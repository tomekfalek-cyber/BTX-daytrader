/**
 * BTX Master Fix — ostatnie słowo nad konfliktami modułów.
 */
(function (global) {
  'use strict';
  if (global.__BTX_MASTER_FIX__) return;
  global.__BTX_MASTER_FIX__ = true;

  function bootFlags() {
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
    } catch (e) {}
    try {
      if (global.ST) { global.ST.blocked = false; global.ST.stopForDay = false; }
    } catch (e2) {}
    try {
      var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
      if (P) {
        P.scoreMin = 2; P.primeExtra = 0; P.minRvol = 0.35;
        P.minStrengthOpen = 2; P.requireTrend = false;
      }
      if (global.CFG) {
        global.CFG.maxTrades = Math.max(global.CFG.maxTrades || 0, 8);
        global.CFG.maxPos = Math.max(global.CFG.maxPos || 0, 2);
      }
    } catch (e3) {}
  }

  function lastPrice(sym) {
    var ST = global.ST;
    var a = ST && ST.series && ST.series[sym];
    if (a && a.length) return +a[a.length - 1].c;
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return +list[i].b || 100;
    return 100;
  }

  function masterOpen(g) {
    bootFlags();
    var ST = global.ST, CFG = global.CFG;
    if (!ST || !CFG || !g) return false;
    if (g.side !== 'LONG' && g.side !== 'SHORT') return false;
    ST.pos = ST.pos || {};
    if (ST.pos[g.sym]) return false;
    if (Object.keys(ST.pos).length >= (CFG.maxPos || 3)) return false;

    var price = +g.price || lastPrice(g.sym);
    if (!(price > 0)) price = 100;
    var atr = +g.atr || price * 0.004;
    var sd = Math.max(price * 0.001, atr * 1.2);
    var riskAmt = (ST.equity || CFG.capital || 10000) * ((CFG.risk > 0 ? CFG.risk : 0.5) / 100);
    var q = Math.max(1, Math.floor(riskAmt / sd));
    var maxN = (ST.equity || 10000) * 0.3;
    if (q * price > maxN) q = Math.max(1, Math.floor(maxN / price));
    var stop = g.side === 'LONG' ? price - sd : price + sd;
    var tgt = g.side === 'LONG' ? price + 2.2 * sd : price - 2.2 * sd;
    var margin = Math.min((ST.cash || riskAmt) * 0.5, riskAmt * 1.2);
    if (!(margin > 0)) margin = riskAmt;

    ST.dayTrades = (ST.dayTrades || 0) + 1;
    ST.pos[g.sym] = {
      sym: g.sym, side: g.side, qty: q, entry: price, stop: stop, target: tgt,
      why: (g.why || '') + ' [MASTER]', bars: 0, risk0: sd, be: false,
      at: new Date().toLocaleTimeString('pl-PL'), openedAt: Date.now(),
      margin: margin, riskAmt: riskAmt, paper: true
    };
    if (ST.cash > margin) ST.cash -= margin;
    try {
      if (typeof global.log === 'function') global.log('OTWARCIE ' + g.side + ' ' + g.sym + ' x' + q + ' @ ' + price.toFixed(2) + ' [MASTER]', 'g');
      if (global.toast) global.toast('OPEN ' + g.side + ' ' + g.sym, 'ok');
      if (typeof global.render === 'function') global.render();
      if (typeof global.save === 'function') global.save();
    } catch (e) {}
    return true;
  }

  function installOpenPos() {
    var prev = global.openPos;
    global.openPos = function (g) {
      bootFlags();
      var before = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      try { if (typeof prev === 'function' && !prev.__masterFix) prev.apply(this, arguments); } catch (e) {}
      var after = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      if (after > before) return;
      if (g && (g.side === 'LONG' || g.side === 'SHORT')) masterOpen(g);
    };
    global.openPos.__masterFix = true;
  }

  function autoTrade() {
    bootFlags();
    installOpenPos();
    var ST = global.ST;
    if (!ST) return;
    if (Object.keys(ST.pos || {}).length > 0) return;
    if (typeof global.cycle === 'function') { try { global.cycle(); } catch (e) {} }
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.tryOpenBest) {
      try { global.BTX_AUTONOMY.tryOpenBest(); } catch (e2) {}
    }
    if (Object.keys(ST.pos || {}).length > 0) return;
    var sig = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    if (sig.length) { masterOpen(sig[0]); return; }
    if (global.BTX_FORCE_PAPER && global.BTX_FORCE_PAPER.tryForce) {
      try { global.BTX_FORCE_PAPER.tryForce(); } catch (e3) {}
    }
  }

  function boot() {
    bootFlags();
    installOpenPos();
    setTimeout(autoTrade, 4000);
    setTimeout(autoTrade, 12000);
    setInterval(function () { bootFlags(); installOpenPos(); autoTrade(); }, 90 * 1000);
  }

  global.BTX_MASTER = { open: masterOpen, autoTrade: autoTrade };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
