/**
 * Trade Flow Guard — pilnuje, zeby paper daytrading nie stawal przez stare flagi.
 */
(function (global) {
  'use strict';
  if (global.__BTX_FLOW_GUARD__) return;
  global.__BTX_FLOW_GUARD__ = true;

  function unlock() {
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_LEARNER_MODE', 'trade');
      // ZAWSZE: autonomia ON, blokada dnia OFF przy aktywnym bocie
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
      localStorage.setItem('BTX_KILL_SWITCH', '0');
    } catch (e) {}
    try {
      if (global.ST) {
        global.ST.blocked = false;
        global.ST.stopForDay = false;
      }
    } catch (e2) {}
    // UI toggle autonomii jesli istnieje
    try {
      var el = document.getElementById('btx-auto-toggle');
      if (el) {
        if (el.type === 'checkbox') el.checked = true;
        el.setAttribute('aria-pressed', 'true');
      }
    } catch (e3) {}
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__flowGuard) return;
    var orig = global.cycle;
    global.cycle = function () {
      unlock();
      var r = orig.apply(this, arguments);
      // po cyklu: jesli sa sygnaly LONG/SHORT a 0 pozycji i autonomia ON — sprobuj open
      try {
        var ST = global.ST;
        if (!ST || !ST.sig) return r;
        var act = ST.sig.filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
        var posN = ST.pos ? Object.keys(ST.pos).length : 0;
        var maxP = (global.CFG && global.CFG.maxPos) || 2;
        if (act.length && posN < maxP) {
          if (global.BTX_APEX && typeof global.BTX_APEX.tryOpen === 'function') global.BTX_APEX.tryOpen();
          else if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tryOpenBest === 'function') global.BTX_AUTONOMY.tryOpenBest();
          else if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tryOpen === 'function') global.BTX_AUTONOMY.tryOpen();
        }
      } catch (e3) {}
      return r;
    };
    global.cycle.__flowGuard = true;
  }

  function boot() {
    unlock();
    patchCycle();
    setInterval(function () { unlock(); patchCycle(); }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
  else setTimeout(boot, 800);
})(typeof window !== 'undefined' ? window : globalThis);
