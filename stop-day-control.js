/**
 * STOP FOR DAY — domyślnie WYŁĄCZONY na stałe.
 * Włączenie tylko ręczne (Ustawienia / localStorage BTX_ALLOW_STOP_DAY=1).
 */
(function (global) {
  'use strict';
  var LS = 'BTX_ALLOW_STOP_DAY';

  function allowed() {
    try { return localStorage.getItem(LS) === '1'; } catch (e) { return false; }
  }
  function setAllowed(on) {
    try { localStorage.setItem(LS, on ? '1' : '0'); } catch (e) {}
  }

  function clearBlock() {
    try {
      var ST = global.ST;
      if (ST) {
        ST.blocked = false;
        ST.stopForDay = false;
      }
    } catch (e) {}
    try {
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
    } catch (e2) {}
    try {
      var b = document.getElementById('limit-badge');
      if (b && !allowed()) {
        b.textContent = 'STOP DAY: OFF';
        b.style.color = 'var(--tx3, #94a3b8)';
      }
    } catch (e3) {}
  }

  function patchCheckLimits() {
    if (typeof global.checkLimits !== 'function') return;
    if (global.checkLimits.__stopCtrl) return;
    var prev = global.checkLimits;
    global.checkLimits = function () {
      if (!allowed()) {
        clearBlock();
        try { prev.apply(this, arguments); } catch (e) {}
        clearBlock();
        return false;
      }
      return prev.apply(this, arguments);
    };
    global.checkLimits.__stopCtrl = true;
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__stopCtrl) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      if (!allowed()) clearBlock();
      return prev.apply(this, arguments);
    };
    global.openPos.__stopCtrl = true;
  }

  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup) return;
    if (global.BTX_AUTONOMY.gradeSetup.__stopCtrl) return;
    var prev = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      if (!allowed()) clearBlock();
      return prev.apply(this, arguments);
    };
    global.BTX_AUTONOMY.gradeSetup.__stopCtrl = true;
  }

  function ensureUi() {
    var pane = document.getElementById('pane-cfg') || document.getElementById('pane-set') || document.getElementById('pane-settings');
    if (!pane) return;
    var el = document.getElementById('btx-stop-day-ctrl');
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-stop-day-ctrl';
      el.style.cssText = 'margin:14px 0;padding:14px 16px;border-radius:12px;border:1px solid rgba(251,191,36,.35);background:rgba(120,53,15,.15);font-size:13px;color:#fde68a;line-height:1.5';
      pane.appendChild(el);
    }
    var on = allowed();
    el.innerHTML =
      '<b style="color:#fbbf24">Blokada dnia (STOP FOR DAY)</b><br>' +
      '<span style="color:#e2e8f0">Domyślnie <b>wyłączona</b>. Bot nie przerywa dnia automatycznie. ' +
      'Włącz tylko jeśli chcesz twardy limit strat / max trade’ów na dziś.</span>' +
      '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
      '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;color:#e2e8f0">' +
      '<input type="checkbox" id="btx-allow-stop-day" ' + (on ? 'checked' : '') + '/> ' +
      'Włącz blokadę dnia (ręcznie)</label>' +
      '<button type="button" id="btx-clear-stop-now" style="cursor:pointer;padding:6px 12px;border:0;border-radius:8px;background:#334155;color:#fff;font-weight:600">Wyczyść blokadę teraz</button>' +
      '</div>' +
      '<div id="btx-stop-day-msg" style="margin-top:8px;font-size:12px;color:#94a3b8">' +
      (on ? 'Blokada dnia MOŻE się włączyć przy limitach.' : 'Blokada dnia OFF — handel nie jest zatrzymywany przez STOP FOR DAY.') +
      '</div>';

    var cb = document.getElementById('btx-allow-stop-day');
    if (cb) {
      cb.onchange = function () {
        setAllowed(!!cb.checked);
        if (!cb.checked) clearBlock();
        ensureUi();
        if (global.toast) global.toast(cb.checked ? 'Blokada dnia: możliwa' : 'Blokada dnia: OFF na stałe', 'ok');
      };
    }
    var btn = document.getElementById('btx-clear-stop-now');
    if (btn) {
      btn.onclick = function () {
        clearBlock();
        if (global.toast) global.toast('Blokada wyczyszczona', 'ok');
        ensureUi();
      };
    }
  }

  function boot() {
    if (!allowed()) clearBlock();
    patchCheckLimits();
    patchOpen();
    patchAutonomy();
    ensureUi();
    setInterval(function () {
      if (!allowed()) clearBlock();
      patchCheckLimits();
      patchOpen();
      patchAutonomy();
    }, 4000);
    document.querySelectorAll('button[data-tab], .nav button').forEach(function (btn) {
      if (btn.__stopCtrl) return;
      btn.__stopCtrl = true;
      btn.addEventListener('click', function () { setTimeout(ensureUi, 100); });
    });
  }

  global.BTX_STOP_DAY = { allowed: allowed, setAllowed: setAllowed, clear: clearBlock };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
