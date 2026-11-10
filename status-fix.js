/**
 * Wymusza PRACUJE w godzinach sesji — bezpośrednio w panelu #btx-ops.
 * STOP FOR DAY off. Nie zależy od wewnętrznego opsStatus (closure).
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
    if (w.weekend) return { active: false, where: '', profile: profile(), weekend: true };
    var inEu = w.min >= 9 * 60 && w.min < 17 * 60 + 30;
    var inUs = w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var prof = profile();
    var active = prof === 'RANO' ? inEu : (prof === 'US' ? inUs : (inEu || inUs));
    var where = inUs && inEu ? 'EU+US' : (inUs ? 'US' : (inEu ? 'EU (RANO)' : ''));
    return { active: active, where: where, profile: prof, weekend: false };
  }

  function clearStop() {
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
      if (global.ST) {
        global.ST.blocked = false;
        global.ST.stopForDay = false;
      }
    } catch (e) {}
    var b = document.getElementById('limit-badge');
    if (b && /BLOKADA|STOP/i.test(b.textContent || '')) {
      b.textContent = 'STOP DAY: OFF';
      b.style.color = 'var(--tx3,#94a3b8)';
    }
  }

  function forcePanel() {
    clearStop();
    var ses = sessionActive();
    var el = document.getElementById('btx-ops');
    if (!el) return;

    var stSpan = el.querySelector('.st-block, .st-wait, .st-work');
    if (stSpan && ses.active) {
      if (stSpan.textContent !== 'PRACUJE' || stSpan.className !== 'st-work') {
        stSpan.className = 'st-work';
        stSpan.textContent = 'PRACUJE';
      }
    }

    // Podmiana szczegółów pod statusem
    if (ses.active) {
      var cells = el.querySelectorAll('.cell');
      // nic krytycznego
      var detail = 'sesja ' + ses.where + ' \u00b7 profil ' + ses.profile + ' \u00b7 skan aktywny \u00b7 STOP DAY off';
      el.querySelectorAll('.sub').forEach(function (sub, idx) {
        if (idx === 1 || /BLOKADA|nie-LIVE|STOP FOR DAY|pre-market|CZEKA \(pre/i.test(sub.textContent || '')) {
          sub.textContent = detail;
        }
      });
    }

    // Autonomia ON w sesji
    if (ses.active) {
      try {
        if (localStorage.getItem('BTX_AUTONOMY_ON') !== '0') {
          localStorage.setItem('BTX_AUTONOMY_ON', '1');
        }
      } catch (e2) {}
    }
  }

  var obs = null;
  function watch() {
    var el = document.getElementById('btx-ops');
    if (!el) return;
    if (obs) return;
    obs = new MutationObserver(function () {
      forcePanel();
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    forcePanel();
  }

  function boot() {
    clearStop();
    forcePanel();
    watch();
    setInterval(function () {
      forcePanel();
      watch();
    }, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
