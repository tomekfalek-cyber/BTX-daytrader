/**
 * BTX CANON — jedyne zrodlo prawdy parametrow (PRO daytrade / XTB paper).
 * Laduj wcześnie. Inne moduly maja czytac global.BTX_CANON / CFG.
 */
(function (global) {
  'use strict';
  if (global.__BTX_CANON__) return;
  global.__BTX_CANON__ = true;

  var CANON = {
    riskPct: 0.35,
    maxPos: 2,
    maxDayTrades: 6,
    dailyLossPct: 1.25,
    maxConsecLoss: 3,
    minStrengthOpen: 3,
    coolBars: 1,
    minHoldBars: 4,
    minHoldMin: 6,
    timeStopBars: 24,
    tpR: 2.0,
    beR: 1.0,
    partialR: 1.0,
    partialFrac: 0.5,
    atrSlMult: 1.2,
    minNetRR: 1.05,
    requireTrend: false,
    allowShort: true,
    targetTradesPerDay: 2,
    fxLev: 10,
    eqLev: 1,
    autoSec: 180,
    version: 'CANON-2026-11'
  };

  function apply() {
    global.BTX_CANON = CANON;
    global.CFG = global.CFG || {};
    var C = global.CFG;
    C.risk = CANON.riskPct;
    C.maxPos = CANON.maxPos;
    C.maxTrades = CANON.maxDayTrades;
    C.dailyLoss = CANON.dailyLossPct;
    C.maxConsec = CANON.maxConsecLoss;
    C.minHold = CANON.minHoldBars;
    C.minHoldMin = CANON.minHoldMin;
    C.timeStop = CANON.timeStopBars;
    C.autoSec = C.autoSec || CANON.autoSec;
    C.fxLev = C.fxLev || CANON.fxLev;
    C.eqLev = C.eqLev != null ? C.eqLev : CANON.eqLev;
    C.allowShort = CANON.allowShort;
    try {
      if (global.BTX_STRATEGY_PRO) {
        var P = global.BTX_STRATEGY_PRO;
        P.riskPct = CANON.riskPct;
        P.maxPos = CANON.maxPos;
        P.maxDayTrades = CANON.maxDayTrades;
        P.minStrengthOpen = CANON.minStrengthOpen;
        P.coolBars = CANON.coolBars;
        P.minHoldBars = CANON.minHoldBars;
        P.timeStopBars = CANON.timeStopBars;
        P.tpR = CANON.tpR;
        P.beR = CANON.beR;
        P.partialR = CANON.partialR;
        P.partialFrac = CANON.partialFrac;
        P.atrSlMult = CANON.atrSlMult;
        P.minNetRR = CANON.minNetRR;
        P.requireTrend = CANON.requireTrend;
        P.allowShort = CANON.allowShort;
      }
    } catch (e) {}
  }

  apply();
  setInterval(apply, 15000);
  global.BTX_CANON_APPLY = apply;
})(typeof window !== 'undefined' ? window : globalThis);
