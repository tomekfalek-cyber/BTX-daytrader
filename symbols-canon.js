/**
 * Kanoniczna lista + mapowanie XTB / Twelve — wspólne dla całego BTX
 */
(function (global) {
  var CANON = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', td: 'NVDA' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', td: 'TSLA' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', td: 'META' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', td: 'AAPL' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', td: 'QQQ' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', td: 'SPY' },
    { s: 'ASML', n: 'ASML Holding (EU)', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', xtb: 'ASML.NL', td: 'ASML' },
    { s: 'SAP', n: 'SAP SE (EU)', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', xtb: 'SAP.DE', td: 'SAP' },
    { s: 'SIE.DE', n: 'Siemens (EU)', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', xtb: 'SIE.DE', td: 'SIE.DE' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', td: 'EUR/USD' },
    { s: 'XAU/USD', n: 'Złoto (Gold)', t: 'FX', b: 2650, v: 0.0008, mkt: 'FX', xtb: 'GOLD', td: 'XAU/USD' }
  ];

  var XTB_MAP = {};
  var TD_MAP = {};
  CANON.forEach(function (m) {
    XTB_MAP[m.s] = m.xtb;
    TD_MAP[m.s] = m.td;
  });

  function mapXtb(sym) { return XTB_MAP[sym] || sym; }
  function mapTd(sym) { return TD_MAP[sym] || sym; }

  function forceSymbols() {
    global.SYMBOLS = CANON.map(function (m) {
      return { s: m.s, n: m.n, t: m.t, b: m.b, v: m.v, mkt: m.mkt, xtb: m.xtb };
    });
    if (global.BTX_UNI) global.BTX_UNI.list = global.SYMBOLS.slice();
  }

  // Patch quality-cap / trade-hero maps when present
  function patchMaps() {
    forceSymbols();
    if (global.BTX_QCAP) {
      global.BTX_QCAP.mapSym = mapXtb;
    }
    if (typeof global.fetchReal === 'function' && !global.fetchReal.__canonTd) {
      var orig = global.fetchReal;
      global.fetchReal = async function (sym) {
        return orig.call(this, mapTd(sym));
      };
      global.fetchReal.__canonTd = true;
    }
  }

  function boot() {
    patchMaps();
    setInterval(patchMaps, 4000);
  }

  global.BTX_CANON = { list: CANON, mapXtb: mapXtb, mapTd: mapTd, forceSymbols: forceSymbols };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
