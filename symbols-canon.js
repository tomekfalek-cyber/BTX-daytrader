/**
 * Kanoniczna lista instrumentów BTX + waluta notowania (ccy).
 */
(function (global) {
  'use strict';
  var LIST = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', ccy: 'USD', xtb: 'NVDA.US', td: 'NVDA' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', ccy: 'USD', xtb: 'TSLA.US', td: 'TSLA' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', ccy: 'USD', xtb: 'META.US', td: 'META' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', ccy: 'USD', xtb: 'AAPL.US', td: 'AAPL' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', ccy: 'USD', xtb: 'US100', td: 'QQQ' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', ccy: 'USD', xtb: 'US500', td: 'SPY' },
    { s: 'ASML', n: 'ASML Holding (EU)', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', ccy: 'EUR', xtb: 'ASML.NL', td: 'ASML' },
    { s: 'SAP', n: 'SAP SE (EU)', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', ccy: 'EUR', xtb: 'SAP.DE', td: 'SAP' },
    { s: 'SIE.DE', n: 'Siemens (EU)', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', ccy: 'EUR', xtb: 'SIE.DE', td: 'SIE.DE' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', ccy: 'USD', xtb: 'EURUSD', td: 'EUR/USD' },
    { s: 'XAU/USD', n: 'Z\u0142oto (Gold)', t: 'FX', b: 2650, v: 0.0008, mkt: 'FX', ccy: 'USD', xtb: 'GOLD', td: 'XAU/USD' }
  ];

  function ccyOf(sym) {
    if (!sym) return '\u2014';
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].s === sym || LIST[i].xtb === sym || LIST[i].td === sym) return LIST[i].ccy || '\u2014';
    }
    if (/ASML|SAP|SIE|\.DE|\.NL|\.PA/.test(sym)) return 'EUR';
    if (/\.US$|NVDA|TSLA|AAPL|META|QQQ|SPY|EURUSD|XAU|GOLD/.test(sym)) return 'USD';
    return 'USD';
  }

  function apply() {
    try {
      if (Array.isArray(global.SYMBOLS) && global.SYMBOLS.length) {
        global.SYMBOLS.forEach(function (m) {
          if (!m.ccy) m.ccy = ccyOf(m.s);
        });
      } else {
        global.SYMBOLS = LIST.map(function (m) {
          return { s: m.s, n: m.n, t: m.t, b: m.b, v: m.v, mkt: m.mkt, ccy: m.ccy, xtb: m.xtb };
        });
      }
    } catch (e) {}
  }

  global.BTX_CANON = { list: LIST, ccyOf: ccyOf, apply: apply };
  global.BTX_CCY = ccyOf;
  apply();
  setInterval(apply, 10000);
})(typeof window !== 'undefined' ? window : globalThis);
