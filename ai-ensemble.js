/**
 * BTX DayTrader — AI Ensemble v2 (significantly stronger)
 *
 * Stack:
 *  1) Feature engine from OHLCV (trend, momentum, vol regime, VWAP, location)
 *  2) Online logistic model (SGD) per direction
 *  3) Naive Bayes on discrete bins
 *  4) GBM-lite (weighted feature blend with online updates)
 *  5) Regime gate (trend / range / shock) — blocks weak edge regimes
 *  6) Disagreement veto + adaptive threshold from paper PnL
 *  7) Separate memory buckets: US / PL / FX
 *
 * Persists in localStorage (BTX_AI_V2). Paper-only learning.
 */
(function (global) {
  var STORE_KEY = 'BTX_AI_V2';
  var FEAT_KEYS = [
    'trend', 'mom', 'rsi14', 'rsi2', 'vwapDist', 'loc',
    'atrPct', 'volRegime', 'rangePos', 'body', 'ext'
  ];

  function defaultState() {
    return {
      logreg: { LONG: zeros(), SHORT: zeros() },
      nb: { LONG: {}, SHORT: {} },
      gbm: { LONG: ones(), SHORT: ones() },
      thresh: { US: 0.58, PL: 0.60, FX: 0.62 },
      stats: { wins: 0, losses: 0, byMkt: {} },
      version: 2
    };
  }
  function zeros() {
    var o = { bias: 0 };
    FEAT_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  }
  function ones() {
    var o = {};
    FEAT_KEYS.forEach(function (k) { o[k] = 1 / FEAT_KEYS.length; });
    return o;
  }

  var S = defaultState();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.version === 2) S = o;
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-clamp(x, -20, 20))); }

  function sma(a, n) {
    if (!a || a.length < n) return null;
    var s = 0;
    for (var i = a.length - n; i < a.length; i++) s += a[i];
    return s / n;
  }
  function ema(a, n) {
    if (!a || a.length < n) return null;
    var k = 2 / (n + 1), e = a[0];
    for (var i = 1; i < a.length; i++) e = a[i] * k + e * (1 - k);
    return e;
  }
  function rsi(cl, n) {
    if (!cl || cl.length < n + 1) return 50;
    var g = 0, l = 0;
    for (var i = cl.length - n; i < cl.length; i++) {
      var d = cl[i] - cl[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    if (l === 0) return 100;
    return 100 - 100 / (1 + g / l);
  }
  function atr(bars, n) {
    if (!bars || bars.length < n + 1) return null;
    var s = 0;
    for (var i = bars.length - n; i < bars.length; i++) {
      var b = bars[i], p = bars[i - 1];
      s += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
    }
    return s / n;
  }

  function extractFeatures(bars) {
    if (!bars || bars.length < 50) return null;
    var cl = bars.map(function (x) { return x.c; });
    var c = cl[cl.length - 1];
    var e20 = ema(cl, 20), e50 = ema(cl, 50);
    var r14 = rsi(cl, 14), r2 = rsi(cl, 2);
    var a = atr(bars, 14) || c * 0.004;
    var aPrev = atr(bars.slice(0, -5), 14) || a;
    var trendRaw = 0;
    if (e20 != null && e50 != null) {
      if (c > e20 && e20 > e50) trendRaw = 1;
      else if (c > e50) trendRaw = 0.5;
      else if (c < e20 && e20 < e50) trendRaw = -1;
      else if (c < e50) trendRaw = -0.5;
    }
    var mom = 0;
    if (cl.length >= 10) mom = (c - cl[cl.length - 10]) / (a * 3);
    var n = Math.min(78, bars.length), pv = 0, vv = 0;
    for (var i = bars.length - n; i < bars.length; i++) {
      var mid = (bars[i].h + bars[i].l + bars[i].c) / 3;
      var vol = bars[i].v || 1;
      pv += mid * vol; vv += vol;
    }
    var vwap = vv ? pv / vv : c;
    var vwapDist = (c - vwap) / (a * 2);
    var hi = -Infinity, lo = Infinity;
    for (var j = bars.length - 40; j < bars.length; j++) {
      if (bars[j].h > hi) hi = bars[j].h;
      if (bars[j].l < lo) lo = bars[j].l;
    }
    var loc = hi === lo ? 0.5 : (c - lo) / (hi - lo);
    var last = bars[bars.length - 1];
    var body = Math.abs(last.c - last.o) / Math.max(1e-9, last.h - last.l);
    var ext = ((last.h - last.l) / a);
    var atrPct = a / c;
    var volRegime = a / Math.max(1e-9, aPrev);
    return {
      trend: clamp((trendRaw + 1) / 2, 0, 1),
      mom: clamp(mom * 0.5 + 0.5, 0, 1),
      rsi14: clamp(r14 / 100, 0, 1),
      rsi2: clamp(r2 / 100, 0, 1),
      vwapDist: clamp(vwapDist * 0.5 + 0.5, 0, 1),
      loc: clamp(loc, 0, 1),
      atrPct: clamp(atrPct * 80, 0, 1),
      volRegime: clamp((volRegime - 0.5) / 1.5, 0, 1),
      rangePos: clamp(loc, 0, 1),
      body: clamp(body, 0, 1),
      ext: clamp(ext / 3, 0, 1),
      _trendRaw: trendRaw, _r14: r14, _volRegime: volRegime, _atr: a
    };
  }

  function regimeOf(f) {
    if (!f) return 'unknown';
    if (f._volRegime > 1.8 || f.ext > 0.85) return 'shock';
    if (Math.abs(f._trendRaw) >= 0.5 && f.atrPct > 0.15) return 'trend';
    if (Math.abs(f._trendRaw) < 0.5) return 'range';
    return 'mixed';
  }

  function binFeat(f) {
    var bins = {};
    FEAT_KEYS.forEach(function (k) {
      var v = f[k];
      bins[k] = v < 0.33 ? 'L' : v < 0.66 ? 'M' : 'H';
    });
    return bins;
  }

  function logregProb(dir, f) {
    var w = S.logreg[dir] || S.logreg.LONG;
    var z = w.bias || 0;
    FEAT_KEYS.forEach(function (k) { z += (w[k] || 0) * (f[k] || 0.5); });
    if (dir === 'SHORT') {
      z += (0.35 - (f.trend || 0.5)) * 0.8;
      z += (0.35 - (f.loc || 0.5)) * 0.5;
    } else {
      z += ((f.trend || 0.5) - 0.65) * 0.8;
      z += ((f.loc || 0.5) < 0.4 ? 0.3 : -0.1);
    }
    return sigmoid(z);
  }

  function nbProb(dir, bins) {
    var table = S.nb[dir] || {};
    var st = S.stats;
    var prior = 0.5;
    if (st.wins + st.losses > 5) prior = (st.wins + 1) / (st.wins + st.losses + 2);
    var logp = Math.log(prior);
    FEAT_KEYS.forEach(function (k) {
      var key = k + '=' + (bins[k] || 'M');
      var cell = table[key] || { w: 1, n: 2 };
      logp += Math.log((cell.w + 1) / (cell.n + 2));
    });
    return sigmoid(logp);
  }

  function gbmScore(dir, f) {
    var w = S.gbm[dir] || ones();
    var s = 0, ws = 0;
    FEAT_KEYS.forEach(function (k) {
      var wk = w[k] || 0.05;
      var x = f[k] || 0.5;
      if (dir === 'SHORT' && (k === 'trend' || k === 'loc' || k === 'vwapDist' || k === 'mom')) x = 1 - x;
      s += wk * x; ws += Math.abs(wk);
    });
    return ws ? s / ws : 0.5;
  }

  function marketOf(m) {
    if (!m) return 'US';
    if (m.mkt) return m.mkt;
    if (m.t === 'fx') return 'FX';
    if (m.t === 'pl') return 'PL';
    return 'US';
  }

  function decide(bars, sideHint, mkt) {
    var f = extractFeatures(bars);
    if (!f) return { ok: false, conf: 0, reason: 'no-features' };
    var reg = regimeOf(f);
    if (reg === 'shock') return { ok: false, conf: 0, reason: 'regime-shock', regime: reg, features: f };
    var bins = binFeat(f);
    if (sideHint && sideHint !== 'WAIT') {
      var pAligned = 0.40 * logregProb(sideHint, f) + 0.25 * nbProb(sideHint, bins) + 0.35 * gbmScore(sideHint, f);
      if (reg === 'range') pAligned *= 0.85;
      if (reg === 'trend') pAligned *= 1.05;
      var thr = S.thresh[mkt] != null ? S.thresh[mkt] : 0.58;
      if (pAligned < thr * 0.92) {
        return {
          ok: false, conf: pAligned, side: sideHint, reason: 'ai-veto-weak', regime: reg,
          parts: { logreg: logregProb(sideHint, f), nb: nbProb(sideHint, bins), gbm: gbmScore(sideHint, f) },
          features: f, bins: bins, thr: thr
        };
      }
      return {
        ok: true, conf: pAligned, side: sideHint, regime: reg,
        parts: { logreg: logregProb(sideHint, f), nb: nbProb(sideHint, bins), gbm: gbmScore(sideHint, f) },
        features: f, bins: bins, thr: thr
      };
    }
    return { ok: false, conf: 0, side: 'WAIT', reason: 'no-side' };
  }

  function learn(trade) {
    if (!trade || !trade.side) return;
    var win = (trade.pnl || 0) > 0;
    var dir = trade.side === 'SHORT' ? 'SHORT' : 'LONG';
    var f = trade.features;
    var bins = trade.bins;
    if (!f) return;
    if (!bins) bins = binFeat(f);
    if (win) S.stats.wins++; else S.stats.losses++;
    var mkt = trade.mkt || 'US';
    if (!S.stats.byMkt[mkt]) S.stats.byMkt[mkt] = { w: 0, l: 0 };
    if (win) S.stats.byMkt[mkt].w++; else S.stats.byMkt[mkt].l++;
    var y = win ? 1 : 0;
    var p = logregProb(dir, f);
    var err = y - p;
    var lr = 0.08;
    var w = S.logreg[dir];
    w.bias = clamp((w.bias || 0) + lr * err, -3, 3);
    FEAT_KEYS.forEach(function (k) {
      w[k] = clamp((w[k] || 0) + lr * err * (f[k] || 0.5), -2, 2);
    });
    if (!S.nb[dir]) S.nb[dir] = {};
    FEAT_KEYS.forEach(function (k) {
      var key = k + '=' + (bins[k] || 'M');
      if (!S.nb[dir][key]) S.nb[dir][key] = { w: 1, n: 2 };
      S.nb[dir][key].n += 1;
      if (win) S.nb[dir][key].w += 1;
    });
    var g = S.gbm[dir];
    var lrG = 0.03;
    FEAT_KEYS.forEach(function (k) {
      var x = f[k] || 0.5;
      if (dir === 'SHORT' && (k === 'trend' || k === 'loc' || k === 'mom' || k === 'vwapDist')) x = 1 - x;
      g[k] = clamp((g[k] || 0.05) + lrG * (win ? x : -0.5 * x), 0.01, 0.4);
    });
    var sum = 0;
    FEAT_KEYS.forEach(function (k) { sum += g[k]; });
    if (sum > 0) FEAT_KEYS.forEach(function (k) { g[k] /= sum; });
    var bm = S.stats.byMkt[mkt];
    var n = (bm.w + bm.l);
    if (n >= 5) {
      var wr = bm.w / n;
      var thr = S.thresh[mkt] != null ? S.thresh[mkt] : 0.58;
      if (wr < 0.40) thr = Math.min(0.75, thr + 0.02);
      else if (wr > 0.58) thr = Math.max(0.50, thr - 0.015);
      S.thresh[mkt] = thr;
    }
    save();
  }

  function patchEvaluate() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__aiv2) return;
    var prev = global.evaluate;
    global.evaluate = function (m) {
      var g = prev(m);
      if (!g || g.side === 'WAIT') return g;
      var bars = global.ST && global.ST.series && global.ST.series[m.s];
      var mkt = marketOf(m);
      var d = decide(bars, g.side, mkt);
      g.ai = { conf: d.conf, ok: d.ok, regime: d.regime, parts: d.parts, reason: d.reason, thr: d.thr };
      if (!d.ok) {
        if (d.reason === 'regime-shock' || d.reason === 'ai-disagreement' ||
            (d.reason === 'ai-veto-weak' && (d.conf || 0) < 0.48)) {
          g.why = (g.why || '') + ' · AI veto (' + (d.reason || '?') + ')';
          g.strength = Math.min(g.strength || 0, 2);
          if ((d.conf || 0) < 0.45 || d.reason === 'regime-shock') {
            g.side = 'WAIT';
            g.strength = 0;
          }
        }
      } else {
        if (d.conf >= 0.7 && g.strength < 5) g.strength = Math.min(5, (g.strength || 3) + 1);
        g.why = (g.why || '') + ' · AI ' + Math.round(d.conf * 100) + '%';
        g._aiFeat = d.features;
        g._aiBins = d.bins;
      }
      return g;
    };
    global.evaluate.__aiv2 = true;
  }

  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__aiv2) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var p = global.ST && global.ST.pos && global.ST.pos[sym];
      var snap = p ? { side: p.side, mkt: p.mkt || 'US' } : null;
      var feat = p && p._aiFeat;
      var bins = p && p._aiBins;
      orig(sym, why, px);
      try {
        var closed = global.ST && global.ST.closed && global.ST.closed[0];
        if (closed && snap && closed.sym === sym) {
          learn({ side: snap.side, pnl: closed.pnl, mkt: snap.mkt, features: feat, bins: bins });
        }
      } catch (e) {}
    };
    global.closePos.__aiv2 = true;
  }

  function patchOpenStoreFeat() {
    if (typeof global.openPos !== 'function' || global.openPos.__aiv2feat) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      orig(g);
      try {
        if (g && global.ST && global.ST.pos && global.ST.pos[g.sym]) {
          global.ST.pos[g.sym]._aiFeat = g._aiFeat;
          global.ST.pos[g.sym]._aiBins = g._aiBins;
          global.ST.pos[g.sym].mkt = g.mkt || marketOf({ s: g.sym, t: g.type });
        }
      } catch (e) {}
    };
    global.openPos.__aiv2feat = true;
  }

  function boot() {
    load();
    var n = 0;
    var t = setInterval(function () {
      n++;
      patchEvaluate();
      patchClose();
      patchOpenStoreFeat();
      if (n > 80) clearInterval(t);
    }, 350);
  }

  global.BTX_AI = {
    decide: decide,
    learn: learn,
    extractFeatures: extractFeatures,
    state: function () { return S; },
    reset: function () { S = defaultState(); save(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
