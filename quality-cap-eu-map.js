/** Patch XTB symbol map for EU names */
(function (global) {
  var EXTRA = {
    ASML: 'ASML.NL',
    SAP: 'SAP.DE',
    'SIE.DE': 'SIE.DE',
    NVDA: 'NVDA.US',
    TSLA: 'TSLA.US',
    META: 'META.US',
    AAPL: 'AAPL.US',
    QQQ: 'US100',
    SPY: 'US500',
    EURUSD: 'EURUSD',
    'XAU/USD': 'GOLD',
    XAUUSD: 'GOLD'
  };
  function apply() {
    if (global.BTX_QCAP && typeof global.BTX_QCAP.mapSym === 'function') {
      global.BTX_QCAP.mapSym = function (sym) { return EXTRA[sym] || sym; };
    }
    if (global.BTX_CANON && global.BTX_CANON.mapXtb) {
      /* canon wins if loaded */
    }
  }
  apply();
  setInterval(apply, 3000);
})(typeof window !== 'undefined' ? window : globalThis);
