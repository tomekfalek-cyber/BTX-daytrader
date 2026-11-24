/**
 * BTX Entry Engine — jeden kanoniczny pipeline wejscia.
 * Kolejnosc: flagi -> limity -> ranking -> openPos (capital-lock juz owija nizej/wczesniej).
 * Logi: OPEN / SKIP: powod
 */
(function (global) {
  'use strict';
  if (global.__BTX_ENTRY_ENGINE__) return;
  global.__BTX_ENTRY_ENGINE__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  function forceFlags() {
    try {
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
      localStorage.setItem('BTX_KILL_SWITCH', '0');
    } catch (e) {}
    if (global.ST) {
      global.ST.blocked = false;
      global.ST.stopForDay = false;
    }
  }

  function skipReason(g) {
    var ST = global.ST || {};
    var CFG = global.CFG || {};
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return 'brak kierunku';
    if (ST.blocked) return 'blokada dnia';
    var maxP = CFG.maxPos || 2;
    var n = ST.pos ? Object.keys(ST.pos).length : 0;
    if (n >= maxP) return 'max pozycji ' + n + '/' + maxP;
    if (ST.pos && ST.pos[g.sym]) return 'juz otwarte ' + g.sym;
    if (ST.cool && ST.cool[g.sym] > 0) return 'cooldown ' + g.sym;
    if (!(ST.cash > 0)) return 'brak cash';
    if ((g.strength || 0) < 2) return 'sila < 2';
    return '';
  }

  function rankTop() {
    var sig = (global.ST && global.ST.sig) || [];
    var out = [];
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var q = (g.strength || 0) * 20;
      if (g.desk && g.desk.score) q += g.desk.score * 0.5;
      try {
        if (global.BTX_APEX && global.BTX_APEX.qualityScore) q = Math.max(q, global.BTX_APEX.qualityScore(g));
      } catch (e) {}
      out.push({ g: g, q: q });
    }
    out.sort(function (a, b) { return b.q - a.q; });
    return out;
  }

  function tryOpenBest() {
    forceFlags();
    var ranked = rankTop();
    if (!ranked.length) {
      log('SKIP: brak sygnalow LONG/SHORT na radarze', 'i');
      return null;
    }
    for (var i = 0; i < ranked.length; i++) {
      var g = ranked[i].g;
      var why = skipReason(g);
      if (why) {
        log('SKIP: ' + g.sym + ' ' + g.side + ' — ' + why, 'i');
        continue;
      }
      if (typeof global.openPos !== 'function') {
        log('SKIP: brak openPos', 'r');
        return null;
      }
      var before = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      global.openPos(g);
      var after = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
      if (after > before) {
        log('OPEN ' + g.side + ' ' + g.sym + ' (entry-engine q=' + Math.round(ranked[i].q) + ')', 'g');
        return g;
      }
      log('SKIP: ' + g.sym + ' — openPos nie utworzyl pozycji (sizing/sesja/capital)', 'i');
    }
    return null;
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__entryEng) return;
    var orig = global.cycle;
    global.cycle = function () {
      forceFlags();
      var r = orig.apply(this, arguments);
      try { tryOpenBest(); } catch (e) {}
      return r;
    };
    global.cycle.__entryEng = true;
  }

  global.BTX_ENTRY = { tryOpenBest: tryOpenBest, skipReason: skipReason, rankTop: rankTop };

  function boot() {
    forceFlags();
    patchCycle();
    setInterval(function () { forceFlags(); patchCycle(); }, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1500); });
  else setTimeout(boot, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
