/**
 * 6) Paper bliżej XTB: koszty per rynek + opis jednostek (szt. / lot).
 */
(function (global) {
  'use strict';
  if (global.__BTX_XTB_COST__) return;
  global.__BTX_XTB_COST__ = true;

  var COST = {
    US: { spreadPct: 0.03, slipPct: 0.02, commPct: 0.02 },
    EU: { spreadPct: 0.05, slipPct: 0.03, commPct: 0.03 },
    FX: { spreadPct: 0.01, slipPct: 0.01, commPct: 0.0 },
    PL: { spreadPct: 0.08, slipPct: 0.04, commPct: 0.03 }
  };

  function mktOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].mkt || 'US';
    if (/EUR|USD|XAU|GOLD/.test(sym)) return 'FX';
    if (/ASML|SAP|SIE/.test(sym)) return 'EU';
    return 'US';
  }

  function unitLabel(sym, qty) {
    var m = mktOf(sym);
    if (m === 'FX') {
      var lots = (Number(qty) || 0) / 100000;
      return (Math.round(lots * 100) / 100) + ' lota (FX)';
    }
    return (Number(qty) || 0) + ' szt.';
  }

  function applyFeesToCfg() {
    var CFG = global.CFG;
    if (!CFG) return;
    CFG.fees = CFG.fees || {};
    ['US', 'EU', 'FX', 'PL'].forEach(function (mk) {
      var c = COST[mk];
      CFG.fees[mk] = CFG.fees[mk] || {};
      // nie nadpisuj jesli user ustawil recznie mocno — tylko uzupelnij braki
      if (CFG.fees[mk].spr == null) CFG.fees[mk].spr = c.spreadPct / 100;
      if (CFG.fees[mk].slip == null) CFG.fees[mk].slip = c.slipPct / 100;
      if (CFG.fees[mk].comm == null) CFG.fees[mk].comm = c.commPct / 100;
    });
  }

  function patchPlanCopy() {
    // wzbogac global helper
    global.BTX_XTB_UNITS = { unitLabel: unitLabel, mktOf: mktOf, COST: COST };
  }

  function boot() {
    applyFeesToCfg();
    patchPlanCopy();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(applyFeesToCfg, 'xtb-costs');
    else setInterval(applyFeesToCfg, 10000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();


  /** Poślizg — aktywny (wcześniej pole było martwe). */
  function applySlip(price, side, mkt) {
    var c = COST[mkt] || COST.US;
    var slip = (c.slipPct || 0) / 100;
    if (!(price > 0) || slip <= 0) return price;
    // LONG kupuje drożej, SHORT shortuje taniej (gorszy fill)
    if (side === 'LONG') return price * (1 + slip);
    if (side === 'SHORT') return price * (1 - slip);
    return price;
  }
  function roundTripCostPct(mkt) {
    var c = COST[mkt] || COST.US;
    return ((c.spreadPct || 0) + (c.slipPct || 0) * 2 + (c.commPct || 0) * 2) / 100;
  }
  global.BTX_COST = global.BTX_COST || {};
  global.BTX_COST.applySlip = applySlip;
  global.BTX_COST.roundTripCostPct = roundTripCostPct;
  global.BTX_COST.table = COST;
})(typeof window !== 'undefined' ? window : globalThis);
