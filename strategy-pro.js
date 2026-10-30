/**
 * BTX DayTrader — STRATEGY PRO + partial TP + BE + news blackout
 */
(function (global) {
  var PRO = {
    riskPct: 0.5, maxPos: 2, dailyLossPct: 1.5, maxConsecLoss: 3, maxDayTrades: 4,
    atrSlMult: 2.0, tpR: 2.5, beR: 1.0, partialR: 1.5, partialFrac: 0.5,
    minStrengthOpen: 4, coolBars: 12, minHoldBars: 4, requireTrend: true, newsPadMin: 30,
    sessions: {
      US: { open: 14 * 60 + 30, close: 21 * 60, prime: [[14 * 60 + 35, 16 * 60], [19 * 60, 20 * 60 + 30]] },
      PL: { open: 8 * 60, close: 16 * 60 + 50, prime: [[8 * 60 + 5, 10 * 60], [14 * 60, 16 * 60]] },
      FX: { open: 0, close: 24 * 60 - 1, prime: [[7 * 60, 16 * 60], [13 * 60, 21 * 60]] }
    },
    newsWindows: [
      { label: 'US data 12:30', min: 12 * 60 + 30 },
      { label: 'US data 13:30', min: 13 * 60 + 30 },
      { label: 'US data 14:00', min: 14 * 60 },
      { label: 'FOMC/Fed 18:00', min: 18 * 60 },
      { label: 'FOMC/Fed 19:00', min: 19 * 60 },
      { label: 'EU/ECB 12:00', min: 12 * 60 },
      { label: 'EU/ECB 12:45', min: 12 * 60 + 45 }
    ]
  };
  function utcMin(d) { d = d || new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
  function weekday(d) { d = d || new Date(); var x = d.getUTCDay(); return x >= 1 && x <= 5; }
  function newsBlocked(d) {
    d = d || new Date();
    if (!weekday(d)) return { blocked: true, label: 'weekend' };
    var t = utcMin(d), pad = PRO.newsPadMin;
    for (var i = 0; i < PRO.newsWindows.length; i++) {
      var w = PRO.newsWindows[i];
      if (Math.abs(t - w.min) <= pad) return { blocked: true, label: w.label };
    }
    return { blocked: false, label: '' };
  }
  function marketOf(m) {
    if (!m) return 'US';
    if (m.mkt) return m.mkt;
    if (m.t === 'fx' || /USD|EUR|JPY|GBP|AUD|NZD/.test(m.s || '')) return 'FX';
    if (/\.WA$/.test(m.s || '') || m.t === 'pl') return 'PL';
    return 'US';
  }
  function inSession(mkt, d) {
    if (!weekday(d)) return false;
    var s = PRO.sessions[mkt] || PRO.sessions.US, t = utcMin(d);
    if (mkt === 'FX') return true;
    return t >= s.open && t < s.close;
  }
  function sessionQuality(mkt, d) {
    d = d || new Date();
    if (!weekday(d) || !inSession(mkt, d)) return 0;
    var t = utcMin(d), s = PRO.sessions[mkt] || PRO.sessions.US;
    if (mkt !== 'FX' && t >= s.close - 45) return 0;
    if (mkt !== 'FX' && t < s.open + 5) return 0.3;
    if (newsBlocked(d).blocked) return 0.15;
    var prime = s.prime || [];
    for (var i = 0; i < prime.length; i++) if (t >= prime[i][0] && t < prime[i][1]) return 1.0;
    if (mkt === 'FX') {
      if (t >= 13 * 60 && t < 16 * 60) return 1.0;
      if ((t >= 7 * 60 && t < 16 * 60) || (t >= 13 * 60 && t < 21 * 60)) return 0.85;
      return 0.4;
    }
    return 0.55;
  }
  function emaArr(cl, n) {
    if (!cl || cl.length < n) return null;
    var k = 2 / (n + 1), e = cl[0];
    for (var i = 1; i < cl.length; i++) e = cl[i] * k + e * (1 - k);
    return e;
  }
  function smaArr(cl, n) {
    if (!cl || cl.length < n) return null;
    var s = 0; for (var i = cl.length - n; i < cl.length; i++) s += cl[i]; return s / n;
  }
  function htfTrend(cl) {
    var e20 = emaArr(cl, 20), e50 = emaArr(cl, 50);
    if (e20 == null || e50 == null) return 0;
    var c = cl[cl.length - 1];
    if (c > e20 && e20 > e50) return 2;
    if (c > e50) return 1;
    if (c < e20 && e20 < e50) return -2;
    if (c < e50) return -1;
    return 0;
  }
  function pdZone(b) {
    var n = Math.min(40, b.length), hi = -Infinity, lo = Infinity;
    for (var i = b.length - n; i < b.length; i++) { if (b[i].h > hi) hi = b[i].h; if (b[i].l < lo) lo = b[i].l; }
    var c = b[b.length - 1].c, pos = hi === lo ? 0.5 : (c - lo) / (hi - lo);
    if (pos <= 0.35) return 'discount'; if (pos >= 0.65) return 'premium'; return 'mid';
  }
  function rangeExpansion(b) {
    if (b.length < 20) return 1;
    var last = b[b.length - 1], r = last.h - last.l, avg = 0, n = 0;
    for (var i = b.length - 16; i < b.length - 1; i++) { avg += (b[i].h - b[i].l); n++; }
    avg = n ? avg / n : r; return avg > 0 ? r / avg : 1;
  }
  function applyCfg() {
    if (!global.CFG) return;
    global.CFG.risk = PRO.riskPct; global.CFG.maxPos = PRO.maxPos; global.CFG.minHold = PRO.minHoldBars;
    global.CFG.dailyLossPct = PRO.dailyLossPct; global.CFG.maxConsecLoss = PRO.maxConsecLoss; global.CFG.maxDayTrades = PRO.maxDayTrades;
  }
  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__pro) return;
    global.openPos = function (g) {
      applyCfg();
      if (!g || g.side === 'WAIT') return;
      var nb = newsBlocked();
      if (nb.blocked && nb.label !== 'weekend') {
        if (typeof global.log === 'function') global.log('PRO: blokada news (' + nb.label + ')', 'mut');
        return;
      }
      if ((g.strength || 0) < PRO.minStrengthOpen) return;
      var ST = global.ST; if (!ST || ST.blocked) return;
      if (Object.keys(ST.pos || {}).length >= PRO.maxPos) return;
      if ((ST.dayTrades || 0) >= PRO.maxDayTrades) return;
      if ((ST.consecLoss || 0) >= PRO.maxConsecLoss) { ST.blocked = true; return; }
      if (ST.cool && ST.cool[g.sym] > 0) return;
      if (ST.dayStart && ST.equity < ST.dayStart * (1 - PRO.dailyLossPct / 100)) { ST.blocked = true; return; }
      var risk = ST.equity * (PRO.riskPct / 100);
      var sd = (g.atr || g.price * 0.004) * PRO.atrSlMult; if (sd <= 0) return;
      var q = Math.max(1, Math.floor(risk / sd)), cost = q * g.price;
      if (cost > ST.cash) { q = Math.floor(ST.cash / g.price); if (q < 1) return; cost = q * g.price; }
      var stop = g.side === 'LONG' ? g.price - sd : g.price + sd;
      var tgt = g.side === 'LONG' ? g.price + PRO.tpR * sd : g.price - PRO.tpR * sd;
      var partial = g.side === 'LONG' ? g.price + PRO.partialR * sd : g.price - PRO.partialR * sd;
      ST.dayTrades = (ST.dayTrades || 0) + 1;
      ST.pos[g.sym] = { sym: g.sym, side: g.side, qty: q, entry: g.price, stop: stop, target: tgt,
        partial: partial, partialDone: false, why: '[PRO] ' + g.why, bars: 0,
        risk0: Math.abs(g.price - stop), be: false, at: new Date().toLocaleTimeString('pl-PL') };
      ST.cash -= cost;
      if (typeof global.log === 'function') {
        var f = global.f2 || function (x) { return (+x).toFixed(2); };
        global.log('OTWARCIE ' + g.side + ' ' + g.sym + ' x' + q + ' @ ' + f(g.price) +
          ' | SL ' + f(stop) + ' | pTP ' + f(partial) + ' | TP ' + f(tgt) + ' — PRO ' + g.why, 'g');
      }
    };
    global.openPos.__pro = true;
  }
  function patchCoolOnClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__proCool) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      orig(sym, why, px);
      if (global.ST && global.ST.cool) global.ST.cool[sym] = PRO.coolBars;
    };
    global.closePos.__proCool = true;
  }
  function managePartialAndBE() {
    var ST = global.ST; if (!ST || !ST.pos) return;
    var f = global.f2 || function (x) { return (+x).toFixed(2); };
    for (var sym in ST.pos) {
      var p = ST.pos[sym];
      var bar = typeof global.last === 'function' ? global.last(sym) : null;
      if (!p || !bar) continue;
      var risk = p.risk0 || Math.abs(p.entry - p.stop) || 0; if (risk <= 0) continue;
      var mv = p.side === 'LONG' ? (bar.c - p.entry) : (p.entry - bar.c);
      var rNow = mv / risk;
      if (!p.be && rNow >= PRO.beR) {
        p.stop = p.entry; p.be = true;
        if (typeof global.log === 'function') global.log('BE @ 1R: ' + sym, 'g');
      }
      if (!p.partialDone && p.partial != null && p.qty >= 2) {
        var hit = p.side === 'LONG' ? (bar.h >= p.partial) : (bar.l <= p.partial);
        if (hit || rNow >= PRO.partialR) {
          var closeQty = Math.max(1, Math.floor(p.qty * PRO.partialFrac));
          if (closeQty >= p.qty) closeQty = p.qty - 1;
          if (closeQty >= 1) {
            var fill = p.partial;
            var pnl = (p.side === 'LONG' ? (fill - p.entry) : (p.entry - fill)) * closeQty;
            ST.cash += closeQty * fill; ST.equity += pnl; p.qty -= closeQty; p.partialDone = true;
            if (!p.be) { p.stop = p.entry; p.be = true; }
            if (ST.closed) ST.closed.unshift({ sym: sym, side: p.side, qty: closeQty, entry: p.entry, exit: fill, pnl: pnl, why: 'partial-1.5R', bars: p.bars });
            if (typeof global.log === 'function') global.log('PARTIAL ' + sym + ' x' + closeQty + ' @ ' + f(fill) + ' P&L ' + f(pnl), pnl >= 0 ? 'g' : 'r');
          }
        }
      }
    }
  }
  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__proPart) return;
    var orig = global.cycle;
    global.cycle = function () { var r = orig.apply(this, arguments); try { managePartialAndBE(); } catch (e) {} return r; };
    global.cycle.__proPart = true;
  }
  function patchEvaluate() {
    if (typeof global.evaluate !== 'function') return false;
    global.evaluate = function (m) {
      var ST = global.ST, b = ST && ST.series && ST.series[m.s];
      if (!b || b.length < 60) return null;
      var mkt = marketOf(m), sq = sessionQuality(mkt); if (sq < 0.35) sq = 0.35;
      var nb = newsBlocked();
      var cl = b.map(function (x) { return x.c; });
      var c = cl[cl.length - 1], s20 = smaArr(cl, 20);
      var r2 = typeof global.rsi === 'function' ? global.rsi(cl, 2) : 50;
      var r14 = typeof global.rsi === 'function' ? global.rsi(cl, 14) : 50;
      var a = typeof global.atr === 'function' ? global.atr(b, 14) : c * 0.004;
      var vw = typeof global.vwap === 'function' ? global.vwap(b) : null;
      var trend = htfTrend(cl), zone = pdZone(b), rx = rangeExpansion(b);
      var win = b.slice(-50);
      var hi = Math.max.apply(null, win.map(function (x) { return x.h; }));
      var lo = Math.min.apply(null, win.map(function (x) { return x.l; }));
      var g = { sym: m.s, name: m.n, type: m.t, mkt: mkt, price: c, rsi: r14, atr: a,
        trend: trend >= 1 ? 'UP' : trend <= -1 ? 'DN' : 'FLAT', side: 'WAIT', why: '', strength: 0 };
      var allowShort = (global.CFG && global.CFG.allowShort) || mkt === 'FX';
      var scoreL = 0, scoreS = 0, whyL = [], whyS = [];
      if (sq >= 0.9) { scoreL++; scoreS++; whyL.push('prime session'); whyS.push('prime session'); }
      else if (sq < 0.45) { scoreL--; scoreS--; }
      if (nb.blocked && nb.label !== 'weekend') { scoreL -= 2; scoreS -= 2; }
      if (trend >= 2) { scoreL += 3; whyL.push('HTF up'); } else if (trend >= 1) { scoreL++; whyL.push('HTF mild up'); }
      if (trend <= -2) { scoreS += 3; whyS.push('HTF down'); } else if (trend <= -1) { scoreS++; whyS.push('HTF mild down'); }
      if (zone === 'discount') { scoreL += 2; whyL.push('discount'); }
      if (zone === 'premium') { scoreS += 2; whyS.push('premium'); }
      if (trend >= 1 && r2 < 12 && s20 != null && c >= s20 * 0.997) { scoreL += 3; whyL.push('RSI(2) PB'); }
      if (trend <= -1 && r2 > 88 && s20 != null && c <= s20 * 1.003 && allowShort) { scoreS += 3; whyS.push('RSI(2) bounce'); }
      if (vw) {
        if (c >= vw && trend >= 1) { scoreL++; whyL.push('>VWAP'); }
        if (c <= vw && trend <= -1 && allowShort) { scoreS++; whyS.push('<VWAP'); }
      }
      if (s20 != null && a > 0) {
        var extHi = (c - hi) / a, extLo = (lo - c) / a;
        if (c > hi && c > s20 && trend >= 1 && extHi >= 0 && extHi <= 0.75 && sq >= 0.7) { scoreL += 2; whyL.push('ORB retest'); }
        if (c < lo && c < s20 && trend <= -1 && allowShort && extLo >= 0 && extLo <= 0.75 && sq >= 0.7) { scoreS += 2; whyS.push('ORB retest'); }
        if (extHi > 1.15) scoreL -= 2; if (extLo > 1.15) scoreS -= 2;
      }
      if (rx > 2.2) { scoreL--; scoreS--; }
      if (mkt === 'FX') { if (trend < 2) scoreL--; if (trend > -2) scoreS--; }
      if (mkt !== 'FX' && !allowShort) scoreS = 0;
      if (r14 > 72) scoreL--; if (r14 < 28) scoreS--;
      if (scoreL >= 6 && scoreL > scoreS) { g.side = 'LONG'; g.strength = Math.min(5, Math.max(1, Math.round(scoreL / 2))); g.why = whyL.slice(0, 4).join(' · '); }
      else if (scoreS >= 6 && scoreS > scoreL && allowShort) { g.side = 'SHORT'; g.strength = Math.min(5, Math.max(1, Math.round(scoreS / 2))); g.why = whyS.slice(0, 4).join(' · '); }
      else { g.side = 'WAIT'; g.strength = 0; g.why = 'brak konfluencji (L' + scoreL + '/S' + scoreS + ')'; }
      if (PRO.requireTrend) {
        if (g.side === 'LONG' && trend < 1) { g.side = 'WAIT'; g.strength = 0; g.why = 'veto: brak HTF up'; }
        if (g.side === 'SHORT' && trend > -1) { g.side = 'WAIT'; g.strength = 0; g.why = 'veto: brak HTF down'; }
      }
      if (nb.blocked && nb.label !== 'weekend') { g.side = 'WAIT'; g.strength = 0; g.why = 'news blackout: ' + nb.label; }
      if (weekday() && mkt !== 'FX') {
        var sdef = PRO.sessions[mkt], t = utcMin();
        if (sdef && t >= sdef.close - 45 && t < sdef.close) { g.side = 'WAIT'; g.strength = 0; g.why = 'ostatnie 45 min sesji'; }
      }
      g.atr = a; g._pro = { scoreL: scoreL, scoreS: scoreS, trend: trend, zone: zone, sessionQ: sq, mkt: mkt, news: nb };
      return g;
    };
    global.evaluate.__pro = true; return true;
  }
  function boot() {
    applyCfg();
    var n = 0, t = setInterval(function () {
      n++; applyCfg(); patchEvaluate(); patchOpenPos(); patchCoolOnClose(); patchCycle();
      if (n > 60) clearInterval(t);
    }, 400);
    try {
      var el = document.getElementById('limit-badge');
      if (el) { el.textContent = 'PRO+BE+pTP'; el.title = 'PRO: partial 50%@1.5R, BE@1R, news ±30m'; }
    } catch (e) {}
  }
  global.BTX_PRO = PRO; global.BTX_newsBlocked = newsBlocked;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
