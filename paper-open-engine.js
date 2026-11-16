/**
 * Progi PRO daytrade — bez forsowania pozycji.
 */
(function (global) {
  'use strict';
  if (global.__BTX_PAPER_OPEN__) return;
  global.__BTX_PAPER_OPEN__ = true;

  function apply() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (P) {
      P.scoreMin = 4;
      P.primeExtra = 0;
      P.minRvol = 0.5;
      P.minStrengthOpen = 3;
      P.minNetRR = 1.25;
      P.riskPct = 0.35;
      P.maxPos = 2;
      P.maxDayTrades = 4;
      P.dailyLossPct = 1.0;
      P.maxConsecLoss = 2;
      P.strictCore = true;
    }
    if (global.CFG) {
      global.CFG.risk = 0.35;
      global.CFG.maxTrades = 4;
      global.CFG.maxPos = 2;
      global.CFG.dailyLoss = 1.0;
      global.CFG.maxConsec = 2;
    }
    try { localStorage.setItem('BTX_ALLOW_STOP_DAY', '1'); } catch (e) {}
  }

  function boot() {
    apply();
    setInterval(apply, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
