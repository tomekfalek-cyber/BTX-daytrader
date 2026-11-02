/**
 * BTX Pro Edge — 8 punktów pro daytradera
 * 1 Indeks + relative strength
 * 2 Fazy sesji (open / mid / power)
 * 3 Lokalizacja wejścia (anti-chase, VA/HTF)
 * 4 Zarządzanie po stratach (size down, time-stop)
 * 5 Checklista XTB (zielony plan tylko po 5×TAK)
 * 6 Blacklist dnia
 * 7 Stale data → BLOKADA
 * 8 XTB trade z SL/TP gdy xAPI ONLINE
 */
(function (global) {
  var STYLE = 'btx-pro-edge-css';
  var LS_BL = 'BTX_BLACKLIST_DAY';
  var LS_SIZE = 'BTX_SIZE_MULT';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-edge{margin:12px 0;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(167,139,250,.4);background:rgba(124,58,237,.08)}',
      '#btx-edge h3{margin:0 0 6px;font-size:14px;color:#ede9fe}',
      '#btx-edge .why{font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 10px}',
      '#btx-edge table{width:100%;border-collapse:collapse;font-size:12px}',
      '#btx-edge td,#btx-edge th{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}',
      '#btx-edge .ok{color:#12c48b;font-weight:700}',
      '#btx-edge .bad{color:#f87171;font-weight:700}',
      '#btx-edge .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
      '#btx-edge input[type=text]{min-width:180px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg4,#202733);color:#fff}'
    ].join('');
    document.head.appendChild(s);
  }

  function closes(sym, n) {
    var b = global.ST && global.ST.series && global.ST.series[sym];
    if (!b || !b.length) return [];
    var c = b.map(function (x) { return x.c; });
    return n ? c.slice(-n) : c;
  }
  function lastC(sym) {
    var c = closes(sym);
    return c.length ? c[c.length - 1] : null;
  }
  function ret(sym, bars) {
    var c = closes(sym, bars + 1);
    if (c.length < bars + 1) return null;
    var a = c[0], b = c[c.length - 1];
    if (!a) return null;
    return (b - a) / a;
  }

  /** 1. Indeks + relative strength */
  function indexContext(side) {
    var spy = ret('SPY', 10);
    var qqq = ret('QQQ', 10);
    var bench = qqq != null ? qqq : spy;
    var label = 'brak SPY/QQQ';
    var bias = 0;
    if (bench != null) {
      if (bench > 0.002) { bias = 1; label = 'indeks ↑ (~' + (bench * 100).toFixed(2) + '%)'; }
      else if (bench < -0.002) { bias = -1; label = 'indeks ↓ (~' + (bench * 100).toFixed(2) + '%)'; }
      else { bias = 0; label = 'indeks płaski'; }
    }
    var allowLong = bias >= 0; // dump indeksu → ostrożnie z long
    var allowShort = bias <= 0;
    if (side === 'LONG' && bias < 0) return { ok: false, bias: bias, label: label, reason: 'Indeks słaby — long akcji pod wiatr' };
    if (side === 'SHORT' && bias > 0) return { ok: false, bias: bias, label: label, reason: 'Indeks mocny — short pod wiatr' };
    return { ok: true, bias: bias, label: label, allowLong: allowLong, allowShort: allowShort };
  }

  function relativeStrength(sym, side) {
    var rSym = ret(sym, 10);
    var rIdx = ret('QQQ', 10);
    if (rIdx == null) rIdx = ret('SPY', 10);
    if (rSym == null || rIdx == null) return { ok: true, rs: null, label: 'RS: brak danych', bonus: 0 };
    var rs = rSym - rIdx;
    var label = 'RS ' + (rs >= 0 ? '+' : '') + (rs * 100).toFixed(2) + '% vs indeks';
    if (side === 'LONG' && rs < -0.003) return { ok: false, rs: rs, label: label, reason: 'Słaba siła względna vs indeks', bonus: 0 };
    if (side === 'SHORT' && rs > 0.003) return { ok: false, rs: rs, label: label, reason: 'Za silny vs indeks na short', bonus: 0 };
    var bonus = 0;
    if (side === 'LONG' && rs > 0.002) bonus = 6;
    if (side === 'SHORT' && rs < -0.002) bonus = 6;
    return { ok: true, rs: rs, label: label, bonus: bonus };
  }

  /** 2. Fazy sesji US (PL clock) */
  function sessionPhase() {
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    var parts = fmt.formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    var wd = map.weekday || '';
    var weekend = /Sat|Sun/i.test(wd);
    var usOpen = 15 * 60 + 30, usClose = 22 * 60;
    if (weekend) return { phase: 'WEEKEND', sizeMult: 0, newEntries: false, label: 'Weekend' };
    if (min < usOpen) return { phase: 'PRE', sizeMult: 0.5, newEntries: false, label: 'Pre-market US — bez nowych stock' };
    if (min < usOpen + 30) return { phase: 'OPEN', sizeMult: 0.5, newEntries: true, onlyAPlus: true, label: 'Otwarcie US (pierwsze 30 min) — tylko A+, half size' };
    if (min >= usClose - 45) return { phase: 'CLOSE', sizeMult: 0.5, newEntries: true, onlyAPlus: true, timeStopBars: 20, label: 'Końcówka sesji — ostrożnie, szybszy time-stop' };
    if (min >= 19 * 60 && min <= 20 * 60 + 30) return { phase: 'POWER', sizeMult: 1, newEntries: true, label: 'Power hour — standard PRO' };
    if (min >= usOpen && min < usClose) return { phase: 'MID', sizeMult: 1, newEntries: true, label: 'Środek sesji US — standard' };
    return { phase: 'AFTER', sizeMult: 0, newEntries: false, label: 'Po sesji US' };
  }

  /** 3. Lokalizacja — anti-chase */
  function locationQuality(sym, side) {
    var b = global.ST && global.ST.series && global.ST.series[sym];
    if (!b || b.length < 20) return { ok: true, label: 'za mało świec', penalty: 0 };
    var slice = b.slice(-20);
    var hi = -Infinity, lo = Infinity;
    slice.forEach(function (x) { if (x.h > hi) hi = x.h; if (x.l < lo) lo = x.l; });
    var c = slice[slice.length - 1].c;
    var pos = hi > lo ? (c - lo) / (hi - lo) : 0.5;
    // chase: long na samym szczycie zakresu / short na samym dole
    if (side === 'LONG' && pos > 0.92) return { ok: false, label: 'Chase long (góra zakresu)', reason: 'Pogoń za ceną LONG — czekaj pullback', penalty: 15 };
    if (side === 'SHORT' && pos < 0.08) return { ok: false, label: 'Chase short (dół zakresu)', reason: 'Pogoń SHORT — czekaj odbicie', penalty: 15 };
    var bonus = 0;
    if (side === 'LONG' && pos >= 0.25 && pos <= 0.55) bonus = 5;
    if (side === 'SHORT' && pos >= 0.45 && pos <= 0.75) bonus = 5;
    // VPVR
    try {
      if (global.BTX_VPVR && global.BTX_VPVR.getProfile) {
        var prof = global.BTX_VPVR.getProfile(sym);
        if (prof && global.BTX_VPVR.classify) {
          var cl = global.BTX_VPVR.classify(c, prof);
          if (cl && (cl.zone === 'in_va' || cl.zone === 'at_poc')) bonus += 4;
        }
      }
    } catch (e) {}
    return { ok: true, label: 'lok ' + (pos * 100).toFixed(0) + '% zakresu', bonus: bonus, penalty: 0, pos: pos };
  }

  /** 4. Size down po stratach */
  function sizeMultiplier() {
    var ST = global.ST || {};
    var consec = ST.consecLoss || 0;
    var mult = 1;
    if (consec >= 2) mult = 0.5;
    if (consec >= 3) mult = 0;
    var phase = sessionPhase();
    mult *= (phase.sizeMult != null ? phase.sizeMult : 1);
    try { localStorage.setItem(LS_SIZE, String(mult)); } catch (e) {}
    return { mult: mult, consec: consec, phase: phase.phase, label: 'size ×' + mult + (consec >= 2 ? ' (po stratach)' : '') };
  }

  function patchOpenSize() {
    if (typeof global.openPos !== 'function' || global.openPos.__edgeSize) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      var sm = sizeMultiplier();
      if (sm.mult <= 0) {
        if (global.toast) global.toast('Size ×0 — brak nowych wejść (straty/faza sesji)', 'info');
        return;
      }
      // podmienieć tymczasowo risk
      var CFG = global.CFG;
      var oldRisk = CFG && CFG.risk;
      if (CFG && sm.mult < 1) CFG.risk = (oldRisk || 0.5) * sm.mult;
      try { return orig.apply(this, arguments); }
      finally { if (CFG && oldRisk != null) CFG.risk = oldRisk; }
    };
    global.openPos.__edgeSize = true;
  }

  /** 6. Blacklist */
  function blacklistGet() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_BL) || '{}');
      var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      if (o.day !== day) return [];
      return o.list || [];
    } catch (e) { return []; }
  }
  function blacklistSet(list) {
    var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    try { localStorage.setItem(LS_BL, JSON.stringify({ day: day, list: list })); } catch (e) {}
  }
  function isBlacklisted(sym) {
    return blacklistGet().indexOf(sym) >= 0;
  }

  /** 7. Stale data */
  function dataFreshness() {
    var ST = global.ST;
    if (!ST || !ST.series) return { ok: false, label: 'brak serii', stale: true };
    // heurystyka: jeśli provider demo / dataGate block
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var d = global.BTX_PRO6.dataGate();
      if (!d.ok) return { ok: false, label: d.label, stale: true };
    }
    if (global.__BTX_LAST_DATA_ERR) return { ok: false, label: 'błąd danych: ' + global.__BTX_LAST_DATA_ERR, stale: true };
    // znacznik czasu ostatniego live fetch
    var t = global.__BTX_LAST_LIVE_TS || 0;
    if (t && Date.now() - t > 15 * 60 * 1000) {
      return { ok: false, label: 'dane LIVE starsze niż 15 min', stale: true };
    }
    return { ok: true, label: 'dane OK', stale: false };
  }

  // oznaczaj fetchReal
  function patchFetch() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__edge) return;
    var f = global.fetchReal;
    global.fetchReal = async function () {
      var r = await f.apply(this, arguments);
      global.__BTX_LAST_LIVE_TS = Date.now();
      global.__BTX_LAST_DATA_ERR = '';
      return r;
    };
    global.fetchReal.__edge = true;
  }

  /** Pełna ocena edge dla setupu */
  function edgeGrade(g) {
    var reasons = [];
    var scoreAdj = 0;
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) {
      return { pass: false, reasons: ['brak kierunku'], scoreAdj: 0 };
    }
    if (isBlacklisted(g.sym)) reasons.push('BLACKLIST dnia: ' + g.sym);

    var fresh = dataFreshness();
    if (!fresh.ok) reasons.push('Dane: ' + fresh.label);

    var phase = sessionPhase();
    var isFx = /EUR|USD|XAU|GOLD/.test(g.sym || '');
    if (!phase.newEntries && !isFx) reasons.push('Faza sesji: ' + phase.label);
    if (phase.onlyAPlus && (g.strength || 0) < 5) reasons.push('Faza ' + phase.phase + ' wymaga siły 5');

    // indeks tylko dla stock/etf
    if (!isFx) {
      var ix = indexContext(g.side);
      if (!ix.ok) reasons.push(ix.reason);
      else scoreAdj += 3;
      var rs = relativeStrength(g.sym, g.side);
      if (!rs.ok) reasons.push(rs.reason);
      else scoreAdj += (rs.bonus || 0);
    }

    var loc = locationQuality(g.sym, g.side);
    if (!loc.ok) reasons.push(loc.reason);
    else scoreAdj += (loc.bonus || 0);

    var sm = sizeMultiplier();
    if (sm.mult <= 0) reasons.push('Size zablokowany (' + sm.label + ')');

    return {
      pass: reasons.length === 0,
      reasons: reasons,
      scoreAdj: scoreAdj,
      phase: phase,
      size: sm,
      loc: loc,
      fresh: fresh
    };
  }

  /** Patch autonomy gradeSetup */
  function patchAutonomyGrade() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup || global.BTX_AUTONOMY.gradeSetup.__edge) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var base = orig.apply(this, arguments);
      var eg = edgeGrade(g);
      base.score = Math.max(0, Math.min(100, (base.score || 0) + (eg.scoreAdj || 0)));
      if (!eg.pass) {
        base.pass = false;
        base.grade = 'REJECT';
        base.reasons = (base.reasons || []).concat(eg.reasons);
      } else if (base.pass && base.score < 70) {
        base.pass = false;
        base.grade = 'REJECT';
        base.reasons = (base.reasons || []).concat(['score po filtrach pro < 70']);
      }
      base.edge = eg;
      return base;
    };
    global.BTX_AUTONOMY.gradeSetup.__edge = true;
  }

  /** 5. Checklista XTB — 5×TAK */
  function xtbChecklist(g) {
    var items = [];
    var gr = null;
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.gradeSetup) gr = global.BTX_AUTONOMY.gradeSetup(g);
    var eg = edgeGrade(g);
    items.push({ ok: !!(g && (g.side === 'LONG' || g.side === 'SHORT')), text: 'Jest kierunek LONG/SHORT' });
    items.push({ ok: !!(g && (g.strength || 0) >= 4), text: 'Siła ≥ 4' });
    items.push({ ok: !!(gr && gr.pass), text: 'Signal Desk = PASS' });
    items.push({ ok: !!eg.pass, text: 'Filtry pro-edge OK (sesja/RS/lokacja/dane)' });
    items.push({ ok: !!(g && g.price && (g.atr || g.price)), text: 'Znam cenę i skalę ryzyka (ATR/SL)' });
    var pass = items.filter(function (x) { return x.ok; }).length;
    return { items: items, ready: pass === items.length, pass: pass, total: items.length };
  }

  /** 8. XTB trade z SL/TP */
  async function xtbOrderWithStops(g) {
    if (!global.BTX_XTB_API || !global.BTX_XTB_API.isConnected || !global.BTX_XTB_API.isConnected()) {
      throw new Error('xAPI offline');
    }
    if (!global.BTX_QCAP || !localStorage.getItem('BTX_XTB_ARM') || localStorage.getItem('BTX_XTB_ARM') !== '1') {
      throw new Error('XTB ARM wyłączony');
    }
    var ck = xtbChecklist(g);
    if (!ck.ready) throw new Error('Checklista XTB niekompletna (' + ck.pass + '/' + ck.total + ')');

    var sym = (global.BTX_QCAP.mapSym && global.BTX_QCAP.mapSym(g.sym)) || g.sym;
    var price = g.price || lastC(g.sym) || 0;
    var atr = g.atr || price * 0.004;
    var sd = atr * 2;
    var sl = g.side === 'SHORT' ? price + sd : price - sd;
    var tp = g.side === 'SHORT' ? price - 2.5 * sd : price + 2.5 * sd;
    var vol = /EUR|USD|GOLD|XAU/.test(g.sym) ? 0.01 : 1;
    var sm = sizeMultiplier();
    if (sm.mult <= 0.5 && !/EUR|USD|GOLD|XAU/.test(g.sym)) vol = 1;

    var st = global.BTX_XTB_API.getState && global.BTX_XTB_API.getState();
    var ws = st && st.ws;
    if (!ws || ws.readyState !== 1) throw new Error('WebSocket XTB niegotowy');

    var cmd = g.side === 'SHORT' ? 1 : 0;
    var tradeTransInfo = {
      cmd: cmd,
      symbol: sym,
      volume: vol,
      type: 0,
      price: 0,
      sl: Number(sl.toFixed(5)),
      tp: Number(tp.toFixed(5))
    };
    var payload = {
      command: 'tradeTransaction',
      arguments: { tradeTransInfo: tradeTransInfo },
      customTag: 'edge_' + Date.now()
    };
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () { reject(new Error('timeout trade')); }, 15000);
      function onMsg(ev) {
        try {
          var j = JSON.parse(ev.data);
          if (j.customTag && j.customTag !== payload.customTag) return;
          clearTimeout(to);
          ws.removeEventListener('message', onMsg);
          if (j.status === false) reject(new Error(j.errorDescr || j.errorCode || 'trade fail'));
          else resolve(j);
        } catch (e) {}
      }
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify(payload));
    });
  }

  // podmień tradeMarket na wersję z SL/TP gdy wołane z edge
  function patchXtbTrade() {
    if (!global.BTX_XTB_API || global.BTX_XTB_API.__edgeTrade) return;
    global.BTX_XTB_API.tradeWithStops = xtbOrderWithStops;
    global.BTX_XTB_API.__edgeTrade = true;
  }

  function ensurePanel() {
    injectCss();
    var el = document.getElementById('btx-edge');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-edge';
    var ops = document.getElementById('btx-ops');
    if (ops) ops.after(el);
    else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function bestG() {
    var sig = (global.ST && global.ST.sig) || [];
    return sig.filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0] || null;
  }

  function render() {
    var el = ensurePanel();
    if (!el) return;
    var phase = sessionPhase();
    var fresh = dataFreshness();
    var sm = sizeMultiplier();
    var ix = indexContext('LONG');
    var g = bestG();
    var ck = g ? xtbChecklist(g) : null;
    var eg = g ? edgeGrade(g) : null;
    var bl = blacklistGet();

    var html = '<h3>Pro Edge · 8 filtrów daytradera</h3>';
    html += '<p class="why"><b>Po co:</b> indeks, sesja, lokalizacja ceny, size po stratach, checklista XTB, blacklist, świeżość danych, zlecenie z SL/TP.</p>';
    html += '<table>';
    html += '<tr><td>2. Faza sesji</td><td class="' + (phase.newEntries ? 'ok' : 'bad') + '">' + phase.label + '</td></tr>';
    html += '<tr><td>1. Indeks</td><td>' + ix.label + '</td></tr>';
    html += '<tr><td>7. Dane</td><td class="' + (fresh.ok ? 'ok' : 'bad') + '">' + fresh.label + '</td></tr>';
    html += '<tr><td>4. Size</td><td>' + sm.label + ' · serie strat: ' + sm.consec + '</td></tr>';
    html += '<tr><td>6. Blacklist</td><td>' + (bl.length ? bl.join(', ') : 'pusta') + '</td></tr>';
    if (g && eg) {
      html += '<tr><td>Setup</td><td>' + g.side + ' ' + g.sym + ' · edge ' + (eg.pass ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL: ' + eg.reasons.join('; ') + '</span>') + '</td></tr>';
      if (eg.loc) html += '<tr><td>3. Lokalizacja</td><td>' + eg.loc.label + '</td></tr>';
    }
    html += '</table>';

    if (ck) {
      html += '<p class="why" style="margin-top:10px"><b>5. Checklista XTB</b> — zielony plan tylko przy ' + ck.total + '/' + ck.total + ':</p><ul style="margin:0 0 8px 16px;font-size:12.5px">';
      ck.items.forEach(function (it) {
        html += '<li class="' + (it.ok ? 'ok' : 'bad') + '">' + (it.ok ? '✓' : '✗') + ' ' + it.text + '</li>';
      });
      html += '</ul>';
      html += '<div class="why">Status planu: ' + (ck.ready ? '<span class="ok">GOTOWY DO XTB</span>' : '<span class="bad">NIE KOPIUJ JAKO A+ (' + ck.pass + '/' + ck.total + ')</span>') + '</div>';
    }

    html += '<div class="row">';
    html += '<input type="text" id="edge-bl" placeholder="Blacklist: NVDA,TSLA">';
    html += '<button type="button" class="btn" id="edge-bl-save">Zapisz blacklistę dnia</button>';
    html += '<button type="button" class="btn ghost" id="edge-xtb">Wyślij XTB z SL/TP (ARM)</button>';
    html += '</div>';
    el.innerHTML = html;

    var bs = document.getElementById('edge-bl-save');
    if (bs) bs.onclick = function () {
      var v = (document.getElementById('edge-bl').value || '').toUpperCase();
      var list = v.split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      blacklistSet(list);
      if (global.toast) global.toast('Blacklista dnia: ' + (list.join(', ') || 'pusta'), 'ok');
      render();
    };
    var bx = document.getElementById('edge-xtb');
    if (bx) bx.onclick = async function () {
      if (!g) return alert('Brak setupu');
      try {
        var res = await xtbOrderWithStops(g);
        if (global.toast) global.toast('XTB SL/TP wysłane', 'ok');
        console.log(res);
      } catch (e) {
        if (global.toast) global.toast(e.message, 'err');
        else alert(e.message);
      }
    };
  }

  // blokuj budowanie "fałszywie zielonego" ticketu bez checklisty — patch buildXtbTicket display only via flag
  function patchTicketGuard() {
    if (!global.BTX_PRO6 || !global.BTX_PRO6.buildXtbTicket || global.BTX_PRO6.buildXtbTicket.__edge) return;
    var orig = global.BTX_PRO6.buildXtbTicket;
    global.BTX_PRO6.buildXtbTicket = function (g) {
      var t = orig.apply(this, arguments);
      var ck = xtbChecklist(g);
      if (!ck.ready) {
        return 'PLAN NIEZIELONY (' + ck.pass + '/' + ck.total + ') — nie składaj na XTB jako A+\n\n' + t;
      }
      return 'PLAN GOTOWY XTB (' + ck.total + '/' + ck.total + ')\n\n' + t;
    };
    global.BTX_PRO6.buildXtbTicket.__edge = true;
  }

  function boot() {
    injectCss();
    patchFetch();
    patchOpenSize();
    patchAutonomyGrade();
    patchXtbTrade();
    patchTicketGuard();
    render();
    setInterval(function () {
      patchFetch();
      patchOpenSize();
      patchAutonomyGrade();
      patchXtbTrade();
      patchTicketGuard();
      render();
    }, 4000);
  }

  global.BTX_EDGE = {
    edgeGrade: edgeGrade,
    sessionPhase: sessionPhase,
    xtbChecklist: xtbChecklist,
    sizeMultiplier: sizeMultiplier,
    dataFreshness: dataFreshness,
    xtbOrderWithStops: xtbOrderWithStops
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
