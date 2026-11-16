/**
 * Odblokowanie learner-pack: observe + STOP nie blokują paper openPos.
 */
(function (global) {
  'use strict';
  if (global.__BTX_FIX_LEARNER__) return;
  global.__BTX_FIX_LEARNER__ = true;

  function unlock() {
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.removeItem('BTX_STOP_DAY');
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      if (global.ST) global.ST.blocked = false;
    } catch (e) {}
  }

  function rewrap() {
    if (typeof global.openPos !== 'function') return;
    if (global.openPos.__fixLearner) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      unlock();
      return prev.apply(this, arguments);
    };
    global.openPos.__fixLearner = true;
  }

  function boot() {
    unlock();
    rewrap();
    setInterval(function () { unlock(); rewrap(); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
