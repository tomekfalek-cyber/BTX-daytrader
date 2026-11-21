/**
 * EOD flat pro — 15 min przed koncem sesji US: bez nowych wejsc + soft close paper na time-stop szybciej.
 */
(function (global) {
  'use strict';
  if (global.__BTX_EOD_FLAT__) return;
  global.__BTX_EOD_FLAT__ = true;

  function warsawMin() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || '')
    };
  }

  function inUsManageOnly() {
    var w = warsawMin();
    if (w.weekend) return false;
    // US close ~22:00 PL; manage-only from 21:45
    return w.min >= 21 * 60 + 45 && w.min < 22 * 60 + 15;
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__eodFlat) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      if (inUsManageOnly()) {
        if (global.log) global.log('EOD: brak nowych wejsc (bufor zamkniecia US)', 'i');
        return;
      }
      return prev.apply(this, arguments);
    };
    global.openPos.__eodFlat = true;
  }

  function softFlat() {
    if (!inUsManageOnly()) return;
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    Object.keys(ST.pos).forEach(function (sym) {
      var p = ST.pos[sym];
      if (!p) return;
      // po 21:50 PL zamykaj paper na rynku jesli trzyma > 6 swiec
      var w = warsawMin();
      if (w.min >= 21 * 60 + 50 && (p.bars || 0) >= 6 && typeof global.closePos === 'function') {
        try {
          var px = null;
          if (typeof global.last === 'function' && global.last(sym)) px = global.last(sym).c;
          global.closePos(sym, 'EOD flat US', px);
          if (global.log) global.log('EOD flat paper: ' + sym, 'i');
        } catch (e) {}
      }
    });
  }

  function boot() {
    patchOpen();
    softFlat();
    setInterval(function () { patchOpen(); softFlat(); }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
