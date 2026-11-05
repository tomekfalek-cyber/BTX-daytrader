/**
 * Permanent daytrader thresholds (no UI banner).
 * Softens swing-style confluence/HTF/risk geometry.
 */
(function (global) {
  function patchEvaluate() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__dtMode) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var g = orig.apply(this, arguments);
      if (!g || !m) return g;
      if (g.side === 'LONG' || g.side === 'SHORT') return g;

      var scoreL = 0, scoreS = 0, trend = 0;
      if (g._pro) {
        scoreL = g._pro.scoreL || 0;
        scoreS = g._pro.scoreS || 0;
        trend = g._pro.trend || 0;
      }

      if (g.side === 'WAIT' && (scoreL >= 4 || scoreS >= 4)) {
        if (scoreL >= 4 && scoreL >= scoreS && trend > -2) {
          g.side = 'LONG';
          g.strength = Math.min(5, Math.max(3, Math.round(scoreL / 2)));
          g.why = (g.why || '') + ' · DT L' + scoreL;
        } else if (scoreS >= 4 && scoreS > scoreL && trend < 2) {
          g.side = 'SHORT';
          g.strength = Math.min(5, Math.max(3, Math.round(scoreS / 2)));
          g.why = (g.why || '') + ' · DT S' + scoreS;
        }
      }

      if (g.side === 'WAIT' && /veto:\s*brak HTF/i.test(g.why || '') && g._pro) {
        if ((g._pro.scoreL || 0) >= 4 && (g._pro.trend || 0) >= -1) {
          g.side = 'LONG';
          g.strength = 3;
          g.why = 'DT L' + g._pro.scoreL;
        } else if ((g._pro.scoreS || 0) >= 4 && (g._pro.trend || 0) <= 1) {
          g.side = 'SHORT';
          g.strength = 3;
          g.why = 'DT S' + g._pro.scoreS;
        }
      }
      return g;
    };
    global.evaluate.__dtMode = true;
  }

  function patchCFG() {
    var CFG = global.CFG;
    if (!CFG) return;
    if (CFG.minHold == null || CFG.minHold > 3) CFG.minHold = 2;
    if (CFG.timeStop == null || CFG.timeStop > 36) CFG.timeStop = 24;
    if (CFG.maxTrades == null || CFG.maxTrades < 6) CFG.maxTrades = 6;
  }

  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup || global.BTX_AUTONOMY.gradeSetup.__dtMode) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      if (!g || !r) return r;
      if ((g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 3) {
        r.score = Math.max(r.score || 0, 50 + (g.strength || 0) * 5);
        if (r.reasons) {
          r.reasons = r.reasons.filter(function (x) {
            return !/score po filtrach\s*<\s*63/i.test(String(x))
              && !/score\s*<\s*63/i.test(String(x));
          });
        }
        if ((!r.reasons || !r.reasons.length) && r.score >= 55) {
          r.pass = true;
          r.grade = r.score >= 80 ? 'A+' : 'A';
        }
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__dtMode = true;
  }

  function boot() {
    patchCFG();
    patchEvaluate();
    patchAutonomy();
    setInterval(function () {
      patchCFG();
      patchEvaluate();
      patchAutonomy();
    }, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
