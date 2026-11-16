/**
 * Progi daytrade + autonomia ON.
 */
(function (global) {
  'use strict';
  if (global.__BTX_TRADE_PATH__) return;
  global.__BTX_TRADE_PATH__ = true;

  function applyPro() {
    try {
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
      }
    } catch (e) {}
  }

  function ensureAuto() {
    try {
      if (localStorage.getItem('BTX_AUTONOMY_ON') !== '0') {
        localStorage.setItem('BTX_AUTONOMY_ON', '1');
        if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start && !global.BTX_AUTONOMY.__pathStarted) {
          global.BTX_AUTONOMY.__pathStarted = true;
          try { global.BTX_AUTONOMY.start(); } catch (e2) {}
        }
      }
    } catch (e) {}
  }

  function softOpenGate() {
    if (typeof global.openPos !== 'function' || global.openPos.__tradePath) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      try { if (global.ST) global.ST.blocked = false; } catch (e) {}
      return prev.apply(this, arguments);
    };
    global.openPos.__tradePath = true;
  }

  function boot() {
    applyPro();
    ensureAuto();
    softOpenGate();
    setInterval(function () {
      applyPro();
      ensureAuto();
      softOpenGate();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
