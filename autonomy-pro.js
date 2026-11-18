/**
 * Autonomia PRO — progi zsynchronizowane ze strategy / dt-config.
 * Siła >= minStrengthOpen (domyślnie 2). LIVE sprawdza gateCheck przy openPos.
 */
(function (global) {
  var STYLE = 'btx-autonomy-css';
  var LS_ON = 'BTX_AUTONOMY_ON';
  var timer = null;

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-auto-panel{margin:12px 0;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(18,196,139,.35);background:rgba(18,196,139,.07)}',
      '#btx-auto-panel h3{margin:0 0 6px;font-size:14px;color:#d1fae5}',
      '#btx-auto-panel .why{font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 10px}',
      '#btx-auto-panel table{width:100%;border-collapse:collapse;font-size:12px}',
      '#btx-auto-panel th,#btx-auto-panel td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}',
      '#btx-auto-panel .ok{color:#12c48b;font-weight:700}',
      '#btx-auto-panel .bad{color:#f87171;font-weight:700}',
      '#btx-auto-panel .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}'
    ].join('');
    document.head.appendChild(s);
  }

  function isOn() {
    try { return localStorage.getItem(LS_ON) === '1'; } catch (e) { return false; }
  }
  function setOn(v) {
    try { localStorage.setItem(LS_ON, v ? '1' : '0'); } catch (e) {}
  }

  function minStr() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO || {};
    var n = P.minStrengthOpen != null ? +P.minStrengthOpen : 2;
    return n > 0 ? n : 2;
  }

  function gradeSetup(g) {
    var reasons = [];
    var score = 45;
    var str = (g && g.strength) || 0;
    var need = minStr();
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) {
      return { pass: false, grade: 'REJECT', score: 0, reasons: ['brak kierunku'] };
    }
    if (str < need) reasons.push('si\u0142a < ' + need);
    else score += str >= 5 ? 25 : (str >= 4 ? 18 : (str >= 3 ? 12 : 8));

    try {
      if (global.BTX_LIVE && global.BTX_LIVE.isFresh) {
        if (global.BTX_LIVE.isFresh(g.sym)) score += 12;
        else {
          reasons.push('brak \u015bwie\u017cej ceny LIVE');
          score -= 8;
        }
      }
    } catch (e) {}

    try {
      if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
        var n = global.BTX_PRO6.highNewsNow();
        if (n && n.blocked) { reasons.push('news HIGH'); score -= 40; }
      }
    } catch (e2) {}

    if (global.ST && global.ST.blocked) reasons.push('limit dnia');

    var why = (g.why || '') + '';
    if (/ORB/i.test(why)) score += 5;

    score = Math.max(0, Math.min(100, score));
    var hard = reasons.some(function (r) {
      return r.indexOf('si') === 0 || r === 'limit dnia' || r === 'news HIGH' || r.indexOf('brak kierunku') === 0;
    });
    // si\u0142a: dopasuj do minStr (PL: "si\u0142a")
    hard = reasons.some(function (r) {
      return /si[l\u0142]a\s*</i.test(r) || r === 'limit dnia' || r === 'news HIGH' || r.indexOf('brak kierunku') === 0;
    });
    var pass = !hard && str >= need && score >= 50;
    var grade = !pass ? 'REJECT' : (score >= 80 || str >= 5 ? 'A+' : (str >= 3 ? 'A' : 'B'));
    return { pass: pass, grade: grade, score: score, reasons: reasons };
  }

  function rankSignals() {
    var sig = (global.ST && global.ST.sig) || [];
    var out = [];
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var gr = gradeSetup(g);
      g.desk = gr;
      out.push({ g: g, gr: gr });
    }
    out.sort(function (a, b) {
      return (b.gr.score || 0) - (a.gr.score || 0) || (b.g.strength || 0) - (a.g.strength || 0);
    });
    return out;
  }

  function tryOpenBest() {
    var ST = global.ST;
    var CFG = global.CFG || {};
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO || {};
    if (!ST || ST.blocked) return null;
    if (Object.keys(ST.pos || {}).length >= (CFG.maxPos || P.maxPos || 3)) return null;
    if ((ST.dayTrades || 0) >= (CFG.maxTrades || P.maxDayTrades || 10)) return null;
    var ranked = rankSignals();
    for (var i = 0; i < ranked.length; i++) {
      var r = ranked[i];
      if (!r.gr.pass) continue;
      if (ST.pos[r.g.sym]) continue;
      if (ST.cool && ST.cool[r.g.sym] > 0) continue;
      if (typeof global.openPos === 'function') {
        global.openPos(r.g);
        if (global.log) global.log('Autonomia OPEN ' + r.g.side + ' ' + r.g.sym + ' ' + r.gr.grade + ' s' + (r.g.strength || 0), 'g');
        return r;
      }
    }
    return null;
  }

  function tick() {
    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }
    if (isOn()) tryOpenBest();
    render();
  }

  function start() {
    stop();
    setOn(true);
    var sec = Math.max(90, Math.min(300, (global.CFG && global.CFG.autoSec) || 180));
    tick();
    timer = setInterval(tick, sec * 1000);
    if (global.toast) global.toast('Autonomia ON (si\u0142a \u2265 ' + minStr() + ')', 'ok');
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    setOn(false);
  }

  function ensurePanel() {
    injectCss();
    var el = document.getElementById('btx-auto-panel');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-auto-panel';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function render() {
    var el = ensurePanel();
    if (!el) return;
    var ranked = rankSignals();
    var need = minStr();
    var html = '<h3>Autonomia PRO \u00b7 Signal Desk</h3>';
    html += '<p class="why"><b>Progi jak strategia:</b> si\u0142a \u2265 ' + need + ', \u015bcie\u017cka ORB dozwolona. LIVE sprawdza bramka przy otwarciu.</p>';
    html += '<div class="row">';
    html += '<button type="button" class="btn" id="btx-auto-toggle">' + (isOn() ? 'Autonomia ON \u2713' : 'W\u0142\u0105cz autonomi\u0119') + '</button>';
    html += '<button type="button" class="btn ghost" id="btx-auto-tick">Skan teraz</button>';
    html += '</div>';
    html += '<table><tr><th>Symbol</th><th>Strona</th><th>Si\u0142a</th><th>Score</th><th>Grade</th><th>Powody</th></tr>';
    if (!ranked.length) {
      html += '<tr><td colspan="6">Brak LONG/SHORT w sygnale \u2014 czekam (ORB / trend+RSI2)</td></tr>';
    } else {
      ranked.slice(0, 12).forEach(function (r) {
        var cls = r.gr.pass ? 'ok' : 'bad';
        html += '<tr><td>' + r.g.sym + '</td><td>' + r.g.side + '</td><td>' + (r.g.strength || 0) +
          '</td><td>' + r.gr.score + '</td><td class="' + cls + '">' + r.gr.grade +
          '</td><td>' + (r.gr.reasons && r.gr.reasons.length ? r.gr.reasons.join('; ') : '\u2014') + '</td></tr>';
      });
    }
    html += '</table>';
    el.innerHTML = html;
    var tg = document.getElementById('btx-auto-toggle');
    if (tg) tg.onclick = function () {
      if (isOn()) { stop(); if (global.toast) global.toast('Autonomia OFF', 'info'); }
      else start();
      render();
    };
    var k = document.getElementById('btx-auto-tick');
    if (k) k.onclick = function () { tick(); };
  }

  function boot() {
    injectCss();
    render();
    if (isOn()) start();
    setInterval(render, 6000);
  }

  global.BTX_AUTONOMY = {
    gradeSetup: gradeSetup,
    rankSignals: rankSignals,
    tick: tick,
    start: start,
    stop: stop,
    isOn: isOn,
    tryOpenBest: tryOpenBest
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
