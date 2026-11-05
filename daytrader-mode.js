/**
 * BTX TRUE DAYTRADER MODE
 * Strategy-pro było zbyt "swingowe": score>=6, twardy HTF, szeroki SL, długi cool.
 * Ten moduł przestawia progi pod intraday 5m.
 */
(function (global) {
  var ROOT = 'btx-daytrader-mode';

  function patchPRO() {
    // Jeśli strategy-pro wystawi PRO globalnie — użyj; inaczej patch evaluate po fakcie
    if (global.BTX_STRATEGY_PRO) {
      var P = global.BTX_STRATEGY_PRO;
      P.minStrengthOpen = 3;
      P.requireTrend = false;
      P.atrSlMult = 1.2;
      P.tpR = 1.6;
      P.beR = 0.8;
      P.partialR = 1.0;
      P.coolBars = 4;
      P.minHoldBars = 2;
      P.maxDayTrades = 8;
      P.newsPadMin = 10;
    }
  }

  function patchEvaluate() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__dtMode) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var g = orig.apply(this, arguments);
      if (!g || !m) return g;

      // Jeśli już LONG/SHORT — OK
      if (g.side === 'LONG' || g.side === 'SHORT') {
        // lekko nie obniżaj strength
        return g;
      }

      // Odzyskaj scoring z _pro jeśli jest
      var scoreL = 0, scoreS = 0, trend = 0;
      if (g._pro) {
        scoreL = g._pro.scoreL || 0;
        scoreS = g._pro.scoreS || 0;
        trend = g._pro.trend || 0;
      }

      // Daytrading: próg konfluencji 4 zamiast 6; HTF tylko lekka preferencja, nie veto
      if (g.side === 'WAIT' && (scoreL >= 4 || scoreS >= 4)) {
        if (scoreL >= 4 && scoreL >= scoreS) {
          // nie blokuj LONG gdy trend płaski; tylko gdy mocno DN
          if (trend > -2) {
            g.side = 'LONG';
            g.strength = Math.min(5, Math.max(3, Math.round(scoreL / 2)));
            g.why = (g.why || '') + ' · DT: konfluencja L' + scoreL;
          }
        } else if (scoreS >= 4 && scoreS > scoreL) {
          if (trend < 2) {
            g.side = 'SHORT';
            g.strength = Math.min(5, Math.max(3, Math.round(scoreS / 2)));
            g.why = (g.why || '') + ' · DT: konfluencja S' + scoreS;
          }
        }
      }

      // Odblokuj veto HTF jeśli to był jedyny powód
      if (g.side === 'WAIT' && /veto:\s*brak HTF/i.test(g.why || '') && g._pro) {
        if ((g._pro.scoreL || 0) >= 4 && (g._pro.trend || 0) >= -1) {
          g.side = 'LONG';
          g.strength = 3;
          g.why = 'DT: bez twardego HTF veto · L' + g._pro.scoreL;
        } else if ((g._pro.scoreS || 0) >= 4 && (g._pro.trend || 0) <= 1) {
          g.side = 'SHORT';
          g.strength = 3;
          g.why = 'DT: bez twardego HTF veto · S' + g._pro.scoreS;
        }
      }

      return g;
    };
    global.evaluate.__dtMode = true;
  }

  function patchCFG() {
    var CFG = global.CFG;
    if (!CFG) return;
    // daytrading risk geometry
    if (CFG.minHold == null || CFG.minHold > 3) CFG.minHold = 2;
    if (CFG.timeStop == null || CFG.timeStop > 36) CFG.timeStop = 24; // ~2h na 5m
    if (CFG.maxTrades == null || CFG.maxTrades < 6) CFG.maxTrades = 6;
    if (CFG.autoSec == null || CFG.autoSec > 180) CFG.autoSec = 120;
  }

  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup || global.BTX_AUTONOMY.gradeSetup.__dtMode) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      if (!g || !r) return r;
      // Daytrading desk: strength>=3, score>=55
      if ((g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 3) {
        r.score = Math.max(r.score || 0, 50 + (g.strength || 0) * 5);
        if ((!r.reasons || !r.reasons.length) && r.score >= 55) {
          r.pass = true;
          r.grade = r.score >= 80 ? 'A+' : 'A';
        }
        // usuń swingowe odrzuty "score < 63" gdy mamy 55+
        if (r.reasons) {
          r.reasons = r.reasons.filter(function (x) {
            return !/score po filtrach\s*<\s*63/i.test(String(x))
              && !/score\s*<\s*63/i.test(String(x));
          });
          if (!r.reasons.length && r.score >= 55 && (g.strength || 0) >= 3) {
            r.pass = true;
            r.grade = r.score >= 80 ? 'A+' : 'A';
          }
        }
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__dtMode = true;
  }

  function patchOpenRisk() {
    // węższy SL daytradingowy przy openPos hardening — przez CFG.hint
    global.__BTX_DT = {
      atrSlMult: 1.2,
      tpR: 1.6,
      beR: 0.8,
      maxTrades: 6,
      minStrength: 3,
      minScore: 55
    };
  }

  function render() {
    var el = document.getElementById(ROOT);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:2px solid #22c55e;background:rgba(34,197,94,.12);font-size:12.5px;color:#bbf7d0;line-height:1.5';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    el.innerHTML =
      '<b style="color:#86efac">TRYB DAYTRADER ON</b> (nie swing)<br>' +
      'Konfluencja <b>4+</b> (było 6) · HTF <b>bez twardego veto</b> · siła wejścia <b>≥3</b> · score desk <b>≥55</b><br>' +
      'SL ~1.2×ATR · TP ~1.6R · BE ~0.8R · time-stop ~2h · max ~6 trade/dzień · cool krótszy<br>' +
      '<span style="opacity:.9">Włącz <b>Autonomia ON</b> + profil <b>RANO</b> (teraz) / <b>US</b> po 15:30 + LIVE Twelve.</span>';
  }

  function boot() {
    patchPRO();
    patchCFG();
    patchEvaluate();
    patchAutonomy();
    patchOpenRisk();
    render();
    setInterval(function () {
      patchPRO();
      patchCFG();
      patchEvaluate();
      patchAutonomy();
      render();
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
