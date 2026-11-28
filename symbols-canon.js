/**
 * Kanoniczna lista instrumentów BTX (daytrading XTB):
 * akcje/ETF US + EU + główne FX.
 * ANT = Anthropic (Nasdaq IPO 2026-11-19).
 */
(function (global) {
  'use strict';
  var LIST = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', ccy: 'USD', xtb: 'NVDA.US', td: 'NVDA' },
    { s: 'ANT', n: 'Anthropic', t: 'Akcja', b: 83, v: 0.0035, mkt: 'US', ccy: 'USD', xtb: 'ANT.US', td: 'ANT' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', ccy: 'USD', xtb: 'TSLA.US', td: 'TSLA' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', ccy: 'USD', xtb: 'META.US', td: 'META' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', ccy: 'USD', xtb: 'AAPL.US', td: 'AAPL' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', ccy: 'USD', xtb: 'US100', td: 'QQQ' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', ccy: 'USD', xtb: 'US500', td: 'SPY' },
    { s: 'ASML', n: 'ASML Holding', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', ccy: 'EUR', xtb: 'ASML.NL', td: 'ASML' },
    { s: 'SAP', n: 'SAP SE', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', ccy: 'EUR', xtb: 'SAP.DE', td: 'SAP' },
    { s: 'SIE.DE', n: 'Siemens', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', ccy: 'EUR', xtb: 'SIE.DE', td: 'SIE.DE' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', ccy: 'USD', xtb: 'EURUSD', td: 'EUR/USD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', ccy: 'USD', xtb: 'GBPUSD', td: 'GBP/USD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', ccy: 'JPY', xtb: 'USDJPY', td: 'USD/JPY' }
  ];

  function ccyOf(sym) {
    if (!sym) return '\u2014';
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].s === sym || LIST[i].xtb === sym || LIST[i].td === sym) return LIST[i].ccy || '\u2014';
    }
    if (/ASML|SAP|SIE|\.DE|\.NL|\.PA/.test(sym)) return 'EUR';
    if (/JPY$/.test(sym)) return 'JPY';
    return 'USD';
  }

  function toSym(m) {
    return { s: m.s, n: m.n, t: m.t, b: m.b, v: m.v, mkt: m.mkt, ccy: m.ccy, xtb: m.xtb, td: m.td };
  }

  function apply() {
    try {
      global.SYMBOLS = LIST.map(toSym);
      // uzupewnij selecty UI
      ['chart-sym', 'ai-sym'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var cur = sel.value;
        var have = {};
        for (var i = 0; i < sel.options.length; i++) have[sel.options[i].value] = true;
        LIST.forEach(function (m) {
          if (!have[m.s]) {
            var o = document.createElement('option');
            o.value = m.s; o.textContent = m.s + ' — ' + m.n;
            sel.appendChild(o);
          }
        });
        if (cur) sel.value = cur;
      });
    } catch (e) {}
  }

  global.BTX_SYMBOLS = {
    list: LIST,
    ccyOf: ccyOf,
    apply: apply,
    mapXtb: function (sym) {
      for (var i = 0; i < LIST.length; i++) if (LIST[i].s === sym) return LIST[i].xtb || sym;
      return sym;
    }
  };
  global.BTX_CCY = ccyOf;
  apply();
  setInterval(apply, 10000);
})(typeof window !== 'undefined' ? window : globalThis);
