/**
 * Gate LIVE (daytrade): 20 min, nie blokuj całości gdy jest jakikolwiek LIVE
 */
(function (global) {
  var MAX_AGE_MS = 20 * 60 * 1000;

  function isSymLive(sym) {
    var ST = global.ST;
    if (!ST) return false;
    if (ST.liveSource && ST.liveSource[sym] && Date.now() - ST.liveSource[sym] < MAX_AGE_MS) return true;
    return false;
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

  function patchCycleNoSynth() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__liveGate) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var sym = m && (m.s || m.sym);
      if (sym && !isSymLive(sym) && !anyLive()) {
        return {
          sym: sym,
          side: 'WAIT',
          strength: 0,
          price: (m && m.b) || 0,
          why: 'Brak LIVE — brak sygnału',
          liveBlocked: true
        };
      }
      return orig.apply(this, arguments);
    };
    global.evaluate.__liveGate = true;
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
    patchCycleNoSynth();
    patchFetch();
    setInterval(function () {
      patchCycleNoSynth();
      patchFetch();
    }, 5000);
  }

  global.BTX_LIVE_GATE = { isSymLive: isSymLive, mark: markFromSeries, anyLive: anyLive };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
