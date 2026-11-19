/**
 * Jedna lista instrumentow wszedzie: Rynek, Sygnaly, Analiza, Wykres, desk.
 */
(function (global) {
  'use strict';
  if (global.__BTX_UNI_SYNC__) return;
  global.__BTX_UNI_SYNC__ = true;

  var FULL = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', ccy: 'USD' },
    { s: 'ANT', n: 'Anthropic', t: 'Akcja', b: 83, v: 0.0035, mkt: 'US', xtb: 'ANT.US', ccy: 'USD' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', ccy: 'USD' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', ccy: 'USD' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', ccy: 'USD' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', ccy: 'USD' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', ccy: 'USD' },
    { s: 'ASML', n: 'ASML Holding', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', xtb: 'ASML.NL', ccy: 'EUR' },
    { s: 'SAP', n: 'SAP SE', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', xtb: 'SAP.DE', ccy: 'EUR' },
    { s: 'SIE.DE', n: 'Siemens', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', xtb: 'SIE.DE', ccy: 'EUR' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', ccy: 'USD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', xtb: 'GBPUSD', ccy: 'USD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', xtb: 'USDJPY', ccy: 'JPY' }
  ];

  function clone() {
    return FULL.map(function (m) {
      return { s: m.s, n: m.n, t: m.t, b: m.b, v: m.v, mkt: m.mkt, xtb: m.xtb, ccy: m.ccy, td: m.s === 'EURUSD' ? 'EUR/USD' : (m.s === 'GBPUSD' ? 'GBP/USD' : (m.s === 'USDJPY' ? 'USD/JPY' : m.s)) };
    });
  }

  function ensureSeries() {
    var ST = global.ST;
    if (!ST) return;
    ST.series = ST.series || {};
    clone().forEach(function (m) {
      if (!ST.series[m.s] && typeof global.initSeries === 'function') {
        try { ST.series[m.s] = global.initSeries(m, 150); } catch (e) {}
      }
    });
  }

  function fillSelects() {
    ['chart-sym', 'ai-sym'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      var html = FULL.map(function (m) {
        return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + ' (' + (m.ccy || '') + ')</option>';
      }).join('');
      if (sel.innerHTML !== html && sel.options.length !== FULL.length) {
        sel.innerHTML = html;
        if (FULL.some(function (m) { return m.s === cur; })) sel.value = cur;
      } else if (sel.options.length !== FULL.length) {
        sel.innerHTML = html;
        if (FULL.some(function (m) { return m.s === cur; })) sel.value = cur;
      }
    });
  }

  function hasAnt(list) {
    if (!list || !list.length) return false;
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].s === 'ANT') return true;
    return false;
  }

  function apply() {
    try {
      global.SYMBOLS = clone();
      if (global.CFG && global.CFG.scan) {
        global.CFG.scan.US = true;
        global.CFG.scan.EU = true;
        global.CFG.scan.FX = true;
      }
      ensureSeries();
      fillSelects();
    } catch (e) {}
  }

  function patchFns() {
    ['render', 'renderMkt', 'renderSig', 'cycle'].forEach(function (name) {
      if (typeof global[name] !== 'function' || global[name].__uniSync) return;
      var orig = global[name];
      global[name] = function () {
        apply();
        return orig.apply(this, arguments);
      };
      global[name].__uniSync = true;
    });
    if (typeof global.signals === 'function' && !global.signals.__uniSync) {
      var sig = global.signals;
      global.signals = function () {
        apply();
        return sig.apply(this, arguments);
      };
      global.signals.__uniSync = true;
    }
  }

  function boot() {
    apply();
    patchFns();
    setInterval(function () {
      if (!hasAnt(global.SYMBOLS)) apply();
      else {
        ensureSeries();
        fillSelects();
      }
      patchFns();
    }, 3000);
  }

  global.BTX_UNI_SYNC = { list: FULL, apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);
})(typeof window !== 'undefined' ? window : globalThis);
