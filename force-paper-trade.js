/**
 * FORCE PAPER TRADE — omija ciche blokady openPos (q<1, blocked, dataGate).
 */
(function (global) {
  'use strict';
  if (global.__BTX_FORCE_PAPER__) return;
  global.__BTX_FORCE_PAPER__ = true;

  function log(msg, k) {
    try { if (typeof global.log === 'function') global.log(msg, k || 'g'); } catch (e) {}
    try { if (global.toast) global.toast(msg, k === 'r' ? 'err' : 'ok'); } catch (e2) {}
    try { console.log('[BTX-FORCE]', msg); } catch (e3) {}
  }

  function ensureState() {
    var ST = global.ST, CFG = global.CFG;
    if (!ST || !CFG) return null;
    ST.blocked = false;
    ST.pos = ST.pos || {};
    ST.series = ST.series || {};
    ST.cool = ST.cool || {};
    ST.closed = ST.closed || [];
    if (!(ST.equity > 0)) ST.equity = CFG.capital || 10000;
    if (!(ST.cash > 0)) ST.cash = ST.equity;
    if (!(ST.dayStart > 0)) ST.dayStart = ST.equity;
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
    } catch (e) {}
    return { ST: ST, CFG: CFG };
  }

  function lastPrice(sym) {
    var ST = global.ST;
    var a = ST && ST.series && ST.series[sym];
    if (a && a.length) return +a[a.length - 1].c;
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return +list[i].b || 100;
    return 100;
  }

  function paperOpen(g) {
    var st = ensureState();
    if (!st || !g) return false;
    var ST = st.ST, CFG = st.CFG;
    if (g.side !== 'LONG' && g.side !== 'SHORT') return false;
    if (ST.pos[g.sym]) return false;
    if (Object.keys(ST.pos).length >= (CFG.maxPos || 3)) return false;
    if ((ST.dayTrades || 0) >= (CFG.maxTrades || 10)) return false;

    var price = +g.price || lastPrice(g.sym);
    if (!(price > 0)) price = 100;
    var atr = +g.atr || price * 0.004;
    var sd = Math.max(price * 0.001, atr * 1.2);
    var riskPct = (CFG.risk > 0 ? CFG.risk : 0.5) / 100;
    var riskAmt = ST.equity * riskPct;
    var q = Math.max(1, Math.floor(riskAmt / sd));
    var maxNotional = ST.equity * 0.3;
    if (q * price > maxNotional) q = Math.max(1, Math.floor(maxNotional / price));

    var stop = g.side === 'LONG' ? price - sd : price + sd;
    var tgt = g.side === 'LONG' ? price + 2.2 * sd : price - 2.2 * sd;
    var margin = Math.min(ST.cash * 0.5, riskAmt * 1.2);
    if (margin > ST.cash) margin = Math.max(1, ST.cash * 0.2);

    ST.dayTrades = (ST.dayTrades || 0) + 1;
    ST.pos[g.sym] = {
      sym: g.sym,
      side: g.side,
      qty: q,
      entry: price,
      stop: stop,
      target: tgt,
      why: (g.why || 'paper-force') + ' [FORCE]',
      bars: 0,
      risk0: sd,
      be: false,
      at: new Date().toLocaleTimeString('pl-PL'),
      openedAt: Date.now(),
      margin: margin,
      riskAmt: riskAmt,
      paper: true
    };
    ST.cash -= margin;
    log('OTWARCIE PAPER ' + g.side + ' ' + g.sym + ' x' + q + ' @ ' + price.toFixed(2) + ' | SL ' + stop.toFixed(2) + ' | TP ' + tgt.toFixed(2), 'g');
    try {
      if (typeof global.render === 'function') global.render();
      if (typeof global.save === 'function') global.save();
    } catch (e) {}
    return true;
  }

  function pickSignal() {
    var ST = global.ST;
    if (!ST) return null;
    var sig = (ST.sig || []).filter(function (g) {
      return g && (g.side === 'LONG' || g.side !== 'WAIT' && (g.side === 'LONG' || g.side === 'SHORT'));
    });
    sig = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    sig.sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    if (sig.length) return sig[0];

    var list = global.SYMBOLS || [];
    var best = null, bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var a = ST.series[m.s];
      if (!a || a.length < 30) {
        if (typeof global.initSeries === 'function') {
          try { ST.series[m.s] = global.initSeries(m, 120); a = ST.series[m.s]; } catch (e) {}
        }
      }
      if (!a || a.length < 25) continue;
      var c0 = a[a.length - 1].c, c1 = a[a.length - 6].c, c2 = a[a.length - 12].c;
      if (!(c0 > 0 && c1 > 0)) continue;
      var mom = (c0 - c1) / c1;
      var mom2 = (c1 - c2) / (c2 || c1);
      var score = Math.abs(mom) * 100 + Math.abs(mom2) * 40;
      var side = mom > 0.0008 ? 'LONG' : (mom < -0.0008 ? 'SHORT' : null);
      if (!side) continue;
      if (score > bestScore) {
        bestScore = score;
        best = {
          sym: m.s,
          side: side,
          strength: Math.min(5, 2 + Math.floor(score / 3)),
          price: c0,
          atr: Math.abs(c0 - c1) || c0 * 0.003,
          why: 'momentum paper ' + (mom * 100).toFixed(2) + '%'
        };
      }
    }
    return best;
  }

  function tryForce() {
    var st = ensureState();
    if (!st) return;
    var ST = st.ST;
    if (Object.keys(ST.pos).length > 0) return;

    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }

    var g = pickSignal();
    if (!g) {
      var m0 = (global.SYMBOLS || [])[0];
      if (!m0) return;
      g = {
        sym: m0.s,
        side: 'LONG',
        strength: 2,
        price: lastPrice(m0.s),
        atr: lastPrice(m0.s) * 0.004,
        why: 'bootstrap paper'
      };
    }
    paperOpen(g);
  }

  function patchOpenPos() {
    var prev = global.openPos;
    global.openPos = function (g) {
      ensureState();
      var before = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      try {
        if (typeof prev === 'function' && !prev.__forcePaper) prev.apply(this, arguments);
      } catch (e) {}
      var after = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      if (after > before) return;
      if (g && (g.side === 'LONG' || g.side === 'SHORT')) paperOpen(g);
    };
    global.openPos.__forcePaper = true;
  }

  function ensureBtn() {
    var pane = document.getElementById('pane-desk');
    if (!pane || document.getElementById('btx-force-open-btn')) return;
    var d = document.createElement('div');
    d.id = 'btx-force-open-wrap';
    d.style.cssText = 'margin:12px 0;padding:14px;border-radius:12px;border:2px solid #12c48b;background:rgba(18,196,139,.12);';
    d.innerHTML = '<b style="color:#6ee7b7">Paper daytrader — wymuszenie</b>' +
      '<div style="font-size:12px;color:#cbd5e1;margin:6px 0 10px">Przycisk otwiera pozycję paper (sizing od ryzyka).</div>' +
      '<button type="button" id="btx-force-open-btn" style="cursor:pointer;padding:10px 14px;border:0;border-radius:8px;background:#12c48b;color:#062;font-weight:800">Otwórz pozycję paper TERAZ</button>';
    pane.insertBefore(d, pane.firstChild);
    document.getElementById('btx-force-open-btn').onclick = function () {
      tryForce();
      var n = Object.keys((global.ST && global.ST.pos) || {}).length;
      log(n ? ('Pozycje paper: ' + n) : 'Brak SYMBOLS/ST', n ? 'g' : 'r');
    };
  }

  function boot() {
    ensureState();
    patchOpenPos();
    ensureBtn();
    setTimeout(function () { patchOpenPos(); tryForce(); }, 3000);
    setTimeout(tryForce, 10000);
    setInterval(function () {
      ensureState();
      patchOpenPos();
      ensureBtn();
      var ST = global.ST;
      if (ST && Object.keys(ST.pos || {}).length === 0) tryForce();
    }, 120000);
  }

  global.BTX_FORCE_PAPER = { open: paperOpen, tryForce: tryForce };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
