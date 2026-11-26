/**
 * BTX Edge Core — ostre filtry jak u daytradera z dyscyplina.
 * To NIE jest gwarancja zysku. To odcinanie slabych wejsc:
 * 1) reżim (kierunek z ostatnich swiec)
 * 2) RVOL / impuls
 * 3) koszt vs dystans SL
 * 4) anty-chop (zbyt niska zmiennosc = skip)
 * 5) anty-event (zbyt wysoka zmiennosc = skip)
 * 6) tylko z biasem sesji i grade A/A+
 */
(function (global) {
  'use strict';
  if (global.__BTX_EDGE_CORE__) return;
  global.__BTX_EDGE_CORE__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  function barsOf(sym) {
    try {
      if (global.ST && global.ST.series && global.ST.series[sym]) return global.ST.series[sym];
    } catch (e) {}
    return null;
  }

  function lastN(sym, n) {
    var a = barsOf(sym);
    if (!a || a.length < n) return null;
    return a.slice(a.length - n);
  }

  function atrApprox(bars, n) {
    if (!bars || bars.length < n + 1) return null;
    var s = 0, i;
    for (i = bars.length - n; i < bars.length; i++) {
      var x = bars[i], pc = bars[i - 1].c;
      s += Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc));
    }
    return s / n;
  }

  function rvolApprox(bars) {
    if (!bars || bars.length < 20) return 1;
    var i, sum = 0, n = 0;
    for (i = bars.length - 20; i < bars.length - 1; i++) {
      sum += bars[i].v || 1; n++;
    }
    var avg = n ? sum / n : 1;
    var last = bars[bars.length - 1].v || 1;
    return avg > 0 ? last / avg : 1;
  }

  function regime(sym) {
    var bars = lastN(sym, 24);
    if (!bars || bars.length < 12) return 'NA';
    var a = bars[0].c, b = bars[bars.length - 1].c;
    var ch = (b - a) / (a || 1);
    if (ch > 0.0025) return 'UP';
    if (ch < -0.0025) return 'DOWN';
    return 'CHOP';
  }

  function costOk(g) {
    if (!g || !(g.price > 0)) return { ok: false, why: 'brak ceny' };
    var atr = g.atr || g.price * 0.004;
    var slDist = atr * 1.2;
    var rt = 0.001;
    try {
      if (global.BTX_COST && global.BTX_COST.roundTripCostPct) {
        var mkt = 'US';
        var list = global.SYMBOLS || [];
        for (var i = 0; i < list.length; i++) if (list[i].s === g.sym) { mkt = list[i].mkt || 'US'; break; }
        rt = global.BTX_COST.roundTripCostPct(mkt) || rt;
      }
    } catch (e) {}
    // koszt rundy nie moze zjadac > 35% drogi do 1R
    if (g.price * rt > slDist * 0.35) return { ok: false, why: 'koszt za duzy vs SL (edge ujemny)' };
    return { ok: true };
  }

  function edgeGate(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return { ok: false, why: 'brak kierunku' };

    // sila minimum 4 pod auto (twardsze niz 2)
    if ((g.strength || 0) < 4) return { ok: false, why: 'sila < 4 — za slaby setup' };

    var bars = lastN(g.sym, 30);
    if (!bars) return { ok: false, why: 'brak serii swiec' };

    var reg = regime(g.sym);
    if (reg === 'CHOP') return { ok: false, why: 'rynek CHOP — bez wejscia' };
    if (g.side === 'LONG' && reg === 'DOWN') return { ok: false, why: 'LONG przeciw reżimowi DOWN' };
    if (g.side === 'SHORT' && reg === 'UP') return { ok: false, why: 'SHORT przeciw reżimowi UP' };

    var rv = rvolApprox(bars);
    if (rv < 0.85) return { ok: false, why: 'RVOL niski (' + rv.toFixed(2) + ') — brak impulsu' };

    var atr = atrApprox(bars, 14) || g.atr || g.price * 0.004;
    var px = g.price || bars[bars.length - 1].c;
    var atrPct = atr / (px || 1);
    if (atrPct < 0.0008) return { ok: false, why: 'ATR za niski — szum, nie daytrade' };
    if (atrPct > 0.025) return { ok: false, why: 'ATR za wysoki — ryzyko eventu/luki' };

    var c = costOk(g);
    if (!c.ok) return c;

    // elite bias juz istnieje — tu dodatkowo
    try {
      if (global.BTX_ELITE && global.BTX_ELITE.sessionBias) {
        var b = global.BTX_ELITE.sessionBias();
        if (b === 'BULL' && g.side === 'SHORT') return { ok: false, why: 'bias sesji BULL — bez SHORT' };
        if (b === 'BEAR' && g.side === 'LONG') return { ok: false, why: 'bias sesji BEAR — bez LONG' };
      }
    } catch (e2) {}

    return { ok: true, why: 'EDGE OK reg=' + reg + ' RVOL=' + rv.toFixed(2) };
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function') return;
    // jesli singleton zamrozil set, uzyj BTX_ENGINE
    var current = global.openPos;
    if (current.__edgeCore) return;

    function wrapped(g) {
      var gate = edgeGate(g);
      if (!gate.ok) {
        log('EDGE SKIP ' + (g && g.sym) + ' — ' + gate.why, 'i');
        return null;
      }
      log('EDGE PASS ' + g.sym + ' ' + g.side + ' — ' + gate.why, 'g');
      return current.apply(global, arguments);
    }
    wrapped.__edgeCore = true;

    // proba nadpisania; singleton moze zablokowac — wtedy patchamy BTX_ENGINE
    try {
      var desc = Object.getOwnPropertyDescriptor(global, 'openPos');
      if (desc && desc.set && global.BTX_ENGINE && global.BTX_ENGINE.rawOpen) {
        // owijnij rawOpen w engine
        var raw = global.BTX_ENGINE.rawOpen;
        if (!raw.__edgeCore) {
          global.BTX_ENGINE.rawOpen = function (g) {
            var gate = edgeGate(g);
            if (!gate.ok) { log('EDGE SKIP ' + (g && g.sym) + ' — ' + gate.why, 'i'); return null; }
            log('EDGE PASS ' + g.sym + ' ' + g.side + ' — ' + gate.why, 'g');
            return raw.apply(global, arguments);
          };
          global.BTX_ENGINE.rawOpen.__edgeCore = true;
          // przebuduj openPos unified
          var rawClose = global.BTX_ENGINE.rawClose;
          var openPosUnified = function (g) {
            var gate2 = edgeGate(g);
            if (!gate2.ok) { log('EDGE SKIP ' + (g && g.sym) + ' — ' + gate2.why, 'i'); return null; }
            if (global.BTX_ELITE && global.BTX_ELITE.canAutoOpen) {
              var e = global.BTX_ELITE.canAutoOpen(g);
              if (!e.ok) { log('SKIP OPEN ' + g.sym + ' — ' + e.why, 'i'); return null; }
            }
            return global.BTX_ENGINE.rawOpen.apply(global, arguments);
          };
          try {
            Object.defineProperty(global, 'openPos', {
              configurable: true, enumerable: true,
              get: function () { return openPosUnified; },
              set: function () {}
            });
          } catch (e3) { global.openPos = openPosUnified; }
          log('EDGE wpięty w engine singleton', 'g');
        }
        return;
      }
      global.openPos = wrapped;
      log('EDGE owija openPos', 'g');
    } catch (e) {
      log('EDGE: nie udalo sie podpiac openPos', 'r');
    }
  }

  // entry-engine skip reason
  var prevSkip = null;
  function patchSkip() {
    if (!global.BTX_ENTRY || !global.BTX_ENTRY.skipReason) return;
    if (global.BTX_ENTRY.skipReason.__edge) return;
    prevSkip = global.BTX_ENTRY.skipReason;
    global.BTX_ENTRY.skipReason = function (g) {
      var a = prevSkip(g);
      if (a) return a;
      var e = edgeGate(g);
      if (!e.ok) return e.why;
      return '';
    };
    global.BTX_ENTRY.skipReason.__edge = true;
  }

  function panel() {
    var el = document.getElementById('btx-edge-panel');
    var desk = document.getElementById('pane-desk');
    if (!desk) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-edge-panel';
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(96,165,250,.4);background:rgba(15,23,42,.7);font-size:12.5px;color:#bfdbfe;line-height:1.45';
      var host = document.getElementById('btx-elite-panel') || document.getElementById('btx-skip-panel');
      if (host && host.parentNode) host.after(el); else desk.appendChild(el);
    }
    el.innerHTML = '<b style="color:#dbeafe">EDGE CORE</b> — mniej trade’ów, wyższa jakość: reżim · RVOL · koszt/SL · ATR · bias · siła≥4<br>' +
      '<span style="color:#93c5fd">To filtr jakości, nie obietnica zysku. Przewagę potwierdza tylko backtest vs RANDOM (Twelve 5m).</span>';
  }

  function boot() {
    patchOpen();
    patchSkip();
    panel();
    setInterval(function () { patchOpen(); patchSkip(); panel(); }, 5000);
  }

  global.BTX_EDGE = { gate: edgeGate, regime: regime };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 2800); });
  else setTimeout(boot, 2800);
})(typeof window !== 'undefined' ? window : globalThis);
