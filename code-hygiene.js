/**
 * BTX code-hygiene — jedna hierarchia reguł.
 * 1 dt-config  2 strategy-pro  3 apex  4 autonomy  5 entry-boost  6 guards
 */
(function (global) {
  'use strict';
  if (global.__BTX_HYGIENE__) return;
  global.__BTX_HYGIENE__ = true;

  function pro() { return global.BTX_STRATEGY_PRO || global.BTX_PRO; }
  function cfg() { return global.CFG; }

  function applyApex() {
    var DT = global.BTX_DT && global.BTX_DT.PROFILE;
    if (!DT || !DT.pro) return;
    var P = pro(), C = cfg();
    if (P) Object.keys(DT.pro).forEach(function (k) { P[k] = DT.pro[k]; });
    if (C && DT.cfg) {
      ['risk', 'maxPos', 'maxTrades', 'dailyLoss', 'maxConsec', 'minHold', 'timeStop', 'autoSec', 'allowShort'].forEach(function (k) {
        if (DT.cfg[k] != null) C[k] = DT.cfg[k];
      });
      C.ccy = 'USD';
      C.scan = C.scan || {};
      C.scan.US = true; C.scan.EU = true; C.scan.FX = true;
    }
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      if (localStorage.getItem('BTX_LEARNER_MODE') === 'observe') {
        localStorage.setItem('BTX_LEARNER_MODE', 'trade');
      }
    } catch (e) {}
    try {
      if (global.BTX_LEARNER && global.BTX_LEARNER.modeSet) global.BTX_LEARNER.modeSet('trade');
    } catch (e2) {}
  }

  function patchLearnerOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__hygLearn) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      try {
        var m = localStorage.getItem('BTX_LEARNER_MODE') || localStorage.getItem('BTX_TRADE_MODE');
        if (m === 'observe') localStorage.setItem('BTX_LEARNER_MODE', 'trade');
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    global.openPos.__hygLearn = true;
  }

  function guardBoost() {
    var P = pro();
    if (!P) return;
    if (P.minRvol != null && P.minRvol < 0.45) P.minRvol = 0.5;
    if (P.riskPct != null && P.riskPct > 0.5) P.riskPct = 0.35;
    if (P.maxPos != null && P.maxPos > 2) P.maxPos = 2;
    if (P.tpR != null && P.tpR < 1.5) P.tpR = 2.0;
  }

  function boot() {
    applyApex();
    guardBoost();
    patchLearnerOpen();
    setInterval(function () {
      applyApex();
      guardBoost();
      patchLearnerOpen();
    }, 8000);
  }

  global.BTX_HYGIENE = {
    apply: applyApex,
    hierarchy: ['dt-config', 'strategy-pro', 'apex', 'autonomy', 'entry-boost', 'guards']
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 3000); });
  } else {
    setTimeout(boot, 3000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
