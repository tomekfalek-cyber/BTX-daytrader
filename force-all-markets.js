/**
 * Wymusza skan i handel na wszystkich rynkach: US + EU + FX (w tym ANT).
 */
(function (global) {
  'use strict';
  if (global.__BTX_FORCE_ALL_MKT__) return;
  global.__BTX_FORCE_ALL_MKT__ = true;

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

  function fillSelects() {
    ['chart-sym', 'ai-sym'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = FULL.map(function (m) {
        return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + ' (' + (m.ccy || '') + ')</option>';
      }).join('');
      if (FULL.some(function (m) { return m.s === cur; })) sel.value = cur;
    });
  }

  function apply() {
    try {
      global.SYMBOLS = FULL.slice();
      if (global.CFG) {
        global.CFG.scan = { US: true, EU: true, PL: false, FX: true };
      }
      try { localStorage.setItem('BTX_SESSION_PROFILE', 'ALL'); } catch (e) {}
      if (global.ST && global.ST.series && typeof global.initSeries === 'function') {
        FULL.forEach(function (m) {
          if (!global.ST.series[m.s]) {
            try { global.ST.series[m.s] = global.initSeries(m, 150); } catch (e2) {}
          }
        });
      }
      fillSelects();
    } catch (e3) {}
  }

  function boot() {
    apply();
    setInterval(apply, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
