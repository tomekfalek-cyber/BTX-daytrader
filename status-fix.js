/**
 * STOP FOR DAY off — bez ruszania DOM (nie psuje przycisków).
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

  function boot() {
    clearStop();
    setInterval(clearStop, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
