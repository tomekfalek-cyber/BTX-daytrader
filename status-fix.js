/**
 * Status fix — wymusza PRACUJE w godzinach sesji; STOP FOR DAY off.
 * Łata panel #btx-ops bezpośrednio (wewnętrzne opsStatus w closure).
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
    if (w.weekend) return { active: false, phase: 'WEEKEND', where: '', profile: profile(), label: w.label, weekend: true };
    var inEu = w.min >= 9 * 60 && w.min < 17 * 60 + 30;
    var inUs = w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var prof = profile();
    var active = prof === 'RANO' ? inEu : (prof === 'US' ? inUs : (inEu || inUs));
    var where = inUs && inEu ? 'EU+US' : (inUs ? 'US' : (inEu ? 'EU (RANO)' : ''));
    return { active: active, phase: inUs ? 'US' : (inEu ? 'EU' : 'OFF'), where: where, profile: prof, label: w.label, weekend: false };
  }

  function clearStop() {
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
      if (global.ST) { global.ST.blocked = false; global.ST.stopForDay = false; }
    } catch (e) {}
  }

  function forcePanel() {
    var ses = sessionActive();
    var el = document.getElementById('btx-ops');
    if (!el) return;
    var stSpan = el.querySelector('.st-block, .st-wait, .st-work');
    if (!stSpan) return;
    if (ses.active) {
      stSpan.className = 'st-work';
      stSpan.textContent = 'PRACUJE';
      var subs = el.querySelectorAll('.sub');
      if (subs && subs.length > 1) {
        subs[1].textContent = 'sesja ' + ses.where + ' \u00b7 profil ' + ses.profile + ' \u00b7 skan aktywny \u00b7 STOP DAY off';
      }
    }
  }

  function patchOps() {
    if (!global.BTX_ASSISTANT) return;
    clearStop();
    global.BTX_ASSISTANT.opsStatus = function () {
      clearStop();
      var ses = sessionActive();
      if (ses.active) {
        return {
          code: 'WORK',
          cls: 'st-work',
          title: 'PRACUJE',
          detail: 'sesja ' + ses.where + ' \u00b7 profil ' + ses.profile + ' \u00b7 skan aktywny \u00b7 STOP DAY off',
          hb: { blocks: [], warns: [], ses: ses, data: { ok: true, label: 'scan' } }
        };
      }
      if (ses.weekend) {
        return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (weekend)', detail: 'Parkiety zamkni\u0119te', hb: { blocks: [], ses: ses, data: {} } };
      }
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA', detail: 'Poza sesj\u0105 \u00b7 ' + ses.phase, hb: { blocks: [], ses: ses, data: {} } };
    };
    global.BTX_ASSISTANT.opsStatus.__statusFix = true;
    forcePanel();
  }

  function boot() {
    clearStop();
    try { if (localStorage.getItem('BTX_AUTONOMY_ON') !== '0') localStorage.setItem('BTX_AUTONOMY_ON', '1'); } catch (e) {}
    patchOps();
    setInterval(function () {
      clearStop();
      patchOps();
      forcePanel();
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
