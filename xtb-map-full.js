/**
 * Pełne mapowanie BTX → XTB (US + EU + FX)
 */
(function (global) {
  var MAP = {
    NVDA: 'NVDA.US',
    TSLA: 'TSLA.US',
    META: 'META.US',
    AAPL: 'AAPL.US',
    QQQ: 'US100',
    SPY: 'US500',
    ASML: 'ASML.NL',
    SAP: 'SAP.DE',
    'SIE.DE': 'SIE.DE',
    EURUSD: 'EURUSD',
    'XAU/USD': 'GOLD',
    XAUUSD: 'GOLD'
  };

  function mapSym(sym) {
    return MAP[sym] || sym;
  }

  function apply() {
    if (global.BTX_QCAP) global.BTX_QCAP.mapSym = mapSym;
    if (global.BTX_CANON) global.BTX_CANON.mapXtb = mapSym;
    // trade-hero używa BTX_QCAP.mapSym — OK
  }

  apply();
  setInterval(apply, 3000);
  global.BTX_XTB_MAP = { map: mapSym, table: MAP };
})(typeof window !== 'undefined' ? window : globalThis);
