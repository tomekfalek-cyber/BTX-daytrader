/**
 * BTX Pro Desk — FIX menu tabs: mount only in #pane-desk, rebind nav clicks
 */
(function (global) {
  var JK = 'BTX_JOURNAL_V2';
  var AK = 'BTX_ALERTS_ON';
  var STYLE = 'btx-pro-desk-css';
  var lastAlertKey = '';
  var lastHtml = '';

  function loadJournal() { try { return JSON.parse(localStorage.getItem(JK) || '{}'); } catch (e) { return {}; } }
  function saveJournal(j)) { try { localStorage.setItem(JK, JSON.stringify(j)); } catch (e) {} }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = '.pro-wrap{display:grid;gap:12px;margin:12px 0 14px;box-sizing:border-box}.pro-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.pro-card{background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--line);border-radius:14px;padding:12px 14px}.pro-card h3{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx3);margin-bottom:8px;font-weight:700}.pro-card .big{font-family:"JetBrains Mono",monospace;font-size:20px;font-weight:700}.pro-card .sub{font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.4}.pro-check{list-style:none;padding:0;margin:0}.pro-check li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);line-height:1.4}.pro-check .box{width:16px;height:16px;border-radius:4px;border:1px solid var(--line2);flex:0 0 16px;margin-top:1px;text-align:center;font-size:11px;line-height:15px}.pro-check .box.ok{background:rgba(18,196,139,.2);border-color:var(--green);color:var(--green)}.pro-check .box.no{background:rgba(240,68,82,.15);border-color:#f87171;color:#f87171}.pro-plan{font-family:"JetBrains Mono",monospace;font-size:12px;line-height:1.7}.pro-plan b{color:#fff;font-weight:600}.data-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:10px;font-weight:700}.data-pill.demo{background:rgba(245,179,1,.12);color:var(--gold)}.data-pill.live{background:rgba(18,196,139,.14);color:var(--green)}.data-pill.cfg{background:rgba(59,130,246,.14);color:#93c5fd}.pro-alert-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.pro-mini{font-size:11px;color:var(--tx2);line-height:1.45}.jr-note{width:100%;background:var(--bg4);border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:6px 8px;font:inherit;font-size:12px;margin-top:4px}.tag{display:inline-block;padding:2px 7px;border-radius:99px;background:var(--bg4);border:1px solid var(--line);font-size:10px;margin:2px 3px 2px 0;color:var(--tx2);cursor:pointer}.tag.on{border-color:var(--red);color:#fff;background:rgba(228,0,43,.2)}.btn.tiny{padding:5px 10px;font-size:11px;border-radius:8px}#pro-desk-root{position:relative;z-index:1}aside,.nav{position:relative;z-index:20}';
    document.head.appendChild(s);
  }

  function bindTabs() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.__proTabsBound) return;
    nav.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.nav button') : null;
      if (!t) return;
      var tab = t.getAttribute('data-tab');
      if (!tab) return;
      e.preventDefault();
      var bs = document.querySelectorAll('.nav button');
      for (var i = 0; i < bs.length; i++) {
        bs[i].className = (bs[i].getAttribute('data-tab') === tab) ? 'on' : '';
      }
      var ps = document.querySelectorAll('.pane');
      for (var k = 0; k < ps.length; k++) {
        var on = ps[k].id === ('pane-' + tab);
        var base = (ps[k].className || 'pane').replace(/\bon\b/g, '').replace(/\s+/g, ' ').trim();
        if (base.indexOf('pane') < 0) base = 'pane ' + base;
        ps[k].className = on ? (base + ' on') : base;
      }
      try {
        if (tab === 'chart' && typeof global.drawCandles === 'function') global.drawCandles();
        if (tab === 'ai') {
          if (typeof global.initAI === 'function') global.initAI();
          if (typeof global.renderAI === 'function') global.renderAI();
        }
      } catch (err) {}
    });
    nav.__proTabsBound = true;
  }

  function dataStatus() {
    var cfg = global.CFG || {};
    var provEl = document.getElementById('set-prov');
    var prov = cfg.prov || cfg.provider || (provEl && provEl.value) || 'demo';
    var hasTwelve = !!(cfg.twelveKey || cfg.apiKey);
    var hasAlp = !!(cfg.alpKey && cfg.alpSec);
    var hasFinn = !!(cfg.finnhubKey);
    if (prov === 'twelve' && hasTwelve) return { mode: 'live', label: 'LIVE \u00b7 Twelve Data', cls: 'live', tip: 'Klucz Twelve ustawiony' };
    if (prov === 'alpaca' && hasAlp) return { mode: 'live', label: 'LIVE \u00b7 Alpaca IEX', cls: 'live', tip: 'Alpaca keys OK' };
    if (prov === 'finnhub' && hasFinn) return { mode: 'live', label: 'LIVE \u00b7 Finnhub', cls: 'live', tip: 'Finnhub OK' };
    if (prov === 'stooq') return { mode: 'cfg', label: 'STOOQ \u00b7 EOD', cls: 'cfg', tip: 'Nie daytrading live' };
    if (hasTwelve || hasAlp || hasFinn) return { mode: 'cfg', label: 'KLUCZ \u00b7 sprawd\u017a dostawc\u0119', cls: 'cfg', tip: 'Wybierz dostawc\u0119 w Ustawieniach' };
    return { mode: 'demo', label: 'DEMO \u00b7 dane syntetyczne', cls: 'demo', tip: 'Ustaw Twelve / Alpaca w Ustawieniach' };
  }

  function dayRegime() {
    var ST = global.ST;
    if (!ST || !ST.series || !ST.series.SPY || ST.series.SPY.length < 40)
      return { label: 'nieznany', tip: 'Brak SPY \u2014 uruchom cykl', score: 0 };
    var b = ST.series.SPY, cl = b.map(function (x) { return x.c; }), n = cl.length, c = cl[n - 1];
    var sma20 = 0, sma50 = 0, k;
    for (k = n - 20; k < n; k++) sma20 += cl[k]; sma20 /= 20;
    for (k = Math.max(0, n - 50); k < n; k++) sma50 += cl[k]; sma50 /= Math.min(50, n);
    var range40 = Math.max.apply(null, b.slice(-40).map(function (x) { return x.h; })) - Math.min.apply(null, b.slice(-40).map(function (x) { return x.l; }));
    if (range40 / c > 0.025 && Math.abs(c - sma20) / c < 0.003)
      return { label: 'RANGE / chop', tip: 'SPY w konsolidacji', score: -1 };
    if (c > sma20 && sma20 >= sma50 * 0.998)
      return { label: 'TREND \u2191', tip: 'SPY powy\u017cej \u015brednich', score: 1 };
    if (c < sma20 && sma20 <= sma50 * 1.002)
      return { label: 'TREND \u2193', tip: 'SPY poni\u017cej \u015brednich', score: -2 };
    return { label: 'MIXED', tip: 'Wymagaj si\u0142y 5/5', score: 0 };
  }

  function newsToday() {
    var windows = (global.BTX_PRO && global.BTX_PRO.newsWindows) || [
      { label: 'US data 12:30', min: 12 * 60 + 30 }, { label: 'US data 13:30', min: 13 * 60 + 30 },
      { label: 'US data 14:00', min: 14 * 60 }, { label: 'FOMC/Fed 18:00', min: 18 * 60 },
      { label: 'FOMC/Fed 19:00', min: 19 * 60 }, { label: 'EU/ECB 12:00', min: 12 * 60 },
      { label: 'EU/ECB 12:45', min: 12 * 60 + 45 }
    ];
    var pad = (global.BTX_PRO && global.BTX_PRO.newsPadMin) || 30;
    var now = new Date(), t = now.getUTCHours() * 60 + now.getUTCMinutes();
    return windows.map(function (w) {
      return { label: w.label, min: w.min, dist: w.min - t, active: Math.abs(w.min - t) <= pad };
    }).sort(function (a, b) { return Math.abs(a.dist) - Math.abs(b.dist); });
  }

  function tradeR(t) {
    if (!t) return null;
    var risk = t.risk0 != null ? t.risk0 : Math.abs((t.entry || 0) - (t.stop != null ? t.stop : t.entry));
    if (!risk || risk < 1e-9) return null;
    var pnlPer = t.exit != null ? (t.side === 'LONG' ? (t.exit - t.entry) : (t.entry - t.exit)) : (t.qty ? (t.pnl || 0) / t.qty : null);
    if (pnlPer == null) return null;
    return pnlPer / risk;
  }

  function computeStats() {
    var ST = global.ST || {}, closed = ST.closed || [], eq = ST.eq || [];
    var wins = 0, losses = 0, sumR = 0, nR = 0, sumPnl = 0;
    closed.forEach(function (t) {
      sumPnl += (t.pnl || 0);
      if ((t.pnl || 0) > 0) wins++; else if ((t.pnl || 0) < 0) losses++;
      var r = tradeR(t);
      if (r != null && isFinite(r)) { sumR += r; nR++; }
    });
    var n = wins + losses, maxDD = 0, peak = -Infinity;
    (eq.length ? eq : [ST.equity || 0]).forEach(function (v) {
      if (v > peak) peak = v;
      if (peak - v > maxDD) maxDD = peak - v;
    });
    return { n: n, wins: wins, losses: losses, wr: n ? wins / n : 0, avgR: nR ? sumR / nR : null, avgPnl: n ? sumPnl / n : 0, sumPnl: sumPnl, maxDD: maxDD, nR: nR };
  }

  function checklistFor(g) {
    var items = [], regime = dayRegime(), newsActive = newsToday().some(function (x) { return x.active; });
    var ds = dataStatus(), str = g.strength || 0, side = g.side;
    items.push({ ok: side === 'LONG' || side === 'SHORT', text: 'Jest kierunek (LONG/SHORT)' });
    items.push({ ok: str >= 4, text: 'Si\u0142a \u2265 4 (teraz ' + str + '/5)' });
    items.push({ ok: !newsActive, text: newsActive ? 'News blackout \u2014 nie wchod\u017a' : 'Poza oknem news\u00f3w' });
    items.push({ ok: regime.score !== -1 || str >= 5, text: 'Re\u017cim: ' + regime.label });
    if (side === 'LONG') items.push({ ok: String(g.trend || '').indexOf('UP') >= 0 || /up/i.test(String(g.why || '')), text: 'Z trendem wzrostowym' });
    if (side === 'SHORT') items.push({ ok: String(g.trend || '').indexOf('DN') >= 0 || /down/i.test(String(g.why || '')), text: 'Z trendem spadkowym' });
    items.push({ ok: !g.ai || g.ai.ok !== false || (g.ai.conf || 0) >= 0.55, text: g.ai ? ('AI: ' + (g.ai.ok ? 'OK' : 's\u0142abo')) : 'AI: regu\u0142y PRO' });
    items.push({ ok: ds.mode !== 'demo', text: ds.mode === 'demo' ? 'Dane DEMO' : ds.label });
    items.push({ ok: true, text: 'Plan SL/TP/size przed XTB' });
    var pass = items.filter(function (x) { return x.ok; }).length;
    return { items: items, pass: pass, total: items.length, ready: pass >= items.length - 1 && str >= 4 && !newsActive };
  }

  function xtbPlan(g) {
    var ST = global.ST || {}, cfg = global.CFG || {};
    var riskPct = (global.BTX_PRO && global.BTX_PRO.riskPct) || cfg.risk || 0.5;
    var atrMult = (global.BTX_PRO && global.BTX_PRO.atrSlMult) || 2;
    var tpR = (global.BTX_PRO && global.BTX_PRO.tpR) || 2.5;
    var partialR = (global.BTX_PRO && global.BTX_PRO.partialR) || 1.5;
    var eq = ST.equity || cfg.capital || 100000;
    var price = g.price || 0, atr = g.atr || price * 0.004, sd = atr * atrMult;
    var riskCash = eq * (riskPct / 100);
    var qty = sd > 0 ? Math.max(1, Math.floor(riskCash / sd)) : 1;
    return {
      riskPct: riskPct, riskCash: riskCash, qty: qty, entry: price,
      sl: g.side === 'SHORT' ? price + sd : price - sd,
      tp: g.side === 'SHORT' ? price - tpR * sd : price + tpR * sd,
      partial: g.side === 'SHORT' ? price - partialR * sd : price + partialR * sd,
      tpR: tpR, partialR: partialR
    };
  }

  function fmt(x) {
    if (x == null || !isFinite(x)) return '\u2014';
    return global.f2 ? global.f2(x) : Number(x).toFixed(2);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function ensureRootDesk() {
    var el = document.getElementById('pro-desk-root');
    if (el && el.parentNode) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'pro-desk-root';
    el.className = 'pro-wrap';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function bestSetups() {
    var sig = (global.ST && global.ST.sig) || [];
    return sig.filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
  }

  function beep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination); o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, 180);
    } catch (e) {}
  }

  function maybeAlert() {
    if (localStorage.getItem(AK) === '0') return;
    var best = bestSetups().filter(function (x) { return (x.strength || 0) >= 4; })[0];
    if (!best) return;
    var key = best.sym + '|' + best.side + '|' + best.strength + '|' + (global.ST && global.ST.n);
    if (key === lastAlertKey) return;
    lastAlertKey = key;
    beep();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('BTX okazja ' + best.side, { body: best.sym + ' si\u0142a ' + best.strength + '/5' });
    } catch (e) {}
  }

  function journalId(t) { return [t.sym, t.side, t.entry, t.exit, t.pnl, t.bars].join('|'); }

  function renderJournalBox() {
    var box = document.getElementById('pro-journal-box');
    if (!box) return;
    var closed = (global.ST && global.ST.closed) || [];
    if (!closed.length) { box.innerHTML = '<span class="pro-mini">Brak zamkni\u0119tych paper trades.</span>'; return; }
    var j = loadJournal(), t = closed[0], id = journalId(t), rec = j[id] || { tags: [], note: '' };
    var tags = ['pullback', 'ORB', 'VWAP', 'trend', 'news-skip', 'FOMO', 'ok', 'b\u0142\u0105d'];
    var h = '<div class="pro-mini">Ostatni: <b>' + esc(t.sym) + ' ' + esc(t.side) + '</b> P&L ' + fmt(t.pnl) + '</div><div style="margin-top:6px">';
    tags.forEach(function (tg) {
      h += '<span class="tag' + (rec.tags && rec.tags.indexOf(tg) >= 0 ? ' on' : '') + '" data-tag="' + tg + '">' + tg + '</span>';
    });
    h += '</div><textarea class="jr-note" id="pro-jr-note" rows="2" placeholder="Notatka...">' + esc(rec.note || '') + '</textarea>';
    h += '<div style="margin-top:6px"><button type="button" class="btn ghost tiny" id="pro-jr-save">Zapisz journal</button></div>';
    box.innerHTML = h;
    box.querySelectorAll('.tag').forEach(function (el) {
      el.addEventListener('click', function () {
        var tg = el.getAttribute('data-tag');
        rec.tags = rec.tags || [];
        var i = rec.tags.indexOf(tg);
        if (i >= 0) rec.tags.splice(i, 1); else rec.tags.push(tg);
        j[id] = rec; saveJournal(j); renderJournalBox();
      });
    });
    var btn = document.getElementById('pro-jr-save');
    if (btn) btn.onclick = function (ev) {
      if (ev) ev.preventDefault();
      rec.note = (document.getElementById('pro-jr-note') || {}).value || '';
      j[id] = rec; saveJournal(j);
      if (global.toast) global.toast('Journal zapisany');
    };
  }

  function bindAlertButtons() {
    var t = document.getElementById('pro-toggle-alert');
    if (t) t.onclick = function (ev) {
      if (ev) ev.preventDefault();
      var on = localStorage.getItem(AK) !== '0';
      localStorage.setItem(AK, on ? '0' : '1');
      if (!on && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
      lastHtml = '';
      renderPro();
    };
    var b = document.getElementById('pro-test-alert');
    if (b) b.onclick = function (ev) { if (ev) ev.preventDefault(); beep(); };
  }

  function renderPro() {
    try {
      injectCss();
      bindTabs();
      var root = document.getElementById('pro-desk-root') || ensureRootDesk();
      if (!root) return;
      var desk = document.getElementById('pane-desk');
      if (desk && desk.className.indexOf('on') < 0) return;

      var ds = dataStatus(), regime = dayRegime(), news = newsToday(), st = computeStats();
      var best = bestSetups()[0];
      var alertsOn = localStorage.getItem(AK) !== '0';
      var nAct = news.filter(function (x) { return x.active; })[0];

      var html = '<div class="pro-row">';
      html += '<div class="pro-card"><h3>Dane rynkowe</h3><div><span class="data-pill ' + ds.cls + '">' + ds.label + '</span></div><div class="sub">' + ds.tip + '</div></div>';
      html += '<div class="pro-card"><h3>Re\u017cim dnia (SPY)</h3><div class="big" style="font-size:16px">' + regime.label + '</div><div class="sub">' + regime.tip + '</div></div>';
      html += '<div class="pro-card"><h3>Strategia</h3><div class="big" style="font-size:15px">PRO desk</div><div class="sub">0.5% risk \u00b7 max 2 pos \u00b7 SL 2\u00d7ATR \u00b7 TP 2.5R</div></div>';
      html += '<div class="pro-card"><h3>News (UTC)</h3><div class="big" style="font-size:14px">' + (nAct ? '\u26a0 ' + nAct.label : 'OK') + '</div><div class="sub">';
      news.slice(0, 3).forEach(function (w) {
        var when = w.dist >= 0 ? ('za ' + w.dist + ' min') : (Math.abs(w.dist) + ' min temu');
        html += (w.active ? '<b style="color:#f87171">' : '') + w.label + ' (' + when + ')' + (w.active ? '</b>' : '') + '<br>';
      });
      html += '</div></div></div><div class="pro-row">';
      html += '<div class="pro-card"><h3>Win rate</h3><div class="big">' + (st.n ? Math.round(st.wr * 100) + '%' : '\u2014') + '</div><div class="sub">' + st.wins + 'W / ' + st.losses + 'L</div></div>';
      html += '<div class="pro-card"><h3>Avg R</h3><div class="big">' + (st.avgR != null ? ((st.avgR >= 0 ? '+' : '') + st.avgR.toFixed(2) + 'R') : '\u2014') + '</div><div class="sub">' + (st.nR ? (st.nR + ' trade\'s') : 'gdy znamy SL') + '</div></div>';
      html += '<div class="pro-card"><h3>\u015ar. P&L</h3><div class="big" style="color:' + (st.avgPnl >= 0 ? 'var(--green)' : '#f87171') + '">' + fmt(st.avgPnl) + '</div><div class="sub">Suma ' + fmt(st.sumPnl) + '</div></div>';
      html += '<div class="pro-card"><h3>Max DD</h3><div class="big">' + fmt(st.maxDD) + '</div></div></div>';
      html += '<div class="pro-row" style="grid-template-columns:1fr 1fr">';
      html += '<div class="pro-card"><h3>Checklist' + (best ? ' \u00b7 ' + best.sym + ' ' + best.side : '') + '</h3>';
      if (!best) html += '<div class="pro-mini">Brak LONG/SHORT. Uruchom cykl.</div>';
      else {
        var ck = checklistFor(best);
        html += '<ul class="pro-check">';
        ck.items.forEach(function (it) {
          html += '<li><span class="box ' + (it.ok ? 'ok' : 'no') + '">' + (it.ok ? '\u2713' : '!') + '</span><span>' + esc(it.text) + '</span></li>';
        });
        html += '</ul><div class="sub" style="margin-top:8px">' + (ck.ready ? '<b style="color:var(--green)">CHECKLIST OK</b>' : '<b style="color:#f87171">Nie gotowe</b>') + '</div>';
      }
      html += '</div><div class="pro-card"><h3>Plan XTB</h3>';
      if (!best) html += '<div class="pro-mini">Przy sile 4\u20135: size, SL, TP.</div>';
      else {
        var p = xtbPlan(best);
        html += '<div class="pro-plan">' + best.side + ' <b>' + esc(best.sym) + '</b> @ <b>' + fmt(p.entry) + '</b><br>';
        html += 'Qty <b>' + p.qty + '</b> \u00b7 risk <b>' + p.riskPct + '%</b> \u2248 ' + fmt(p.riskCash) + '<br>';
        html += 'SL <b>' + fmt(p.sl) + '</b><br>Partial <b>' + fmt(p.partial) + '</b> (+' + p.partialR + 'R)<br>';
        html += 'TP <b>' + fmt(p.tp) + '</b> (+' + p.tpR + 'R)<br>BE po +1R</div>';
      }
      html += '</div></div>';
      html += '<div class="pro-card"><h3>Alerty & journal</h3><div class="pro-alert-bar">';
      html += '<button type="button" class="btn ghost tiny" id="pro-toggle-alert">' + (alertsOn ? 'Alerty ON' : 'Alerty OFF') + '</button> ';
      html += '<button type="button" class="btn ghost tiny" id="pro-test-alert">Test d\u017awi\u0119ku</button></div>';
      html += '<div id="pro-journal-box" style="margin-top:8px"></div></div>';

      if (html !== lastHtml) {
        root.innerHTML = html;
        lastHtml = html;
        renderJournalBox();
        bindAlertButtons();
      }
    } catch (e) {
      try { console.warn('pro-desk', e); } catch (e2) {}
    }
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__proDesk) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      orig(g);
      try {
        var p = global.ST && global.ST.pos && global.ST.pos[g.sym];
        if (p && p.risk0 == null && p.entry != null && p.stop != null) p.risk0 = Math.abs(p.entry - p.stop);
      } catch (e) {}
    };
    global.openPos.__proDesk = true;
  }
  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__proDesk) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var p = global.ST && global.ST.pos && global.ST.pos[sym];
      var risk0 = p && p.risk0;
      orig(sym, why, px);
      try {
        var c = global.ST && global.ST.closed && global.ST.closed[0];
        if (c && c.sym === sym && risk0 != null) c.risk0 = risk0;
      } catch (e) {}
    };
    global.closePos.__proDesk = true;
  }
  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__proDesk) return;
    var orig = global.render;
    global.render = function () {
      var r = orig.apply(this, arguments);
      try { renderPro(); maybeAlert(); } catch (e) {}
      return r;
    };
    global.render.__proDesk = true;
  }

  function boot() {
    try {
      injectCss();
      bindTabs();
      ensureRootDesk();
      patchOpen();
      patchClose();
      patchRender();
      renderPro();
    } catch (e) { try { console.warn('pro-desk boot', e); } catch (e2) {} }
    setInterval(function () {
      try { bindTabs(); patchOpen(); patchClose(); patchRender(); renderPro(); maybeAlert(); } catch (e) {}
    }, 3000);
  }

  global.BTX_PRO_DESK = { render: renderPro, bindTabs: bindTabs, checklistFor: checklistFor, xtbPlan: xtbPlan, stats: computeStats };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
