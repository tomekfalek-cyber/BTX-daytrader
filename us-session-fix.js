/**
 * Sesja US daytrading (czas PL zima): 15:30-22:00, nowe wejscia do 21:45.
 * Ustawia sesje w strategy-pro i pilnuje ST.sig.
 */
(function (global) {
  'use strict';
  if (global.__BTX_US_FIX__) return;
  global.__BTX_US_FIX__ = true;

  function warsawMin() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function applySession() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (!P) return;
    P.primeExtra = 0;
    P.closeBufferMin = 15;
    P.flatBeforeCloseMin = 12;
    P.minStrengthOpen = 2;
    if (P.scoreMin == null || P.scoreMin > 3) P.scoreMin = 3;
    P.strictCore = false;
    // sesje w minutach "utcMin" strategy (UTC zima ≈ PL-60)
    // US 15:30-22:00 PL zima = 14:30-21:00 UTC
    if (!P.sessions) P.sessions = {};
    P.sessions.US = {
      open: 14 * 60 + 30,
      close: 21 * 60,
      prime: [[14 * 60 + 35, 16 * 60 + 30], [18 * 60 + 30, 20 * 60 + 30]]
    };
    P.sessions.EU = {
      open: 8 * 60, close: 16 * 60 + 30,
      prime: [[8 * 60 + 5, 11 * 60], [14 * 60, 16 * 60]]
    };
    P.sessions.FX = {
      open: 7 * 60, close: 21 * 60,
      prime: [[8 * 60, 11 * 60], [14 * 60 + 30, 17 * 60 + 30]]
    };
  }

  function ensureSig() {
    try {
      if (typeof global.signals === 'function' && global.ST) {
        global.ST.sig = global.signals() || [];
      }
    } catch (e) {}
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__usFix) return;
    var orig = global.cycle;
    global.cycle = function () {
      applySession();
      var ret = orig.apply(this, arguments);
      ensureSig();
      try {
        if (global.BTX_AUTONOMY) {
          if (typeof global.BTX_AUTONOMY.tryOpenBest === 'function') global.BTX_AUTONOMY.tryOpenBest();
          else if (typeof global.BTX_AUTONOMY.tryOpen === 'function') global.BTX_AUTONOMY.tryOpen();
        }
      } catch (e) {}
      return ret;
    };
    global.cycle.__usFix = true;
  }

  function banner() {
    var w = warsawMin();
    var usOpen = !w.weekend && w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var canEntry = usOpen && w.min < 21 * 60 + 45;
    var el = document.getElementById('btx-us-fix-banner');
    if (!el) {
      var pane = document.getElementById('pane-desk') || document.getElementById('pane-sig');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-us-fix-banner';
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(96,165,250,.4);background:rgba(37,99,235,.12);font-size:12px;color:#dbeafe';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var n = (global.ST && global.ST.sig) ? global.ST.sig.length : 0;
    var act = (global.ST && global.ST.sig) ? global.ST.sig.filter(function (g) { return g && g.side !== 'WAIT'; }).length : 0;
    el.innerHTML = '<b>Sesja US</b> · ' + w.label + ' PL · ' +
      (usOpen ? (canEntry ? '<span style="color:#86efac">OTWARTA — można nowe wejścia</span>' : '<span style="color:#fde68a">OTWARTA — tylko zarządzanie (bufor zamknięcia)</span>') : '<span style="color:#fca5a5">ZAMKNIĘTA</span>') +
      ' · sygnały: <b>' + act + '</b> aktywne / ' + n + ' skan';
  }

  function boot() {
    applySession();
    patchCycle();
    ensureSig();
    banner();
    setInterval(function () {
      applySession();
      patchCycle();
      ensureSig();
      banner();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
