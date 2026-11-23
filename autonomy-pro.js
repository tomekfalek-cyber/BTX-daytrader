/**
 * Autonomia APEX
 */
(function (global) {
  var STYLE = 'btx-autonomy-css';
  var LS_ON = 'BTX_AUTONOMY_ON';
  var timer = null;
  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = '#btx-auto-panel{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(18,196,139,.35);background:rgba(18,196,139,.07)}#btx-auto-panel h3{margin:0 0 6px;font-size:14px;color:#d1fae5}#btx-auto-panel .why{font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 10px}#btx-auto-panel table{width:100%;border-collapse:collapse;font-size:12px}#btx-auto-panel th,#btx-auto-panel td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}#btx-auto-panel .ok{color:#12c48b;font-weight:700}#btx-auto-panel .bad{color:#f87171;font-weight:700}#btx-auto-panel .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}';
    document.head.appendChild(s);
  }
  function isOn() { try { return localStorage.getItem(LS_ON) !== '0'; } catch (e) { return true; } }
  function setOn(v) { try { localStorage.setItem(LS_ON, v ? '1' : '0'); } catch (e) {} }
  function minStr() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO || {};
    return P.minStrengthOpen != null ? +P.minStrengthOpen : 2;
  }
  function gradeSetup(g) {
    var reasons = [], score = 45, str = (g && g.strength) || 0, need = minStr();
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return { pass: false, grade: 'REJECT', score: 0, reasons: ['brak kierunku'] };
    if (str < need) reasons.push('sila < ' + need);
    else score += str >= 5 ? 25 : (str >= 4 ? 18 : (str >= 3 ? 12 : 8));
    try {
      if (global.BTX_LIVE && global.BTX_LIVE.isFresh) {
        if (global.BTX_LIVE.isFresh(g.sym)) score += 12;
        else { reasons.push('brak LIVE (paper OK)'); score -= 4; }
      }
    } catch (e) {}
    if (global.ST && global.ST.blocked) reasons.push('limit dnia');
    if (/ORB/i.test(g.why || '')) score += 6;
    if (global.BTX_APEX && global.BTX_APEX.qualityScore) score += Math.max(0, Math.min(20, Math.round((global.BTX_APEX.qualityScore(g) || 0) / 5)));
    score = Math.max(0, Math.min(100, score));
    var hard = reasons.some(function (r) { return r.indexOf('sila') === 0 || r === 'limit dnia' || r.indexOf('brak kierunku') === 0; });
    var pass = !hard && str >= need && score >= 48;
    var grade = !pass ? 'REJECT' : (score >= 80 || str >= 5 ? 'A+' : (str >= 3 ? 'A' : 'B'));
    return { pass: pass, grade: grade, score: score, reasons: reasons };
  }
  function rankSignals() {
    var sig = (global.ST && global.ST.sig) || [], out = [];
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var gr = gradeSetup(g); g.desk = gr; out.push({ g: g, gr: gr });
    }
    out.sort(function (a, b) { return (b.gr.score || 0) - (a.gr.score || 0) || (b.g.strength || 0) - (a.g.strength || 0); });
    return out;
  }
  function tryOpenBest() {
    if (global.BTX_APEX && global.BTX_APEX.tryOpen) {
      var ar = global.BTX_APEX.tryOpen();
      if (ar) return ar;
    }
    var ST = global.ST, CFG = global.CFG || {};
    if (!ST) return null;
    try { if (localStorage.getItem('BTX_ALLOW_STOP_DAY') !== '1') { ST.blocked = false; ST.stopForDay = false; } } catch (eB) {}
    if (ST.blocked) return null;
    if (Object.keys(ST.pos || {}).length >= (CFG.maxPos || 2)) return null;
    if ((ST.dayTrades || 0) >= (CFG.maxTrades || 6)) return null;
    var ranked = rankSignals();
    for (var i = 0; i < ranked.length; i++) {
      var r = ranked[i];
      if (!r.gr.pass || ST.pos[r.g.sym]) continue;
      if (ST.cool && ST.cool[r.g.sym] > 0) continue;
      if (typeof global.openPos === 'function') {
        global.openPos(r.g);
        if (global.log) global.log('Autonomia OPEN ' + r.g.side + ' ' + r.g.sym + ' ' + r.gr.grade, 'g');
        return r;
      }
    }
    return null;
  }
  function tick() {
    if (typeof global.cycle === 'function') { try { global.cycle(); } catch (e) {} }
    if (isOn()) tryOpenBest();
    render();
  }
  function start() {
    stop(); setOn(true);
    var sec = Math.max(90, Math.min(240, (global.CFG && global.CFG.autoSec) || 120));
    tick(); timer = setInterval(tick, sec * 1000);
    if (global.toast) global.toast('Autonomia APEX ON', 'ok');
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } setOn(false); }
  function ensurePanel() {
    injectCss();
    var el = document.getElementById('btx-auto-panel');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div'); el.id = 'btx-auto-panel';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild); else pane.appendChild(el);
    return el;
  }
  function render() {
    var el = ensurePanel(); if (!el) return;
    var ranked = rankSignals(), need = minStr();
    var html = '<h3>Autonomia APEX</h3><p class="why">Sila >= ' + need + ' (poza prime apex wymaga >=3). Max 2 poz., risk 0.35%.</p>';
    html += '<div class="row"><button type="button" class="btn" id="btx-auto-toggle">' + (isOn() ? 'Autonomia ON' : 'Wlacz autonomie') + '</button>';
    html += '<button type="button" class="btn ghost" id="btx-auto-tick">Skan teraz</button></div>';
    html += '<table><tr><th>Symbol</th><th>Strona</th><th>Sila</th><th>Score</th><th>Grade</th><th>Powody</th></tr>';
    if (!ranked.length) html += '<tr><td colspan="6">Brak sygnalu - czekam na jakosc</td></tr>';
    else ranked.slice(0, 10).forEach(function (r) {
      var cls = r.gr.pass ? 'ok' : 'bad';
      html += '<tr><td>' + r.g.sym + '</td><td>' + r.g.side + '</td><td>' + (r.g.strength || 0) + '</td><td>' + r.gr.score + '</td><td class="' + cls + '">' + r.gr.grade + '</td><td>' + (r.gr.reasons.length ? r.gr.reasons.join('; ') : '-') + '</td></tr>';
    });
    html += '</table>'; el.innerHTML = html;
    var tg = document.getElementById('btx-auto-toggle');
    if (tg) tg.onclick = function () { if (isOn()) { stop(); } else start(); render(); };
    var k = document.getElementById('btx-auto-tick');
    if (k) k.onclick = function () { tick(); };
  }
  function boot() { try { localStorage.setItem(LS_ON, '1'); } catch (e) {} injectCss(); render(); start(); setInterval(render, 6000); }
  global.BTX_AUTONOMY = { gradeSetup: gradeSetup, rankSignals: rankSignals, tick: tick, start: start, stop: stop, isOn: isOn, tryOpenBest: tryOpenBest };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
