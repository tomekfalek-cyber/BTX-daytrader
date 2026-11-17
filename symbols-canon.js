/**
 * Kanoniczna lista instrumentów BTX + waluta notowania (ccy).
 */
(function (global) {
  'use strict';
  var LIST = [
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', ccy: 'USD', xtb: 'EURUSD', td: 'EUR/USD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', ccy: 'USD', xtb: 'GBPUSD', td: 'GBP/USD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', ccy: 'JPY', xtb: 'USDJPY', td: 'USD/JPY' },
    { s: 'AUDUSD', n: 'AUD/USD', t: 'FX', b: 0.65, v: 0.0004, mkt: 'FX', ccy: 'USD', xtb: 'AUDUSD', td: 'AUD/USD' }
  ];

  function ccyOf(sym) {
    if (!sym) return '\u2014';
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].s === sym || LIST[i].xtb === sym || LIST[i].td === sym) return LIST[i].ccy || '\u2014';
    }
    if (/ASML|SAP|SIE|\.DE|\.NL|\.PA/.test(sym)) return 'EUR';
    if (/JPY$/.test(sym)) return 'JPY';
    if (/\.US$|NVDA|TSLA|AAPL|META|QQQ|SPY|USD|XAU|GOLD/.test(sym)) return 'USD';
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
