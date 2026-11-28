/**
 * Daytrade boost: autonomia co cykl, bez martwego dnia przez LIVE/STOP.
 */
(function (global) {
  'use strict';
  if (global.__BTX_DT_BOOST__) return;
  global.__BTX_DT_BOOST__ = true;

  function unlock() {
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_LEARNER_MODE', 'trade');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      // STOP DAY wylaczony domyslnie (wlacz recznie w ustawieniach)
      if (localStorage.getItem('BTX_ALLOW_STOP_DAY') == null) {
        localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      }
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
    } catch (e) {}
    try {
      if (global.ST) {
        // nie trzymamy permanentnej blokady gdy stop day OFF
        if (localStorage.getItem('BTX_ALLOW_STOP_DAY') !== '1') {
          global.ST.blocked = false;
          global.ST.stopForDay = false;
        }
      }
    } catch (e2) {}
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (P) {
      if (P.scoreMin == null || P.scoreMin > 3) P.scoreMin = 3;
      if (P.minStrengthOpen == null || P.minStrengthOpen > 2) P.minStrengthOpen = 2;
      if (P.primeExtra == null || P.primeExtra > 0) P.primeExtra = 0;
      if (P.minRvol != null && P.minRvol > 0.5) P.minRvol = 0.35;
    }
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__dtBoost) return;
    var orig = global.cycle;
    global.cycle = function () {
      unlock();
      var ret = orig.apply(this, arguments);
      try {
        if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tryOpen === 'function') {
          global.BTX_AUTONOMY.tryOpen();
        } else if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.scan === 'function') {
          global.BTX_AUTONOMY.scan();
        }
      } catch (e) {}
      return ret;
    };
    global.cycle.__dtBoost = true;
  }

  function boot() {
    unlock();
    patchCycle();
    setInterval(function () { unlock(); patchCycle(); }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
