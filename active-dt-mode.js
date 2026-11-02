/**
 * Active Daytrader mode — runtime overrides
 * Działa nawet gdy inne pliki się odświeżają: obniża próg score, miękczy filtry.
 */
(function (global) {
  var MIN_SCORE = 63;

  function patchGrade() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup) return;
    if (global.BTX_AUTONOMY.gradeSetup.__activeDT) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      // jeśli odrzut tylko przez stary próg 70 — poluzuj do 63
      if (!r.pass && (g && (g.strength || 0) >= 4) && (r.score || 0) >= MIN_SCORE) {
        var reasons = (r.reasons || []).filter(function (x) {
          return !/score|70|63/i.test(String(x));
        });
        // jeśli nie ma innych powodów twardych — PASS
        var hard = reasons.filter(function (x) {
          return !/kara|RS|indeks|wiatr|słaby RS/i.test(String(x));
        });
        if (!hard.length && !(global.BTX_QCAP && global.BTX_QCAP.killed && global.BTX_QCAP.killed())) {
          r.pass = true;
          r.grade = (r.score >= 85 || (g.strength || 0) >= 5) ? 'A+' : 'A';
          r.reasons = [];
          r.activeDT = true;
        }
      }
      if (r.pass && r.score < MIN_SCORE) {
        r.pass = false;
        r.grade = 'REJECT';
        r.reasons = (r.reasons || []).concat(['score < ' + MIN_SCORE + ' (Active DT)']);
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__activeDT = true;
  }

  function patchEdgeSession() {
    if (!global.BTX_EDGE || !global.BTX_EDGE.sessionPhase) return;
    if (global.BTX_EDGE.sessionPhase.__activeDT) return;
    var orig = global.BTX_EDGE.sessionPhase;
    global.BTX_EDGE.sessionPhase = function () {
      var p = orig.apply(this, arguments);
      if (p.phase === 'OPEN' || p.phase === 'CLOSE') {
        p.onlyAPlus = false;
        p.minStrength = 4;
        p.label = (p.phase === 'OPEN' ? 'Otwarcie US — Active DT siła ≥4, half size' : 'Końcówka — Active DT siła ≥4');
      }
      return p;
    };
    global.BTX_EDGE.sessionPhase.__activeDT = true;
  }

  function banner() {
    var el = document.getElementById('btx-active-dt-banner');
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-active-dt-banner';
      el.style.cssText = 'margin:10px 0;padding:10px 14px;border-radius:12px;border:1px solid rgba(18,196,139,.4);background:rgba(18,196,139,.1);font-size:13px;color:#d1fae5';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    el.innerHTML = '<b>Active Daytrader ON</b> · score ≥ <b>63</b> · open/close: siła ≥ <b>4</b> · RS/indeks = kara do score (nie zawsze zakaz) · anti-chase tylko skraj zakresu · max nadal <b>4</b>/dzień, risk <b>0,5%</b>';
  }

  function boot() {
    patchGrade();
    patchEdgeSession();
    banner();
    setInterval(function () {
      patchGrade();
      patchEdgeSession();
      banner();
    }, 3000);
  }

  global.BTX_ACTIVE_DT = { minScore: MIN_SCORE };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
