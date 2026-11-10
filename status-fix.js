/**
 * Status fix — BLOKADA tylko przy twardych powodach.
 * Brak LIVE / ładowanie / stary STOP → nie czerwona BLOKADA przy aktywnej sesji.
 */
(function (global) {
  'use strict';
  if (global.__BTX_STATUS_FIX__) return;
  global.__BTX_STATUS_FIX__ = true;

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

  function profile() {
    try {
      if (global.BTX_SESSION_PROFILE && global.BTX_SESSION_PROFILE.get) return global.BTX_SESSION_PROFILE.get();
      return localStorage.getItem('BTX_SESSION_PROFILE') || 'ALL';
    } catch (e) { return 'ALL'; }
  }

  function sessionActive() {
    var w = warsawMin();
    if (w.weekend) return { active: false, phase: 'WEEKEND', where: '' };
    var inEu = w.min >= 9 * 60 && w.min < 17 * 60 + 30;
    var inUs = w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var prof = profile();
    var active = prof === 'RANO' ? inEu : (prof === 'US' ? inUs : (inEu || inUs));
    var where = inUs && inEu ? 'EU+US' : (inUs ? 'US' : (inEu ? 'EU (RANO)' : ''));
    var phase = inUs ? 'US_SESSION' : (inEu ? 'EU_SESSION' : (w.min < 9 * 60 ? 'PRE_OPEN' : 'OFF'));
    return { active: active, phase: phase, where: where, profile: prof, label: w.label };
  }

  function allowStop() {
    try { return localStorage.getItem('BTX_ALLOW_STOP_DAY') === '1'; } catch (e) { return false; }
  }

  function patch() {
    if (!global.BTX_ASSISTANT || !global.BTX_ASSISTANT.opsStatus) return;
    if (global.BTX_ASSISTANT.opsStatus.__statusFix) return;
    var prev = global.BTX_ASSISTANT.opsStatus;
    global.BTX_ASSISTANT.opsStatus = function () {
      var st = prev.apply(this, arguments) || {};
      var ses = sessionActive();

      if (st.code === 'BLOCK' || st.title === 'BLOKADA') {
        var detail = String(st.detail || '');
        var soft = /Dane nie-LIVE|DEMO|KEY|\u0142aduje|laduje|brak klucza|STOP FOR DAY|Limity konta/i.test(detail);
        var hardMacro = /Makro HIGH|News blackout/i.test(detail);
        if (!allowStop() && soft && !hardMacro) {
          if (ses.active) {
            st = {
              code: 'WORK',
              cls: 'st-work',
              title: 'PRACUJE',
              detail: 'sesja ' + ses.where + ' \u00b7 profil ' + ses.profile + (detail ? ' \u00b7 \u26a0 ' + detail : ''),
              hb: st.hb
            };
          } else {
            st = {
              code: 'WAIT',
              cls: 'st-wait',
              title: 'CZEKA',
              detail: detail || ('Poza sesj\u0105 \u00b7 ' + ses.phase),
              hb: st.hb
            };
          }
        }
      }

      if (st.code === 'WAIT' && ses.active) {
        st = {
          code: 'WORK',
          cls: 'st-work',
          title: 'PRACUJE',
          detail: 'sesja ' + ses.where + ' \u00b7 profil ' + ses.profile + ' \u00b7 skan aktywny',
          hb: st.hb
        };
      }

      try {
        if (!allowStop() && global.ST) {
          global.ST.blocked = false;
          global.ST.stopForDay = false;
        }
      } catch (e) {}

      return st;
    };
    global.BTX_ASSISTANT.opsStatus.__statusFix = true;

    try {
      if (typeof global.render === 'function') global.render();
    } catch (e2) {}
  }

  function boot() {
    patch();
    setInterval(patch, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
