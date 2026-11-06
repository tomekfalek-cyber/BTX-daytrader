/**
 * Trade Now — żeby bot w ogóle handlował (paper)
 * 1) Twarde obniżenie progów evaluate (score>=3, bez HTF veto)
 * 2) Autonomia: PASS przy sile>=3
 * 3) Panel: konkretny powód 0 pozycji TERAZ
 */
(function (global) {
  var ROOT = 'btx-trade-now';

  function warsaw() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function patchEvaluateSoft() {
    if (typeof global.evaluate !== 'function' || global.evaluate.__tradeNow) return;
    var orig = global.evaluate;
    global.evaluate = function (m) {
      var g = orig.apply(this, arguments);
      if (!g || !m) return g;
      if (g.side === 'LONG' || g.side === 'SHORT') return g;

      // Odzyskaj scoring
      var scoreL = 0, scoreS = 0, trend = 0;
      if (g._pro) {
        scoreL = g._pro.scoreL || 0;
        scoreS = g._pro.scoreS || 0;
        trend = g._pro.trend || 0;
      }

      // Bardzo daytrade'owo: już od 3 punktów konfluencji
      if (scoreL >= 3 && scoreL >= scoreS && trend >= -1) {
        g.side = 'LONG';
        g.strength = Math.min(5, Math.max(3, Math.round(scoreL / 1.5)));
        g.why = (g.why && !/brak konfluencji|veto/i.test(g.why) ? g.why + ' · ' : '') + 'TradeNow L' + scoreL;
      } else if (scoreS >= 3 && scoreS > scoreL && trend <= 1) {
        g.side = 'SHORT';
        g.strength = Math.min(5, Math.max(3, Math.round(scoreS / 1.5)));
        g.why = (g.why && !/brak konfluencji|veto/i.test(g.why) ? g.why + ' · ' : '') + 'TradeNow S' + scoreS;
      }

      // Odblokuj veto HTF
      if (g.side === 'WAIT' && /veto|brak konfluencji/i.test(g.why || '') && g._pro) {
        if ((g._pro.scoreL || 0) >= 3) {
          g.side = 'LONG'; g.strength = 3; g.why = 'TradeNow soft L' + g._pro.scoreL;
        } else if ((g._pro.scoreS || 0) >= 3) {
          g.side = 'SHORT'; g.strength = 3; g.why = 'TradeNow soft S' + g._pro.scoreS;
        }
      }
      return g;
    };
    global.evaluate.__tradeNow = true;
  }

  function patchAutonomySoft() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup || global.BTX_AUTONOMY.gradeSetup.__tradeNow) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      if (!g || !r) return r;
      if ((g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 3) {
        r.score = Math.max(r.score || 0, 55);
        r.reasons = (r.reasons || []).filter(function (x) {
          return !/score|LIVE|faza|Pre-market/i.test(String(x));
        });
        // LIVE: jeśli jest jakikolwiek live w systemie — nie odrzucaj
        var anyLive = false;
        try {
          if (global.BTX_LIVE_GATE && global.BTX_LIVE_GATE.anyLive) anyLive = global.BTX_LIVE_GATE.anyLive();
          else if (global.ST && global.ST.liveSource) {
            var t = Date.now();
            anyLive = Object.keys(global.ST.liveSource).some(function (k) {
              return t - global.ST.liveSource[k] < 25 * 60 * 1000;
            });
          }
        } catch (e) {}
        if (!anyLive) {
          // paper: pozwól mimo DEMO — inaczej 0 trade cały dzień
          r.reasons = (r.reasons || []).filter(function (x) { return !/dane|LIVE|demo/i.test(String(x)); });
        }
        if (!r.reasons.length) {
          r.pass = true;
          r.grade = r.score >= 80 ? 'A+' : 'A';
        }
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__tradeNow = true;
  }

  function diagnose() {
    var w = warsaw();
    var lines = [];
    var ST = global.ST || {};
    var CFG = global.CFG || {};

    lines.push('Czas PL: ' + w.label + (w.weekend ? ' (WEEKEND — equity OFF)' : ''));
    if (w.weekend) lines.push('WEEKEND: bot nie powinien otwierać akcji/FX daytradingowo');
    if (w.min >= 9 * 60 && w.min < 15 * 60 + 30) lines.push('Okno: EU/FX (US od 15:30)');
    if (w.min >= 15 * 60 + 30 && w.min < 22 * 60) lines.push('Okno: US + FX');

    var auto = global.BTX_AUTONOMY && global.BTX_AUTONOMY.isOn && global.BTX_AUTONOMY.isOn();
    lines.push('Autonomia paper: ' + (auto ? 'ON' : 'OFF ← włącz na Pulpicie!'));

    var liveN = 0;
    (global.SYMBOLS || []).forEach(function (m) {
      if (ST.liveSource && ST.liveSource[m.s] && Date.now() - ST.liveSource[m.s] < 25 * 60 * 1000) liveN++;
    });
    lines.push('LIVE symboli: ' + liveN + '/' + ((global.SYMBOLS || []).length || 0) + (liveN ? '' : ' ← ustaw Twelve i skan'));

    var sig = [];
    try {
      if (typeof global.signals === 'function') sig = global.signals() || [];
      else sig = ST.sig || [];
    } catch (e) { sig = ST.sig || []; }
    var dir = sig.filter(function (x) { return x && (x.side === 'LONG' || x.side === 'SHORT'); });
    lines.push('Sygnały LONG/SHORT teraz: ' + dir.length);
    dir.slice(0, 5).forEach(function (g) {
      var gr = null;
      try { if (global.BTX_AUTONOMY) gr = global.BTX_AUTONOMY.gradeSetup(g); } catch (e) {}
      lines.push('  · ' + g.sym + ' ' + g.side + ' sila ' + (g.strength || 0) +
        (gr ? (' → ' + gr.grade + ' score ' + gr.score + (gr.reasons && gr.reasons.length ? ' [' + gr.reasons.join(', ') + ']' : '')) : ''));
    });

    lines.push('Otwarte pozycje: ' + Object.keys(ST.pos || {}).length + ' / max ' + (CFG.maxPos || 2));
    lines.push('Trade/dzień: ' + (ST.dayTrades || 0) + ' / ' + (CFG.maxTrades || 6));

    if (!auto) lines.push('>>> Główny powód 0 pozycji: Autonomia OFF');
    else if (!dir.length) lines.push('>>> Brak kierunku z evaluate (rynek bez setupu ALBO stare progi — TradeNow już miękczy)');
    else if (dir.length && auto) {
      var anyPass = dir.some(function (g) {
        try { return global.BTX_AUTONOMY.gradeSetup(g).pass; } catch (e) { return false; }
      });
      if (!anyPass) lines.push('>>> Są sygnały, ale żaden nie ma PASS na desk');
      else lines.push('>>> Jest PASS — kolejny skan autonomii powinien otworzyć (lub limit/sesja)' );
    }
    return lines;
  }

  function render() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(251,191,36,.45);background:rgba(245,158,11,.1);font-size:12.5px;color:#fde68a;line-height:1.5';
      pane.appendChild(el);
    }
    var lines = diagnose();
    el.innerHTML = '<b style="color:#fbbf24">Dlaczego 0 pozycji? (diagnoza na żywo)</b><br>' +
      lines.map(function (x) { return '• ' + x; }).join('<br>') +
      '<div style="margin-top:8px"><button type="button" id="btx-tn-scan" style="cursor:pointer;padding:8px 12px;border:0;border-radius:8px;background:#d97706;color:#fff;font-weight:700">Skan + próba otwarcia teraz</button></div>';
    var b = document.getElementById('btx-tn-scan');
    if (b) b.onclick = function () {
      try {
        if (typeof global.cycle === 'function') global.cycle();
        if (global.BTX_AUTONOMY) {
          if (!global.BTX_AUTONOMY.isOn()) global.BTX_AUTONOMY.start();
          if (global.BTX_AUTONOMY.openAllPass) global.BTX_AUTONOMY.openAllPass();
          else if (global.BTX_AUTONOMY.tick) global.BTX_AUTONOMY.tick();
        }
        if (global.toast) global.toast('Skan wykonany', 'ok');
      } catch (e) {
        alert(String(e));
      }
      setTimeout(render, 300);
    };
  }

  function boot() {
    patchEvaluateSoft();
    patchAutonomySoft();
    render();
    setInterval(function () {
      patchEvaluateSoft();
      patchAutonomySoft();
      render();
    }, 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
