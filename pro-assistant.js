/**
 * BTX Pro Assistant — warstwa "prawdziwy asystent handlowy"
 *
 * Cel: jeden mózg operacyjny, nie zbieranina skryptów.
 * - status pracy (PRACUJE / CZEKA / BLOKADA) z powodem
 * - automatyczny skan w godzinach sesji
 * - odświeżanie LIVE w limicie Twelve
 * - twardy gate A/A+ zsynchronizowany z autonomią
 * - kolejka działań pod XTB
 * - spójne limity PRO
 *
 * Nadal: zlecenie na koncie XTB wymaga xAPI ONLINE albo ręki.
 */
(function (global) {
  var STYLE = 'btx-pro-assistant-css';
  var LS = 'BTX_PRO_ASSIST_V1';
  var timer = null;
  var liveIdx = 0;
  var lastOps = { t: 0, status: 'START', detail: 'Inicjalizacja…', actions: [] };

  function load() {
    try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-ops{margin:10px 0 14px;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(18,196,139,.45);background:linear-gradient(180deg,rgba(18,196,139,.12),rgba(18,196,139,.04));',
      'position:relative;z-index:6}',
      '#btx-ops h3{margin:0 0 4px;font-size:15px;color:#e8fff6}',
      '#btx-ops .sub{font-size:12px;color:var(--tx2);line-height:1.45;margin-bottom:10px}',
      '#btx-ops .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}',
      '#btx-ops .cell{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px}',
      '#btx-ops .cell b{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3);margin-bottom:4px}',
      '#btx-ops .st-work{color:#12c48b;font-weight:800;font-size:16px}',
      '#btx-ops .st-wait{color:#f5b301;font-weight:800;font-size:16px}',
      '#btx-ops .st-block{color:#f87171;font-weight:800;font-size:16px}',
      '#btx-ops ul{margin:6px 0 0 16px;padding:0;font-size:12.5px;line-height:1.45}',
      '#btx-ops .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Wymuś parametry PRO — asystent, nie zabawka */
  function enforceProConfig() {
    var CFG = global.CFG;
    if (!CFG) return;
    if (CFG.risk == null || CFG.risk > 0.75) CFG.risk = 0.5;
    if (CFG.maxPos == null || CFG.maxPos > 2) CFG.maxPos = 2;
    if (CFG.maxTrades == null || CFG.maxTrades > 4) CFG.maxTrades = 4;
    if (CFG.dailyLoss == null || CFG.dailyLoss > 2) CFG.dailyLoss = 1.5;
    if (CFG.maxConsec == null || CFG.maxConsec > 3) CFG.maxConsec = 3;
    if (CFG.minHold == null || CFG.minHold < 4) CFG.minHold = 4;
    if (CFG.autoSec == null || CFG.autoSec < 120) CFG.autoSec = 180;
    if (CFG.provider !== 'alpaca' && CFG.provider !== 'stooq') CFG.provider = 'twelve';
    try {
      if (typeof global.save === 'function') global.save();
    } catch (e) {}
  }

  function warsawMinutes() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false,
      weekday: 'short'
    });
    var parts = fmt.formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var hh = parseInt(map.hour, 10), mm = parseInt(map.minute, 10);
    return { min: hh * 60 + mm, weekday: map.weekday, label: map.weekday + ' ' + map.hour + ':' + map.minute };
  }

  function sessionInfo() {
    var w = warsawMinutes();
    var day = new Date().getDay(); // local machine — uzupełnij weekend UTC/PL
    var plDay = w.weekday; // Mon, Tue...
    var isWeekend = /Sat|Sun|sob|niedz/i.test(plDay) || day === 0 || day === 6;
    // US cash equities approx 15:30–22:00 PL (bez DST edge cases idealnych)
    var usOpen = 15 * 60 + 30, usClose = 22 * 60;
    var usPrime1 = w.min >= usOpen && w.min <= 17 * 60; // first 90m
    var usPrime2 = w.min >= 19 * 60 && w.min <= 20 * 60 + 30;
    var inUs = !isWeekend && w.min >= usOpen && w.min < usClose;
    var fxOk = !isWeekend || true; // FX weekend thin
    return {
      isWeekend: isWeekend,
      inUs: inUs,
      usPrime: usPrime1 || usPrime2,
      label: w.label,
      min: w.min,
      phase: isWeekend ? 'WEEKEND' : (inUs ? (usPrime1 || usPrime2 ? 'US_PRIME' : 'US_SESSION') : (w.min < usOpen ? 'PRE_US' : 'AFTER_US'))
    };
  }

  function dataLive() {
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var d = global.BTX_PRO6.dataGate();
      return { ok: !!d.ok, label: d.label, tip: d.tip, raw: d };
    }
    var key = '';
    try { key = localStorage.getItem('btx_twelve_key') || ''; } catch (e) {}
    key = key || (global.CFG && (global.CFG.tdKey || global.CFG.twelveKey)) || '';
    return { ok: !!String(key).trim(), label: key ? 'KEY?' : 'DEMO', tip: key ? 'Klucz jest — sprawdź provider Twelve' : 'Brak klucza Twelve' };
  }

  function xtbOnline() {
    return !!(global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected());
  }

  function hardBlocks() {
    var blocks = [];
    var ses = sessionInfo();
    var data = dataLive();
    if (!data.ok) blocks.push('Dane nie-LIVE: ' + data.label);
    if (global.BTX_LEARN && global.BTX_LEARN.checkHardStop) {
      var st = global.BTX_LEARN.checkHardStop();
      if (st.stopped) blocks.push('STOP FOR DAY: ' + (st.reason || ''));
    }
    if (global.__BTX_MACRO_BLOCK) blocks.push('Makro HIGH: ' + (global.__BTX_MACRO_BLOCK.title || ''));
    else if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
      var n = global.BTX_PRO6.highNewsNow();
      if (n.blocked) blocks.push(n.headline || 'News blackout');
    }
    if (global.ST && global.ST.blocked) blocks.push('Limity konta paper (blocked)');
    return { blocks: blocks, ses: ses, data: data };
  }

  function opsStatus() {
    var hb = hardBlocks();
    if (hb.blocks.length) {
      return { code: 'BLOCK', cls: 'st-block', title: 'BLOKADA', detail: hb.blocks.join(' · '), hb: hb };
    }
    if (hb.ses.phase === 'WEEKEND') {
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (weekend)', detail: 'Stock/ETF stoją. Możesz tylko analizować / FX ostrożnie.', hb: hb };
    }
    if (hb.ses.phase === 'PRE_US') {
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (pre-market US)', detail: 'Do ~15:30 PL główny parkiet US zamknięty. Asystent skanuje FX/GOLD i przygotowuje sesję.', hb: hb };
    }
    if (hb.ses.phase === 'AFTER_US') {
      return { code: 'WAIT', cls: 'st-wait', title: 'CZEKA (po sesji US)', detail: 'Sesja cash US skończona. Podsumowanie / journal, bez forsowania wejść.', hb: hb };
    }
    return { code: 'WORK', cls: 'st-work', title: 'PRACUJE', detail: 'Sesja US aktywna · LIVE · skan i desk A/A+ włączone.', hb: hb };
  }

  async function refreshLiveRoundRobin() {
    var data = dataLive();
    if (!data.ok || typeof global.fetchReal !== 'function') return null;
    var syms = (global.SYMBOLS || []).map(function (m) { return m.s; });
    if (!syms.length) return null;
    var sym = syms[liveIdx % syms.length];
    liveIdx++;
    try {
      await global.fetchReal(sym);
      return sym;
    } catch (e) {
      global.__BTX_LAST_DATA_ERR = e.message || 'fetchReal error';
      return null;
    }
  }

  function bestPass() {
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
      var r = global.BTX_AUTONOMY.rankSignals();
      for (var i = 0; i < r.length; i++) if (r[i].gr && r[i].gr.pass) return r[i];
    }
    return null;
  }

  async function workOnce() {
    enforceProConfig();
    var st = opsStatus();
    var actions = [];

    // zawsze lekki cycle paper świec (demo path) + evaluate
    if (typeof global.cycle === 'function') {
      try { global.cycle(); actions.push('cycle'); } catch (e) { actions.push('cycle-err'); }
    }

    // LIVE refresh tylko gdy nie ma twardej blokady danych
    if (st.hb.data.ok) {
      var sym = await refreshLiveRoundRobin();
      if (sym) actions.push('live:' + sym);
    }

    // autonomia paper gdy włączona
    var autoOn = false;
    try { autoOn = localStorage.getItem('BTX_AUTONOMY_ON') === '1'; } catch (e) {}
    if (autoOn && global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tick === 'function') {
      // tick sam zarządza open; uniknij podwójnego cycle ciężkiego — wywołaj rank + manage przez tick
      try { await global.BTX_AUTONOMY.tick(); actions.push('autonomy-tick'); } catch (e2) { actions.push('auto-err'); }
    } else if (st.code === 'WORK') {
      // bez pełnej autonomii: przygotuj najlepszy plan XTB
      var best = bestPass();
      if (best && best.g && global.BTX_PRO6 && global.BTX_PRO6.buildXtbTicket) {
        try {
          var ticket = global.BTX_PRO6.buildXtbTicket(best.g);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            // nie spamuj schowka co tick — tylko gdy zmiana setupu
            var sig = best.g.sym + best.g.side + (best.g.strength || 0);
            var prev = load().lastSig;
            if (sig !== prev) {
              await navigator.clipboard.writeText(ticket);
              var o = load(); o.lastSig = sig; save(o);
              actions.push('xtb-plan-clipboard');
              if (global.toast) global.toast('A/A+ gotowy: ' + best.g.side + ' ' + best.g.sym + ' · plan w schowku', 'ok');
            }
          }
        } catch (e3) {}
      }
    }

    lastOps = {
      t: Date.now(),
      status: st.title,
      code: st.code,
      detail: st.detail,
      actions: actions,
      phase: st.hb.ses.phase,
      clock: st.hb.ses.label
    };

    if (typeof global.render === 'function') {
      try { global.render(); } catch (e4) {}
    }
    renderOps();
    return lastOps;
  }

  function startWorker() {
    stopWorker();
    var sec = (global.CFG && global.CFG.autoSec) || 180;
    sec = Math.max(90, Math.min(300, sec));
    workOnce();
    timer = setInterval(workOnce, sec * 1000);
  }
  function stopWorker() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function ensureOps() {
    injectCss();
    var el = document.getElementById('btx-ops');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-ops';
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
    var best = bestPass();
    var html = '';
    html += '<h3>Asystent handlowy · status operacyjny</h3>';
    html += '<div class="sub">To nie zabawka: tu widać czy system <b>pracuje</b>, <b>czeka na sesję/dane</b>, czy jest <b>zablokowany</b> — i dlaczego.</div>';
    html += '<div class="grid">';
    html += '<div class="cell"><b>Status</b><span class="' + st.cls + '">' + st.title + '</span></div>';
    html += '<div class="cell"><b>Zegar PL</b>' + (st.hb.ses.label || '') + '<br><span style="font-size:11px;color:var(--tx3)">' + st.hb.ses.phase + '</span></div>';
    html += '<div class="cell"><b>Dane</b>' + st.hb.data.label + '</div>';
    html += '<div class="cell"><b>XTB xAPI</b>' + (xtbOnline() ? 'ONLINE' : 'offline / ręcznie') + '</div>';
    html += '<div class="cell"><b>Autonomia paper</b>' + (autoOn ? 'ON' : 'OFF') + '</div>';
    html += '<div class="cell"><b>Najlepszy setup</b>' + (best && best.g ? (best.g.side + ' ' + best.g.sym + ' · ' + best.gr.grade + ' · ' + best.gr.score) : 'brak A/A+') + '</div>';
    html += '</div>';
    html += '<div class="sub">' + st.detail + '</div>';
    if (lastOps.actions && lastOps.actions.length) {
      html += '<div class="sub">Ostatni cykl prac: ' + lastOps.actions.join(', ') + ' · ' + (lastOps.t ? new Date(lastOps.t).toLocaleTimeString('pl-PL') : '') + '</div>';
    }
    html += '<div class="row">';
    html += '<button type="button" class="btn" id="btx-ops-now">Pracuj teraz (1 cykl)</button>';
    html += '<button type="button" class="btn" id="btx-ops-auto">' + (autoOn ? 'Autonomia ON ✓' : 'Włącz autonomię paper') + '</button>';
    html += '<button type="button" class="btn ghost" id="btx-ops-enforce">Wymuś limity PRO</button>';
    html += '</div>';
    html += '<ul>';
    html += '<li>Asystent sam odświeża instrumenty LIVE rotacyjnie (limit Twelve).</li>';
    html += '<li>Wejścia paper tylko przez Signal Desk (siła ≥4, score ≥70, bez blokad).</li>';
    html += '<li>XTB: plan w schowku / kolejce; auto-zlecenie tylko gdy xAPI ONLINE i osobno włączysz handel real/demo.</li>';
    html += '</ul>';
    el.innerHTML = html;

    var b1 = document.getElementById('btx-ops-now');
    if (b1) b1.onclick = function () { workOnce(); };
    var b2 = document.getElementById('btx-ops-auto');
    if (b2) b2.onclick = function () {
      try { localStorage.setItem('BTX_AUTONOMY_ON', '1'); localStorage.setItem('BTX_TRADE_MODE', 'trade'); } catch (e) {}
      if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start) global.BTX_AUTONOMY.start();
      if (global.toast) global.toast('Autonomia paper włączona', 'ok');
      workOnce();
    };
    var b3 = document.getElementById('btx-ops-enforce');
    if (b3) b3.onclick = function () {
      enforceProConfig();
      if (global.toast) global.toast('Limity PRO wymuszone (0.5% / max2 / max4)', 'ok');
      renderOps();
    };
  }

  function boot() {
    injectCss();
    enforceProConfig();
    renderOps();
    startWorker();
    // przechwyt render — panel zawsze świeży
    if (typeof global.render === 'function' && !global.render.__proAssist) {
      var orig = global.render;
      global.render = function () {
        var r = orig.apply(this, arguments);
        try { renderOps(); } catch (e) {}
        return r;
      };
      global.render.__proAssist = true;
    }
  }

  global.BTX_ASSISTANT = {
    workOnce: workOnce,
    opsStatus: opsStatus,
    enforceProConfig: enforceProConfig,
    startWorker: startWorker,
    stopWorker: stopWorker
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
