/**
 * Entry path boost: ORB path B gdy strategy zwróci WAIT. Nie obniża progów APEX.
 */
(function (global) {
  'use strict';
  if (global.__BTX_ENTRY_BOOST__) return;
  global.__BTX_ENTRY_BOOST__ = true;

  function applyPro() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (!P) return;
    if (P.scoreMin == null) P.scoreMin = 3;
    if (P.primeExtra == null) P.primeExtra = 1;
    if (P.minStrengthOpen == null) P.minStrengthOpen = 2;
    if (P.minRvol == null) P.minRvol = 0.5;
  }

  function sma(arr, n) {
    if (!arr || arr.length < n) return null;
    var s = 0;
    for (var i = arr.length - n; i < arr.length; i++) s += arr[i].c;
    return s / n;
  }

  function tryOrb(m, g) {
    if (!m || !g || g.side !== 'WAIT') return g;
    var ST = global.ST;
    var b = ST && ST.series && ST.series[m.s];
    if (!b || b.length < 40) return g;
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO || {};
    var orBars = P.orBars || 6;
    var sess = b.slice(-Math.min(b.length, 80));
    if (sess.length < orBars + 2 || sess.length > 20) return g;
    var hi = -Infinity, lo = Infinity;
    for (var i = 0; i < orBars; i++) {
      if (sess[i].h > hi) hi = sess[i].h;
      if (sess[i].l < lo) lo = sess[i].l;
    }
    var c = sess[sess.length - 1].c;
    var s20 = sma(b, 20);
    if (s20 == null) return g;
    var atrN = 14, trs = [];
    for (var j = b.length - atrN; j < b.length; j++) {
      if (j < 1) continue;
      var tr = Math.max(b[j].h - b[j].l, Math.abs(b[j].h - b[j - 1].c), Math.abs(b[j].l - b[j - 1].c));
      trs.push(tr);
    }
    var a = trs.length ? trs.reduce(function (x, y) { return x + y; }, 0) / trs.length : c * 0.003;
    if (!(a > 0)) return g;
    var allowShort = !!(global.CFG && global.CFG.allowShort) || !!(P.allowShort);
    var step = 3, ht = [];
    for (var k = b.length % step; k < b.length; k += step) ht.push(b[k]);
    var htS = sma(ht, Math.min(20, ht.length));
    var trend = 0;
    if (htS != null) {
      if (c > htS * 1.001) trend = 1;
      if (c > htS * 1.004) trend = 2;
      if (c < htS * 0.999) trend = -1;
      if (c < htS * 0.996) trend = -2;
    }
    var extHi = (c - hi) / a, extLo = (lo - c) / a;
    if (c > hi && c > s20 && trend >= 1 && extHi >= 0 && extHi <= 1.0) {
      g.side = 'LONG'; g.strength = 2;
      g.why = 'ORB path \u00b7 HTF up \u00b7 wybicie zakresu otwarcia';
      g.sym = g.sym || m.s; g.price = c; g.atr = a;
      if (!g._pro) g._pro = { scoreL: 3, scoreS: 0, need: 3, veto: '', t15: trend };
      else { g._pro.scoreL = Math.max(g._pro.scoreL || 0, 3); g._pro.need = Math.min(g._pro.need || 3, 3); g._pro.veto = ''; }
    } else if (allowShort && c < lo && c < s20 && trend <= -1 && extLo >= 0 && extLo <= 1.0) {
      g.side = 'SHORT'; g.strength = 2;
      g.why = 'ORB path \u00b7 HTF down \u00b7 wybicie zakresu otwarcia';
      g.sym = g.sym || m.s; g.price = c; g.atr = a;
      if (!g._pro) g._pro = { scoreL: 0, scoreS: 3, need: 3, veto: '', t15: trend };
      else { g._pro.scoreS = Math.max(g._pro.scoreS || 0, 3); g._pro.need = Math.min(g._pro.need || 3, 3); g._pro.veto = ''; }
    }
    return g;
  }

  function install() {
    applyPro();
    if (typeof global.evaluate !== 'function') return;
    if (global.evaluate.__entryBoost) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      applyPro();
      var g = orig.apply(this, arguments);
      try {
        if (g && g.side === 'WAIT') g = tryOrb(m, g);
        if (g && (g.side === 'LONG' || g.side === 'SHORT') && !g._pro) {
          g._pro = {
            scoreL: g.side === 'LONG' ? Math.max(3, (g.strength || 2) * 2) : 0,
            scoreS: g.side === 'SHORT' ? Math.max(3, (g.strength || 2) * 2) : 0,
            need: 3, veto: ''
          };
        }
      } catch (e) {}
      return g;
    };
    try { Object.keys(orig).forEach(function (k) { global.evaluate[k] = orig[k]; }); } catch (e2) {}
    global.evaluate.__entryBoost = true;
  }

  function boot() { install(); setInterval(install, 4000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
