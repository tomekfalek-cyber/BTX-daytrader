/**
 * Dyscyplina trzymania + ostrzezenia przed zamknieciem.
 * Problem: kazdy cykl = +1 "swieca" → przy Auto pozycja znikala w <1 min.
 * Rozwiazanie: minimalny czas zegarowy (domyslnie 10 min) zanim wolno zamknac
 * z powodu TP / time-stop / BE-trail; SL nadal natychmiast.
 */
(function (global) {
  'use strict';
  if (global.__BTX_HOLD_DISC__) return;
  global.__BTX_HOLD_DISC__ = true;

  var MIN_HOLD_MS = 6 * 60 * 1000; // 6 min — daytrade, nie swing // 10 min — realny daytrade, czas na XTB
  var WARN_MS = 2 * 60 * 1000;      // ostrzezenie 2 min przed min. hold / przed time-stop

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  function minHoldMs() {
    try {
      var v = localStorage.getItem('BTX_MIN_HOLD_MIN');
      if (v != null && +v > 0) return Math.max(3, +v) * 60 * 1000;
    } catch (e) {}
    var CFG = global.CFG || {};
    // minuty z CFG.minHoldMin jesli ustawione
    if (CFG.minHoldMin > 0) return Math.max(3, +CFG.minHoldMin) * 60 * 1000;
    return MIN_HOLD_MS;
  }

  function openTs(p) {
    if (p.openTs) return +p.openTs;
    if (p.ts) return +p.ts;
    // fallback: oszacuj z bars * autoSec
    var sec = (global.CFG && global.CFG.autoSec) || 120;
    var bars = p.bars || 0;
    var approx = Date.now() - bars * sec * 1000;
    p.openTs = approx;
    return approx;
  }

  function heldMs(p) {
    return Date.now() - openTs(p);
  }

  function isHardStop(why) {
    var w = String(why || '').toLowerCase();
    return /stop|sl\b|stop-loss|eod|flat koniec|kill|panic|force/.test(w) && !/time-stop|be/.test(w);
  }

  function isSoftExit(why) {
    var w = String(why || '').toLowerCase();
    return /time-stop|target|tp\b|be|trail|partial|flat poza/.test(w);
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__holdTs) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      var ST = global.ST;
      var before = ST && ST.pos ? Object.keys(ST.pos) : [];
      var r = prev.apply(this, arguments);
      try {
        if (ST && ST.pos && g && g.sym && ST.pos[g.sym]) {
          ST.pos[g.sym].openTs = Date.now();
          ST.pos[g.sym].holdWarn = false;
        }
      } catch (e) {}
      return r;
    };
    global.openPos.__holdTs = true;
  }

  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__holdDisc) return;
    var prev = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      if (p) {
        var held = heldMs(p);
        var need = minHoldMs();
        // SL / twarde zamkniecie — zawsze
        if (!isHardStop(why) && held < need) {
          var left = Math.ceil((need - held) / 60000);
          if (!p.holdBlockLog || Date.now() - p.holdBlockLog > 60000) {
            log('TRZYMAM ' + sym + ' jeszcze ~' + left + ' min (min. hold) — powód odłożony: ' + (why || ''), 'i');
            p.holdBlockLog = Date.now();
          }
          p.pendingExit = { why: why, px: px, ts: Date.now() };
          return null; // nie zamykaj jeszcze
        }
      }
      return prev.apply(this, arguments);
    };
    global.closePos.__holdDisc = true;
  }

  /** Ostrzezenia na pulpicie */
  function warnings() {
    var ST = global.ST;
    if (!ST || !ST.pos) return [];
    var need = minHoldMs();
    var out = [];
    Object.keys(ST.pos).forEach(function (sym) {
      var p = ST.pos[sym];
      if (!p) return;
      var held = heldMs(p);
      var leftHold = need - held;
      var bars = p.bars || 0;
      var tStop = (global.CFG && global.CFG.timeStop) || 24;

      // blisko min hold — za chwile wolno zamykać miękkie
      if (leftHold > 0 && leftHold <= WARN_MS) {
        out.push({
          sym: sym,
          level: 'info',
          msg: sym + ': min. trzymanie kończy się za ~' + Math.ceil(leftHold / 60000) + ' min — dopiero potem TP/time-stop'
        });
      }

      // pending exit waiting
      if (p.pendingExit && held < need) {
        out.push({
          sym: sym,
          level: 'warn',
          msg: sym + ': bot CHCE zamknąć (' + p.pendingExit.why + '), ale czeka na min. hold (~' +
            Math.ceil((need - held) / 60000) + ' min). Przygotuj XTB.'
        });
      }

      // time-stop approaching after min hold
      if (held >= need && bars >= tStop - 3 && bars < tStop) {
        out.push({
          sym: sym,
          level: 'warn',
          msg: sym + ': zbliża się TIME-STOP (' + bars + '/' + tStop + ' świec) — rozważ ręczne domknięcie na XTB'
        });
      }

      // near TP: price within 30% of remaining to target
      try {
        var px = null;
        if (typeof global.last === 'function' && global.last(sym)) px = global.last(sym).c;
        if (px != null && p.target != null && p.entry != null) {
          var risk = Math.abs(p.entry - (p.stop0 || p.stop || p.entry)) || Math.abs(p.entry - p.target) / 2;
          var toTp = p.side === 'LONG' ? (p.target - px) : (px - p.target);
          var span = Math.abs(p.target - p.entry) || 1;
          if (toTp > 0 && toTp / span <= 0.25) {
            out.push({
              sym: sym,
              level: 'hot',
              msg: sym + ': blisko TP — bot może domknąć wkrótce. Sprawdź XTB.'
            });
          }
        }
      } catch (e) {}

      // SL threatened
      try {
        var px2 = null;
        if (typeof global.last === 'function' && global.last(sym)) px2 = global.last(sym).c;
        if (px2 != null && p.stop != null) {
          var toSl = p.side === 'LONG' ? (px2 - p.stop) : (p.stop - px2);
          var risk2 = Math.abs(p.entry - p.stop) || 1;
          if (toSl > 0 && toSl / risk2 <= 0.35) {
            out.push({
              sym: sym,
              level: 'hot',
              msg: sym + ': cena blisko SL — możliwe szybkie zamknięcie (SL nie czeka na min. hold)'
            });
          }
        }
      } catch (e2) {}
    });
    return out;
  }

  function renderWarn() {
    var list = warnings();
    var el = document.getElementById('btx-hold-warn');
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    if (!list.length) {
      if (el) el.style.display = 'none';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-hold-warn';
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:2px solid #f59e0b;background:rgba(120,53,15,.45);font-size:13px;color:#fde68a;line-height:1.45';
      var radar = document.getElementById('btx-skip-panel');
      if (radar && radar.parentNode) radar.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild.nextSibling);
      else pane.appendChild(el);
    }
    el.style.display = 'block';
    var html = '<b style="color:#fef3c7">⚠ Ostrzeżenia pozycji (zanim bot zamknie)</b>';
    list.forEach(function (w) {
      var col = w.level === 'hot' ? '#fca5a5' : (w.level === 'warn' ? '#fcd34d' : '#e2e8f0');
      html += '<div style="margin-top:6px;color:' + col + '">• ' + w.msg + '</div>';
    });
    html += '<div style="margin-top:8px;font-size:11px;color:#94a3b8">Min. trzymanie: ' +
      Math.round(minHoldMs() / 60000) + ' min (zegar). SL działa od razu. Ustawienia: localStorage BTX_MIN_HOLD_MIN (minuty).</div>';
    el.innerHTML = html;
  }

  function tick() {
    patchOpen();
    patchClose();
    // wykonaj odlozone wyjscie po min hold
    var ST = global.ST;
    if (ST && ST.pos) {
      var need = minHoldMs();
      Object.keys(ST.pos).forEach(function (sym) {
        var p = ST.pos[sym];
        if (!p || !p.pendingExit) return;
        if (heldMs(p) >= need && typeof global.closePos === 'function') {
          var pe = p.pendingExit;
          p.pendingExit = null;
          log('DOMYKAM po min. hold: ' + sym + ' — ' + pe.why, 'i');
          // hard call through previous? closePos wrapper will allow now
          global.closePos(sym, pe.why, pe.px);
        }
      });
    }
    renderWarn();
  }

  function boot() {
    // kanon minHold bars
    try {
      if (global.CFG) global.CFG.minHold = Math.max(global.CFG.minHold || 0, 8);
    } catch (e) {}
    tick();
    setInterval(tick, 3000);
  }

  global.BTX_HOLD = { minHoldMs: minHoldMs, warnings: warnings };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 700); });
  else setTimeout(boot, 700);
})(typeof window !== 'undefined' ? window : globalThis);
