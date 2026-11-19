/**
 * Signal lock — TYLKO oslabia soft-nakladki; NIE blokuje paper/LIVE.
 */
(function (global) {
  'use strict';
  if (global.__BTX_SIGNAL_LOCK__) return;
  global.__BTX_SIGNAL_LOCK__ = true;

  function pro() { return global.BTX_STRATEGY_PRO || global.BTX_PRO || {}; }

  function isSoftWhy(why) {
    return /TradeNow|Trade Now|soft L|soft S|DT mode|daytrader-mode/i.test(String(why || ''));
  }

  function patchEvaluate() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__signalLock) return;
    var prev = global.evaluate;
    global.evaluate = function (m) {
      var g = prev.apply(this, arguments);
      if (!g) return g;
      var P = pro();
      // strictCore: odrzucaj tylko ewidentnie "soft" nakladki, nie zabijaj zwyklych sygnalow
      if (P.strictCore && isSoftWhy(g.why) && (g.side === 'LONG' || g.side === 'SHORT')) {
        var need = P.scoreMin != null ? P.scoreMin : 3;
        var sc = g._pro ? (g.side === 'LONG' ? g._pro.scoreL : g._pro.scoreS) : (g.strength || 0) * 2;
        if (sc < need) {
          g.side = 'WAIT';
          g.strength = 0;
          g.why = 'strictCore: soft setup ponizej progu';
        }
      }
      // LIVE: tylko oznacz, NIE kasuj
      if (g.side !== 'WAIT' && global.BTX_LIVE && typeof global.BTX_LIVE.isFresh === 'function') {
        if (!global.BTX_LIVE.isFresh(g.sym)) {
          g.why = (g.why ? g.why + ' · ' : '') + 'LIVE nieświeże (paper OK)';
        }
      }
      return g;
    };
    try { Object.keys(prev).forEach(function (k) { global.evaluate[k] = prev[k]; }); } catch (e) {}
    global.evaluate.__signalLock = true;
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__signalLock) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      // nie blokuj open z powodu LIVE
      return prev.apply(this, arguments);
    };
    global.openPos.__signalLock = true;
  }

  function boot() {
    patchEvaluate();
    patchOpenPos();
    setInterval(function () { patchEvaluate(); patchOpenPos(); }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
