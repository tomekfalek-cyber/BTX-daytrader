/**
 * BTX Account Fix — saldo, kursy, sizing, klucz Twelve.
 */
(function (global) {
  'use strict';
  if (global.__BTX_ACCOUNT_FIX__) return;
  global.__BTX_ACCOUNT_FIX__ = true;

  function patchRateOf() {
    if (typeof global.rateOf !== 'function' || global.rateOf.__acc) return;
    var prev = global.rateOf;
    global.rateOf = function (m) {
      var C = global.CFG || {};
      // Konto w USD: akcje US i pary xxxUSD w jednostkach konta 1:1
      if ((C.ccy || 'USD').toUpperCase() === 'USD') {
        if (!m) return 1;
        if (m.mkt === 'US') return 1;
        if (m.mkt === 'FX' && /USD$/.test(m.s || '')) return 1;
        if (m.mkt === 'EU') return +(C.rates && C.rates.EUR) || 1.08;
        if (m.ccy === 'USD') return 1;
      }
      var r = prev.apply(this, arguments);
      return r > 0 ? r : 1;
    };
    global.rateOf.__acc = true;
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__accCash) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      var ST = global.ST;
      if (!ST || !g) return prev.apply(this, arguments);
      var cashBefore = ST.cash;
      var eqBefore = ST.equity;
      var ret = prev.apply(this, arguments);
      try {
        // jesli pozycja otwarta z margin > cashBefore — cofnij (bezpiecznik)
        var p = ST.pos && ST.pos[g.sym];
        if (p && p.margin != null && p.margin > cashBefore + 1e-6) {
          delete ST.pos[g.sym];
          ST.cash = cashBefore;
          ST.equity = eqBefore;
          ST.dayTrades = Math.max(0, (ST.dayTrades || 1) - 1);
          if (global.log) global.log('ODRZUCONO ' + g.sym + ' — margin ' + p.margin.toFixed(2) + ' > cash ' + cashBefore.toFixed(2), 'r');
          if (global.toast) global.toast('Za duża pozycja vs saldo — odrzucono', 'err');
          return;
        }
        // legacy open bez margin: qty*price nie może > cash
        if (p && p.margin == null && p.qty && p.entry) {
          var cost = p.qty * p.entry * (p.rate || 1);
          if (cost > cashBefore + 1e-6) {
            delete ST.pos[g.sym];
            ST.cash = cashBefore;
            ST.equity = eqBefore;
            ST.dayTrades = Math.max(0, (ST.dayTrades || 1) - 1);
            if (global.log) global.log('ODRZUCONO ' + g.sym + ' — koszt ' + cost.toFixed(2) + ' > cash', 'r');
          }
        }
      } catch (e) {}
      return ret;
    };
    global.openPos.__accCash = true;
  }

  function syncTwelveKey() {
    try {
      var k = '';
      if (global.BTX_LIVE && global.BTX_LIVE.getKey) k = global.BTX_LIVE.getKey() || '';
      if (!k) {
        ['btx_twelve_key', 'BTX_TWELVE_KEY', 'twelve_key'].forEach(function (key) {
          if (k) return;
          try { var v = localStorage.getItem(key); if (v) k = v; } catch (e) {}
        });
      }
      if (k) {
        localStorage.setItem('btx_twelve_key', k);
        if (global.CFG) { global.CFG.tdKey = k; global.CFG.twelveKey = k; global.CFG.provider = 'twelve'; }
        var el = document.getElementById('btx-tdkey-main') || document.getElementById('set-tdkey');
        if (el && !el.value) el.value = k;
      }
    } catch (e2) {}
  }

  function boot() {
    patchRateOf();
    patchOpenPos();
    syncTwelveKey();
    setInterval(function () {
      patchRateOf();
      patchOpenPos();
      syncTwelveKey();
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
