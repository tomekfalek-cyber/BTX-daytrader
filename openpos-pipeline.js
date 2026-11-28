/**
 * 2) Jeden pipeline openPos (finalny straznik):
 * strategy gate/size -> capital -> open core -> log
 * Owijka na koncu lancucha: nie duplikuje strategii, tylko porzadkuje odpornosc.
 */
(function (global) {
  'use strict';
  if (global.__BTX_OPENPOS_PIPE__) return;
  global.__BTX_OPENPOS_PIPE__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  function install() {
    if (typeof global.openPos !== 'function') return;
    if (global.openPos.__pipeline) return;
    var prev = global.openPos;

    global.openPos = function (g) {
      if (!g || g.side === 'WAIT') return;
      var ST = global.ST;
      if (!ST) return;

      // STOP DAY wylaczony domyslnie
      try {
        if (localStorage.getItem('BTX_ALLOW_STOP_DAY') !== '1') {
          ST.blocked = false;
          ST.stopForDay = false;
        }
      } catch (e) {}

      if (ST.blocked) {
        log('PIPE: blokada dnia — ' + g.sym, 'i');
        return;
      }

      // max pozycji
      var maxP = (global.CFG && global.CFG.maxPos) || 2;
      var n = ST.pos ? Object.keys(ST.pos).length : 0;
      if (n >= maxP) {
        log('PIPE: max pozycji ' + n + '/' + maxP + ' — ' + g.sym, 'i');
        return;
      }
      if (ST.pos && ST.pos[g.sym]) {
        log('PIPE: juz otwarte ' + g.sym, 'i');
        return;
      }

      // cash
      if (!(ST.cash > 0)) {
        log('PIPE: brak cash', 'r');
        return;
      }

      var cashBefore = +ST.cash;
      var eqBefore = +ST.equity;
      var ret = prev.apply(this, arguments);

      // po open: cash nie moze byc ujemny
      try {
        if (ST.cash < -0.01) {
          if (ST.pos && ST.pos[g.sym]) delete ST.pos[g.sym];
          ST.cash = cashBefore;
          ST.equity = eqBefore;
          log('PIPE: cofnieto ' + g.sym + ' — cash na minus', 'r');
          return;
        }
        if (ST.pos && ST.pos[g.sym]) {
          log('PIPE OK ' + g.side + ' ' + g.sym + ' cash=' + (+ST.cash).toFixed(2), 'g');
        }
      } catch (e2) {}
      return ret;
    };
    global.openPos.__pipeline = true;
  }

  function boot() {
    install();
    if (global.BTX_TICK && global.BTX_TICK.on) {
      global.BTX_TICK.on(install, 'openpos-pipeline');
    } else {
      setInterval(install, 4000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
  else setTimeout(boot, 1200);
})(typeof window !== 'undefined' ? window : globalThis);
