/**
 * Alias: pelna lista rynkow (deleguje do tej samej listy co universe-sync).
 */
(function (global) {
  'use strict';
  if (global.__BTX_FORCE_ALL_MKT__) return;
  global.__BTX_FORCE_ALL_MKT__ = true;
  function tick() {
    if (global.BTX_UNI_SYNC && global.BTX_UNI_SYNC.apply) global.BTX_UNI_SYNC.apply();
    else if (global.SYMBOLS && !global.SYMBOLS.some(function (m) { return m.s === 'ANT'; })) {
      // awaryjnie dolacz ANT
      global.SYMBOLS = (global.SYMBOLS || []).concat([
        { s: 'ANT', n: 'Anthropic', t: 'Akcja', b: 83, v: 0.0035, mkt: 'US', xtb: 'ANT.US', ccy: 'USD' }
      ]);
    }
  }
  setInterval(tick, 4000);
  setTimeout(tick, 800);
})(typeof window !== 'undefined' ? window : globalThis);
