/**
 * BTX Pro Desk FULL + AI Journal + News weekend fix
 */
(function (global) {
  var JK = 'BTX_JOURNAL_V2';
  var AK = 'BTX_ALERTS_ON';
  var STYLE = 'btx-pro-desk-css';
  var lastAlertKey = '';
  var lastHtml = '';
  var lastAutoJr = '';

  function loadJournal() { try { return JSON.parse(localStorage.getItem(JK) || '{}'); } catch (e) { return {}; } }
  function saveJournal(j) { try { localStorage.setItem(JK, JSON.stringify(j)); } catch (e) {} }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = '.pro-wrap{display:grid;gap:12px;margin:12px 0 14px}.pro-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.pro-card{background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--line);border-radius:14px;padding:12px 14px}.pro-card h3{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx3);margin-bottom:8px;font-weight:700}.pro-card .big{font-family:"JetBrains Mono",monospace;font-size:20px;font-weight:700}.pro-card .sub{font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.4}.pro-check{list-style:none;padding:0;margin:0}.pro-check li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}.pro-check .box{width:16px;height:16px;border-radius:4px;border:1px solid var(--line2);flex:0 0 16px;text-align:center;font-size:11px;line-height:15px}.pro-check .box.ok{background:rgba(18,196,139,.2);border-color:var(--green);color:var(--green)}.pro-check .box.no{background:rgba(240,68,82,.15);border-color:#f87171;color:#f87171}.pro-plan{font-family:"JetBrains Mono",monospace;font-size:12px;line-height:1.7}.data-pill{display:inline-flex;padding:4px 10px;border-radius:99px;font-size:10px;font-weight:700}.data-pill.demo{background:rgba(245,179,1,.12);color:var(--gold)}.data-pill.live{background:rgba(18,196,139,.14);color:var(--green)}.data-pill.cfg{background:rgba(59,130,246,.14);color:#93c5fd}.pro-mini{font-size:11px;color:var(--tx2);line-height:1.45}.jr-note{width:100%;background:var(--bg4);border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px}.jr-ai{font-size:12.5px;line-height:1.55;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:10px 12px;margin-top:8px}.tag{display:inline-block;padding:2px 7px;border-radius:99px;background:var(--bg4);border:1px solid var(--line);font-size:10px;margin:2px 3px 2px 0;cursor:pointer}.tag.on{border-color:var(--red);color:#fff;background:rgba(228,0,43,.2)}.btn.tiny{padding:5px 10px;font-size:11px;border-radius:8px}';
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
      for (var i = 0; i < bs.length; i++) bs[i].className = (bs[i].getAttribute('data-tab') === tab) ? 'on' : '';
      var ps = document.querySelectorAll('.pane');
      for (var k = 0; k < ps.length; k++) {
        var on = ps[k].id === ('pane-' + tab);
        var base = (ps[k].className || 'pane').replace(/\bon\b/g, '').replace(/\s+/g, ' ').trim();
        if (base.indexOf('pane') < 0) base = 'pane ' + base;
        ps[k].className = on ? (base + ' on') : base;
      }
      try {
        if (tab === 'chart' && typeof global.drawCandles === 'function') global.drawCandles();
        if (tab === 'ai') { if (typeof global.initAI === 'function') global.initAI(); if (typeof global.renderAI === 'function') global.renderAI(); }
        if (tab === 'desk') renderPro(true);
      } catch (err) {}
    });
    nav.__proTabsBound = true;
  }

  function dataStatus() {
    var cfg = global.CFG || {};
    var provEl = document.getElementById('set-prov');
    var prov = cfg.prov || cfg.provider || (provEl && provEl.value) || 'demo';
    var hasTwelve = !!(cfg.twelveKey || cfg.tdKey || cfg.apiKey);
    try { if (!hasTwelve && localStorage.getItem('btx_twelve_key')) hasTwelve = true; } catch (e) {}
    if (prov === 'twelve' && hasTwelve) return { mode: 'live', label: 'LIVE · Twelve Data', cls: 'live', tip: 'Klucz Twelve ustawiony.' };
    if (prov === 'alpaca' && cfg.alpKey && cfg.alpSec) return { mode: 'live', label: 'LIVE · Alpaca', cls: 'live', tip: 'Alpaca OK.' };
    if (hasTwelve) return { mode: 'cfg', label: 'KLUCZ · sprawdź dostawcę', cls: 'cfg', tip: 'Wybierz Twelve w Ustawieniach.' };
    return { mode: 'demo', label: 'DEMO · dane syntetyczne', cls: 'demo', tip: 'Ustaw klucz Twelve w Ustawieniach.' };
  }

  function dayRegime() {
    var ST = global.ST;
    if (!ST || !ST.series || !ST.series.SPY || ST.series.SPY.length < 40)
      return { label: 'nieznany', tip: 'Brak SPY — uruchom cykl.', score: 0 };
    var b = ST.series.SPY, cl = b.map(function (x) { return x.c; }), n = cl.length, c = cl[n - 1];
    var sma20 = 0, sma50 = 0, k;
    for (k = n - 20; k < n; k++) sma20 += cl[k]; sma20 /= 20;
    for (k = Math.max(0, n - 50); k < n; k++) sma50 += cl[k]; sma50 /= Math.min(50, n);
    if (c > sma20 && sma20 >= sma50 * 0.998) return { label: 'TREND ↑', tip: 'SPY powyżej średnich.', score: 1 };
    if (c < sma20 && sma20 <= sma50 * 1.002) return { label: 'TREND ↓', tip: 'SPY poniżej średnich.', score: -2 };
    return { label: 'MIXED', tip: 'Filtruj mocniej (siła 5).', score: 0 };
  }

  function newsToday() {
    var windows = (global.BTX_PRO && global.BTX_PRO.newsWindows) || [
      { label: 'US data 12:30 UTC', min: 12 * 60 + 30 },
      { label: 'US data 13:30 UTC', min: 13 * 60 + 30 },
      { label: 'US data 14:00 UTC', min: 14 * 60 },
      { label: 'FOMC/Fed 18:00 UTC', min: 18 * 60 },
      { label: 'FOMC/Fed 19:00 UTC', min: 19 * 60 },
      { label: 'EU/ECB 12:00 UTC', min: 12 * 60 },
      { label: 'EU/ECB 12:45 UTC', min: 12 * 60 + 45 }
    ];
    var pad = (global.BTX_PRO && global.BTX_PRO.newsPadMin) || 30;
    var now = new Date();
    var day = now.getUTCDay();
    var tmin = now.getUTCHours() * 60 + now.getUTCMinutes();
    var isWeekend = (day === 0 || day === 6);
    var days = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
    var utcStr = now.toISOString().slice(11, 16) + ' UTC';
    var plStr = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    if (isWeekend) {
      return {
        weekend: true, dayName: days[day], utcStr: utcStr, plStr: plStr,
        headline: 'Weekend — brak sesji akcji US',
        detail: 'Sobota/niedziela: stock/ETF nie handlujemy. Szablon makro dotyczy dni roboczych (pon–pt), nie weekendu.',
        items: []
      };
    }
    var items = windows.map(function (w) {
      var dist = w.min - tmin;
      return { label: w.label, min: w.min, dist: dist, active: Math.abs(dist) <= pad, past: dist < -pad };
    }).sort(function (a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.past !== b.past) return a.past ? 1 : -1;
      return Math.abs(a.dist) - Math.abs(b.dist);
    });
    var nAct = items.filter(function (x) { return x.active; })[0];
    return {
      weekend: false, dayName: days[day], utcStr: utcStr, plStr: plStr,
      headline: nAct ? ('⚠ Blackout: ' + nAct.label) : 'OK — poza oknem newsów',
      detail: 'Czas: ' + plStr + ' · ' + utcStr + ' · blackout ±' + pad + ' min (szablon, nie pełny kalendarz).',
      items: items
    };
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
    var items = [], regime = dayRegime();
    var _nw = newsToday();
    var newsActive = !_nw.weekend && (_nw.items || []).some(function (x) { return x.active; });
    var ds = dataStatus(), str = g.strength || 0, side = g.side;
    items.push({ ok: side === 'LONG' || side === 'SHORT', text: 'Jest kierunek (LONG/SHORT)' });
    items.push({ ok: str >= 4, text: 'Siła ≥ 4 (teraz ' + str + '/5)' });
    items.push({ ok: !newsActive, text: _nw.weekend ? 'Weekend — brak sesji akcji US' : (newsActive ? 'News blackout — nie wchodź' : 'Poza oknem newsów') });
    items.push({ ok: regime.score !== -1 || str >= 5, text: 'Reżim: ' + regime.label });
    items.push({ ok: ds.mode !== 'demo', text: ds.mode === 'demo' ? 'Dane DEMO' : ds.label });
    items.push({ ok: true, text: 'Plan SL/TP/size przed XTB' });
    var pass = items.filter(function (x) { return x.ok; }).length;
    return { items: items, pass: pass, total: items.length, ready: pass >= items.length - 1 && str >= 4 && !newsActive && !_nw.weekend };
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
    return { riskPct: riskPct, riskCash: riskCash, qty: qty, entry: price,
      sl: g.side === 'SHORT' ? price + sd : price - sd,
      tp: g.side === 'SHORT' ? price - tpR * sd : price + tpR * sd,
      partial: g.side === 'SHORT' ? price - partialR * sd : price + partialR * sd,
      tpR: tpR, partialR: partialR };
  }

  function fmt(x) { if (x == null || !isFinite(x)) return '—'; return global.f2 ? global.f2(x) : Number(x).toFixed(2); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function ensureRootDesk() {
    var el = document.getElementById('pro-desk-root');
    if (el && el.parentNode) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'pro-desk-root'; el.className = 'pro-wrap';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild); else pane.appendChild(el);
    return el;
  }

  function bestSetups() {
    var sig = (global.ST && global.ST.sig) || [];
    return sig.filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
  }

  function renderPro(force) {
    try {
      injectCss(); bindTabs();
      var root = document.getElementById('pro-desk-root') || ensureRootDesk();
      if (!root) return;
      var desk = document.getElementById('pane-desk');
      if (desk && desk.className.indexOf('on') < 0 && !force) return;

      var ds = dataStatus(), regime = dayRegime(), newsPack = newsToday(), st = computeStats();
      var best = bestSetups()[0];
      var alertsOn = localStorage.getItem(AK) !== '0';

      var html = '<div class="pro-row">';
      html += '<div class="pro-card"><h3>1 · Status danych</h3><div><span class="data-pill ' + ds.cls + '">' + ds.label + '</span></div><div class="sub">' + ds.tip + '</div></div>';
      html += '<div class="pro-card"><h3>9 · Reżim dnia (SPY)</h3><div class="big" style="font-size:16px">' + regime.label + '</div><div class="sub">' + regime.tip + '</div></div>';
      html += '<div class="pro-card"><h3>6 · Spójność reguł</h3><div class="big" style="font-size:15px">PRO desk</div><div class="sub">0.5% risk · max 2 pos · SL 2×ATR · TP 2.5R · min siła 4</div></div>';
      html += '<div class="pro-card"><h3>7 · News / czas</h3><div class="big" style="font-size:14px">' + (newsPack.headline || 'OK') + '</div><div class="sub">';
      html += (newsPack.detail || '') + '<br>';
      if (newsPack.weekend) {
        html += '<b>Dziś: ' + (newsPack.dayName || 'weekend') + '</b> · ' + (newsPack.plStr || '') + ' · ' + (newsPack.utcStr || '');
      } else {
        (newsPack.items || []).slice(0, 4).forEach(function (w) {
          var when = w.active ? 'TERAZ (±blackout)' : (w.dist >= 0 ? ('za ' + w.dist + ' min') : (Math.abs(w.dist) + ' min temu'));
          html += (w.active ? '<b style="color:#f87171">' : '') + w.label + ' (' + when + ')' + (w.active ? '</b>' : '') + '<br>';
        });
      }
      html += '</div></div></div>';

      html += '<div class="pro-row">';
      html += '<div class="pro-card"><h3>4 · Win rate</h3><div class="big">' + (st.n ? Math.round(st.wr * 100) + '%' : '—') + '</div><div class="sub">' + st.wins + 'W / ' + st.losses + 'L</div></div>';
      html += '<div class="pro-card"><h3>4 · Avg R</h3><div class="big">' + (st.avgR != null ? ((st.avgR >= 0 ? '+' : '') + st.avgR.toFixed(2) + 'R') : '—') + '</div></div>';
      html += '<div class="pro-card"><h3>4 · Śr. P&L</h3><div class="big">' + fmt(st.avgPnl) + '</div></div>';
      html += '<div class="pro-card"><h3>4 · Max DD</h3><div class="big">' + fmt(st.maxDD) + '</div></div></div>';

      html += '<div class="pro-row" style="grid-template-columns:1fr 1fr">';
      html += '<div class="pro-card"><h3>2 · Checklist' + (best ? ' · ' + best.sym + ' ' + best.side : '') + '</h3>';
      if (!best) html += '<div class="pro-mini">Brak LONG/SHORT. Uruchom cykl.</div>';
      else {
        var ck = checklistFor(best);
        html += '<ul class="pro-check">';
        ck.items.forEach(function (it) {
          html += '<li><span class="box ' + (it.ok ? 'ok' : 'no') + '">' + (it.ok ? '✓' : '!') + '</span><span>' + esc(it.text) + '</span></li>';
        });
        html += '</ul>';
      }
      html += '</div><div class="pro-card"><h3>8 · Plan XTB</h3>';
      if (!best) html += '<div class="pro-mini">Przy sile 4–5: size, SL, TP.</div>';
      else {
        var p = xtbPlan(best);
        html += '<div class="pro-plan">' + best.side + ' <b>' + esc(best.sym) + '</b> @ <b>' + fmt(p.entry) + '</b><br>';
        html += 'Qty <b>' + p.qty + '</b> · risk <b>' + p.riskPct + '%</b><br>SL <b>' + fmt(p.sl) + '</b><br>TP <b>' + fmt(p.tp) + '</b></div>';
      }
      html += '</div></div>';

      html += '<div class="pro-card"><h3>5 · Alerty</h3><div class="pro-mini">Alerty: ' + (alertsOn ? 'ON' : 'OFF') + ' · siła ≥ 4</div>';
      html += '<button type="button" class="btn ghost tiny" id="pro-toggle-alert">' + (alertsOn ? 'Wyłącz alerty' : 'Włącz alerty') + '</button></div>';

      if (force || html !== lastHtml) {
        root.innerHTML = html;
        lastHtml = html;
        var tb = document.getElementById('pro-toggle-alert');
        if (tb) tb.onclick = function () {
          localStorage.setItem(AK, alertsOn ? '0' : '1');
          lastHtml = '';
          renderPro(true);
        };
      }
    } catch (e) { try { console.warn('pro-desk', e); } catch (e2) {} }
  }

  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__proDesk) return;
    var orig = global.render;
    global.render = function () {
      var r = orig.apply(this, arguments);
      try { renderPro(false); } catch (e) {}
      return r;
    };
    global.render.__proDesk = true;
  }

  function boot() {
    try {
      injectCss(); bindTabs(); ensureRootDesk(); patchRender(); renderPro(true);
    } catch (e) {}
    setInterval(function () {
      try { bindTabs(); patchRender(); renderPro(false); } catch (e) {}
    }, 3000);
  }

  global.BTX_PRO_DESK = { render: renderPro, newsToday: newsToday };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
