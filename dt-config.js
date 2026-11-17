/**
 * BTX DT-CONFIG — daytrading (konto 25000 PLN paper, US/EU/FX, świece 5 min).
 */
(function (global) {
  'use strict';
  var VERSION = 'dt25k-2026-11-17b';
  var LS_VER = 'BTX_DT_PROFILE_VERSION';
  var LS_OVR = 'BTX_DT_OVERRIDES';

  var PROFILE = {
    capital: 25000,
    pro: {
      riskPct: 0.5,
      maxPos: 2,
      maxDayTrades: 8,
      dailyLossPct: 2.0,
      maxConsecLoss: 3,
      scoreMin: 4,
      primeExtra: 0,
      minStrengthOpen: 3,
      minNetRR: 1.1,
      strictCore: true,
      requireTrend: false,
      allowShort: true,
      tpR: 1.5,
      beR: 1.0,
      partialR: 99,
      partialFrac: 0,
      coolBars: 3,
      minHoldBars: 2,
      timeStopBars: 36,
      stopMinAtr: 1.5,
      stopMaxAtr: 2.5,
      newsPadMin: 7,
      closeBufferMin: 30,
      flatBeforeCloseMin: 10
    },
    newsWindows: [
      { label: 'US dane 14:30 PL', min: 13 * 60 + 30 },
      { label: 'US dane 16:00 PL', min: 15 * 60 }
    ],
    fxSession: { open: 7 * 60, close: 20 * 60, prime: [[7 * 60, 11 * 60], [13 * 60 + 30, 17 * 60]] },
    cfg: {
      risk: 0.5, maxPos: 2, maxTrades: 8, dailyLoss: 2, maxConsec: 3,
      minHold: 2, timeStop: 36, autoSec: 300, allowShort: true,
      fxLev: 30,
      slip: 0.003,
      scan: { US: true, EU: true, PL: false, FX: true },
      rates: { USD: 3.7, JPY: 0.0245, EUR: 4.25 },
      fracStep: 0.01
    },
    fxFees: { comm: 0, conv: 0, spread: 0.012, slip: 0.003 }
  };

  function merge(dst, src) { Object.keys(src || {}).forEach(function (k) { dst[k] = src[k]; }); return dst; }
  function overrides() {
    try { return JSON.parse(global.localStorage.getItem(LS_OVR) || 'null') || {}; } catch (e) { return {}; }
  }

  function applyTo(PRO, CFG, force) {
    var o = overrides();
    if (PRO) {
      merge(PRO, PROFILE.pro);
      PRO.newsWindows = PROFILE.newsWindows.slice();
      if (PRO.sessions) PRO.sessions.FX = merge({}, PROFILE.fxSession);
      merge(PRO, o.pro);
    }
    if (CFG) {
      var c = PROFILE.cfg;
      ['risk', 'maxPos', 'maxTrades', 'dailyLoss', 'maxConsec', 'minHold', 'timeStop', 'autoSec', 'allowShort', 'fxLev'].forEach(function (k) { CFG[k] = c[k]; });
      CFG.scan = merge({ US: true, EU: true, PL: false, FX: true }, c.scan || {});
      if (force || CFG.slip == null || CFG.slip > 0.01) CFG.slip = c.slip;
      if (force || !CFG.rates) CFG.rates = merge({}, c.rates);
      if (!CFG.rates.EUR) CFG.rates.EUR = c.rates.EUR;
      CFG.fracStep = c.fracStep;
      CFG.fees = CFG.fees || {};
      if (force || !CFG.fees.FX) CFG.fees.FX = merge({}, PROFILE.fxFees);
      if (!CFG.fees.US) CFG.fees.US = { comm: 0, conv: 0.5, spread: 0.03, slip: 0.02 };
      if (!CFG.fees.EU) CFG.fees.EU = merge({}, CFG.fees.US);
      merge(CFG, o.cfg);
      // zawsze aktywne rynki handlowe
      CFG.scan.US = true;
      CFG.scan.EU = true;
      CFG.scan.FX = true;
    }
    return { PRO: PRO, CFG: CFG };
  }
  function apply() {
    applyTo(global.BTX_STRATEGY_PRO || global.BTX_PRO, global.CFG);
  }

  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__dtStamp) return;
    var orig = global.closePos;
    global.closePos = function () {
      var ST = global.ST, n0 = ST && ST.closed ? ST.closed.length : 0;
      var r = orig.apply(this, arguments);
      try {
        var c = global.ST && global.ST.closed;
        if (c && c.length > n0 && c[0] && !c[0].t) c[0].t = Date.now();
      } catch (e) {}
      return r;
    };
    Object.keys(orig).forEach(function (k) { try { global.closePos[k] = orig[k]; } catch (e) {} });
    global.closePos.__dtStamp = true;
  }

  function migrate() {
    var ls = global.localStorage;
    if (ls.getItem(LS_VER) === VERSION) return false;
    ['BTX_STOP_DAY', 'BTX_STOP_FOR_DAY', 'BTX_STOPPED', 'BTX_BLACKLIST_DAY'].forEach(function (k) { try { ls.removeItem(k); } catch (e) {} });
    ls.setItem('BTX_TRADE_MODE', 'trade');
    ls.setItem('BTX_ALLOW_STOP_DAY', '0');
    ls.setItem('BTX_AUTONOMY_ON', '1');
    ls.setItem('BTX_SESSION_PROFILE', 'ALL');
    applyTo(global.BTX_STRATEGY_PRO || global.BTX_PRO, global.CFG, true);
    global.CFG.capital = PROFILE.capital;
    if (typeof global.reset === 'function') global.reset();
    if (global.ST) {
      global.ST.feesTot = 0; global.ST.dayTrades = 0; global.ST.consecLoss = 0; global.ST.blocked = false;
      global.ST.dayStart = global.ST.equity;
    }
    try { if (typeof global.save === 'function') global.save(); } catch (e2) {}
    try { if (typeof global.log === 'function') global.log('Profil ' + VERSION + ': paper ' + PROFILE.capital + ' PLN · skan US+EU+FX', 'g'); } catch (e3) {}
    try { if (typeof global.render === 'function') global.render(); } catch (e4) {}
    ls.setItem(LS_VER, VERSION);
    return true;
  }

  function patchRate() {
    if (typeof global.rateOf !== 'function' || global.rateOf.__dtEur) return;
    var orig = global.rateOf;
    global.rateOf = function (m) {
      if (m && m.mkt === 'EU') { var r = (global.CFG && global.CFG.rates) || {}; return +r.EUR || 4.25; }
      return orig.apply(this, arguments);
    };
    Object.keys(orig).forEach(function (k) { try { global.rateOf[k] = orig[k]; } catch (e) {} });
    global.rateOf.__dtEur = true;
  }

  global.BTX_DT = { VERSION: VERSION, PROFILE: PROFILE, applyTo: applyTo, apply: apply, migrate: migrate };
  if (typeof document === 'undefined') return;

  function boot() {
    apply();
    patchClose();
    patchRate();
    setTimeout(function () { try { migrate(); } catch (e) { if (global.console) console.error('[BTX_DT] migrate', e); } apply(); }, 2500);
    setInterval(function () { apply(); patchClose(); }, 60000);
    setInterval(function () { patchClose(); patchRate(); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
