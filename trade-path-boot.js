/**
 * Ścieżka PRO daytrade — progi jakości + limity.
 */
(function (global) {
  'use strict';
  if (global.__BTX_TRADE_PATH__) return;
  global.__BTX_TRADE_PATH__ = true;

  function applyPro() {
    try {
      var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
      if (P) {
        P.scoreMin = 4;
        P.primeExtra = 0;
        P.minRvol = 0.5;
        P.minStrengthOpen = 3;
        P.minNetRR = 1.25;
        P.riskPct = 0.35;
        P.strictCore = true;
      }
      if (global.CFG) {
        global.CFG.risk = 0.35;
        global.CFG.maxTrades = 4;
        global.CFG.maxPos = 2;
        global.CFG.dailyLoss = 1.0;
        global.CFG.maxConsec = 2;
      }
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '1');
    } catch (e) {}
  }

  function boot() {
    applyPro();
    setInterval(applyPro, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
