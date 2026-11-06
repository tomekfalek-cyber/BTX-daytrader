/**
 * BTX — 5 ulepszeń daytradingu
 * 1) Flat 15 min przed końcem sesji
 * 2) Backtest z kosztami (spread, FX, poślizg) + dane LIVE/CSV
 * 3) Test losowych wejść (ta sama geometria ryzyka)
 * 4) Codzienny reset limitów + limit z floating PnL
 * 5) Dziennik transakcji (powód, koszt, wynik)
 */
(function (global) {
  var ROOT = 'btx-pro5-panel';
  var LS_JOURNAL = 'BTX_TRADE_JOURNAL_V1';
  var LS_CSV = 'BTX_CSV_BARS_V1';

  function warsaw() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    return {
      min: min,
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      dayKey: (map.year || '') + '-' + (map.month || '') + '-' + (map.day || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function mktOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].mkt || 'US';
    if (/ASML|SAP|SIE/.test(sym || '')) return 'EU';
    if (/EUR|XAU|GOLD/.test(sym || '')) return 'FX';
    return 'US';
  }

  /** Sesja close (PL clock) */
  function sessionCloseMin(mkt) {
    if (mkt === 'US') return 22 * 60;
    if (mkt === 'EU' || mkt === 'PL') return 17 * 60 + 30;
    return 23 * 60; // FX — prawie całą dobę pn-pt
  }

  function minutesToFlat(mkt) {
    var w = warsaw();
    if (w.weekend) return -1;
    var close = sessionCloseMin(mkt);
    return close - 15 - w.min; // >0 = jeszcze czas, <=0 = czas na flat
  }

  // ========== 1) Flat 15 min przed końcem sesji ==========
  function forceSessionFlat() {
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    var w = warsaw();
    if (w.weekend) return;
    Object.keys(ST.pos).forEach(function (sym) {
      var mkt = mktOf(sym);
      var left = minutesToFlat(mkt);
      if (left <= 0) {
        var b = typeof global.last === 'function' ? global.last(sym) : null;
        var px = b ? b.c : ST.pos[sym].entry;
        if (typeof global.closePos === 'function') {
          global.closePos(sym, 'flat-15m-przed-końcem-sesji', px);
          if (global.log) global.log('FLAT sesja: zamknięto ' + sym + ' (15 min przed końcem ' + mkt + ')', 'i');
        }
      }
    });
  }

  function blockNewNearClose(sym) {
    var mkt = mktOf(sym);
    return minutesToFlat(mkt) <= 0;
  }

  function patchOpenNearClose() {
    if (typeof global.openPos !== 'function' || global.openPos.__p5flat) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      if (g && g.sym && blockNewNearClose(g.sym)) {
        if (global.toast) global.toast('Brak nowych wejść — 15 min do końca sesji ' + mktOf(g.sym), 'info');
        return;
      }
      return orig.apply(this, arguments);
    };
    global.openPos.__p5flat = true;
  }

  // ========== 4) Codzienny reset + limit z floating ==========
  function floatingPnl() {
    var ST = global.ST;
    if (!ST || !ST.pos) return 0;
    var sum = 0;
    Object.keys(ST.pos).forEach(function (k) {
      var p = ST.pos[k];
      var b = typeof global.last === 'function' ? global.last(k) : null;
      var px = b ? b.c : p.entry;
      sum += (p.side === 'LONG' ? (px - p.entry) : (p.entry - px)) * (p.qty || 0);
    });
    return sum;
  }

  function markEquity() {
    var ST = global.ST;
    if (!ST) return 0;
    var cash = ST.cash != null ? ST.cash : ST.equity;
    var inPos = 0;
    Object.keys(ST.pos || {}).forEach(function (k) {
      var p = ST.pos[k];
      var b = typeof global.last === 'function' ? global.last(k) : null;
      var px = b ? b.c : p.entry;
      inPos += px * (p.qty || 0);
    });
    // cash już pomniejszony o koszt pozycji — equity ≈ cash + wartość pozycji
    // jeśli model trzyma equity osobno, bierz max z floating
    var mtm = cash + inPos;
    if (ST.equity != null && Object.keys(ST.pos || {}).length === 0) return ST.equity;
    return mtm || ST.equity || 0;
  }

  function ensureDayReset() {
    var ST = global.ST;
    if (!ST) return;
    var w = warsaw();
    if (ST.dayPL !== w.dayKey) {
      ST.dayPL = w.dayKey;
      ST.dayStart = markEquity();
      ST.dayTrades = 0;
      ST.consecLoss = 0;
      ST.blocked = false;
      if (global.log) global.log('Nowy dzień PL ' + w.dayKey + ' — reset limitów (start equity ' + (ST.dayStart || 0).toFixed(2) + ')', 'i');
      try { if (typeof global.save === 'function') global.save(); } catch (e) {}
    }
  }

  function dayDdWithOpen() {
    var ST = global.ST;
    if (!ST) return 0;
    ensureDayReset();
    var start = ST.dayStart || ST.equity || 1;
    var now = markEquity();
    return (now - start) / (start || 1);
  }

  function patchDailyLimits() {
    // informacyjnie — STOP FOR DAY pozostaje OFF (ui-stable), ale liczymy poprawnie
    var ST = global.ST;
    if (!ST) return;
    ensureDayReset();
    ST._dayDdOpen = dayDdWithOpen();
    ST._floatPnl = floatingPnl();
    ST._markEquity = markEquity();
  }

  // ========== 5) Dziennik transakcji ==========
  function loadJournal() {
    try { return JSON.parse(localStorage.getItem(LS_JOURNAL) || '[]'); } catch (e) { return []; }
  }
  function saveJournal(arr) {
    try { localStorage.setItem(LS_JOURNAL, JSON.stringify(arr.slice(0, 2000))); } catch (e) {}
  }

  function appendJournal(entry) {
    var j = loadJournal();
    j.unshift(entry);
    saveJournal(j);
  }

  function estimateCosts(p, exitPx) {
    var CFG = global.CFG || {};
    var entry = Number(p.entry) || 0;
    var qty = Number(p.qty) || 0;
    var notional = Math.abs(entry * qty);
    var spreadPct = Number(CFG.spreadPct != null ? CFG.spreadPct : 0.03) / 100; // 0.03%
    var slipPct = Number(CFG.slip != null ? CFG.slip : 0.03) / 100;
    var fxPct = 0;
    var mkt = mktOf(p.sym || '');
    if (mkt === 'US' || mkt === 'EU') fxPct = Number(CFG.fxPct != null ? CFG.fxPct : 0.5) / 100; // przewalutowanie ~0.5% round-trip uproszczenie
    var spread = notional * spreadPct;
    var slip = notional * slipPct;
    var fx = notional * fxPct * 0.5; // jedna strona przy wyjściu już częściowo
    var fees = (p.feeIn || 0) + (p.feeOut || 0);
    return { spread: spread, slip: slip, fx: fx, fees: fees, total: spread + slip + fx + fees };
  }

  function patchCloseJournal() {
    if (typeof global.closePos !== 'function' || global.closePos.__p5j) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      var snap = p ? {
        sym: sym,
        side: p.side,
        qty: p.qty,
        entry: p.entry,
        whyIn: p.why || '',
        bars: p.bars || 0
      } : null;
      var ret = orig.apply(this, arguments);
     var exitPx = px;
      if (snap) {
        var pnlGross = snap.side === 'LONG'
          ? (exitPx - snap.entry) * snap.qty
          : (snap.entry - exitPx) * snap.qty;
        var costs = estimateCosts({ entry: snap.entry, qty: snap.qty, sym: snap.sym, feeIn: 0, feeOut: 0 }, exitPx);
        var pnlNet = pnlGross - costs.total;
        appendJournal({
          ts: new Date().toISOString(),
          dayPL: warsaw().dayKey,
          sym: snap.sym,
          side: snap.side,
          qty: snap.qty,
          entry: snap.entry,
          exit: exitPx,
          bars: snap.bars,
          whyIn: snap.whyIn,
          whyOut: why || '',
          pnlGross: Math.round(pnlGross * 100) / 100,
          costs: Math.round(costs.total * 100) / 100,
          costDetail: costs,
          pnlNet: Math.round(pnlNet * 100) / 100
        });
      }
      return ret;
    };
    global.closePos.__p5j = true;
  }

  // ========== 2) Backtest z kosztami + CSV ==========
  function parseCsvBars(text) {
    // format: time,open,high,low,close,volume  lub date,o,h,l,c,v
    var lines = String(text).trim().split(/\r?\n/);
    var bars = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || /time|date|open/i.test(line) && i === 0) continue;
      var p = line.split(/[,;\t]/);
      if (p.length < 5) continue;
      var o = parseFloat(p[1]), h = parseFloat(p[2]), l = parseFloat(p[3]), c = parseFloat(p[4]);
      var v = p[5] != null ? parseFloat(p[5]) : 0;
      if (![o, h, l, c].every(isFinite)) continue;
      bars.push({ t: Date.parse(p[0]) || i, o: o, h: h, l: l, c: c, v: v || 0 });
    }
    return bars;
  }

  function loadCsvMap() {
    try { return JSON.parse(localStorage.getItem(LS_CSV) || '{}'); } catch (e) { return {}; }
  }
  function saveCsvMap(m) {
    try { localStorage.setItem(LS_CSV, JSON.stringify(m)); } catch (e) {}
  }

  function costOnTrade(entry, exit, qty, side) {
    var CFG = global.CFG || {};
    var notional = Math.abs(entry * qty);
    var spread = notional * (Number(CFG.spreadPct != null ? CFG.spreadPct : 0.03) / 100);
    var slip = notional * (Number(CFG.slip != null ? CFG.slip : 0.03) / 100);
    var fx = notional * (Number(CFG.fxPct != null ? CFG.fxPct : 0.5) / 100) * 0.5;
    var gross = side === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
    return { gross: gross, costs: spread + slip + fx, net: gross - spread - slip - fx };
  }

  function runBacktestWithCosts(sym, bars, opts) {
    opts = opts || {};
    var mode = opts.mode || 'strategy'; // strategy | random
    var riskPct = (global.CFG && global.CFG.risk) || 0.5;
    var equity = (global.CFG && global.CFG.capital) || 500;
    var startEq = equity;
    var trades = [];
    var i = 30;
    while (i < bars.length - 5) {
      var window = bars.slice(Math.max(0, i - 40), i + 1);
      var last = window[window.length - 1];
      var side = null;
      if (mode === 'random') {
        if (Math.random() < 0.08) side = Math.random() < 0.5 ? 'LONG' : 'SHORT';
      } else {
        // prosta reguła daytrade na świecach (SMA)
        var closes = window.map(function (b) { return b.c; });
        var sma = closes.reduce(function (a, b) { return a + b; }, 0) / closes.length;
        var mom = last.c - closes[0];
        if (last.c > sma && mom > 0) side = 'LONG';
        else if (last.c < sma && mom < 0) side = 'SHORT';
      }
      if (!side) { i++; continue; }

      var atr = 0;
      for (var k = 1; k < window.length; k++) atr += (window[k].h - window[k].l);
      atr /= Math.max(1, window.length - 1);
      if (atr <= 0) atr = last.c * 0.004;
      var sd = atr * 1.2;
      var riskCash = equity * (riskPct / 100);
      var qty = Math.max(1, Math.floor(riskCash / sd));
      var entry = last.c;
      var stop = side === 'LONG' ? entry - sd : entry + sd;
      var tp = side === 'LONG' ? entry + 1.6 * sd : entry - 1.6 * sd;

      var exit = null, why = 'time';
      for (var j = i + 1; j < Math.min(bars.length, i + 24); j++) {
        var bar = bars[j];
        if (side === 'LONG') {
          if (bar.l <= stop) { exit = stop; why = 'SL'; break; }
          if (bar.h >= tp) { exit = tp; why = 'TP'; break; }
        } else {
          if (bar.h >= stop) { exit = stop; why = 'SL'; break; }
          if (bar.l <= tp) { exit = tp; why = 'TP'; break; }
        }
        exit = bar.c;
      }
      if (exit == null) { i++; continue; }
      var c = costOnTrade(entry, exit, qty, side);
      equity += c.net;
      trades.push({ side: side, entry: entry, exit: exit, qty: qty, why: why, net: c.net, costs: c.costs, gross: c.gross });
      i += (why === 'time' ? 12 : 6);
    }
    var wins = trades.filter(function (t) { return t.net > 0; }).length;
    return {
      sym: sym,
      mode: mode,
      trades: trades.length,
      wins: wins,
      winRate: trades.length ? wins / trades.length : 0,
      pnl: equity - startEq,
      endEquity: equity,
      avgTrade: trades.length ? (equity - startEq) / trades.length : 0,
      totalCosts: trades.reduce(function (s, t) { return s + t.costs; }, 0)
    };
  }

  function getBarsForSym(sym) {
    var csv = loadCsvMap();
    if (csv[sym] && csv[sym].length > 50) return csv[sym];
    var ST = global.ST;
    if (ST && ST.series && ST.series[sym] && ST.series[sym].length > 50) return ST.series[sym];
    return null;
  }

  // ========== 3) Random baseline ==========
  function runEdgeTest(sym) {
    var bars = getBarsForSym(sym);
    if (!bars) return { error: 'Brak danych dla ' + sym + ' (LIVE/CSV)' };
    var strat = runBacktestWithCosts(sym, bars, { mode: 'strategy' });
    var rnd = runBacktestWithCosts(sym, bars, { mode: 'random' });
    // powtórz random 5× średnia
    var acc = 0;
    for (var i = 0; i < 5; i++) acc += runBacktestWithCosts(sym, bars, { mode: 'random' }).pnl;
    rnd.pnlAvg5 = acc / 5;
    return {
      sym: sym,
      strategy: strat,
      random: rnd,
      edge: strat.pnl - (rnd.pnlAvg5 != null ? rnd.pnlAvg5 : rnd.pnl),
      beatsRandom: strat.pnl > (rnd.pnlAvg5 != null ? rnd.pnlAvg5 : rnd.pnl)
    };
  }

  // ========== UI panel ==========
  function panelHtml() {
    var w = warsaw();
    var j = loadJournal().slice(0, 8);
    var dd = dayDdWithOpen();
    var html = '';
    html += '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;font-weight:800;margin-bottom:6px">Daytrade PRO · 5 punktów</div>';
    html += '<div style="font-size:12.5px;line-height:1.55;color:#cbd5e1">';
    html += '<b>1. Flat sesji:</b> zamknięcie 15 min przed końcem US/EU (teraz ' + w.label + ')<br>';
    html += '<b>4. Limity dnia:</b> reset PL ' + w.dayKey + ' · DD z otwartymi: <b style="color:' + (dd < 0 ? '#f87171' : '#6ee7b7') + '">' + (dd * 100).toFixed(2) + '%</b><br>';
    html += '<b>5. Dziennik:</b> ' + loadJournal().length + ' wpisów (powód, koszt, wynik netto)<br>';
    html += '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">';
    html += '<button type="button" id="btx-p5-bt" class="btn" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-weight:700">Backtest + koszty</button>';
    html += '<button type="button" id="btx-p5-rnd" class="btn" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:0;background:#7c3aed;color:#fff;font-weight:700">Test vs losowe</button>';
    html += '<button type="button" id="btx-p5-csv" class="btn" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:0;background:#334155;color:#fff;font-weight:700">Wczytaj CSV</button>';
    html += '<button type="button" id="btx-p5-jl" class="btn" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:0;background:#0f766e;color:#fff;font-weight:700">Eksport dziennika</button>';
    html += '</div>';
    html += '<div id="btx-p5-out" style="font-size:12px;color:#e2e8f0;line-height:1.5;min-height:24px"></div>';
    if (j.length) {
      html += '<div style="margin-top:8px;font-size:11px;color:#94a3b8"><b>Ostatnie z dziennika</b></div><ul style="margin:4px 0 0 16px;font-size:12px;color:#cbd5e1">';
      j.forEach(function (e) {
        html += '<li>' + e.sym + ' ' + e.side + ' netto <b style="color:' + (e.pnlNet >= 0 ? '#6ee7b7' : '#f87171') + '">' + e.pnlNet + '</b> (koszt ' + e.costs + ') · ' + (e.whyOut || '') + ' · in: ' + String(e.whyIn || '').slice(0, 40) + '</li>';
      });
      html += '</ul>';
    }
    html += '<div style="margin-top:8px;font-size:11px;color:#64748b">Zalecenie: 2–3 miesiące paper z dziennikiem zanim real. CSV: time,open,high,low,close,volume</div>';
    return html;
  }

  function ensurePanel() {
    var el = document.getElementById(ROOT);
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-bt');
    if (!pane) return null;
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(59,130,246,.4);background:rgba(30,58,138,.15)';
      pane.appendChild(el);
    }
    return el;
  }

  function renderPanel() {
    var el = ensurePanel();
    if (!el) return;
    var html = panelHtml();
    if (el.getAttribute('data-h') === String(html.length) && el.innerHTML.length > 50) {
      // lekki update tylko DD — unikaj drgania: pełny refresh co dłużej
      return;
    }
    el.innerHTML = html;
    el.setAttribute('data-h', String(html.length));

    var out = document.getElementById('btx-p5-out');
    var bt = document.getElementById('btx-p5-bt');
    if (bt) bt.onclick = function () {
      var syms = (global.SYMBOLS || []).map(function (m) { return m.s; }).slice(0, 5);
      var lines = [];
      syms.forEach(function (s) {
        var bars = getBarsForSym(s);
        if (!bars) { lines.push(s + ': brak danych'); return; }
        var r = runBacktestWithCosts(s, bars, { mode: 'strategy' });
        lines.push(s + ': trades ' + r.trades + ' · WR ' + (r.winRate * 100).toFixed(0) + '% · PnL ' + r.pnl.toFixed(2) + ' · koszty ' + r.totalCosts.toFixed(2));
      });
      if (out) out.innerHTML = '<b>Backtest z kosztami (spread/slip/FX):</b><br>' + lines.join('<br>');
    };
    var rnd = document.getElementById('btx-p5-rnd');
    if (rnd) rnd.onclick = function () {
      var sym = ((global.SYMBOLS || [])[0] || {}).s || 'EURUSD';
      var open = global.ST && global.ST.pos && Object.keys(global.ST.pos)[0];
      if (open) sym = open;
      var r = runEdgeTest(sym);
      if (r.error) { if (out) out.textContent = r.error; return; }
      if (out) {
        out.innerHTML = '<b>Test przewagi vs losowe (' + sym + ')</b><br>' +
          'Strategia PnL: <b>' + r.strategy.pnl.toFixed(2) + '</b> (' + r.strategy.trades + ' tr.)<br>' +
          'Losowe śr.5× PnL: <b>' + (r.random.pnlAvg5 != null ? r.random.pnlAvg5 : r.random.pnl).toFixed(2) + '</b><br>' +
          'Edge: <b style="color:' + (r.beatsRandom ? '#6ee7b7' : '#f87171') + '">' + r.edge.toFixed(2) + '</b> — ' +
          (r.beatsRandom ? 'bijie losowe (na tej próbce)' : 'NIE bije losowych — brak dowodu przewagi');
      }
    };
    var csv = document.getElementById('btx-p5-csv');
    if (csv) csv.onclick = function () {
      var sym = prompt('Symbol dla CSV (np. EURUSD, ASML):', 'EURUSD');
      if (!sym) return;
      var ta = prompt('Wklej CSV (time,: time,open,high,low,close,volume):');
      if (!ta) return;
      var bars = parseCsvBars(ta);
      if (bars.length < 50) { alert('Za mało barek (' + bars.length + '). Min. ~50.'); return; }
      var map = loadCsvMap();
      map[sym] = bars;
      saveCsvMap(map);
      if (global.ST) {
        global.ST.series = global.ST.series || {};
        global.ST.series[sym] = bars;
      }
      if (out) out.textContent = 'CSV OK: ' + sym + ' · ' + bars.length + ' świec';
      if (global.toast) global.toast('CSV wczytany: ' + sym, 'ok');
    };
    var jl = document.getElementById('btx-p5-jl');
    if (jl) jl.onclick = function () {
      var j = loadJournal();
      var text = 'ts,sym,side,qty,entry,exit,pnlGross,costs,pnlNet,whyIn,whyOut\n' +
        j.map(function (e) {
          return [e.ts, e.sym, e.side, e.qty, e.entry, e.exit, e.pnlGross, e.costs, e.pnlNet,
            JSON.stringify(e.whyIn || ''), JSON.stringify(e.whyOut || '')].join(',');
        }).join('\n');
      var blob = new Blob([text], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'btx-journal.csv';
      a.click();
    };
  }

  function boot() {
    // defaults kosztów
    try {
      var CFG = global.CFG || (global.CFG = {});
      if (CFG.spreadPct == null) CFG.spreadPct = 0.03;
      if (CFG.slip == null) CFG.slip = 0.03;
      if (CFG.fxPct == null) CFG.fxPct = 0.5;
    } catch (e) {}

    ensureDayReset();
    patchOpenNearClose();
    patchCloseJournal();
    patchDailyLimits();
    forceSessionFlat();
    renderPanel();

    setInterval(function () {
      ensureDayReset();
      patchOpenNearClose();
      patchCloseJournal();
      patchDailyLimits();
      forceSessionFlat();
    }, 15000);

    // panel co 30s (stabilnie)
    setInterval(function () {
      var el = document.getElementById(ROOT);
      if (el) el.removeAttribute('data-h');
      renderPanel();
    }, 30000);
  }

  global.BTX_PRO5 = {
    forceSessionFlat: forceSessionFlat,
    ensureDayReset: ensureDayReset,
    dayDdWithOpen: dayDdWithOpen,
    runBacktestWithCosts: runBacktestWithCosts,
    runEdgeTest: runEdgeTest,
    loadJournal: loadJournal,
    parseCsvBars: parseCsvBars
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
