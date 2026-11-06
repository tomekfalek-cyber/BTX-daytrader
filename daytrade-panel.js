/**
 * Panel "Plan" — precyzyjne informacje daytradingowe w jednym miejscu (przycisk "Plan", prawy dolny rog).
 *  - faza sesji dla US/EU/FX, ceny LIVE, budzet API, dzienne limity, wynik dnia w R
 *  - otwarte pozycje: R teraz, odleglosc do SL/TP, BE/czesciowe, liczba swiec, godzina flat
 *  - gotowe setupy z pelna karta (wejscie, SL, TP, rozmiar, ryzyko, R:R netto po kosztach, powody)
 *  - dla pozostalych: dokladny powod, dlaczego bot NIE wchodzi
 * Korzysta z tych samych funkcji co bot (evalCore + gateCheck), wiec to, co widzisz, jest tym, co bot zrobi.
 */
(function (global) {
  'use strict';
  if (typeof document === 'undefined') return;
  var DAYS = ['nd', 'pn', 'wt', 'sr', 'cz', 'pt', 'sb'];
  var box, pre, timer;

  function p2(n) { return ('0' + n).slice(-2); }
  function f2(x, d) { return (x == null || !isFinite(x)) ? '—' : Number(x).toFixed(d == null ? 2 : d); }
  function sgn(x, d) { return (x >= 0 ? '+' : '') + f2(x, d); }
  function arrow(t) { return t >= 2 ? '↑↑' : t === 1 ? '↑' : t <= -2 ? '↓↓' : t === -1 ? '↓' : '→'; }
  function core() { return global.BTX_STRATEGY_CORE; }
  function pro() { return global.BTX_STRATEGY_PRO; }

  function phase(mk, ts) {
    var C = core(), P = pro(), T = global.BTX_TIME, s = P.sessions[mk] || P.sessions.US;
    if (!T.isWeekday(ts)) return 'zamkniete (weekend)';
    var t = T.pseudoUtcMin(ts);
    if (t < s.open) return 'przed sesja (start ' + T.hhmmPL(s.open) + ')';
    if (t >= s.close) return 'po sesji';
    if (t < s.open + 5) return 'otwarcie — 5 min bez wejsc';
    if (t >= s.close - P.flatBeforeCloseMin) return 'FLAT teraz (koniec sesji)';
    if (t >= s.close - P.closeBufferMin) return 'tylko zarzadzanie (flat o ' + T.hhmmPL(s.close - P.flatBeforeCloseMin) + ')';
    var nb = C.newsBlocked(ts);
    if (nb.blocked) return 'blackout: ' + nb.label;
    return C.sessionQuality(mk, ts) >= 0.9 ? 'PRIME (wymagany score ' + P.scoreMin + ')' : 'spokojny (wymagany score ' + (P.scoreMin + P.primeExtra) + ')';
  }

  function lastPx(sym) {
    try { if (typeof global.last === 'function' && global.last(sym)) return global.last(sym).c; } catch (e) {}
    var b = global.ST && global.ST.series && global.ST.series[sym];
    return b && b.length ? b[b.length - 1].c : null;
  }

  function dayStats() {
    var ST = global.ST || {}, T = global.BTX_TIME, day = T.local(Date.now()).day, n = 0, w = 0, l = 0, R = 0, pnl = 0;
    (ST.closed || []).forEach(function (t) {
      if (!t.t || T.local(t.t).day !== day) return;
      if (t.why === 'partial-1R') { if (t.R != null) R += t.R; pnl += t.pnl; return; }
      n++; pnl += t.pnl; if (t.R != null) R += t.R;
      if (t.pnl > 0) w++; else if (t.pnl < 0) l++;
    });
    return { n: n, w: w, l: l, R: R, pnl: pnl };
  }

  function build() {
    var C = core(), P = pro(), T = global.BTX_TIME, ST = global.ST;
    if (!C || !P || !ST) return 'Ladowanie modulow...';
    var ts = Date.now(), loc = T.local(ts), L = [];
    L.push('=== BTX PLAN · ' + DAYS[loc.dow] + ' ' + p2(Math.floor(loc.min / 60)) + ':' + p2(loc.min % 60) + ' PL ===');
    ['US', 'EU', 'FX'].forEach(function (mk) { L.push(mk + ': ' + phase(mk, ts)); });
    var syms = global.SYMBOLS || [], live = global.BTX_LIVE, fresh = 0;
    syms.forEach(function (m) { if (live && live.isFresh(m.s)) fresh++; });
    var ds = dayStats(), auto = global.BTX_AUTONOMY && global.BTX_AUTONOMY.isOn ? global.BTX_AUTONOMY.isOn() : null;
    L.push('');
    L.push('Ceny LIVE: ' + fresh + '/' + syms.length + (live ? ' · API ' + live.budget().n + '/780' : '') + (auto == null ? '' : ' · autonomia: ' + (auto ? 'ON' : 'OFF (wlacz na Pulpicie)')));
    L.push('Dzis: ' + (ST.dayTrades || 0) + '/' + P.maxDayTrades + ' transakcji · seria strat ' + (ST.consecLoss || 0) + '/' + P.maxConsecLoss +
      ' · wynik ' + sgn(ds.R) + 'R (' + sgn(ds.pnl) + ') · W' + ds.w + '/L' + ds.l + ' · pozycje ' + Object.keys(ST.pos || {}).length + '/' + P.maxPos);

    // --- otwarte pozycje ---
    var keys = Object.keys(ST.pos || {});
    L.push(''); L.push('--- OTWARTE POZYCJE ---');
    if (!keys.length) L.push('(brak)');
    keys.forEach(function (k) {
      var p = ST.pos[k], px = lastPx(k), r0 = p.risk0 || Math.abs(p.entry - p.stop) || 1, s = p.side === 'LONG' ? 1 : -1;
      var rNow = px != null ? s * (px - p.entry) / r0 : null, m = C.symMeta(k) || { s: k }, sdef = P.sessions[C.marketOf(m)] || P.sessions.US;
      L.push(k + ' ' + p.side + ' x' + p.qty + ' @ ' + f2(p.entry) + ' | teraz ' + f2(px) + ' (' + (rNow == null ? '—' : sgn(rNow) + 'R') +
        (px != null ? ', ' + sgn(s * (px - p.entry) * p.qty * (p.rate || 1)) + ' brutto' : '') + ')');
      L.push('  SL ' + f2(p.stop) + (p.be ? ' [BE]' : '') + (px != null ? ' (' + f2(Math.abs(px - p.stop) / r0) + 'R od ceny)' : '') +
        ' · TP ' + f2(p.target) + (px != null ? ' (' + f2(Math.abs(p.target - px) / r0) + 'R do celu)' : '') +
        ' · czesciowe: ' + (p.partialDone ? 'zrobione' : '@ ' + f2(p.partial)) + ' · swiece ' + (p.bars || 0) + '/' + ((global.CFG && global.CFG.timeStop) || P.timeStopBars) +
        ' · flat ' + T.hhmmPL(sdef.close - P.flatBeforeCloseMin));
    });

    // --- setupy ---
    var ready = [], wait = [];
    syms.forEach(function (m) {
      var b = ST.series && ST.series[m.s], g = null;
      try { g = C.evalCore(m, b, ts, C.liveOpts(m)); } catch (e) {}
      if (!g) { wait.push({ m: m, txt: 'za malo danych' }); return; }
      var pr = g._pro || {}, fr = live ? live.status(m) : { ok: true };
      if (g.side !== 'WAIT') {
        var gc = C.gateCheck(g, m, ST, ts);
        ready.push({ m: m, g: g, gc: gc });
      } else {
        wait.push({ m: m, g: g, fr: fr });
      }
    });
    L.push(''); L.push('--- SETUPY ---');
    if (!ready.length) L.push('Brak setupu spelniajacego wszystkie warunki rdzenia.');
    ready.sort(function (a, b) { return (b.gc.ok ? 1 : 0) - (a.gc.ok ? 1 : 0) || (b.g.strength - a.g.strength); });
    ready.forEach(function (r) {
      var g = r.g, pr = g._pro, sp = r.gc.sp, long = g.side === 'LONG', sd = (sp && sp.sd) || g.sd;
      var stop = long ? g.price - sd : g.price + sd, tp = long ? g.price + P.tpR * sd : g.price - P.tpR * sd, p1 = long ? g.price + P.partialR * sd : g.price - P.partialR * sd;
      L.push((r.gc.ok ? '>> ' : '-- ') + g.side + ' ' + g.sym + ' @ ' + f2(g.price) + '  [score ' + (long ? pr.scoreL : pr.scoreS) + '/' + pr.need + ', sila ' + g.strength + ']');
      L.push('   SL ' + f2(stop) + ' (' + f2(sd / g.atr) + ' ATR) · czesciowe ' + f2(p1) + ' · TP ' + f2(tp) +
        (sp && sp.qty ? ' · rozmiar ' + sp.qty + ' · ryzyko ' + f2(sp.riskAmt) + ' (' + f2(sp.riskAmt / ST.equity * 100) + '%) · R:R netto ' + f2(sp.netRR) + ' · koszt wejscia ' + f2(sp.feeIn) : ''));
      L.push('   HTF 15m ' + arrow(pr.t15) + ' 60m ' + arrow(pr.t60) + (pr.marketTrend != null ? ' · SPY 15m ' + arrow(pr.marketTrend) : '') +
        (pr.rvol != null ? ' · RVOL ' + f2(pr.rvol) : '') + ' · VWAP ' + f2(pr.vwap) + ' · ' + g.why);
      L.push('   ' + (r.gc.ok ? 'BRAMKA: GOTOWE — bot wejdzie przy najblizszym cyklu (autonomia ON)' : 'BRAMKA: ZABLOKOWANE — ' + r.gc.reason));
    });

    // --- bez wejscia ---
    L.push(''); L.push('--- BEZ WEJSCIA (dlaczego) ---');
    wait.forEach(function (w) {
      if (!w.g) { L.push(w.m.s + ': ' + w.txt); return; }
      var pr = w.g._pro || {}, why = w.g.why;
      if (w.fr && !w.fr.ok) why = 'BRAK ceny LIVE: ' + w.fr.why;
      L.push(w.m.s + '  L' + pr.scoreL + '/S' + pr.scoreS + ' (wym. ' + pr.need + ') 15m' + arrow(pr.t15) + ' → ' + why);
    });
    L.push('');
    L.push('Plan to podglad decyzji bota, nie rekomendacja inwestycyjna. Przewage sprawdz przyciskiem Backtest.');
    return L.join('\n');
  }

  function refresh() { if (box.style.display !== 'none') pre.textContent = build(); }

  function toggle() {
    if (!box) {
      box = document.createElement('div');
      box.id = 'btx-plan';
      box.style.cssText = 'position:fixed;right:10px;top:10px;z-index:9998;width:min(560px,96vw);max-height:88vh;overflow:auto;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:10px 12px;display:none;box-shadow:0 8px 30px rgba(0,0,0,.5)';
      pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums';
      var x = document.createElement('button');
      x.textContent = '×'; x.title = 'Zamknij';
      x.style.cssText = 'position:sticky;float:right;top:0;cursor:pointer;border:0;border-radius:6px;background:#334155;color:#fff;font:16px/1 sans-serif;padding:2px 8px';
      x.addEventListener('click', function () { box.style.display = 'none'; });
      box.appendChild(x); box.appendChild(pre); document.body.appendChild(box);
      timer = setInterval(refresh, 3000);
    }
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    refresh();
  }

  function boot() {
    if (document.getElementById('btx-plan-btn')) return;
    var b = document.createElement('button');
    b.id = 'btx-plan-btn'; b.textContent = 'Plan';
    b.style.cssText = 'position:fixed;right:158px;bottom:10px;z-index:9999;padding:6px 12px;border-radius:10px;border:1px solid #334155;background:#1e3a8a;color:#e2e8f0;font:600 12px ui-monospace,Menlo,Consolas,monospace;cursor:pointer';
    b.addEventListener('click', toggle);
    document.body.appendChild(b);
  }
  global.BTX_PLAN = { build: build };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
