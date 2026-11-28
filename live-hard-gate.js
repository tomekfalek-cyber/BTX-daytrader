/**
 * LIVE gate — preferuj LIVE, ale nie blokuj calego daytradingu paper.
 * Bez LIVE: sygnaly dzialaja na serii (paper), z nizsza pewnoscia.
 */
(function (global) {
  var MAX_AGE_MS = 45 * 60 * 1000;

  function isSymLive(sym) {
    var ST = global.ST;
    if (!ST || !ST.liveSource || !ST.liveSource[sym]) return false;
    return Date.now() - ST.liveSource[sym] < MAX_AGE_MS;
  }

  function anyLive() {
    var ST = global.ST;
    if (!ST || !ST.liveSource) return false;
    var now = Date.now();
    return Object.keys(ST.liveSource).some(function (k) {
      return now - ST.liveSource[k] < MAX_AGE_MS;
    });
  }

  function markFromSeries(sym) {
    var ST = global.ST || (global.ST = {});
    ST.liveSource = ST.liveSource || {};
    ST.liveSource[sym] = Date.now();
    global.__BTX_LAST_LIVE_TS = Date.now();
  }

  function patchEvaluate() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__liveGate2) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var g = orig.apply(this, arguments);
      if (!g) return g;
      var sym = g.sym || (m && m.s);
      var live = sym && isSymLive(sym);
      if (!live) {
        g.liveBlocked = !anyLive();
        if (g.side === 'LONG' || g.side === 'SHORT') {
          // paper / seria — nie kasuj sygnalu, tylko oznacz
          g.why = (g.why || '') + (g.why ? ' · ' : '') + (anyLive() ? 'seria (brak LIVE tego symbolu)' : 'paper/seria');
          if ((g.strength || 0) > 2) g.strength = 2; // ostrozniej bez LIVE
        }
      } else {
        g.liveOk = true;
      }
      return g;
    };
    try { Object.keys(orig).forEach(function (k) { global.evaluate[k] = orig[k]; }); } catch (e) {}
    global.evaluate.__liveGate2 = true;
  }

  function patchFetch() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__liveMark) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      var r = await orig.apply(this, arguments);
      try { markFromSeries(sym); } catch (e) {}
      return r;
    };
    global.fetchReal.__liveMark = true;
  }

  function boot() {
    patchEvaluate();
    patchFetch();
    setInterval(function () { patchEvaluate(); patchFetch(); }, 4000);
  }

  global.BTX_LIVE_GATE = { isSymLive: isSymLive, mark: markFromSeries, anyLive: anyLive };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
