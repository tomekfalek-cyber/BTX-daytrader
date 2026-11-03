/**
 * Twardy gate LIVE: bez świeżych danych = brak sygnału (nie synth)
 */
(function (global) {
  var MAX_AGE_MS = 12 * 60 * 1000; // 12 min

  function isSymLive(sym) {
    var ST = global.ST;
    if (!ST) return false;
    if (ST.liveSource && ST.liveSource[sym] && Date.now() - ST.liveSource[sym] < MAX_AGE_MS) return true;
    if (global.__BTX_LAST_LIVE_TS && Date.now() - global.__BTX_LAST_LIVE_TS < MAX_AGE_MS) {
      // global live tick — akceptuj tylko jeśli seria ma timestampy
      var b = ST.series && ST.series[sym];
      if (b && b.length && b[b.length - 1].t && Date.now() - b[b.length - 1].t < 24 * 60 * 60 * 1000) {
        // nie wystarczy stary historyczny bar — wymagaj liveSource
      }
    }
    return !!(ST.liveSource && ST.liveSource[sym] && Date.now() - ST.liveSource[sym] < MAX_AGE_MS);
  }

  function markFromSeries(sym) {
    // wywoływane po udanym fetch
    var ST = global.ST || (global.ST = {});
    ST.liveSource = ST.liveSource || {};
    ST.liveSource[sym] = Date.now();
    global.__BTX_LAST_LIVE_TS = Date.now();
  }

  function patchCycleNoSynth() {
    // hardening już blokuje nextBar przy live — tu: bez live w ogóle nie generuj sygnału z evaluate
    if (typeof global.evaluate !== 'function' || global.evaluate.__liveGate) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var sym = m && (m.s || m.sym);
      if (sym && !isSymLive(sym)) {
        return {
          sym: sym,
          side: 'WAIT',
          strength: 0,
          price: m.b || 0,
          why: 'Brak LIVE dla ' + sym + ' — brak sygnału (twardy gate)',
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

  function banner() {
    var id = 'btx-live-gate';
    var el = document.getElementById(id);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(248,113,113,.35);background:rgba(239,68,68,.08);font-size:12px;color:#fecaca';
      pane.appendChild(el);
    }
    var syms = (global.SYMBOLS || []).map(function (m) { return m.s; });
    var live = syms.filter(isSymLive);
    var dead = syms.filter(function (s) { return !isSymLive(s); });
    el.innerHTML = '<b>Gate LIVE</b> · sygnały tylko przy świeżych danych (<12 min)<br>' +
      'LIVE (' + live.length + '): ' + (live.join(', ') || '—') + '<br>' +
      'BEZ sygnału (' + dead.length + '): ' + (dead.join(', ') || '—');
  }

  function boot() {
    patchCycleNoSynth();
    patchFetch();
    banner();
    setInterval(function () {
      patchCycleNoSynth();
      patchFetch();
      banner();
    }, 5000);
  }

  global.BTX_LIVE_GATE = { isSymLive: isSymLive, mark: markFromSeries };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
