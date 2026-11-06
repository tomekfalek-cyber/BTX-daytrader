/**
 * Backtest na PRAWDZIWYCH danych 5-min (Twelve Data) tymi samymi regułami co bot (evalCore ze strategy-pro.js).
 *  - wejscie na otwarciu NASTEPNEJ swiecy po sygnale (bez "podgladania"), poslizg + spread + prowizje z modelu aplikacji
 *  - stop liczony przed celem w tej samej swiecy (podejscie ostrożne), BE, wyjscie czesciowe, time-stop, flat na koniec sesji
 *  - wyniki w R (wielokrotnosc ryzyka), podzial na probe uczaca (60%) i testowa (40%) — wykrywa dopasowanie do szumu
 *  - porownanie wariantow BE / wyjscia czesciowego / TP (decyzje o parametrach opieraja sie na danych, nie na odczuciu)
 */
(function (global) {
  'use strict';
  var CORE = function () { return global.BTX_STRATEGY_CORE; };
  var PRO = function () { return global.BTX_STRATEGY_PRO; };

  var VARIANTS = [
    { name: 'BAZA (jak bot)', p: {} },
    { name: 'bez BE', p: { beR: 99 } },
    { name: 'BE przy 1.0R', p: { beR: 1.0 } },
    { name: 'bez wyjscia czesciowego', p: { partialFrac: 0 } },
    { name: 'bez BE i bez czesciowego', p: { beR: 99, partialFrac: 0 } },
    { name: 'TP 2.0R', p: { tpR: 2.0 } },
    { name: 'TP 1.2R', p: { tpR: 1.2 } }
  ];

  function sgn(side) { return side === 'LONG' ? 1 : -1; }

  // pojedynczy przebieg: bars chronologicznie, meta = wpis z SYMBOLS
  function run(bars, meta, opts) {
    var C = CORE(), base = PRO(), T = global.BTX_TIME;
    opts = opts || {};
    var P = {};
    ['atrSlMult', 'tpR', 'beR', 'partialR', 'partialFrac', 'minStrengthOpen', 'coolBars', 'maxDayTrades', 'maxConsecLoss', 'timeStopBars', 'minNetRR', 'closeBufferMin']
      .forEach(function (k) { P[k] = base[k]; });
    Object.keys(opts.params || {}).forEach(function (k) { P[k] = opts.params[k]; });
    var rt = opts.roundTripPct != null ? opts.roundTripPct : 0.0008;   // spread + prowizje, calosc na transakcje (ulamek nominalu)
    var slip = opts.slipPct != null ? opts.slipPct : 0.0002;           // poslizg na kazda strone
    var mkt = C.marketOf(meta), trades = [], n = bars.length;
    var pos = null, cool = 0, dayKey = null, dayTrades = 0, consec = 0, skippedCost = 0;

    function finish(exitI, legs, why) {
      var gross = 0, i;
      for (i = 0; i < legs.length; i++) gross += legs[i].R * legs[i].w;
      var costR = pos.entry * rt / pos.sd;
      var R = gross - costR;
      trades.push({ t: bars[exitI].t, sym: meta.s, side: pos.side, qty: 1, entry: pos.entry, exit: legs[legs.length - 1].px,
        pnl: R, R: R, fees: costR, why: why, bars: pos.bars });
      if (R < 0) consec++; else consec = 0;
      cool = P.coolBars; pos = null;
    }

    for (var i = 60; i < n - 1; i++) {
      var bar = bars[i], lk = T.local(bar.t);
      if (lk.day !== dayKey) { dayKey = lk.day; dayTrades = 0; consec = 0; }
      if (pos) {
        pos.bars++;
        var s = sgn(pos.side), legs = pos.legs, exitPx = null, why = '';
        var stopHit = s > 0 ? bar.l <= pos.stop : bar.h >= pos.stop;
        var tgtHit = s > 0 ? bar.h >= pos.target : bar.l <= pos.target;
        if (stopHit) {
          exitPx = s > 0 ? Math.min(pos.stop, bar.o) : Math.max(pos.stop, bar.o);
          why = pos.be ? 'stop/BE' : 'stop';
          exitPx = exitPx * (1 - s * slip);
        } else {
          if (!pos.partialDone && P.partialFrac > 0 && (s > 0 ? bar.h >= pos.partial : bar.l <= pos.partial)) {
            legs.push({ px: pos.partial, R: s * (pos.partial - pos.entry) / pos.sd, w: P.partialFrac });
            pos.remaining = 1 - P.partialFrac; pos.partialDone = true; pos.stop = pos.entry; pos.be = true;
          }
          if (tgtHit) { exitPx = pos.target * (1 - s * slip); why = 'cel'; }
        }
        if (exitPx == null) {
          var endTs = bar.t + 300000, flat = false;
          if (mkt !== 'FX') {
            var sd = base.sessions[mkt] || base.sessions.US;
            if (T.pseudoUtcMin(endTs) >= sd.close - P.closeBufferMin) flat = true;
          }
          if (C.sessIdOf(bars[i + 1].t, C.SESS_START[mkt] != null ? C.SESS_START[mkt] : C.SESS_START.US) !== C.sessIdOf(bar.t, C.SESS_START[mkt] != null ? C.SESS_START[mkt] : C.SESS_START.US)) flat = true;
          if (flat) { exitPx = bar.c * (1 - s * slip); why = 'flat sesji'; }
          else if (pos.bars >= P.timeStopBars) { exitPx = bar.c * (1 - s * slip); why = 'time-stop'; }
        }
        if (exitPx != null) {
          pos.legs.push({ px: exitPx, R: s * (exitPx - pos.entry) / pos.sd, w: pos.remaining });
          finish(i, pos.legs, why);
        } else if (!pos.be && s * (bar.c - pos.entry) / pos.sd >= P.beR) {
          pos.stop = pos.entry; pos.be = true;
        }
        continue;
      }
      if (cool > 0) { cool--; continue; }
      if (dayTrades >= P.maxDayTrades || consec >= P.maxConsecLoss) continue;
      var ts = bar.t + 300000;
      if (!C.inSession(mkt, ts) || C.sessionQuality(mkt, ts) === 0) continue;
      var g = opts.signalFn ? opts.signalFn(i, bar, bars) : C.evalCore(meta, bars.slice(Math.max(0, i - 399), i + 1), ts, { allowShort: !!opts.allowShort });
      if (!g || g.side === 'WAIT' || (g.strength || 0) < P.minStrengthOpen) continue;
      var nxt = bars[i + 1];
      if (nxt.t - bar.t > 600000) continue;                    // luka w danych
      var side = g.side, sg = sgn(side), entry = nxt.o * (1 + sg * slip), sdv = (g.atr || entry * 0.004) * P.atrSlMult;
      if (!(sdv > 0)) continue;
      var costPU = entry * rt, netRR = (P.tpR * sdv - costPU) / (sdv + costPU);
      if (netRR < P.minNetRR) { skippedCost++; continue; }
      pos = { side: side, entry: entry, sd: sdv, stop: entry - sg * sdv, target: entry + sg * P.tpR * sdv,
        partial: entry + sg * P.partialR * sdv, partialDone: false, remaining: 1, be: false, bars: 0, legs: [] };
      dayTrades++;
    }
    return { trades: trades, skippedCost: skippedCost };
  }

  function splitStats(trades) {
    var S = global.BTX_STATS, sorted = trades.slice().sort(function (a, b) { return a.t - b.t; });
    var cut = Math.floor(sorted.length * 0.6);
    return { all: S.computeStats(sorted), train: S.computeStats(sorted.slice(0, cut)), test: S.computeStats(sorted.slice(cut)) };
  }

  // rowSets: [{meta, bars}], zwraca wyniki wariantow
  function compare(rowSets, opts) {
    return VARIANTS.map(function (v) {
      var all = [], per = {};
      rowSets.forEach(function (rs) {
        var o = Object.assign({}, opts, { params: v.p, roundTripPct: rs.roundTripPct != null ? rs.roundTripPct : (opts && opts.roundTripPct) });
        var r = run(rs.bars, rs.meta, o);
        per[rs.meta.s] = r;
        all = all.concat(r.trades);
      });
      return { name: v.name, params: v.p, per: per, trades: all, st: splitStats(all) };
    });
  }

  function recommend(results) {
    var cand = results.filter(function (r) { return r.st.all.n >= 30 && r.st.train.expectancy > 0; });
    if (!cand.length) return 'Brak wariantu z dodatnia oczekiwana wartoscia (E[R]) na probie uczacej i >= 30 transakcjach. Reguly nie wykazuja przewagi po kosztach — nie handluj na prawdziwe pieniadze.';
    cand.sort(function (a, b) { return b.st.test.expectancy - a.st.test.expectancy; });
    var best = cand[0], base = results[0];
    if (best.st.test.expectancy <= 0) return 'Zaden wariant nie utrzymal dodatniego E[R] na probie testowej (40% najnowszych danych) — to wyglada na dopasowanie do szumu, nie przewage.';
    if (best === base || Math.abs(best.st.test.expectancy - base.st.test.expectancy) < 0.05)
      return 'BAZA jest tak dobra jak najlepszy wariant (roznica < 0.05R to szum) — zostaw obecne parametry.';
    return 'Najlepszy na probie TESTOWEJ: "' + best.name + '" (E[R] test ' + best.st.test.expectancy.toFixed(2) + ' vs baza ' + base.st.test.expectancy.toFixed(2) + '). Zmien parametry dopiero gdy roznica jest stabilna na wiekszej probie.';
  }

  function f2(x) { return (x == null || !isFinite(x)) ? '—' : x.toFixed(2); }
  function pf(s) { return s.profitFactor == null ? (s.grossWin > 0 ? '∞' : '—') : s.profitFactor.toFixed(2); }

  function format(results, meta) {
    var L = [];
    L.push('BACKTEST (prawdziwe dane 5-min, koszty+poslizg wliczone, wyniki w R)');
    if (meta && meta.coverage) L.push(meta.coverage);
    L.push('');
    L.push('Wariant                         N    Win%   PF    E[R]   uczaca   TEST   MaxDD(R)');
    results.forEach(function (r) {
      var s = r.st.all;
      L.push((r.name + '                              ').slice(0, 30) + ' ' + ('   ' + s.n).slice(-4) + '  ' + ('   ' + (s.winRate * 100).toFixed(0) + '%').slice(-5) + '  ' +
        ('    ' + pf(s)).slice(-5) + ' ' + ('     ' + f2(s.expectancy)).slice(-6) + ' ' + ('      ' + f2(r.st.train.expectancy)).slice(-7) + ' ' + ('     ' + f2(r.st.test.expectancy)).slice(-6) + '   ' + f2(s.maxDrawdown));
    });
    L.push('');
    L.push('WNIOSEK: ' + recommend(results));
    var base = results[0], per = [];
    Object.keys(base.per).forEach(function (sym) {
      var st = global.BTX_STATS.computeStats(base.per[sym].trades);
      per.push(sym + ' N' + st.n + ' E[R] ' + f2(st.expectancy) + ' PF ' + pf(st) + (base.per[sym].skippedCost ? ' (odrzucone przez koszty: ' + base.per[sym].skippedCost + ')' : ''));
    });
    L.push('');
    L.push('Wg symbolu (BAZA): ' + per.join(' | '));
    L.push('');
    L.push('Uwaga: backtest nie modeluje ukrytych nakladek ("TradeNow", "DT mode" itp.), ktore w aplikacji obnizaja progi — testuje reguly PRO v2.');
    L.push('Rozdzielczosc 5 min: gdy stop i cel padaja w tej samej swiecy, zakladamy stop (ostroznie).');
    return L.join('\n');
  }

  global.BTX_BT = { run: run, compare: compare, recommend: recommend, format: format, VARIANTS: VARIANTS, cache: {} };

  if (typeof document === 'undefined') return; // testy w Node

  // ================= UI =================
  var overlay;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  async function start() {
    var out = overlay.querySelector('pre'), btn = overlay.querySelector('#btx-bt-run');
    var live = global.BTX_LIVE;
    if (!live || !live.getKey()) { out.textContent = 'Brak klucza Twelve Data (Ustawienia).'; return; }
    var size = +overlay.querySelector('#btx-bt-size').value;
    var syms = Array.prototype.filter.call(overlay.querySelectorAll('.btx-bt-sym'), function (x) { return x.checked; }).map(function (x) { return x.value; });
    if (!syms.length) { out.textContent = 'Zaznacz co najmniej jeden symbol.'; return; }
    btn.disabled = true;
    var rowSets = [], notes = [];
    for (var i = 0; i < syms.length; i++) {
      var sym = syms[i], meta = (global.SYMBOLS || []).filter(function (m) { return m.s === sym; })[0];
      var bars = global.BTX_BT.cache[sym + ':' + size];
      if (!bars) {
        out.textContent = 'Pobieranie ' + sym + ' (' + (i + 1) + '/' + syms.length + ') ...';
        try { bars = await live.fetchHistory(sym, size); global.BTX_BT.cache[sym + ':' + size] = bars; await sleep(8700); }
        catch (e) { notes.push(sym + ': ' + e.message); continue; }
      }
      var rt = 0.0008;
      try { if (typeof global.feeOf === 'function') { var f = global.feeOf(meta); rt = 2 * (f.comm + f.conv) + f.spr; } } catch (e2) {}
      rowSets.push({ meta: meta, bars: bars, roundTripPct: rt });
    }
    if (!rowSets.length) { out.textContent = 'Nie pobrano zadnych danych.\n' + notes.join('\n'); btn.disabled = false; return; }
    out.textContent = 'Liczenie ...';
    await sleep(30);
    var res = global.BTX_BT.compare(rowSets, { allowShort: !!(global.CFG && global.CFG.allowShort), slipPct: 0.0002 });
    var tot = rowSets.reduce(function (a, r) { return a + r.bars.length; }, 0);
    var first = Math.min.apply(null, rowSets.map(function (r) { return r.bars[0].t; })), lastT = Math.max.apply(null, rowSets.map(function (r) { return r.bars[r.bars.length - 1].t; }));
    var cov = 'Dane: ' + rowSets.length + ' symboli, ' + tot + ' swiec, ' + new Date(first).toISOString().slice(0, 10) + ' .. ' + new Date(lastT).toISOString().slice(0, 10) +
      (notes.length ? '\nPominiete: ' + notes.join('; ') : '');
    out.textContent = format(res, { coverage: cov });
    btn.disabled = false;
  }

  function open() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';
      var syms = (global.SYMBOLS || []).map(function (m) {
        return '<label style="margin-right:10px;white-space:nowrap"><input type="checkbox" class="btx-bt-sym" value="' + esc(m.s) + '"' + (m.mkt === 'US' || m.mkt === 'FX' ? ' checked' : '') + '> ' + esc(m.s) + '</label>';
      }).join('');
      overlay.innerHTML = '<div style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:14px;width:min(900px,96vw);max-height:90vh;display:flex;flex-direction:column;gap:10px;font:12px ui-monospace,Menlo,Consolas,monospace">' +
        '<div><b>Backtest na prawdziwych danych</b> — 1 zapytanie Twelve na symbol (limit dzienny!), ~9 s odstepu miedzy symbolami</div>' +
        '<div style="line-height:1.9">' + syms + '</div>' +
        '<div>Historia: <select id="btx-bt-size"><option value="2000">2000 swiec (~26 sesji)</option><option value="5000" selected>5000 swiec (~64 sesje)</option></select> ' +
        '<button id="btx-bt-run" style="cursor:pointer;padding:6px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font:inherit">Uruchom</button> ' +
        '<button id="btx-bt-close" style="cursor:pointer;padding:6px 12px;border:0;border-radius:8px;background:#334155;color:#fff;font:inherit">Zamknij</button></div>' +
        '<pre style="margin:0;white-space:pre;overflow:auto;flex:1;line-height:1.45;min-height:200px">Wybierz symbole i kliknij Uruchom.\nSymbole EU moga nie byc dostepne w Twoim planie Twelve Data.</pre></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.id === 'btx-bt-close') overlay.style.display = 'none';
        else if (e.target.id === 'btx-bt-run') start();
      });
    }
    overlay.style.display = 'flex';
  }

  function boot() {
    if (document.getElementById('btx-bt-btn')) return;
    var b = document.createElement('button');
    b.id = 'btx-bt-btn'; b.textContent = 'Backtest';
    b.style.cssText = 'position:fixed;right:78px;bottom:10px;z-index:9999;padding:6px 12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:600 12px ui-monospace,Menlo,Consolas,monospace;cursor:pointer';
    b.addEventListener('click', open);
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
