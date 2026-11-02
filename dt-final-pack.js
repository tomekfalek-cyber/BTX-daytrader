/**
 * BTX Daytrading final pack
 * 1 Pullback entry (nie impuls)
 * 2 Pierwsze 15 min po 15:30 — tylko siła 5 / half albo wait
 * 3 Jedna ekspozycja tech (spółka XOR QQQ)
 * 5 Spread/koszt w decyzji PASS + domyślny spread wpisany
 */
(function (global) {
  var STYLE = 'btx-dt-final-css';
  var LS_COSTS = 'BTX_COST_MODEL';
  var TECH = ['NVDA', 'TSLA', 'META', 'AAPL', 'QQQ'];

  /** Domyślny spread orientacyjny (Active DT) */
  function ensureDefaultSpread() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_COSTS) || '{}');
      var changed = false;
      if (o.spreadPct == null || o.spreadPct === '' || isNaN(+o.spreadPct)) {
        o.spreadPct = 0.03; // 0.03% ceny w+wy — ostrożny default pod CFD/akcje
        changed = true;
      }
      if (o.commission == null || isNaN(+o.commission)) {
        o.commission = 0;
        changed = true;
      }
      if (changed) localStorage.setItem(LS_COSTS, JSON.stringify(o));
      // learner costsGet jeśli jest
      if (global.CFG && global.CFG.spreadPct == null) global.CFG.spreadPct = o.spreadPct;
    } catch (e) {}
  }

  function costs() {
    ensureDefaultSpread();
    try {
      var o = JSON.parse(localStorage.getItem(LS_COSTS) || '{}');
      return {
        spreadPct: o.spreadPct != null ? +o.spreadPct : 0.03,
        commission: o.commission != null ? +o.commission : 0
      };
    } catch (e) {
      return { spreadPct: 0.03, commission: 0 };
    }
  }

  function bars(sym) {
    return (global.ST && global.ST.series && global.ST.series[sym]) || [];
  }
  function closes(sym, n) {
    var b = bars(sym);
    var c = b.map(function (x) { return x.c; });
    return n ? c.slice(-n) : c;
  }

  function warsawMin() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false
    });
    var parts = fmt.formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
  }

  /** 2. Pierwsze 15 min sesji US */
  function open15() {
    var m = warsawMin();
    var usOpen = 15 * 60 + 30;
    if (m >= usOpen && m < usOpen + 15) {
      return { active: true, label: 'Pierwsze 15 min US — tylko siła 5, half size (albo WAIT)' };
    }
    return { active: false, label: '' };
  }

  /** 1. Pullback vs impuls */
  function pullbackOk(sym, side) {
    var c = closes(sym, 25);
    if (c.length < 15) return { ok: true, label: 'pullback: mało danych', bonus: 0 };
    var last = c[c.length - 1];
    // EMA-ish 9
    var k = 2 / (9 + 1), e = c[0];
    for (var i = 1; i < c.length; i++) e = c[i] * k + e * (1 - k);
    // impuls: ostatnie 3 świece mocno w jedną stronę bez cofnięcia
    var r3 = (last - c[c.length - 4]) / c[c.length - 4];
    var distEma = (last - e) / e;

    if (side === 'LONG') {
      // zły moment: silny impuls w górę i daleko powyżej EMA
      if (r3 > 0.004 && distEma > 0.0035) {
        return { ok: false, label: 'impuls UP — czekaj pullback do EMA', reason: 'Brak pullbacku LONG (pogoń za impulsem)' };
      }
      // dobry: cena blisko EMA z góry / lekki cofnij
      if (distEma >= -0.0015 && distEma <= 0.0025) {
        return { ok: true, label: 'pullback/EMA OK', bonus: 6 };
      }
      return { ok: true, label: 'LONG bez idealnego pullbacku', bonus: 0 };
    }
    if (side === 'SHORT') {
      if (r3 < -0.004 && distEma < -0.0035) {
        return { ok: false, label: 'impuls DOWN — czekaj bounce do EMA', reason: 'Brak pullbacku SHORT (pogoń za impulsem)' };
      }
      if (distEma <= 0.0015 && distEma >= -0.0025) {
        return { ok: true, label: 'pullback/EMA OK', bonus: 6 };
      }
      return { ok: true, label: 'SHORT bez idealnego pullbacku', bonus: 0 };
    }
    return { ok: true, label: '', bonus: 0 };
  }

  /** 3. Tech: spółka XOR QQQ */
  function techExposureBlock(sym, side) {
    if (TECH.indexOf(sym) < 0) return { ok: true };
    var pos = (global.ST && global.ST.pos) || {};
    var openTech = Object.keys(pos).filter(function (s) { return TECH.indexOf(s) >= 0; });
    if (!openTech.length) return { ok: true };

    var hasQQQ = !!pos['QQQ'];
    var hasStock = openTech.some(function (s) { return s !== 'QQQ'; });

    // nowa spółka tech gdy już jest QQQ
    if (sym !== 'QQQ' && hasQQQ) {
      return { ok: false, reason: 'Już jest QQQ — nie dokładaj spółki tech (jedna ekspozycja)' };
    }
    // QQQ gdy już jest spółka tech
    if (sym === 'QQQ' && hasStock) {
      return { ok: false, reason: 'Już jest spółka tech — nie dokładaj QQQ (jedna ekspozycja)' };
    }
    // druga spółka tech
    if (sym !== 'QQQ' && hasStock && !pos[sym]) {
      return { ok: false, reason: 'Max 1 spółka tech naraz' };
    }
    return { ok: true };
  }

  /** 5. Spread gate — TP dystans vs koszt */
  function spreadGate(g) {
    if (!g || !g.price) return { ok: true, label: 'brak ceny' };
    var c = costs();
    var price = g.price;
    var atr = g.atr || price * 0.004;
    var risk = atr * 2; // jak PRO SL
    var reward = risk * 2.5; // TP 2.5R
    // koszt orientacyjny: spread% * price * 2 (w+wy) na jednostkę
    var spreadCost = price * (c.spreadPct / 100) * 2;
    var fee = (c.commission || 0) * 2;
    // fee w jednostkach ceny przybliżone — tylko gdy qty=1, więc traktujemy fee osobno słabo; głównie spread
    var cost = spreadCost;
    var ratio = cost > 0 ? reward / cost : 99;
    // wymagaj co najmniej ~1.8× kosztu w potencjale TP
    if (ratio < 1.8) {
      return {
        ok: false,
        reason: 'TP za mały vs spread (R/cost=' + ratio.toFixed(2) + ', spread~' + c.spreadPct + '%)',
        ratio: ratio,
        spreadPct: c.spreadPct
      };
    }
    return { ok: true, label: 'R/cost~' + ratio.toFixed(1) + ' (spread ' + c.spreadPct + '%)', ratio: ratio, spreadPct: c.spreadPct };
  }

  function finalGrade(g) {
    var reasons = [];
    var bonus = 0;
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) {
      return { pass: false, reasons: ['brak kierunku'], bonus: 0 };
    }

    var o15 = open15();
    if (o15.active) {
      if ((g.strength || 0) < 5) reasons.push(o15.label);
    }

    var pb = pullbackOk(g.sym, g.side);
    if (!pb.ok) reasons.push(pb.reason || pb.label);
    else bonus += (pb.bonus || 0);

    var tech = techExposureBlock(g.sym, g.side);
    if (!tech.ok) reasons.push(tech.reason);

    var sp = spreadGate(g);
    if (!sp.ok) reasons.push(sp.reason);

    return { pass: reasons.length === 0, reasons: reasons, bonus: bonus, open15: o15, pullback: pb, spread: sp, tech: tech };
  }

  function patchGrade() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup) return;
    if (global.BTX_AUTONOMY.gradeSetup.__dtFinal) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      var f = finalGrade(g);
      r.score = Math.max(0, Math.min(100, (r.score || 0) + (f.bonus || 0)));
      if (!f.pass) {
        r.pass = false;
        r.grade = 'REJECT';
        r.reasons = (r.reasons || []).concat(f.reasons);
      }
      r.dtFinal = f;
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__dtFinal = true;
  }

  function patchOpenSize15() {
    if (typeof global.openPos !== 'function' || global.openPos.__dt15) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      var o15 = open15();
      var CFG = global.CFG;
      var old = CFG && CFG.risk;
      if (o15.active && CFG) {
        if (!g || (g.strength || 0) < 5) {
          if (global.toast) global.toast('Pierwsze 15 min US: tylko siła 5', 'info');
          return;
        }
        CFG.risk = (old || 0.5) * 0.5;
      }
      try { return orig.apply(this, arguments); }
      finally { if (CFG && old != null) CFG.risk = old; }
    };
    global.openPos.__dt15 = true;
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = '#btx-dt-final{margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);background:rgba(16,185,129,.08);font-size:12.5px;color:#d1fae5;line-height:1.5}'
      + '#btx-dt-final b{color:#fff}';
    document.head.appendChild(s);
  }

  function render() {
    injectCss();
    ensureDefaultSpread();
    var el = document.getElementById('btx-dt-final');
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-dt-final';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var c = costs();
    var o15 = open15();
    var sig = ((global.ST && global.ST.sig) || []).filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })[0];
    var f = sig ? finalGrade(sig) : null;
    var html = '<b>Pakiet DT</b> · pullback · open 15m · tech XOR QQQ · spread w PASS<br>';
    html += 'Domyślny spread: <b>' + c.spreadPct + '%</b> (w+wy, localStorage) · prowizja: ' + c.commission + ' · zmiana w pakiecie nauki / kosztach<br>';
    if (o15.active) html += '<span style="color:#fbbf24">⚠ ' + o15.label + '</span><br>';
    if (f) {
      html += 'Filtr na top setupie: ' + (f.pass ? '<b style="color:#6ee7b7">OK</b>' : '<b style="color:#fca5a5">blok: ' + f.reasons.join('; ') + '</b>');
      if (f.spread && f.spread.label) html += ' · ' + f.spread.label;
      if (f.pullback && f.pullback.label) html += ' · ' + f.pullback.label;
    }
    el.innerHTML = html;
  }

  function boot() {
    ensureDefaultSpread();
    patchGrade();
    patchOpenSize15();
    render();
    setInterval(function () {
      ensureDefaultSpread();
      patchGrade();
      patchOpenSize15();
      render();
    }, 3500);
  }

  global.BTX_DT_FINAL = { finalGrade: finalGrade, costs: costs, open15: open15, pullbackOk: pullbackOk };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
