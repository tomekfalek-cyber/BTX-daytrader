/**
 * BTX DayTrader — AI Ensemble (SwingRAI-style)
 * Naive Bayes + simple GBM + adaptive Q-threshold
 * Score 40% + NB 30% + GBM 30%
 */
(function (global) {
  const AI = {
    nb: {
      long: { wins: 1, total: 2 },
      short: { wins: 1, total: 2 },
      features: {}
    },
    gbmWeights: {
      rsi: 0.18, macd: 0.14, bb: 0.12, trend: 0.10,
      structure: 0.12, pd: 0.10, ob: 0.10, fvg: 0.06, liq: 0.08
    },
    threshold: 62,
    q: { success: 0, fail: 0, lastReward: 0 },
    minThreshold: 55,
    maxThreshold: 78
  };

  function nbProb(dir, features) {
    const key = (dir || 'LONG').toLowerCase();
    const bucket = AI.nb[key] || AI.nb.long;
    let p = Math.log(bucket.wins / Math.max(1, bucket.total));
    (features || []).forEach(function (f) {
      const fk = dir + ':' + f;
      const stats = AI.nb.features[fk] || { wins: 1, total: 2 };
      p += Math.log(stats.wins / Math.max(1, stats.total));
    });
    return 1 / (1 + Math.exp(-p * 1.5));
  }

  function gbmScore(featureScores) {
    let s = 0, wsum = 0;
    Object.keys(AI.gbmWeights).forEach(function (k) {
      const w = AI.gbmWeights[k];
      const v = featureScores && featureScores[k] != null ? featureScores[k] : 0.5;
      s += w * v;
      wsum += w;
    });
    return wsum ? (s / wsum) * 100 : 50;
  }

  function updateEnsembleAfterTrade(trade) {
    if (!trade || !trade.dir) return;
    const win = (trade.pnl || 0) > 0;
    const dirKey = String(trade.dir).toLowerCase();
    const bucket = AI.nb[dirKey];
    if (bucket) {
      bucket.total += 1;
      if (win) bucket.wins += 1;
    }
    (trade.features || []).forEach(function (f) {
      const key = trade.dir + ':' + f;
      if (!AI.nb.features[key]) AI.nb.features[key] = { wins: 1, total: 2 };
      AI.nb.features[key].total += 1;
      if (win) AI.nb.features[key].wins += 1;
    });
    const lr = 0.04;
    const target = win ? 1 : 0;
    Object.keys(AI.gbmWeights).forEach(function (k) {
      const w = AI.gbmWeights[k];
      const x = trade.featureScores && trade.featureScores[k] != null ? trade.featureScores[k] : 0.5;
      AI.gbmWeights[k] = Math.max(0.02, Math.min(0.35, w + lr * (target - x * w) * x));
    });
    AI.q.lastReward = win ? 1 : -1;
    if (win) AI.q.success += 1; else AI.q.fail += 1;
    const wr = AI.q.success / Math.max(1, AI.q.success + AI.q.fail);
    if (wr < 0.42) AI.threshold = Math.min(AI.maxThreshold, AI.threshold + 1.5);
    else if (wr > 0.58) AI.threshold = Math.max(AI.minThreshold, AI.threshold - 1);
    try {
      localStorage.setItem('BTX_AI', JSON.stringify({
        nb: AI.nb, gbmWeights: AI.gbmWeights, threshold: AI.threshold, q: AI.q
      }));
    } catch (e) {}
  }

  function loadAI() {
    try {
      const raw = localStorage.getItem('BTX_AI');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.nb) AI.nb = d.nb;
      if (d.gbmWeights) AI.gbmWeights = d.gbmWeights;
      if (typeof d.threshold === 'number') AI.threshold = d.threshold;
      if (d.q) AI.q = d.q;
    } catch (e) {}
  }

  function ensembleDecision(baseScore, dir, features, featureScores) {
    if (!dir) return { finalScore: baseScore || 0, nb: 0.5, gbm: 50, threshold: AI.threshold, pass: false };
    const nb = nbProb(dir, features);
    const gbm = gbmScore(featureScores || {});
    const finalScore = (baseScore || 0) * 0.40 + nb * 100 * 0.30 + gbm * 0.30;
    return {
      finalScore: finalScore,
      nb: nb,
      gbm: gbm,
      threshold: AI.threshold,
      pass: finalScore >= AI.threshold
    };
  }

  function featuresFromSnapshot(s) {
    s = s || {};
    const rsi = s.rsi != null ? s.rsi : 50;
    const macdHist = s.macdHist != null ? s.macdHist : 0;
    const bbPos = s.bbPos != null ? s.bbPos : 0.5;
    const trend = s.trend != null ? s.trend : 0;
    const zone = s.zone || 'mid';
    const event = s.event || '';
    const liq = !!s.liq;
    return {
      rsi: rsi <= 35 ? 0.85 : rsi >= 65 ? 0.15 : 0.5,
      macd: macdHist > 0 ? 0.75 : 0.25,
      bb: bbPos < 0.2 ? 0.8 : bbPos > 0.8 ? 0.2 : 0.5,
      trend: trend >= 1 ? 0.8 : trend <= -1 ? 0.2 : 0.5,
      structure: /BoS_up|CHoCH_up|UP/.test(event) ? 0.85 : /BoS_down|CHoCH_down|DN/.test(event) ? 0.15 : 0.5,
      pd: zone === 'discount' ? 0.8 : zone === 'premium' ? 0.2 : 0.5,
      ob: s.nearOB ? 0.8 : 0.5,
      fvg: s.inFVG ? 0.75 : 0.5,
      liq: liq ? 0.8 : 0.5
    };
  }

  loadAI();

  global.BTX_AI = {
    AI: AI,
    ensembleDecision: ensembleDecision,
    updateEnsembleAfterTrade: updateEnsembleAfterTrade,
    featuresFromSnapshot: featuresFromSnapshot,
    nbProb: nbProb,
    gbmScore: gbmScore
  };

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (typeof global.evaluate === 'function' && !global.evaluate.__btxEns) {
      var orig = global.evaluate;
      global.evaluate = function (m) {
        var g = orig.apply(this, arguments);
        if (!g || g.side === 'WAIT') return g;
        var snap = {};
        try {
          var b = global.ST && global.ST.series && global.ST.series[m.s];
          if (b && b.length > 30) {
            var cl = b.map(function (x) { return x.c; });
            var last = cl[cl.length - 1];
            snap.rsi = typeof global.rsi === 'function' ? global.rsi(cl, 14) : 50;
            snap.trend = last > cl[cl.length - 10] ? 1 : -1;
          }
        } catch (e) {}
        var fs = featuresFromSnapshot(snap);
        var base = 50 + (g.strength || 0) * 12;
        var ens = ensembleDecision(base, g.side, [g.why || ''], fs);
        g.ensemble = ens;
        g.strength = Math.max(1, Math.min(5, Math.round(ens.finalScore / 20)));
        if (!ens.pass && g.strength < 3) {
          g.why = (g.why || '') + ' · ens ' + ens.finalScore.toFixed(0) + '<' + ens.threshold.toFixed(0);
        } else {
          g.why = (g.why || '') + ' · ens ' + ens.finalScore.toFixed(0);
        }
        return g;
      };
      global.evaluate.__btxEns = true;
      clearInterval(t);
    }
    if (tries > 40) clearInterval(t);
  }, 500);

  var t2 = setInterval(function () {
    if (typeof global.ST === 'undefined' || !global.ST.closed) return;
    if (global.ST._btxEnsLen == null) global.ST._btxEnsLen = global.ST.closed.length;
    if (global.ST.closed.length > global.ST._btxEnsLen) {
      var neu = global.ST.closed.slice(0, global.ST.closed.length - global.ST._btxEnsLen);
      neu.forEach(function (tr) {
        updateEnsembleAfterTrade({
          dir: tr.dir || tr.side,
          pnl: tr.pnl,
          features: tr.why ? [String(tr.why)] : [],
          featureScores: {}
        });
      });
      global.ST._btxEnsLen = global.ST.closed.length;
    }
  }, 2000);

})(typeof window !== 'undefined' ? window : globalThis);
