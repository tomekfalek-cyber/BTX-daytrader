/**
 * Shorty "w cieniu" — sprawdzian trafnosci bez ryzyka.
 * Bot handluje tylko LONG. Ten modul po cichu zapisuje, jakie SHORTY dalyby te same reguly (te same bramki sesji,
 * swiezych cen, newsow, filtra SPY), i rozlicza je na kolejnych swiecach: stop / cel / time-stop / flat sesji.
 * Po >= 30 rozliczonych widzisz, czy short ma przewage (win rate, E[R], PF) — dopiero wtedy ma sens je wlaczac (CFD).
 * Uproszczenia: bez BE i wyjscia czesciowego; koszt = spread+prowizja (bez konwersji walut, bo short = CFD).
 */
(function (global) {
  'use strict';
  var LS = 'btx_shadow_v1', MAX_OPEN = 3, KEEP = 400;

  // ---- czysta funkcja: rozlicza jeden "cien" na swiecach po sygnale ----
  // sh: { sigT, sd, entry?, bars? }, bars: swiece chronologicznie. Zwraca { done, R?, why?, exitT? } i uzupelnia sh.
  function advance(sh, bars, P, T, sessions, rt, slip) {
    slip = slip == null ? 0.0002 : slip;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      if (b.t <= sh.sigT) continue;
      if (sh.entry == null) {                                   // wejscie na otwarciu pierwszej swiecy po sygnale
        if (b.t - sh.sigT > 600000) return { done: true, void: true, why: 'luka w danych' };
        sh.entry = b.o * (1 - slip); sh.stop = sh.entry + sh.sd; sh.target = sh.entry - P.tpR * sh.sd; sh.bars = 0;
      }
      sh.bars++;
      var exit = null, why = '';
      if (b.h >= sh.stop) { exit = Math.max(sh.stop, b.o); why = 'stop'; }
      else if (b.l <= sh.target) { exit = sh.target; why = 'cel'; }
      else {
        var sd = sessions;
        if (T.pseudoUtcMin(b.t + 300000) >= sd.close - P.flatBeforeCloseMin) { exit = b.c; why = 'flat sesji'; }
        else if (sh.bars >= P.timeStopBars) { exit = b.c; why = 'time-stop'; }
      }
      if (exit != null) {
        exit = exit * (1 + slip);
        var R = (sh.entry - exit) / sh.sd - sh.entry * rt / sh.sd;
        return { done: true, R: R, why: why, exitT: b.t, exit: exit };
      }
    }
    return { done: false };
  }

  function summary(done) {
    var S = global.BTX_STATS;
    if (!S) return null;
    var tr = (done || []).filter(function (d) { return d.R != null; }).map(function (d) { return { sym: d.sym, side: 'SHORT', pnl: d.R, R: d.R, t: d.exitT }; });
    var st = S.computeStats(tr), verdict;
    if (st.n < 30) verdict = 'za malo danych (' + st.n + '/30) — nie wlaczaj shortow';
    else if (st.expectancy > 0.1 && (st.profitFactor == null || st.profitFactor > 1.2)) verdict = 'przewaga widoczna — mozna rozwazyc shorty na CFD (male ryzyko, sprawdz ponownie za tydzien)';
    else verdict = 'brak przewagi — NIE wlaczaj shortow';
    return { n: st.n, winRate: st.winRate, expectancy: st.expectancy, pf: st.profitFactor, verdict: verdict };
  }

  global.BTX_SHADOW_CORE = { advance: advance, summary: summary };
  if (typeof document === 'undefined') return;

  function load() { try { var o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && o.open && o.done) return o; } catch (e) {} return { open: {}, done: [], lastSig: {} }; }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  var state = load();

  function tick() {
    var C = global.BTX_STRATEGY_CORE, P = global.BTX_STRATEGY_PRO, T = global.BTX_TIME, ST = global.ST;
    if (!C || !P || !T || !ST || !ST.series) return;
    if (P.allowShort) return;   // shorty sa handlowane naprawde - cien niepotrzebny
    var now = Date.now(), list = global.SYMBOLS || [], live = global.BTX_LIVE;
    // 1) rozlicz otwarte
    Object.keys(state.open).forEach(function (sym) {
      var m = C.symMeta(sym) || { s: sym }, mk = C.marketOf(m), b = ST.series[sym];
      if (!b) return;
      var rt = 0.0003;
      try { if (typeof global.feeOf === 'function') { var f = global.feeOf(m); rt = f.spr + 2 * f.comm; } } catch (e) {}
      var r = advance(state.open[sym], b, P, T, P.sessions[mk] || P.sessions.US, rt, 0.0002);
      if (r.done) {
        if (!r.void) { state.done.push({ sym: sym, sigT: state.open[sym].sigT, R: r.R, why: r.why, exitT: r.exitT }); if (state.done.length > KEEP) state.done.shift(); }
        delete state.open[sym];
      }
    });
    // 2) nowe sygnaly SHORT (bez handlu)
    if (Object.keys(state.open).length < MAX_OPEN) {
      list.forEach(function (m) {
        if (state.open[m.s] || Object.keys(state.open).length >= MAX_OPEN) return;
        var b = ST.series[m.s], mk = C.marketOf(m);
        if (!b || b.length < 60 || !C.inSession(mk, now) || C.sessionQuality(mk, now) === 0) return;
        if (live && live.isFresh && !live.isFresh(m.s)) return;
        var lastBar = b[b.length - 1];
        if (state.lastSig[m.s] && lastBar.t - state.lastSig[m.s] < 6 * 300000) return;   // cooldown 6 swiec
        var o = C.liveOpts(m); o.allowShort = true;
        var g = C.evalCore(m, b, now, o);
        if (g && g.side === 'SHORT' && (g.strength || 0) >= P.minStrengthOpen && g._pro && g._pro.scoreS >= g._pro.need && !g._pro.veto) {
          state.open[m.s] = { sigT: lastBar.t, sd: g.sd, score: g._pro.scoreS };
          state.lastSig[m.s] = lastBar.t;
        }
      });
    }
    save(state);
  }

  global.BTX_SHADOW = { summary: function () { return summary(state.done); }, open: function () { return Object.keys(state.open); }, state: function () { return state; } };
  setInterval(tick, 30000);
  setTimeout(tick, 15000);
})(typeof window !== 'undefined' ? window : globalThis);
