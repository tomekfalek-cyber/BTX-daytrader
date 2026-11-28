/**
 * Ustaw capital paper z profilu APEX gdy ST nadal na 100000 domyslnych.
 */
(function (global) {
  'use strict';
  if (global.__BTX_CAP_BOOT__) return;
  global.__BTX_CAP_BOOT__ = true;

  function bootOnce() {
    var ST = global.ST, CFG = global.CFG;
    if (!ST || !CFG) return;
    var target = CFG.capital;
    if (!(target > 0)) target = 6800;
    CFG.ccy = CFG.ccy || 'USD';
    CFG.risk = 0.35;
    CFG.maxPos = 2;
    CFG.timeStop = CFG.timeStop || 24;
    CFG.minHold = CFG.minHold || 2;
    CFG.confirm = CFG.confirm || 1;
    // tylko gdy wygląda na domyslne duże saldo bez historii
    var noTrades = !(ST.closed && ST.closed.length) && !(ST.pos && Object.keys(ST.pos).length);
    if (noTrades && ST.equity >= 50000 && target < 50000) {
      ST.equity = target;
      ST.cash = target;
      ST.dayStart = target;
      if (global.log) global.log('Paper capital ustawiony na ' + target + ' ' + (CFG.ccy || 'USD'), 'i');
    }
  }

  function boot() {
    bootOnce();
    setTimeout(bootOnce, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
