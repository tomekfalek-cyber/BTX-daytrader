/**
 * Paper Open Engine — daytrader MA otwiera pozycje paper.
 */
(function (global) {
  'use strict';
  if (global.__BTX_PAPER_OPEN__) return;
  global.__BTX_PAPER_OPEN__ = true;

  function applyThresholds() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (P) {
      P.scoreMin = 2;
      P.primeExtra = 0;
      P.minRvol = 0.35;
      P.minStrengthOpen = 2;
      P.requireTrend = false;
      P.strictCore = true;
    }
    if (global.CFG) {
      global.CFG.maxTrades = Math.max(global.CFG.maxTrades || 0, 8);
      global.CFG.maxPos = global.CFG.maxPos || 2;
      global.CFG.autoSec = Math.min(global.CFG.autoSec || 120, 120);
    }
    try {
      if (global.ST) global.ST.blocked = false;
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      if (localStorage.getItem('BTX_AUTONOMY_ON') !== '0') {
        localStorage.setItem('BTX_AUTONOMY_ON', '1');
      }
    } catch (e) {}
  }

  function unwrapOpenBlocks() {
    if (typeof global.openPos !== 'function') return;
    if (global.openPos.__paperOpen) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      applyThresholds();
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return;
      try { if (global.ST) global.ST.blocked = false; } catch (e) {}
      return prev.apply(this, arguments);
    };
    global.openPos.__paperOpen = true;
  }

  function forceOpenIfIdle() {
    var ST = global.ST;
    if (!ST) return;
    var nPos = Object.keys(ST.pos || {}).length;
    if (nPos > 0) return;
    if ((ST.dayTrades || 0) >= 8) return;

    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }

    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.tryOpenBest) {
      var r = global.BTX_AUTONOMY.tryOpenBest();
      if (r) return;
    }

    var sig = (ST.sig || []).filter(function (g) {
      return g && (g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 2;
    });
    sig.sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    if (sig.length && typeof global.openPos === 'function') {
      var g = sig[0];
      if (!ST.pos[g.sym]) {
        global.openPos(g);
        if (global.log) global.log('PaperEngine OPEN ' + g.side + ' ' + g.sym + ' str=' + g.strength, 'g');
        if (global.toast) global.toast('Paper OPEN: ' + g.side + ' ' + g.sym, 'ok');
      }
    }
  }

  function boot() {
    applyThresholds();
    unwrapOpenBlocks();
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start) {
      try { global.BTX_AUTONOMY.start(); } catch (e) {}
    }
    setTimeout(forceOpenIfIdle, 2500);
    setTimeout(forceOpenIfIdle, 8000);
    setInterval(function () {
      applyThresholds();
      unwrapOpenBlocks();
      forceOpenIfIdle();
    }, 90 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
