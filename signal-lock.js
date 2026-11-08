/**
 * Signal lock — jedna ścieżka: live-prices → strategy-pro → autonomy
 * Odrzuca sygnały z nakładek soft (TradeNow / DT mode) gdy strictCore=true.
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
    if (typeof global.evaluate !== 'function') return;
    if (global.evaluate.__signalLock) return;
    var prev = global.evaluate;
    global.evaluate = function (m) {
      var g = prev.apply(this, arguments);
      if (!g) return g;
      var P = pro();
      if (P.strictCore && isSoftWhy(g.why)) {
        g.side = 'WAIT';
        g.strength = 0;
        g.why = 'strictCore: odrzucono soft-nakładkę';
      }
      try {
        if (global.BTX_LIVE && typeof global.BTX_LIVE.isFresh === 'function') {
          if (!global.BTX_LIVE.isFresh(g.sym) && g.side !== 'WAIT') {
            g.side = 'WAIT';
            g.strength = 0;
            g.why = (g.why ? g.why + ' \u00b7 ' : '') + 'brak \u015bwie\u017cej ceny LIVE';
          }
        }
      } catch (e) {}
      return g;
    };
    Object.keys(prev).forEach(function (k) {
      try { global.evaluate[k] = prev[k]; } catch (e) {}
    });
    global.evaluate.__signalLock = true;
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__signalLock) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      var P = pro();
      if (g && P.strictCore && isSoftWhy(g.why)) {
        if (global.log) global.log('SignalLock: blokada soft wej\u015bcia ' + (g.sym || ''), 'mut');
        return;
      }
      if (g && global.BTX_LIVE && typeof global.BTX_LIVE.isFresh === 'function') {
        if (!global.BTX_LIVE.isFresh(g.sym)) {
          if (global.log) global.log('SignalLock: brak LIVE ' + g.sym, 'mut');
          return;
        }
      }
      return prev.apply(this, arguments);
    };
    global.openPos.__signalLock = true;
  }

  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup) return;
    if (global.BTX_AUTONOMY.gradeSetup.__signalLock) return;
    var prev = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = prev.apply(this, arguments);
      if (!r || !g) return r;
      var P = pro();
      if (P.strictCore && isSoftWhy(g.why)) {
        return { pass: false, grade: 'REJECT', score: r.score || 0, reasons: ['strictCore: soft-nak\u0142adka'] };
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__signalLock = true;
  }

  function boot() {
    patchEvaluate();
    patchOpenPos();
    patchAutonomy();
    setInterval(function () {
      patchEvaluate();
      patchOpenPos();
      patchAutonomy();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
