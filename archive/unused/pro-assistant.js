/**
 * BTX Pro Assistant — stabilny status + skan, BEZ przejmowania global.render
 */
(function (global) {
  'use strict';
  if (global.__BTX_ASSISTANT_BOOT__) return;
  global.__BTX_ASSISTANT_BOOT__ = true;

  var STYLE = 'btx-pro-assistant-css';
  var timer = null;
  var liveIdx = 0;
  var lastOps = { actions: [], t: 0 };

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-ops{margin:10px 0 14px;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(18,196,139,.45);background:linear-gradient(180deg,rgba(18,196,139,.12),rgba(18,196,139,.04));',
      'position:relative;z-index:6}',
      '#btx-ops h3{margin:0 0 4px;font-size:15px;color:#e8fff6}',
      '#btx-ops .sub{font-size:12px;color:var(--tx2,#94a3b8);line-height:1.45;margin-bottom:10px}',
      '#btx-ops .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}',
      '#btx-ops .cell{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px}',
      '#btx-ops .cell b{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3,#64748b);margin-bottom:4px}',
      '#btx-ops .st-work{color:#12c48b;font-weight:800;font-size:16px}',
      '#btx-ops .st-wait{color:#f5b301;font-weight:800;font-size:16px}',
      '#btx-ops .st-block{color:#f87171;font-weight:800;font-size:16px}',
      '#btx-ops .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}',
      '#btx-ops button{cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  function warsawMinutes() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekday: map.weekday,
      label: map.weekday + ' ' + map.hour + ':' + map.minute
    };
  }

  function sessionInfo() {
    var w = warsawMinutes();
    var isWeekend = /Sat|Sun/i.test(w.weekday);
    var inEu = !isWeekend && w.min >= 9 * 60 && w.min < 17 * 60 + 30;
    var inUs = !isWeekend && w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var prof = 'ALL';
    try {
      if (global.BTX_SESSION_PROFILE && global.BTX_SESSION_PROFILE.get) prof = global.BTX_SESSION_PROFILE.get();
      else prof = localStorage.getItem('BTX_SESSION_PROFILE') || 'ALL';
    } catch (e) {}
    var active = false;
    if (!isWeekend) {
      if (prof === 'RANO') active = inEu;
      else if (prof === 'US') active = inUs;
      else active = inEu || inUs;
    }
    var phase = isWeekend ? 'WEEKEND' : (inUs ? 'US_SESSION' : (inEu ? 'EU_SESSION' : (w.min < 9 * 60 ? 'PRE_OPEN' : 'AFTER')));
    return { isWeekend: isWeekend, inEu: inEu, inUs: inUs, profile: prof, active: active, label: w.label, phase: phase };
  }

  function dataLabel() {
    try {
      if (global.BTX_LIVE && global.BTX_LIVE.isFresh && global.SYMBOLS) {
        var ok = 0, n = 0;
        (global.SYMBOLS || []).forEach(function (m) {
          n++;
          if (global.BTX_LIVE.isFresh(m.s)) ok++;
        });
        if (ok > 0) return 'LIVE ' + ok + '/' + n;
        if (global.BTX_LIVE.getKey && global.BTX_LIVE.getKey()) return 'KEY';
      }
    } catch (e) {}
    try {
      var k = localStorage.getItem('btx_twelve_key') || '';
      if (k) return 'KEY';
    } catch (e2) {}
    return 'DEMO';
  }

  function clearStop() {
    try {
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      if (global.ST) { global.ST.blocked = false; global.ST.stopForDay = false; }
    } catch (e) {}
  }

  function opsStatus() {
    clearStop();
    var ses = sessionInfo();
    var data = dataLabel();
    if (ses.isWeekend) {
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (weekend)', detail: 'Parkiety zamknięte.', ses: ses, data: data };
    }
    if (ses.active) {
      var where = ses.inUs && ses.inEu ? 'EU+US' : (ses.inUs ? 'sesja US' : 'sesja EU (RANO)');
      return {
        code: 'WORK', cls: 'st-work', title: 'PRACUJE',
        detail: where + ' \u00b7 profil ' + ses.profile + ' \u00b7 dane ' + data + ' \u00b7 STOP DAY off',
        ses: ses, data: data
      };
    }
    if (ses.phase === 'PRE_OPEN') {
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (przed 9:00)', detail: 'Przed otwarciem EU.', ses: ses, data: data };
    }
    return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA', detail: 'Poza godzinami profilu ' + ses.profile + '.', ses: ses, data: data };
  }

  function ensureOps() {
    injectCss();
    var el = document.getElementById('btx-ops');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-ops';
    el.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.id) return;
      if (t.id === 'btx-ops-now') {
        workOnce();
      } else if (t.id === 'btx-ops-auto') {
        try { localStorage.setItem('BTX_AUTONOMY_ON', '1'); } catch (e) {}
        if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start) {
          try { global.BTX_AUTONOMY.start(); } catch (e2) {}
        }
        if (global.toast) global.toast('Autonomia paper ON', 'ok');
        workOnce();
      }
    });
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function renderOps() {
    var el = ensureOps();
    if (!el) return;
    var st = opsStatus();
    var autoOn = false;
    try { autoOn = localStorage.getItem('BTX_AUTONOMY_ON') === '1'; } catch (e) {}
    var best = 'brak A/A+';
    try {
      if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
        var r = global.BTX_AUTONOMY.rankSignals() || [];
        for (var i = 0; i < r.length; i++) {
          if (r[i].gr && r[i].gr.pass && r[i].g) {
            best = r[i].g.side + ' ' + r[i].g.sym + ' \u00b7 ' + r[i].gr.grade;
            break;
          }
        }
      }
    } catch (e3) {}

    var html = '';
    html += '<h3>Asystent handlowy \u00b7 status operacyjny</h3>';
    html += '<div class="sub">Status sesji. Nawigacja strony dzia\u0142a niezale\u017cnie od tego panelu.</div>';
    html += '<div class="grid">';
    html += '<div class="cell"><b>Status</b><span class="' + st.cls + '">' + st.title + '</span></div>';
    html += '<div class="cell"><b>Zegar PL</b>' + st.ses.label + '<br><span style="font-size:11px;color:var(--tx3,#64748b)">' + st.ses.phase + ' \u00b7 ' + st.ses.profile + '</span></div>';
    html += '<div class="cell"><b>Dane</b>' + st.data + '</div>';
    html += '<div class="cell"><b>Autonomia</b>' + (autoOn ? 'ON' : 'OFF') + '</div>';
    html += '<div class="cell"><b>Setup</b>' + best + '</div>';
    html += '</div>';
    html += '<div class="sub">' + st.detail + '</div>';
    if (lastOps.actions && lastOps.actions.length) {
      html += '<div class="sub">Ostatni cykl: ' + lastOps.actions.join(', ') + '</div>';
    }
    html += '<div class="row">';
    html += '<button type="button" class="btn" id="btx-ops-now">Pracuj teraz (1 cykl)</button>';
    html += '<button type="button" class="btn" id="btx-ops-auto">' + (autoOn ? 'Autonomia ON' : 'W\u0142\u0105cz autonomi\u0119 paper') + '</button>';
    html += '</div>';
    if (el.getAttribute('data-html') !== html) {
      el.setAttribute('data-html', html);
      el.innerHTML = html;
    }
  }

  async function workOnce() {
    var st = opsStatus();
    var actions = [];
    if (typeof global.cycle === 'function') {
      try { global.cycle(); actions.push('cycle'); } catch (e) { actions.push('cycle-err'); }
    }
    try {
      var syms = (global.SYMBOLS || []).map(function (m) { return m.s; });
      if (syms.length && (typeof global.fetchReal === 'function' || typeof global.fetchTwelve === 'function')) {
        var sym = syms[liveIdx % syms.length];
        liveIdx++;
        if (typeof global.fetchReal === 'function') await global.fetchReal(sym);
        else await global.fetchTwelve(sym);
        actions.push('live:' + sym);
      }
    } catch (eL) {}
    var autoOn = false;
    try { autoOn = localStorage.getItem('BTX_AUTONOMY_ON') === '1'; } catch (e) {}
    if (autoOn && st.code === 'WORK' && global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tick === 'function') {
      try { await global.BTX_AUTONOMY.tick(); actions.push('auto'); } catch (e2) { actions.push('auto-err'); }
    }
    lastOps = { t: Date.now(), actions: actions };
    renderOps();
  }

  function startWorker() {
    if (timer) clearInterval(timer);
    workOnce();
    var sec = 180;
    try { sec = Math.max(120, Math.min(300, (global.CFG && global.CFG.autoSec) || 180)); } catch (e) {}
    timer = setInterval(function () { workOnce(); }, sec * 1000);
  }

  function boot() {
    injectCss();
    renderOps();
    startWorker();
    setInterval(renderOps, 10000);
  }

  global.BTX_ASSISTANT = {
    workOnce: workOnce,
    opsStatus: opsStatus,
    startWorker: startWorker,
    stopWorker: function () { if (timer) clearInterval(timer); timer = null; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
