/**
 * Kanoniczne parametry DAYTRADER — ostatnie słowo (nadpisuje sprzeczności)
 */
(function (global) {
  var DT = {
    minStrength: 3,
    minScore: 55,
    scoreConfluence: 4,
    atrSlMult: 1.2,
    tpR: 1.6,
    beR: 0.8,
    partialR: 1.0,
    coolBars: 4,
    minHold: 2,
    maxTrades: 6,
    maxPos: 2,
    timeStop: 24,
    newsPadMin: 10,
    requireTrend: false,
    autoSec: 120
  };

  function forcePRO() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (!P) return;
    P.minStrengthOpen = DT.minStrength;
    P.requireTrend = false;
    P.atrSlMult = DT.atrSlMult;
    P.tpR = DT.tpR;
    P.beR = DT.beR;
    P.partialR = DT.partialR;
    P.coolBars = DT.coolBars;
    P.minHoldBars = DT.minHold;
    P.maxDayTrades = DT.maxTrades;
    P.newsPadMin = DT.newsPadMin;
  }

  function forceCFG() {
    var C = global.CFG;
    if (!C) return;
    C.minHold = DT.minHold;
    C.timeStop = DT.timeStop;
    C.maxTrades = DT.maxTrades;
    C.maxPos = DT.maxPos;
    if (!C.autoSec || C.autoSec > 180) C.autoSec = DT.autoSec;
    if (C.slip == null) C.slip = 0.03;
  }

  function forceAssistant() {
    var C = global.CFG;
    if (C && C.maxTrades < DT.maxTrades) C.maxTrades = DT.maxTrades;
  }

  function boot() {
    forcePRO();
    forceCFG();
    forceAssistant();
    setInterval(function () {
      forcePRO();
      forceCFG();
      forceAssistant();
    }, 2500);
  }

  global.BTX_DT_CANON = DT;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
