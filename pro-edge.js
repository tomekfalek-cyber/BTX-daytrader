/**
 * BTX Pro Edge — filtry daytradera (Active DT)
 * indeks/RS (kara), faza sesji, lokalizacja, size po stratach,
 * blacklist, swiezosc danych, checklista XTB
 */
(function (global) {
  var STYLE = 'btx-pro-edge-css';
  var LS_BL = 'BTX_BLACKLIST_DAY';

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
      '#btx-edge td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '#btx-edge .ok{color:#12c48b;font-weight:700}',
      '#btx-edge .bad{color:#f87171;font-weight:700}',
      '#btx-edge .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
      '#btx-edge input[type=text]{min-width:160px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg4,#202733);color:#fff}'
    ].join('');
    document.head.appendChild(s);
  }

  function closes(sym, n) {
    var b = global.ST && global.ST.series && global.ST.series[sym];
    if (!b || !b.length) return [];
    var c = b.map(function (x) { return x.c; });
    return n ? c.slice(-n) : c;
  }
  function ret(sym, bars) {
    var c = closes(sym, bars + 1);
    if (c.length < bars + 1) return null;
    var a = c[0], b = c[c.length - 1];
    if (!a) return null;
    return (b - a) / a;
  }

  function indexContext(side) {
    var spy = ret('SPY', 10);
    var qqq = ret('QQQ', 10);
    var bench = qqq != null ? qqq : spy;
    var label = 'brak SPY/QQQ';
    var bias = 0;
    if (bench != null) {
      if (bench > 0.002) { bias = 1; label = 'indeks up'; }
      else if (bench < -0.002) { bias = -1; label = 'indeks down'; }
      else { bias = 0; label = 'indeks plaski'; }
    }
    var penalty = 0;
    if (side === 'LONG' && bias < 0) { penalty = 12; label += ' · kara long'; }
    if (side === 'SHORT' && bias > 0) { penalty = 12; label += ' · kara short'; }
    return { ok: true, bias: bias, label: label, penalty: penalty };
  }

  function relativeStrength(sym, side) {
    var rSym = ret(sym, 10);
    var rIdx = ret('QQQ', 10);
    if (rIdx == null) rIdx = ret('SPY', 10);
    if (rSym == null || rIdx == null) return { ok: true, label: 'RS: brak danych', bonus: 0, penalty: 0 };
    var rs = rSym - rIdx;
    var label = 'RS ' + (rs >= 0 ? '+' : '') + (rs * 100).toFixed(2) + '%';
    var bonus = 0, penalty = 0;
    if (side === 'LONG' && rs < -0.003) { penalty = 10; label += ' · slaby RS'; }
    if (side === 'SHORT' && rs > 0.003) { penalty = 10; label += ' · RS przeciw short'; }
    if (side === 'LONG' && rs > 0.002) bonus = 6;
    if (side === 'SHORT' && rs < -0.002) bonus = 6;
    return { ok: true, rs: rs, label: label, bonus: bonus, penalty: penalty };
  }

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
    if (min < usOpen) return { phase: 'PRE', sizeMult: 0.5, newEntries: false, label: 'Pre-market US' };
    if (min < usOpen + 30) return { phase: 'OPEN', sizeMult: 0.5, newEntries: true, minStrength: 4, label: 'Otwarcie US Active DT sila>=4 half size' };
    if (min >= usClose - 45) return { phase: 'CLOSE', sizeMult: 0.5, newEntries: true, minStrength: 4, label: 'Koncowka US' };
    if (min >= usOpen && min < usClose) return { phase: 'MID', sizeMult: 1, newEntries: true, label: 'Sesja US' };
    return { phase: 'AFTER', sizeMult: 0, newEntries: false, label: 'Po sesji US' };
  }

  function locationQuality(sym, side) {
    var b = global.ST && global.ST.series && global.ST.series[sym];
    if (!b || b.length < 20) return { ok: true, label: 'malo swiec', bonus: 0 };
    var slice = b.slice(-20);
    var hi = -Infinity, lo = Infinity;
    slice.forEach(function (x) { if (x.h > hi) hi = x.h; if (x.l < lo) lo = x.l; });
    var c = slice[slice.length - 1].c;
    var pos = hi > lo ? (c - lo) / (hi - lo) : 0.5;
    if (side === 'LONG' && pos > 0.95) return { ok: false, label: 'chase long', reason: 'Pogon LONG na skraju', penalty: 15 };
    if (side === 'SHORT' && pos < 0.05) return { ok: false, label: 'chase short', reason: 'Pogon SHORT na skraju', penalty: 15 };
    var bonus = 0;
    if (side === 'LONG' && pos >= 0.25 && pos <= 0.55) bonus = 5;
    if (side === 'SHORT' && pos >= 0.45 && pos <= 0.75) bonus = 5;
    return { ok: true, label: 'lok ' + (pos * 100).toFixed(0) + '%', bonus: bonus, penalty: 0, pos: pos };
  }

  function sizeMultiplier() {
    var ST = global.ST || {};
    var consec = ST.consecLoss || 0;
    var mult = 1;
    if (consec >= 2) mult = 0.5;
    if (consec >= 3) mult = 0;
    var phase = sessionPhase();
    mult *= (phase.sizeMult != null ? phase.sizeMult : 1);
    return { mult: mult, consec: consec, phase: phase.phase, label: 'size x' + mult };
  }

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
  function isBlacklisted(sym) { return blacklistGet().indexOf(sym) >= 0; }

  function dataFreshness() {
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var d = global.BTX_PRO6.dataGate();
      if (!d.ok) return { ok: false, label: d.label, stale: true };
    }
    if (global.__BTX_LAST_DATA_ERR) return { ok: false, label: String(global.__BTX_LAST_DATA_ERR), stale: true };
    var t = global.__BTX_LAST_LIVE_TS || 0;
    if (t && Date.now() - t > 15 * 60 * 1000) return { ok: false, label: 'LIVE >15 min', stale: true };
    return { ok: true, label: 'dane OK', stale: false };
  }

  function edgeGrade(g) {
    var reasons = [];
    var scoreAdj = 0;
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) {
      return { pass: false, reasons: ['brak kierunku'], scoreAdj: 0 };
    }
    if (isBlacklisted(g.sym)) reasons.push('BLACKLIST: ' + g.sym);
    var fresh = dataFreshness();
    if (!fresh.ok) reasons.push('Dane: ' + fresh.label);
    var phase = sessionPhase();
    var isFx = /EUR|USD|XAU|GOLD/.test(g.sym || '');
    if (!phase.newEntries && !isFx) reasons.push('Faza: ' + phase.label);
    var needStr = phase.minStrength || 4;
    if ((g.strength || 0) < needStr && (phase.phase === 'OPEN' || phase.phase === 'CLOSE')) {
      reasons.push('Faza ' + phase.phase + ' wymaga sily >=' + needStr);
    }
    if (!isFx) {
      var ix = indexContext(g.side);
      scoreAdj += 3 - (ix.penalty || 0);
      var rs = relativeStrength(g.sym, g.side);
      scoreAdj += (rs.bonus || 0) - (rs.penalty || 0);
    }
    var loc = locationQuality(g.sym, g.side);
    if (!loc.ok) reasons.push(loc.reason || loc.label);
    else scoreAdj += (loc.bonus || 0);
    var sm = sizeMultiplier();
    if (sm.mult <= 0) reasons.push('Size zablokowany');
    return { pass: reasons.length === 0, reasons: reasons, scoreAdj: scoreAdj, phase: phase, size: sm, loc: loc, fresh: fresh };
  }

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
      } else if (base.pass && base.score < 63) {
        base.pass = false;
        base.grade = 'REJECT';
        base.reasons = (base.reasons || []).concat(['score po filtrach < 63 (Active DT)']);
      }
      base.edge = eg;
      return base;
    };
    global.BTX_AUTONOMY.gradeSetup.__edge = true;
  }

  function xtbChecklist(g) {
    var items = [];
    var gr = null;
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.gradeSetup) gr = global.BTX_AUTONOMY.gradeSetup(g);
    var eg = edgeGrade(g);
    items.push({ ok: !!(g && (g.side === 'LONG' || g.side === 'SHORT')), text: 'Kierunek LONG/SHORT' });
    items.push({ ok: !!(g && (g.strength || 0) >= 4), text: 'Sila >= 4' });
    items.push({ ok: !!(gr && gr.pass), text: 'Signal Desk PASS' });
    items.push({ ok: !!eg.pass, text: 'Pro-edge OK' });
    items.push({ ok: !!(g && g.price), text: 'Cena/ATR znane' });
    var pass = items.filter(function (x) { return x.ok; }).length;
    return { items: items, ready: pass === items.length, pass: pass, total: items.length };
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
    var eg = g ? edgeGrade(g) : null;
    var ck = g ? xtbChecklist(g) : null;
    var bl = blacklistGet();
    var html = '<h3>Pro Edge \u00b7 Active Daytrader</h3>';
    html += '<p class="why">Score >=63, open sila>=4, miekkie RS/indeks, anti-chase na skrajach. Max 4/dzien, risk 0,5%.</p>';
    html += '<table>';
    html += '<tr><td>Faza sesji</td><td class="' + (phase.newEntries ? 'ok' : 'bad') + '">' + phase.label + '</td></tr>';
    html += '<tr><td>Indeks</td><td>' + ix.label + '</td></tr>';
    html += '<tr><td>Dane</td><td class="' + (fresh.ok ? 'ok' : 'bad') + '">' + fresh.label + '</td></tr>';
    html += '<tr><td>Size</td><td>' + sm.label + ' · serie strat: ' + sm.consec + '</td></tr>';
    html += '<tr><td>Blacklist</td><td>' + (bl.length ? bl.join(', ') : 'pusta') + '</td></tr>';
    if (g && eg) {
      html += '<tr><td>Setup</td><td>' + g.side + ' ' + g.sym + ' · ' + (eg.pass ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL: ' + eg.reasons.join('; ') + '</span>') + '</td></tr>';
    }
    html += '</table>';
    if (ck) {
      html += '<p class="why" style="margin-top:8px"><b>Checklista XTB</b> ' + ck.pass + '/' + ck.total + (ck.ready ? ' <span class="ok">GOTOWY</span>' : ' <span class="bad">NIEZIELONY</span>') + '</p>';
    }
    html += '<div class="row"><input type="text" id="edge-bl" placeholder="Blacklist: NVDA,TSLA">';
    html += '<button type="button" class="btn" id="edge-bl-save">Zapisz blacklist\u0119 dnia</button></div>';
    el.innerHTML = html;
    var bs = document.getElementById('edge-bl-save');
    if (bs) bs.onclick = function () {
      var v = (document.getElementById('edge-bl').value || '').toUpperCase();
      var list = v.split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      blacklistSet(list);
      if (global.toast) global.toast('Blacklista: ' + (list.join(', ') || 'pusta'), 'ok');
      render();
    };
  }

  function boot() {
    injectCss();
    patchAutonomyGrade();
    render();
    setInterval(function () { patchAutonomyGrade(); render(); }, 4000);
  }

  global.BTX_EDGE = {
    edgeGrade: edgeGrade,
    sessionPhase: sessionPhase,
    xtbChecklist: xtbChecklist,
    sizeMultiplier: sizeMultiplier,
    dataFreshness: dataFreshness
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
