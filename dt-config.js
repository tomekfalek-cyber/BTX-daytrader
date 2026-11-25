/**
 * BTX DT-CONFIG — APEX daytrading (mały portfel USD).
 * risk 0.35%, TP 2R, max 2 poz., max 6/dzień, limit dnia 1.25%.
 */
(function (global) {
  'use strict';
  var VERSION = 'apex-2026-11-18';
  var LS_VER = 'BTX_DT_PROFILE_VERSION';
  var LS_OVR = 'BTX_DT_OVERRIDES';

  var PROFILE = {
    capital: 6800,
    pro: {
      riskPct: 0.35,
      maxPos: 2,
      maxDayTrades: 6,
      dailyLossPct: 1.25,
      maxConsecLoss: 3,
      scoreMin: 3,
      primeExtra: 0,
      minStrengthOpen: 2,
      minRvol: 0.35,
      minNetRR: 1.1,
      strictCore: false,
      requireTrend: false,
      allowShort: true,
      tpR: 2.0,
      beR: 1.0,
      partialR: 99,
      partialFrac: 0,
      coolBars: 2,
      minHoldBars: 8,
      timeStopBars: 24,
      stopMinAtr: 1.0,
      stopMaxAtr: 2.0,
      stopAtr: { US: [0.9, 1.5], EU: [0.9, 1.5], FX: [1.4, 2.2] },
      newsPadMin: 10,
      closeBufferMin: 15,
      flatBeforeCloseMin: 12,
      marketFilter: true,
      orBars: 6
    },
    newsWindows: [
      { label: 'US dane 14:30 PL', min: 13 * 60 + 30 },
      { label: 'US dane 16:00 PL', min: 15 * 60 }
    ],
    fxSession: {
      open: 7 * 60, close: 20 * 60,
      prime: [[7 * 60 + 30, 11 * 60], [14 * 60 + 30, 17 * 60 + 30]]
    },
    cfg: {
      risk: 0.35, maxPos: 2, maxTrades: 6, dailyLoss: 1.25, maxConsec: 3,
      minHold: 8, timeStop: 24, autoSec: 120, allowShort: true,
      fxLev: 30, slip: 0.004, ccy: 'USD',
      scan: { US: true, EU: true, PL: false, FX: true },
      rates: { USD: 1, JPY: 0.0067, EUR: 1.08 },
      fracStep: 0.01
    },
    fxFees: { comm: 0, conv: 0, spread: 0.012, slip: 0.004 },
    priority: ['SPY', 'QQQ', 'EURUSD', 'ANT', 'NVDA', 'AAPL', 'META', 'TSLA', 'GBPUSD', 'ASML', 'USDJPY', 'SAP', 'SIE.DE']
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
      merge(PRO, o.pro || {});
    }
    if (CFG) {
      var c = PROFILE.cfg;
      ['risk', 'maxPos', 'maxTrades', 'dailyLoss', 'maxConsec', 'minHold', 'timeStop', 'autoSec', 'allowShort', 'fxLev'].forEach(function (k) { CFG[k] = c[k]; });
      CFG.ccy = 'USD';
      CFG.scan = { US: true, EU: true, PL: false, FX: true };
      if (force || CFG.slip == null || CFG.slip > 0.02) CFG.slip = c.slip;
      if (force || !CFG.rates) CFG.rates = merge({}, c.rates);
      CFG.fracStep = 0.01;
      CFG.fees = CFG.fees || {};
      if (force || !CFG.fees.FX) CFG.fees.FX = merge({}, PROFILE.fxFees);
      if (force || !CFG.fees.US) CFG.fees.US = { comm: 0, conv: 0, spread: 0.025, slip: 0.015 };
      if (force || !CFG.fees.EU) CFG.fees.EU = { comm: 0, conv: 0.35, spread: 0.03, slip: 0.015 };
      merge(CFG, o.cfg || {});
      CFG.scan.US = true; CFG.scan.EU = true; CFG.scan.FX = true;
      CFG.ccy = 'USD';
    }
    return { PRO: PRO, CFG: CFG };
  }
  function apply() { applyTo(global.BTX_STRATEGY_PRO || global.BTX_PRO, global.CFG); }

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
    try { if (typeof global.log === 'function') global.log('APEX ' + VERSION + ': ' + PROFILE.capital + ' USD \u00b7 risk 0.35% \u00b7 TP 2R \u00b7 max 6/dzie\u0144', 'g'); } catch (e3) {}
    try { if (typeof global.render === 'function') global.render(); } catch (e4) {}
    ls.setItem(LS_VER, VERSION);
    return true;
  }

  function patchRate() {
    if (typeof global.rateOf !== 'function' || global.rateOf.__dtEur) return;
    var orig = global.rateOf;
    global.rateOf = function (m) {
      var C = global.CFG || {}, r = C.rates || {}, usd = C.ccy === 'USD';
      function lastPx(sym) { var a = global.ST && global.ST.series && global.ST.series[sym]; return a && a.length ? a[a.length - 1].c : 0; }
      if (m && m.mkt === 'EU') {
        if (usd) { var e = lastPx('EURUSD'); if (e > 0.5 && e < 2) return e; }
        return +r.EUR || (usd ? 1.08 : 4.25);
      }
      if (usd && m && m.mkt === 'US') return 1;
      return orig.apply(this, arguments);
    };
    Object.keys(orig).forEach(function (k) { try { global.rateOf[k] = orig[k]; } catch (e) {} });
    global.rateOf.__dtEur = true;
  }

  function relabel() {
    try {
      if (!global.CFG || global.CFG.ccy !== 'USD' || !document.body) return;
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, list = [];
      while ((n = w.nextNode())) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p !== 'SCRIPT' && p !== 'STYLE' && p !== 'TEXTAREA' && /\bPLN\b/.test(n.nodeValue)) list.push(n);
      }
      list.forEach(function (x) { x.nodeValue = x.nodeValue.replace(/\bPLN\b/g, 'USD'); });
    } catch (e) {}
  }
  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__dtCcy) return;
    var orig = global.render;
    global.render = function () { var r = orig.apply(this, arguments); relabel(); return r; };
    Object.keys(orig).forEach(function (k) { try { global.render[k] = orig[k]; } catch (e) {} });
    global.render.__dtCcy = true;
  }

  global.BTX_DT = { VERSION: VERSION, PROFILE: PROFILE, applyTo: applyTo, apply: apply, migrate: migrate, priority: PROFILE.priority };
  if (typeof document === 'undefined') return;
  function boot() {
    apply(); patchClose(); patchRate(); patchRender();
    setTimeout(function () { try { migrate(); } catch (e) {} apply(); }, 2500);
    setInterval(function () { apply(); patchClose(); }, 60000);
    setInterval(function () { patchClose(); patchRate(); patchRender(); relabel(); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
