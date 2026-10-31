/**
 * BTX Pro Desk FULL + AI Journal
 * Loads from same logic as local build - see commit message
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
    s.textContent = '.pro-wrap{display:grid;gap:12px;margin:12px 0 14px;box-sizing:border-box}.pro-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.pro-card{background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--line);border-radius:14px;padding:12px 14px}.pro-card h3{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx3);margin-bottom:8px;font-weight:700}.pro-card .big{font-family:"JetBrains Mono",monospace;font-size:20px;font-weight:700}.pro-card .sub{font-size:11px;color:var(--tx3);margin-top:4px;line-height:1.4}.pro-check{list-style:none;padding:0;margin:0}.pro-check li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);line-height:1.4}.pro-check .box{width:16px;height:16px;border-radius:4px;border:1px solid var(--line2);flex:0 0 16px;margin-top:1px;text-align:center;font-size:11px;line-height:15px}.pro-check .box.ok{background:rgba(18,196,139,.2);border-color:var(--green);color:var(--green)}.pro-check .box.no{background:rgba(240,68,82,.15);border-color:#f87171;color:#f87171}.pro-plan{font-family:"JetBrains Mono",monospace;font-size:12px;line-height:1.7}.pro-plan b{color:#fff;font-weight:600}.data-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:10px;font-weight:700}.data-pill.demo{background:rgba(245,179,1,.12);color:var(--gold)}.data-pill.live{background:rgba(18,196,139,.14);color:var(--green)}.data-pill.cfg{background:rgba(59,130,246,.14);color:#93c5fd}.pro-alert-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.pro-mini{font-size:11px;color:var(--tx2);line-height:1.45}.jr-note{width:100%;background:var(--bg4);border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px;margin-top:4px;line-height:1.5}.jr-ai{font-size:12.5px;line-height:1.55;color:var(--tx);background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:10px 12px;margin-top:8px}.jr-ai b{color:#93c5fd}.tag{display:inline-block;padding:2px 7px;border-radius:99px;background:var(--bg4);border:1px solid var(--line);font-size:10px;margin:2px 3px 2px 0;color:var(--tx2);cursor:pointer}.tag.on{border-color:var(--red);color:#fff;background:rgba(228,0,43,.2)}.btn.tiny{padding:5px 10px;font-size:11px;border-radius:8px}#pro-desk-root{position:relative;z-index:1}aside,.nav{position:relative;z-index:20}';
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
    var hasTwelve = !!(cfg.twelveKey || cfg.apiKey);
    var hasAlp = !!(cfg.alpKey && cfg.alpSec);
    var hasFinn = !!(cfg.finnhubKey);
    if (prov === 'twelve' && hasTwelve) return { mode: 'live', label: 'LIVE \u00b7 Twelve Data', cls: 'live', tip: 'Klucz Twelve ustawiony \u2014 \u015bwiece z API.' };
    if (prov === 'alpaca' && hasAlp) return { mode: 'live', label: 'LIVE \u00b7 Alpaca IEX', cls: 'live', tip: 'Alpaca keys OK \u2014 dane US IEX.' };
    if (prov === 'finnhub' && hasFinn) return { mode: 'live', label: 'LIVE \u00b7 Finnhub', cls: 'live', tip: 'Finnhub OK.' };
    if (prov === 'stooq') return { mode: 'cfg', label: 'STOOQ \u00b7 EOD', cls: 'cfg', tip: 'EOD / op\u00f3\u017anione \u2014 s\u0142abe pod daytrading.' };
    if (hasTwelve || hasAlp || hasFinn) return { mode: 'cfg', label: 'KLUCZ \u00b7 sprawd\u017a dostawc\u0119', cls: 'cfg', tip: 'Masz klucz \u2014 wybierz dostawc\u0119 w Ustawieniach.' };
    return { mode: 'demo', label: 'DEMO \u00b7 dane syntetyczne', cls: 'demo', tip: 'Ustaw Twelve lub Alpaca w Ustawieniach, \u017ceby przej\u015b\u0107 na LIVE.' };
  }

  function dayRegime() {
    var ST = global.ST;
    if (!ST || !ST.series || !ST.series.SPY || ST.series.SPY.length < 40)
      return { label: 'nieznany', tip: 'Brak SPY \u2014 uruchom cykl, \u017ceby oceni\u0107 re\u017cim dnia.', score: 0 };
    var b = ST.series.SPY, cl = b.map(function (x) { return x.c; }), n = cl.length, c = cl[n - 1];
    var sma20 = 0, sma50 = 0, k;
    for (k = n - 20; k < n; k++) sma20 += cl[k]; sma20 /= 20;
    for (k = Math.max(0, n - 50); k < n; k++) sma50 += cl[k]; sma50 /= Math.min(50, n);
    var range40 = Math.max.apply(null, b.slice(-40).map(function (x) { return x.h; })) - Math.min.apply(null, b.slice(-40).map(function (x) { return x.l; }));
    if (range40 / c > 0.025 && Math.abs(c - sma20) / c < 0.003)
      return { label: 'RANGE / chop', tip: 'SPY w konsolidacji \u2014 wi\u0119cej fa\u0142szywych wybi\u0107, wymagaj si\u0142y 5/5.', score: -1 };
    if (c > sma20 && sma20 >= sma50 * 0.998)
      return { label: 'TREND \u2191', tip: 'SPY powy\u017cej \u015brednich \u2014 longi na US maj\u0105 lepszy kontekst.', score: 1 };
    if (c < sma20 && sma20 <= sma50 * 1.002)
      return { label: 'TREND \u2193', tip: 'SPY poni\u017cej \u015brednich \u2014 ostro\u017cnie z longami.', score: -2 };
    return { label: 'MIXED', tip: 'Brak czystego re\u017cimu \u2014 filtruj mocniej (si\u0142a 5, AI OK).', score: 0 };
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
    items.push({ ok: side === 'LONG' || side === 'SHORT', text: 'Jest kierunek (LONG/SHORT), nie WAIT' });
    items.push({ ok: str >= 4, text: 'Si\u0142a sygna\u0142u \u2265 4 (teraz ' + str + '/5)' });
    items.push({ ok: !newsActive, text: newsActive ? 'News blackout aktywny \u2014 nie wchod\u017a' : 'Poza oknem news\u00f3w (\u00b130 min UTC)' });
    items.push({ ok: regime.score !== -1 || str >= 5, text: 'Re\u017cim dnia OK (teraz: ' + regime.label + ')' });
    if (side === 'LONG') items.push({ ok: String(g.trend || '').indexOf('UP') >= 0 || /up/i.test(String(g.why || '')), text: 'Zgodno\u015b\u0107 z trendem wzrostowym' });
    if (side === 'SHORT') items.push({ ok: String(g.trend || '').indexOf('DN') >= 0 || /down/i.test(String(g.why || '')), text: 'Zgodno\u015b\u0107 z trendem spadkowym' });
    items.push({ ok: !g.ai || g.ai.ok !== false || (g.ai.conf || 0) >= 0.55, text: g.ai ? ('AI: ' + (g.ai.ok ? 'potwierdza' : 's\u0142abo') + (g.ai.conf != null ? ' (' + Math.round(g.ai.conf * 100) + '%)' : '')) : 'AI: ocena z regu\u0142 PRO' });
    items.push({ ok: ds.mode !== 'demo', text: ds.mode === 'demo' ? 'Uwaga: dane DEMO \u2014 tylko nauka' : ('\u0179r\u00f3d\u0142o: ' + ds.label) });
    items.push({ ok: true, text: 'Mam plan SL / TP / size zanim klikn\u0119 na XTB' });
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
    return { riskPct: riskPct, riskCash: riskCash, qty: qty, entry: price,
      sl: g.side === 'SHORT' ? price + sd : price - sd,
      tp: g.side === 'SHORT' ? price - tpR * sd : price + tpR * sd,
      partial: g.side === 'SHORT' ? price - partialR * sd : price + partialR * sd,
      tpR: tpR, partialR: partialR };
  }

  function fmt(x) { if (x == null || !isFinite(x)) return '\u2014'; return global.f2 ? global.f2(x) : Number(x).toFixed(2); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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
    lastAlertKey = key; beep();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('BTX okazja ' + best.side, { body: best.sym + ' si\u0142a ' + best.strength + '/5' });
    } catch (e) {}
  }

  function journalId(t) { return [t.sym, t.side, t.entry, t.exit, t.pnl, t.bars].join('|'); }

  function autoTags(t) {
    var w = String((t && (t.setup || t.why)) || '').toLowerCase(), tags = [];
    if (/pullback|pb|rsi\(2\)/.test(w)) tags.push('pullback');
    if (/orb/.test(w)) tags.push('ORB');
    if (/vwap/.test(w)) tags.push('VWAP');
    if (/htf|trend/.test(w)) tags.push('trend');
    if (/news|blackout/.test(w)) tags.push('news-skip');
    if ((t.pnl || 0) > 0) tags.push('ok'); else if ((t.pnl || 0) < 0) tags.push('b\u0142\u0105d');
    return tags;
  }

  function buildAiJournal(t) {
    if (!t) return '';
    var side = t.side || '?', sym = t.sym || '?';
    var why = String(t.setup || t.why || 'brak opisu regu\u0142');
    var pnl = t.pnl || 0, win = pnl > 0, r = tradeR(t);
    var rTxt = r != null ? ((r >= 0 ? '+' : '') + r.toFixed(2) + 'R') : 'R niepoliczalne (brak SL w historii)';
    var bars = t.bars != null ? t.bars : '?';
    var regime = dayRegime(), ds = dataStatus();
    var s1 = win
      ? ('Trade ' + side + ' na ' + sym + ' zako\u0144czy\u0142 si\u0119 na plusie (' + fmt(pnl) + ', ' + rTxt + ').')
      : ('Trade ' + side + ' na ' + sym + ' zako\u0144czy\u0142 si\u0119 na minusie (' + fmt(pnl) + ', ' + rTxt + ').');
    var s2 = 'Wej\u015bcie wynika\u0142o z regu\u0142 PRO: ' + why + '.';
    if (/pullback|pb/i.test(why)) s2 += ' To klasyczny pullback \u2014 do\u0142\u0105czanie do trendu po cofni\u0119ciu, a nie gonienie ceny.';
    else if (/orb/i.test(why)) s2 += ' Setup ORB opiera si\u0119 na zakresie otwarcia i rete\u015bcie poziomu.';
    else if (/vwap/i.test(why)) s2 += ' VWAP pokazywa\u0142 stron\u0119 z przewag\u0105 wolumenu intraday.';
    var s3 = 'Pozycja \u017cy\u0142a ok. ' + bars + ' \u015bwiec. ';
    if (win) s3 += 'Co zadzia\u0142a\u0142o: zgodno\u015b\u0107 kierunku z kontekstem i trzymanie planu SL/TP. Warto powtarza\u0107 ten typ setupu przy podobnym re\u017cimie (' + regime.label + ').';
    else s3 += 'Co posz\u0142o nie tak (do nauki): albo kontekst si\u0119 zmieni\u0142, albo wej\u015bcie by\u0142o zbyt agresywne. Sprawd\u017a si\u0142\u0119 \u22654, okno news\u00f3w i re\u017cim dnia (' + regime.label + ').';
    var s4 = 'Lekcja na XTB: zanim klikniesz, odhacz checklist\u0119 (si\u0142a, news, trend, AI) i ustaw z g\u00f3ry SL oraz partial TP. ';
    s4 += ds.mode === 'demo'
      ? 'Uwaga: paper na danych DEMO \u2014 ucz si\u0119 procesu, nie traktuj wyniku jako dowodu edge na live.'
      : 'Dane by\u0142y oznaczone jako ' + ds.label + ' \u2014 i tak weryfikuj cen\u0119 na XTB przed wej\u015bciem.';
    return s1 + ' ' + s2 + ' ' + s3 + ' ' + s4;
  }

  function autoFillJournal(t) {
    if (!t) return;
    var id = journalId(t);
    if (id === lastAutoJr) return;
    var j = loadJournal();
    var rec = j[id] || { tags: [], note: '', ai: '' };
    autoTags(t).forEach(function (tg) { if (rec.tags.indexOf(tg) < 0) rec.tags.push(tg); });
    rec.ai = buildAiJournal(t);
    if (!rec.note || !String(rec.note).trim() || rec.note === rec.aiPrev) {
      rec.note = rec.ai; rec.aiPrev = rec.ai;
    } else { rec.aiPrev = rec.ai; }
    j[id] = rec; saveJournal(j); lastAutoJr = id;
  }

  function renderJournalBox() {
    var box = document.getElementById('pro-journal-box');
    if (!box) return;
    var closed = (global.ST && global.ST.closed) || [];
    if (!closed.length) {
      box.innerHTML = '<span class="pro-mini">Brak zamkni\u0119tych paper trades \u2014 po zamkni\u0119ciu AI samo opisze trade kilkoma zdaniami.</span>';
      return;
    }
    var t = closed[0];
    autoFillJournal(t);
    var j = loadJournal(), id = journalId(t), rec = j[id] || { tags: [], note: '', ai: '' };
    if (!rec.ai) rec.ai = buildAiJournal(t);
    var tags = ['pullback', 'ORB', 'VWAP', 'trend', 'news-skip', 'FOMO', 'ok', 'b\u0142\u0105d'];
    var h = '<div class="pro-mini">Ostatni: <b>' + esc(t.sym) + ' ' + esc(t.side) + '</b> \u00b7 P&L ' + fmt(t.pnl);
    var r = tradeR(t);
    if (r != null) h += ' \u00b7 <b>' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R</b>';
    h += '</div>';
    h += '<div class="jr-ai"><b>AI Journal</b><br>' + esc(rec.ai) + '</div>';
    h += '<div style="margin-top:8px">';
    tags.forEach(function (tg) {
      h += '<span class="tag' + (rec.tags && rec.tags.indexOf(tg) >= 0 ? ' on' : '') + '" data-tag="' + tg + '">' + tg + '</span>';
    });
    h += '</div>';
    h += '<textarea class="jr-note" id="pro-jr-note" rows="5" placeholder="Twoja notatka (AI wype\u0142nia automatycznie)\u2026">' + esc(rec.note || rec.ai || '') + '</textarea>';
    h += '<div style="margin-top:6px"><button type="button" class="btn ghost tiny" id="pro-jr-save">Zapisz journal</button> ';
    h += '<button type="button" class="btn ghost tiny" id="pro-jr-regen">Przebuduj opis AI</button></div>';
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
    var regen = document.getElementById('pro-jr-regen');
    if (regen) regen.onclick = function (ev) {
      if (ev) ev.preventDefault();
      rec.ai = buildAiJournal(t); rec.note = rec.ai; rec.aiPrev = rec.ai;
      j[id] = rec; saveJournal(j); lastHtml = ''; renderJournalBox();
    };
  }

  function bindAlertButtons() {
    var t = document.getElementById('pro-toggle-alert');
    if (t) t.onclick = function (ev) {
      if (ev) ev.preventDefault();
      var on = localStorage.getItem(AK) !== '0';
      localStorage.setItem(AK, on ? '0' : '1');
      if (!on && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
      lastHtml = ''; renderPro(true);
    };
    var b = document.getElementById('pro-test-alert');
    if (b) b.onclick = function (ev) { if (ev) ev.preventDefault(); beep(); };
  }

  function renderPro(force) {
    try {
      injectCss(); bindTabs();
      var root = document.getElementById('pro-desk-root') || ensureRootDesk();
      if (!root) return;
      var desk = document.getElementById('pane-desk');
      if (desk && desk.className.indexOf('on') < 0 && !force) {
        var closed0 = (global.ST && global.ST.closed) || [];
        if (closed0[0]) autoFillJournal(closed0[0]);
        return;
      }
      var ds = dataStatus(), regime = dayRegime(), news = newsToday(), st = computeStats();
      var best = bestSetups()[0];
      var alertsOn = localStorage.getItem(AK) !== '0';
      var nAct = news.filter(function (x) { return x.active; })[0];
      var html = '<div class="pro-row">';
      html += '<div class="pro-card"><h3>1 \u00b7 Status danych</h3><div><span class="data-pill ' + ds.cls + '">' + ds.label + '</span></div><div class="sub">' + ds.tip + '</div></div>';
      html += '<div class="pro-card"><h3>9 \u00b7 Re\u017cim dnia (SPY)</h3><div class="big" style="font-size:16px">' + regime.label + '</div><div class="sub">' + regime.tip + '</div></div>';
      html += '<div class="pro-card"><h3>6 \u00b7 Sp\u00f3jno\u015b\u0107 regu\u0142</h3><div class="big" style="font-size:15px">PRO desk</div><div class="sub">\u0179r\u00f3d\u0142o: <b>strategy-pro.js</b> \u00b7 0.5% risk \u00b7 max 2 pos \u00b7 SL 2\u00d7ATR \u00b7 TP 2.5R \u00b7 partial 1.5R \u00b7 BE 1R \u00b7 min si\u0142a 4</div></div>';
      html += '<div class="pro-card"><h3>7 \u00b7 News (UTC)</h3><div class="big" style="font-size:14px">' + (nAct ? '\u26a0 ' + nAct.label : 'OK') + '</div><div class="sub">';
      news.slice(0, 4).forEach(function (w) {
        var when = w.dist >= 0 ? ('za ' + w.dist + ' min') : (Math.abs(w.dist) + ' min temu');
        html += (w.active ? '<b style="color:#f87171">' : '') + w.label + ' (' + when + ')' + (w.active ? '</b>' : '') + '<br>';
      });
      html += '</div></div></div><div class="pro-row">';
      html += '<div class="pro-card"><h3>4 \u00b7 Win rate</h3><div class="big">' + (st.n ? Math.round(st.wr * 100) + '%' : '\u2014') + '</div><div class="sub">' + st.wins + 'W / ' + st.losses + 'L \u00b7 n=' + st.n + '</div></div>';
      html += '<div class="pro-card"><h3>4 \u00b7 Avg R / expectancy</h3><div class="big">' + (st.avgR != null ? ((st.avgR >= 0 ? '+' : '') + st.avgR.toFixed(2) + 'R') : '\u2014') + '</div><div class="sub">' + (st.nR ? ('z ' + st.nR + ' trade\'s z SL') : 'R gdy znamy SL') + '</div></div>';
      html += '<div class="pro-card"><h3>4 \u00b7 \u015ar. P&L / trade</h3><div class="big" style="color:' + (st.avgPnl >= 0 ? 'var(--green)' : '#f87171') + '">' + fmt(st.avgPnl) + '</div><div class="sub">Suma: ' + fmt(st.sumPnl) + '</div></div>';
      html += '<div class="pro-card"><h3>4 \u00b7 Max drawdown</h3><div class="big">' + fmt(st.maxDD) + '</div><div class="sub">Z equity / historii paper</div></div></div>';
      html += '<div class="pro-row" style="grid-template-columns:1fr 1fr">';
      html += '<div class="pro-card"><h3>2 \u00b7 Checklist wej\u015bcia' + (best ? ' \u00b7 ' + best.sym + ' ' + best.side : '') + '</h3>';
      if (!best) html += '<div class="pro-mini">Brak LONG/SHORT. Uruchom cykl. Czekanie = pro.</div>';
      else {
        var ck = checklistFor(best);
        html += '<ul class="pro-check">';
        ck.items.forEach(function (it) {
          html += '<li><span class="box ' + (it.ok ? 'ok' : 'no') + '">' + (it.ok ? '\u2713' : '!') + '</span><span>' + esc(it.text) + '</span></li>';
        });
        html += '</ul><div class="sub" style="margin-top:8px">' + (ck.ready ? '<b style="color:var(--green)">CHECKLIST OK</b> \u2014 rozwa\u017c XTB.' : '<b style="color:#f87171">Nie gotowe</b> \u2014 popraw "!".') + '</div>';
      }
      html += '</div><div class="pro-card"><h3>8 \u00b7 Plan na XTB (r\u0119cznie)</h3>';
      if (!best) html += '<div class="pro-mini">Przy sile 4\u20135: size, SL, partial TP, TP.</div>';
      else {
        var p = xtbPlan(best);
        html += '<div class="pro-plan">' + best.side + ' <b>' + esc(best.sym) + '</b> @ <b>' + fmt(p.entry) + '</b><br>';
        html += 'Qty: <b>' + p.qty + '</b> \u00b7 ryzyko <b>' + p.riskPct + '%</b> \u2248 ' + fmt(p.riskCash) + '<br>';
        html += 'SL: <b>' + fmt(p.sl) + '</b> (~2\u00d7ATR)<br>Partial TP: <b>' + fmt(p.partial) + '</b> (+' + p.partialR + 'R, ~50%)<br>';
        html += 'TP: <b>' + fmt(p.tp) + '</b> (+' + p.tpR + 'R)<br>BE: SL\u2192entry po <b>+1R</b></div>';
        html += '<div class="sub">Bot nie sk\u0142ada zlece\u0144 u brokera.</div>';
      }
      html += '</div></div>';
      html += '<div class="pro-card"><h3>5 \u00b7 Alerty \u00b7 3 \u00b7 Journal 2.0 (AI)</h3><div class="pro-alert-bar">';
      html += '<button type="button" class="btn ghost tiny" id="pro-toggle-alert">' + (alertsOn ? '\ud83d\udd14 Alerty ON' : '\ud83d\udd15 Alerty OFF') + '</button> ';
      html += '<button type="button" class="btn ghost tiny" id="pro-test-alert">Test d\u017awi\u0119ku</button>';
      html += '<span class="pro-mini">Alert przy nowym sygnale si\u0142y \u2265 4.</span></div>';
      html += '<div class="pro-mini" style="margin-top:10px"><b>Journal AI</b> sam opisuje zamkni\u0119ty trade kilkoma zdaniami. Mo\u017cesz edytowa\u0107 i doda\u0107 tagi.</div>';
      html += '<div id="pro-journal-box" style="margin-top:8px"></div></div>';
      html += '<div class="pro-card"><h3>10 \u00b7 Backtest & real</h3><div class="pro-mini">Regu\u0142y = <b>strategy-pro.js</b>. Backtest demo \u2260 live. Cel: ma\u0142o trade\'s, dodatni avg R, niski max DD, checklista przed XTB.</div></div>';

      if (force || html !== lastHtml) {
        root.innerHTML = html; lastHtml = html;
        renderJournalBox(); bindAlertButtons();
      } else { renderJournalBox(); }
    } catch (e) { try { console.warn('pro-desk', e); } catch (e2) {} }
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__proDesk) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      orig(g);
      try {
        var p = global.ST && global.ST.pos && global.ST.pos[g.sym];
        if (p) {
          if (p.risk0 == null && p.entry != null && p.stop != null) p.risk0 = Math.abs(p.entry - p.stop);
          p.setup = (g.why || '').slice(0, 120);
        }
      } catch (e) {}
    };
    global.openPos.__proDesk = true;
  }
  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__proDesk) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var p = global.ST && global.ST.pos && global.ST.pos[sym];
      var risk0 = p && p.risk0, setup = p && p.setup;
      orig(sym, why, px);
      try {
        var c = global.ST && global.ST.closed && global.ST.closed[0];
        if (c && c.sym === sym) {
          if (risk0 != null) c.risk0 = risk0;
          if (setup) c.setup = setup;
          if (!c.why && why) c.why = why;
          autoFillJournal(c); lastHtml = '';
        }
      } catch (e) {}
    };
    global.closePos.__proDesk = true;
  }
  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__proDesk) return;
    var orig = global.render;
    global.render = function () {
      var r = orig.apply(this, arguments);
      try { renderPro(false); maybeAlert(); } catch (e) {}
      return r;
    };
    global.render.__proDesk = true;
  }

  function boot() {
    try {
      injectCss(); bindTabs(); ensureRootDesk();
      patchOpen(); patchClose(); patchRender(); renderPro(true);
    } catch (e) { try { console.warn('pro-desk boot', e); } catch (e2) {} }
    setInterval(function () {
      try { bindTabs(); patchOpen(); patchClose(); patchRender(); renderPro(false); maybeAlert(); } catch (e) {}
    }, 3000);
  }

  global.BTX_PRO_DESK = { render: renderPro, bindTabs: bindTabs, checklistFor: checklistFor, xtbPlan: xtbPlan, stats: computeStats, dataStatus: dataStatus, dayRegime: dayRegime, buildAiJournal: buildAiJournal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
