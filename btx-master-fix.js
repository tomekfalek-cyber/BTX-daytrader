/**
 * BTX Master — profesjonalny daytrading (dyscyplina ryzyka).
 * BEZ forsowania pozycji.
 */
(function (global) {
  'use strict';
  if (global.__BTX_MASTER_FIX__) return;
  global.__BTX_MASTER_FIX__ = true;

  function applyProRisk() {
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '1');
      if (localStorage.getItem('BTX_TRADE_MODE') !== 'observe') {
        localStorage.setItem('BTX_TRADE_MODE', 'trade');
      }
    } catch (e) {}

    try {
      var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
      if (P) {
        P.riskPct = 0.35;
        P.scoreMin = 4;
        P.primeExtra = 0;
        P.minRvol = 0.5;
        P.minStrengthOpen = 3;
        P.minNetRR = 1.25;
        P.maxPos = 2;
        P.maxDayTrades = 4;
        P.dailyLossPct = 1.0;
        P.maxConsecLoss = 2;
        P.requireTrend = false;
        P.strictCore = true;
        P.coolBars = 6;
        P.minHoldBars = 2;
        P.tpR = 2.0;
        P.partialR = 1.0;
      }
    } catch (e2) {}

    try {
      if (global.CFG) {
        global.CFG.risk = 0.35;
        global.CFG.maxTrades = 4;
        global.CFG.maxPos = 2;
        global.CFG.dailyLoss = 1.0;
        global.CFG.maxConsec = 2;
        global.CFG.minHold = 2;
      }
    } catch (e3) {}

    try {
      var ST = global.ST, CFG = global.CFG;
      if (ST && CFG && ST.dayStart > 0) {
        var eq = ST.equity != null ? ST.equity : ST.dayStart;
        var dd = (eq - ST.dayStart) / ST.dayStart;
        if (dd <= -0.01) ST.blocked = true;
        if ((ST.dayTrades || 0) >= 4) ST.blocked = true;
        if ((ST.consecLoss || 0) >= 2) ST.blocked = true;
      }
    } catch (e4) {}
  }

  function patchOpenGuard() {
    if (typeof global.openPos !== 'function' || global.openPos.__proRisk) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      applyProRisk();
      var ST = global.ST, CFG = global.CFG || {};
      if (!ST || !g) return;
      if (ST.blocked) {
        if (global.log) global.log('PRO: blokada dnia — brak nowych wejść', 'r');
        if (global.toast) global.toast('Limit dnia — brak nowych wejść', 'err');
        return;
      }
      if ((g.strength || 0) < 3) {
        if (global.log) global.log('PRO: odrzut siła < 3 (' + g.sym + ')', 'mut');
        return;
      }
      if (Object.keys(ST.pos || {}).length >= (CFG.maxPos || 2)) return;
      if ((ST.dayTrades || 0) >= (CFG.maxTrades || 4)) {
        ST.blocked = true;
        return;
      }
      return prev.apply(this, arguments);
    };
    global.openPos.__proRisk = true;
  }

  function boot() {
    applyProRisk();
    patchOpenGuard();
    setInterval(function () {
      applyProRisk();
      patchOpenGuard();
    }, 5000);
  }

  global.BTX_MASTER = { applyProRisk: applyProRisk };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
