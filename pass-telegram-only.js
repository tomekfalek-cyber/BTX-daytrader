/** Telegram tylko przy PASS (A/A+) */
(function (global) {
  function wrap() {
    if (!global.BTX_REAL7 || !global.BTX_REAL7.notifyTelegram) return;
    if (global.BTX_REAL7.notifyTelegram.__passOnly) return;
    var orig = global.BTX_REAL7.notifyTelegram;
    global.BTX_REAL7.notifyTelegram = function (g, meta) {
      meta = meta || {};
      if (!(meta.pass && (meta.grade === 'A' || meta.grade === 'A+'))) {
        if (!g || g.sym !== 'TEST') return;
      }
      return orig.apply(this, arguments);
    };
    global.BTX_REAL7.notifyTelegram.__passOnly = true;
  }
  function patchSignals() {
    if (typeof global.signals !== 'function' || global.signals.__passOnlyTg) return;
    var prev = global.signals;
    global.signals = function () {
      var out = prev.apply(this, arguments) || [];
      out.forEach(function (g) {
        if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return;
        try {
          if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup) return;
          var gr = global.BTX_AUTONOMY.gradeSetup(g);
          if (gr && gr.pass && (gr.grade === 'A' || gr.grade === 'A+')) {
            if (global.BTX_REAL7 && global.BTX_REAL7.notifyTelegram) {
              var k = g.sym + '|' + g.side;
              global.__passTgTs = global.__passTgTs || {};
              if (!global.__passTgTs[k] || Date.now() - global.__passTgTs[k] > 180000) {
                global.__passTgTs[k] = Date.now();
                global.BTX_REAL7.notifyTelegram(g, { pass: true, grade: gr.grade, score: gr.score });
              }
            }
          }
        } catch (e) {}
      });
      return out;
    };
    global.signals.__passOnlyTg = true;
  }
  function boot() {
    wrap();
    patchSignals();
    setInterval(function () { wrap(); patchSignals(); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
