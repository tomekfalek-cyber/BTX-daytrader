/**
 * BTX Perf Governor — anty-zamulanie dashboardu.
 * Problem: 80+ setInterval w modulach → po kilku minutach UI lag (menu, taby).
 * Rozwiazanie: ogranicz czeste timery (min 6s), zostaw tylko krotkie (countdown).
 * + throttle requestAnimationFrame dla ciezkich zapisow (opcjonalnie).
 */
(function (global) {
  'use strict';
  if (global.__BTX_PERF_GOV__) return;
  global.__BTX_PERF_GOV__ = true;

  var nativeSetInterval = global.setInterval.bind(global);
  var nativeClearInterval = global.clearInterval.bind(global);
  var nativeSetTimeout = global.setTimeout.bind(global);

  var MIN_MS = 6000;          // wiekszosc modulow
  var ALLOW_SHORT_MAX = 400;  // countdown / animacje <400ms OK
  var patched = 0;
  var active = 0;

  function adjust(ms) {
    ms = Number(ms);
    if (!isFinite(ms) || ms <= 0) return MIN_MS;
    if (ms <= ALLOW_SHORT_MAX) return ms; // scan-countdown itd.
    if (ms < MIN_MS) return MIN_MS;
    // bardzo czeste 1s → 4s
    if (ms < 2000) return MIN_MS;
    return ms;
  }

  global.setInterval = function (fn, ms) {
    var wait = adjust(ms);
    if (wait !== ms) patched++;
    active++;
    var id = nativeSetInterval(function () {
      try { fn(); } catch (e) {}
    }, wait);
    return id;
  };
  global.clearInterval = function (id) {
    active = Math.max(0, active - 1);
    return nativeClearInterval(id);
  };

  // Tab / menu: odrocz ciezkie renderu przy przelaczaniu
  function patchTabs() {
    var nav = document.querySelector('.nav') || document.querySelector('nav');
    if (!nav || nav.__perfTabs) return;
    nav.__perfTabs = true;
    nav.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = t.closest && t.closest('button[data-tab], .nav button, [data-tab]');
      if (!btn) return;
      // oddaj watek UI natychmiast — ciezkie odswiezenia w nastepnym ticku
      nativeSetTimeout(function () {
        try {
          if (global.BTX_DESK_MIN && global.BTX_DESK_MIN.apply) global.BTX_DESK_MIN.apply();
        } catch (e) {}
      }, 0);
    }, true);
  }

  function banner() {
    var el = document.getElementById('btx-perf-banner');
    if (!el) {
      var pane = document.getElementById('pane-desk') || document.body;
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-perf-banner';
      el.style.cssText = 'margin:6px 0;padding:6px 10px;border-radius:8px;font-size:11px;color:#94a3b8;border:1px solid rgba(148,163,184,.2)';
      if (pane === document.body) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    el.textContent = 'Wydajność: limity timerów ON (min 6s) · złagodzono ' + patched + ' częstych intervali · UI powinno zostać płynne';
  }

  function boot() {
    patchTabs();
    banner();
    nativeSetInterval(function () { patchTabs(); banner(); }, 15000);
  }

  global.BTX_PERF = { adjust: adjust, minMs: MIN_MS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
