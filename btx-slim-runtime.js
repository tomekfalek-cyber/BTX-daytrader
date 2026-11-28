/**
 * Slim runtime — nie odswiezaj ciezkich paneli; trzymaj tylko handel.
 */
(function (global) {
  'use strict';
  if (global.__BTX_SLIM_RT__) return;
  global.__BTX_SLIM_RT__ = true;

  var KILL_IDS = [
    'btx-guide7', 'btx-learn', 'btx-macro-cal', 'btx-pro5-panel', 'btx-p5-out',
    'btx-day-report', 'btx-api-budget', 'btx-edge', 'btx-qcap', 'btx-readiness',
    'btx-why-zero', 'btx-why-scan', 'btx-ops', 'btx-plain-legend', 'btx-helpbar',
    'btx-xtb-bridge', 'btx-bt-honest', 'pro-desk-root', 'btx-auto-panel'
  ];

  function hideHeavy() {
    KILL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.setAttribute('data-slim-off', '1');
      }
    });
  }

  function boot() {
    hideHeavy();
    // domyslnie minimalny pulpit
    try {
      if (localStorage.getItem('BTX_DESK_FULL') == null) localStorage.setItem('BTX_DESK_FULL', '0');
    } catch (e) {}
    setInterval(hideHeavy, 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
  else setTimeout(boot, 800);
})(typeof window !== 'undefined' ? window : globalThis);
