/**
 * BTX Autonomy PRO + Signal Desk (daytrader)
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

  function gradeSetup(g) {
    var reasons = [];
    var score = 50;
    var str = (g && g.strength) || 0;
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) {
      return { pass: false, grade: 'REJECT', score: 0, reasons: ['brak kierunku'] };
    }
    if (str < 3) reasons.push('sila < 3');
    else score += str >= 5 ? 20 : 12;

    try {
      if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
        var d = global.BTX_PRO6.dataGate();
        if (!d.ok) { reasons.push('dane: ' + d.label); score -= 25; }
        else score += 10;
      }
    } catch (e) {}

    try {
      if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
        var n = global.BTX_PRO6.highNewsNow();
        if (n && n.blocked) { reasons.push('news HIGH'); score -= 30; }
      }
    } catch (e2) {}

    if (global.ST && global.ST.blocked) reasons.push('blokada dnia');

    score = Math.max(0, Math.min(100, score + (str * 4)));
    var pass = reasons.length === 0 && str >= 3 && score >= 55;
    var grade = !pass ? 'REJECT' : (score >= 85 || str >= 5 ? 'A+' : 'A');
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

  function manageOpen() {}

  function tryOpenBest() {
    var ST = global.ST;
    var CFG = global.CFG || {};
    if (!ST || ST.blocked) return null;
    if (Object.keys(ST.pos || {}).length >= (CFG.maxPos || 2)) return null;
    if ((ST.dayTrades || 0) >= (CFG.maxTrades || 6)) return null;
    var ranked = rankSignals();
    for (var i = 0; i < ranked.length; i++) {
      var r = ranked[i];
      if (!r.gr.pass) continue;
      if (ST.pos[r.g.sym]) continue;
      if (ST.cool && ST.cool[r.g.sym] > 0) continue;
      if (typeof global.openPos === 'function') {
        global.openPos(r.g);
        if (global.log) global.log('Autonomia: OPEN ' + r.g.side + ' ' + r.g.sym + ' grade ' + r.gr.grade + ' score ' + r.gr.score, 'g');
        return r;
      }
    }
    return null;
  }

  async function tick() {
    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }
    manageOpen();
    if (isOn()) tryOpenBest();
    render();
  }

  function start() {
    stop();
    setOn(true);
    try { localStorage.setItem('BTX_TRADE_MODE', 'trade'); } catch (e) {}
    var sec = (global.CFG && global.CFG.autoSec) || 120;
    sec = Math.max(90, Math.min(300, sec));
    tick();
    timer = setInterval(tick, sec * 1000);
    if (global.toast) global.toast('Autonomia paper ON', 'ok');
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
    var html = '<h3>Autonomia paper \u00b7 Signal Desk</h3>';
    html += '<p class="why"><b>Po co:</b> bot skanuje i moze otwierac pozycje cwiczeniowe przy PASS (sila \u2265 3, score \u2265 55, daytrader).</p>';
    html += '<div class="row">';
    html += '<button type="button" class="btn" id="btx-auto-toggle">' + (isOn() ? 'Autonomia ON \u2713' : 'Wlacz autonomie paper') + '</button>';
    html += '<button type="button" class="btn ghost" id="btx-auto-tick">Skan teraz</button>';
    html += '</div>';
    html += '<table><tr><th>Symbol</th><th>Strona</th><th>Sila</th><th>Score</th><th>Grade</th><th>Powody</th></tr>';
    if (!ranked.length) {
      html += '<tr><td colspan="6">Brak sygnalow LONG/SHORT</td></tr>';
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
    var t = document.getElementById('btx-auto-toggle');
    if (t) t.onclick = function () {
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
    setInterval(render, 4000);
  }

  global.BTX_AUTONOMY = {
    gradeSetup: gradeSetup,
    rankSignals: rankSignals,
    tick: tick,
    start: start,
    stop: stop,
    isOn: isOn
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
