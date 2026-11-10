/**
 * Lekka poprawka: STOP FOR DAY off + status bez niszczenia UI.
 * BEZ MutationObserver / BEZ przepisywania całego panelu (to psuło guziki).
 */
(function (global) {
  'use strict';
  if (global.__BTX_STATUS_FIX__) return;
  global.__BTX_STATUS_FIX__ = true;

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
  }

  function softStatus() {
    clearStop();
    // Tylko tekst statusu — bez ruszania przycisków i layoutu
    try {
      var el = document.getElementById('btx-ops');
      if (!el) return;
      var st = el.querySelector('.st-block');
      if (!st) return;
      // Jeśli to tylko miękka blokada danych — pokaż PRACUJE
      var sub = '';
      el.querySelectorAll('.sub').forEach(function (s) { sub += ' ' + (s.textContent || ''); });
      if (/Dane nie-LIVE|DEMO|STOP FOR DAY|Limity konta/i.test(st.textContent + sub) &&
          !/Makro HIGH|News blackout/i.test(sub)) {
        st.className = 'st-work';
        st.textContent = 'PRACUJE';
      }
    } catch (e2) {}

    var b = document.getElementById('limit-badge');
    if (b && /BLOKADA|STOP FOR DAY/i.test(b.textContent || '')) {
      b.textContent = 'STOP DAY: OFF';
      try { b.style.color = 'var(--tx3,#94a3b8)'; } catch (e3) {}
    }
  }

  function boot() {
    clearStop();
    softStatus();
    // rzadko — nie walczy z renderem co klatkę
    setInterval(softStatus, 8000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
