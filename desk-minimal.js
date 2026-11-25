/**
 * Minimalny pulpit — mniej szumu, wiecej handlu.
 * Domyslnie UKRYWA zbędne panele; zostawia: handel, pozycje, sesja, kapital, PRO okazje.
 * Przelacznik: "Pelny pulpit" zapisany w localStorage BTX_DESK_FULL=1
 */
(function (global) {
  'use strict';
  if (global.__BTX_DESK_MIN__) return;
  global.__BTX_DESK_MIN__ = true;

  var LS = 'BTX_DESK_FULL';
  var BAR = 'btx-desk-min-bar';
  var STYLE = 'btx-desk-min-css';

  // panele, ktore na minimalnym pulpicie chowamy (id elementow)
  var HIDE_IDS = [
    'btx-guide7', 'btx-dl-guide', 'btx-md-guide',
    'btx-learn', 'btx-comm',
    'btx-macro-cal',
    'btx-p5-out', 'btx-pro5-panel',
    'btx-day-report',
    'btx-api-budget',
    'btx-edge',
    'btx-plain-legend', 'btx-helpbar',
    'btx-vpvr-css',
    'btx-bt-honest',
    'btx-qcap',
    'btx-readiness',
    'btx-apex-banner',
    'btx-us-fix-banner',
    'btx-force-open-btn',
    'btx-auto-panel',
    'btx-ops',
    'pro-desk-root',
    'btx-pro6',
    'btx-why-zero', 'btx-why-scan',
    'btx-xtb-bridge',
    'btx-copy-status'
  ];

  // zawsze widoczne (handel)
  var KEEP_IDS = [
    'btx-trade-hero',
    'btx-open-positions',
    'btx-pro-monday',
    'btx-eu-morning',
    'btx-kernel-banner',
    'btx-cap-banner',
    'btx-session-profile',
    'btx-hero-multi',
    'btx-session-cards',
    'btx-skip-panel',
    'btx-hold-warn',
    'btx-elite-panel',
    'btx-edge-week'
  ];

  function isFull() {
    try { return localStorage.getItem(LS) === '1'; } catch (e) { return false; }
  }
  function setFull(v) {
    try { localStorage.setItem(LS, v ? '1' : '0'); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + BAR + '{margin:0 0 12px;padding:10px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.35);',
      'background:rgba(15,23,42,.9);display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}',
      '#' + BAR + ' b{color:#e2e8f0;font-size:13px}',
      '#' + BAR + ' span{color:#94a3b8;font-size:12px}',
      '#' + BAR + ' button{cursor:pointer;border:0;border-radius:8px;padding:8px 12px;font-weight:700;font-size:12px;',
      'background:#334155;color:#f8fafc}',
      '#' + BAR + ' button.on{background:#2563eb}',
      'body.btx-desk-min #pane-desk .card{margin-bottom:10px}',
      'body.btx-desk-min .btx-desk-hidden{display:none!important}'
    ].join('');
    document.head.appendChild(s);
  }

  function apply() {
    injectCss();
    var full = isFull();
    document.body.classList.toggle('btx-desk-min', !full);

    HIDE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (full) {
        el.classList.remove('btx-desk-hidden');
        if (el.dataset.btxPrevDisplay != null) {
          el.style.display = el.dataset.btxPrevDisplay;
        }
      } else {
        if (el.dataset.btxPrevDisplay == null) {
          el.dataset.btxPrevDisplay = el.style.display || '';
        }
        el.classList.add('btx-desk-hidden');
      }
    });

    // KEEP always show
    KEEP_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('btx-desk-hidden');
      if (el.style.display === 'none' && id !== 'btx-eu-morning') {
        /* leave eu morning module to control its own display */
      }
    });

    var bar = document.getElementById(BAR);
    if (bar) {
      var btn = bar.querySelector('button');
      var hint = bar.querySelector('[data-hint]');
      if (btn) {
        btn.textContent = full ? 'Włącz minimalny pulpit' : 'Pokaż pełny pulpit';
        btn.classList.toggle('on', !full);
      }
      if (hint) {
        hint.textContent = full
          ? 'Widok pełny — wszystkie panele edukacyjne i diagnostyczne.'
          : 'Widok minimalny — handel, pozycje, sesja, kapitał, okazje XTB. Reszta ukryta.';
      }
    }
  }

  function ensureBar() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var bar = document.getElementById(BAR);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR;
      bar.innerHTML =
        '<div><b>Pulpit</b> · <span data-hint></span></div>' +
        '<button type="button" id="btx-desk-min-btn">Minimalny pulpit</button>';
      if (pane.firstChild) pane.insertBefore(bar, pane.firstChild);
      else pane.appendChild(bar);
      bar.querySelector('button').onclick = function () {
        setFull(!isFull());
        apply();
      };
    }
    apply();
  }

  function boot() {
    // domyslnie MINIMALNY (nie full)
    try {
      if (localStorage.getItem(LS) == null) localStorage.setItem(LS, '0');
    } catch (e) {}
    ensureBar();
    setInterval(ensureBar, 10000);
  }

  global.BTX_DESK_MIN = { apply: apply, isFull: isFull };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1000); });
  else setTimeout(boot, 1000);
})(typeof window !== 'undefined' ? window : globalThis);
