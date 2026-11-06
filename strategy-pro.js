/**
 * BTX DayTrader — STRATEGY PRO v2 (daytrading)
 *
 * Zmiany wzgledem v1:
 *  - czas: sesje i okna newsow wg czasu warszawskiego (DST-safe, reguly UE), nie "UTC na sztywno"
 *  - HTF = prawdziwy wyzszy interwal (15 min + potwierdzenie 60 min), nie EMA na tych samych swiecach
 *  - VWAP i zakres otwarcia (ORB, pierwsze 30 min) liczone od poczatku biezacej SESJI
 *  - ATR nie liczy luki overnight jako zakresu pierwszej swiecy sesji
 *  - openPos: koszty (prowizja, spread, kurs walut) z modelu aplikacji, filtr netto R:R, prawidlowa
 *    ksiegowosc marginu, straznik korelacji (1 pozycja na grupe i kierunek), brak wejsc poza sesja
 *  - czesciowe zamkniecie ksieguje margines i koszty proporcjonalnie (wczesniej podwajalo kapital)
 *  - evalCore(m, bary, czas) jest czysta funkcja -> uzywana tez przez backtest na prawdziwych danych
 */
(function (global) {
  var PRO = {
    riskPct: 0.5, maxPos: 2, dailyLossPct: 1.5, maxConsecLoss: 3, maxDayTrades: 6,
    atrSlMult: 1.2, tpR: 1.6, beR: 0.8, partialR: 1.0, partialFrac: 0.5,
    minStrengthOpen: 3, coolBars: 4, minHoldBars: 2, requireTrend: false, newsPadMin: 10,
    scoreMin: 4, minNetRR: 1.15, orBars: 6, timeStopBars: 24, closeBufferMin: 45, flatBeforeCloseMin: 10,
    // Warunki daytradingowe (precyzja > liczba transakcji)
    strictCore: true,       // otwieraj tylko, gdy RDZEN strategii daje score >= prog (nakladki "TradeNow"/"DT mode" nie obnizaja progu)
    primeExtra: 1,          // poza oknami prime wymagany score o tyle wyzszy
    minRvol: 0.6,           // min. wzgledny wolumen (ostatnie 3 swiece vs 20 wczesniejszych) dla akcji/ETF
    marketFilter: true,     // akcje USA: kierunek zgodny z trendem 15m SPY
    stopSwingBars: 8, stopMinAtr: 0.9, stopMaxAtr: 1.6, // stop za ostatnim swingiem, ale w widelkach ATR
    // Sesje w "czasie zimowym UTC" (= czas warszawski - 60 min), dzieki temu stale sa poprawne przez caly rok.
    sessions: {
      US: { open: 14 * 60 + 30, close: 21 * 60, prime: [[14 * 60 + 35, 16 * 60], [19 * 60, 20 * 60 + 30]] },
      PL: { open: 8 * 60, close: 16 * 60 + 50, prime: [[8 * 60 + 5, 10 * 60], [14 * 60, 16 * 60]] },
      EU: { open: 8 * 60, close: 16 * 60 + 30, prime: [[8 * 60 + 5, 10 * 60], [14 * 60, 16 * 60]] },
      // FX/zloto: handel dzienny tylko 08:00-21:00 PL (Londyn + NY), reszta = azjatycki szum i niska plynnosc
      FX: { open: 7 * 60, close: 20 * 60, prime: [[7 * 60, 16 * 60], [13 * 60, 19 * 60]] }
    },
    // Okna newsow (te same godziny w czasie polskim przez caly rok: dane USA 8:30 ET = 14:30 PL itd.)
    newsWindows: [
      { label: 'US dane 14:30 PL', min: 13 * 60 + 30 },
      { label: 'US dane 16:00 PL', min: 15 * 60 },
      { label: 'FOMC 20:00 PL', min: 19 * 60 },
      { label: 'ECB decyzja 14:15 PL', min: 13 * 60 + 15 },
      { label: 'ECB konferencja 14:45 PL', min: 13 * 60 + 45 }
    ]
  };
  // poczatek sesji w minutach czasu polskiego (kotwica VWAP / zakresu otwarcia)
  var SESS_START = { US: 15 * 60 + 30, EU: 9 * 60, PL: 9 * 60, FX: 8 * 60 };

  // ================= CZAS (Europa/Warszawa, bez Intl = szybko i testowalnie) =================
  function lastSunday(y, mo) { var d = new Date(Date.UTC(y, mo + 1, 0)); return d.getUTCDate() - d.getUTCDay(); }
  function warsawOffsetMin(ts) { // czas letni UE: ost. niedz. marca 01:00 UTC .. ost. niedz. pazdziernika 01:00 UTC
    var y = new Date(ts).getUTCFullYear();
    var s = Date.UTC(y, 2, lastSunday(y, 2), 1), e = Date.UTC(y, 9, lastSunday(y, 9), 1);
    return ts >= s && ts < e ? 120 : 60;
  }
  function toTs(d) { return d == null ? Date.now() : (d instanceof Date ? d.getTime() : +d); }
  function local(ts) {
    var l = ts + warsawOffsetMin(ts) * 60000;
    return { day: Math.floor(l / 86400000), min: Math.floor((l % 86400000) / 60000), dow: new Date(l).getUTCDay() };
  }
  function utcMin(d) { return (local(toTs(d)).min - 60 + 1440) % 1440; } // "UTC zimowy"
  function weekday(d) { var x = local(toTs(d)).dow; return x >= 1 && x <= 5; }

  function newsBlocked(d) {
    var ts = toTs(d);
    if (!weekday(ts)) return { blocked: true, label: 'weekend' };
    var t = utcMin(ts), pad = PRO.newsPadMin;
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
    if (/ASML|SAP|SIE/.test(m.s || '')) return 'EU';
    return 'US';
  }
  function inSession(mkt, d) {
    var ts = toTs(d);
    if (!weekday(ts)) return false;
    var s = PRO.sessions[mkt] || PRO.sessions.US, t = utcMin(ts);
    return t >= s.open && t < s.close;
  }
  function sessionQuality(mkt, d) {
    var ts = toTs(d);
    if (!weekday(ts) || !inSession(mkt, ts)) return 0;
    var t = utcMin(ts), s = PRO.sessions[mkt] || PRO.sessions.US;
    if (t >= s.close - PRO.closeBufferMin) return 0;
    if (t < s.open + 5) return 0.3;
    if (newsBlocked(ts).blocked) return 0.15;
    var prime = s.prime || [];
    for (var i = 0; i < prime.length; i++) if (t >= prime[i][0] && t < prime[i][1]) return 1.0;
    return mkt === 'FX' ? 0.85 : 0.55;
  }

  // ================= WSKAZNIKI =================
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
  function rsiCalc(cl, n) { // Wilder
    if (!cl || cl.length < n + 1) return 50;
    var g = 0, l = 0, i, d;
    for (i = 1; i <= n; i++) { d = cl[i] - cl[i - 1]; if (d >= 0) g += d; else l -= d; }
    g /= n; l /= n;
    for (i = n + 1; i < cl.length; i++) {
      d = cl[i] - cl[i - 1];
      g = (g * (n - 1) + (d > 0 ? d : 0)) / n;
      l = (l * (n - 1) + (d < 0 ? -d : 0)) / n;
    }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  function sessIdOf(t, startMin) { var l = local(t); return l.min >= startMin ? l.day : l.day - 1; }
  function sessionSlice(b, mkt) { // swiece biezacej sesji
    var sm = SESS_START[mkt] != null ? SESS_START[mkt] : SESS_START.US, n = b.length;
    var id = sessIdOf(b[n - 1].t, sm), i = n - 1;
    while (i > 0 && sessIdOf(b[i - 1].t, sm) === id) i--;
    return b.slice(i);
  }
  function atrCalc(b, n, mkt) { // luka overnight nie liczy sie do TR pierwszej swiecy sesji
    var sm = SESS_START[mkt] != null ? SESS_START[mkt] : SESS_START.US;
    if (b.length < 2) return 0;
    var from = Math.max(1, b.length - n), s = 0, k = 0;
    for (var i = from; i < b.length; i++) {
      var x = b[i], pc = b[i - 1].c, tr = x.h - x.l;
      if (sessIdOf(x.t, sm) === sessIdOf(b[i - 1].t, sm)) tr = Math.max(tr, Math.abs(x.h - pc), Math.abs(x.l - pc));
      s += tr; k++;
    }
    return k ? s / k : 0;
  }
  function anchoredVwap(sess) {
    if (!sess || sess.length < 6) return null;
    var pv = 0, v = 0, ps = 0, i;
    for (i = 0; i < sess.length; i++) {
      var tp = (sess[i].h + sess[i].l + sess[i].c) / 3, vol = sess[i].v || 0;
      pv += tp * vol; v += vol; ps += tp;
    }
    return v > 0 ? pv / v : ps / sess.length;
  }
  function openingRange(sess) {
    if (!sess || sess.length < PRO.orBars + 1) return null;
    var hi = -Infinity, lo = Infinity;
    for (var i = 0; i < PRO.orBars; i++) { if (sess[i].h > hi) hi = sess[i].h; if (sess[i].l < lo) lo = sess[i].l; }
    return { hi: hi, lo: lo };
  }
  function aggregate(b, ms) { // swiece 5m -> wyzszy interwal; ostatnia niepelna odrzucona
    var out = [], cur = null, k = null;
    for (var i = 0; i < b.length; i++) {
      var x = b[i], key = Math.floor(x.t / ms);
      if (key !== k) {
        if (cur) out.push(cur);
        k = key; cur = { t: key * ms, o: x.o, h: x.h, l: x.l, c: x.c, last: x.t };
      } else { if (x.h > cur.h) cur.h = x.h; if (x.l < cur.l) cur.l = x.l; cur.c = x.c; cur.last = x.t; }
    }
    if (cur && cur.last + 300000 >= cur.t + ms) out.push(cur);
    return out;
  }
  function trendOf(cl) { // 2 / 1 / 0 / -1 / -2
    var e9 = emaArr(cl, 9), e21 = emaArr(cl, 21);
    if (e9 == null || e21 == null) return 0;
    var c = cl[cl.length - 1];
    if (c > e9 && e9 > e21) return 2;
    if (c > e21) return 1;
    if (c < e9 && e9 < e21) return -2;
    if (c < e21) return -1;
    return 0;
  }
  function htfTrend(b) { // 15 min + potwierdzenie 60 min
    var a15 = aggregate(b, 15 * 60000).map(function (x) { return x.c; });
    var a60 = aggregate(b, 60 * 60000).map(function (x) { return x.c; });
    var t15 = trendOf(a15), t60 = trendOf(a60), tr = t15;
    if (t60 !== 0 && tr !== 0 && (t60 > 0) !== (tr > 0)) tr = tr > 0 ? tr - 1 : tr + 1; // 60 min przeciwne -> oslab
    return { trend: tr, t15: t15, t60: t60 };
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

  // wzgledny wolumen: srednia z 3 ostatnich swiec / srednia z 20 poprzednich (null = brak danych, np. FX)
  function rvolOf(b) {
    var n = b.length;
    if (n < 24) return null;
    var s3 = 0, s20 = 0, i;
    for (i = n - 3; i < n; i++) s3 += b[i].v || 0;
    for (i = n - 23; i < n - 3; i++) s20 += b[i].v || 0;
    if (s20 <= 0) return null;
    return (s3 / 3) / (s20 / 20);
  }
  // stop za ostatnim swingiem (struktura), ale w widelkach [stopMinAtr, stopMaxAtr] * ATR
  function swingStopDist(b, side, a) {
    var n = Math.min(PRO.stopSwingBars, b.length), c = b[b.length - 1].c, ext = side === 'LONG' ? Infinity : -Infinity;
    for (var i = b.length - n; i < b.length; i++) {
      if (side === 'LONG') { if (b[i].l < ext) ext = b[i].l; } else if (b[i].h > ext) ext = b[i].h;
    }
    var d = (side === 'LONG' ? c - ext : ext - c) + 0.1 * a;
    return Math.min(PRO.stopMaxAtr * a, Math.max(PRO.stopMinAtr * a, d));
  }

  // ================= SYGNAL (czysta funkcja) =================
  function evalCore(m, b, ts, opts) {
    opts = opts || {};
    if (!b || b.length < 40) return null;
    ts = ts == null ? Date.now() : ts;
    var mkt = marketOf(m);
    var sq = sessionQuality(mkt, ts); if (sq < 0.35) sq = 0.35;
    var need = PRO.scoreMin + (sq >= 0.9 ? 0 : PRO.primeExtra);
    var nb = newsBlocked(ts);
    var cl = b.map(function (x) { return x.c; });
    var c = cl[cl.length - 1], s20 = smaArr(cl, 20);
    var r2 = rsiCalc(cl, 2), r14 = rsiCalc(cl, 14);
    var a = atrCalc(b, 14, mkt) || c * 0.004;
    var sess = sessionSlice(b, mkt);
    var vw = anchoredVwap(sess), orr = openingRange(sess);
    var ht = htfTrend(b), trend = ht.trend, zone = pdZone(b), rx = rangeExpansion(b);
    var g = { sym: m.s, name: m.n, type: m.t, mkt: mkt, price: c, rsi: r14, atr: a,
      trend: trend >= 1 ? 'UP' : trend <= -1 ? 'DN' : 'FLAT', side: 'WAIT', why: '', strength: 0 };
    var allowShort = !!opts.allowShort || mkt === 'FX' || mkt === 'EU';
    var scoreL = 0, scoreS = 0, whyL = [], whyS = [];
    if (sq >= 0.9) { scoreL++; scoreS++; whyL.push('prime session'); whyS.push('prime session'); }
    else if (sq < 0.45) { scoreL--; scoreS--; }
    if (nb.blocked && nb.label !== 'weekend') { scoreL -= 2; scoreS -= 2; }
    if (trend >= 2) { scoreL += 3; whyL.push('HTF 15m up'); } else if (trend >= 1) { scoreL++; whyL.push('HTF mild up'); }
    if (trend <= -2) { scoreS += 3; whyS.push('HTF 15m down'); } else if (trend <= -1) { scoreS++; whyS.push('HTF mild down'); }
    if (zone === 'discount') { scoreL += 2; whyL.push('discount'); }
    if (zone === 'premium') { scoreS += 2; whyS.push('premium'); }
    if (trend >= 1 && r2 < 12 && s20 != null && c >= s20 * 0.997) { scoreL += 3; whyL.push('RSI(2) PB'); }
    if (trend <= -1 && r2 > 88 && s20 != null && c <= s20 * 1.003 && allowShort) { scoreS += 3; whyS.push('RSI(2) bounce'); }
    if (vw) {
      if (c >= vw && trend >= 1) { scoreL++; whyL.push('>VWAP sesji'); }
      if (c <= vw && trend <= -1 && allowShort) { scoreS++; whyS.push('<VWAP sesji'); }
    }
    if (orr && s20 != null && a > 0) {
      var extHi = (c - orr.hi) / a, extLo = (orr.lo - c) / a;
      if (c > orr.hi && c > s20 && trend >= 1 && extHi <= 0.75 && sq >= 0.7) { scoreL += 2; whyL.push('ORB 30m'); }
      if (c < orr.lo && c < s20 && trend <= -1 && allowShort && extLo <= 0.75 && sq >= 0.7) { scoreS += 2; whyS.push('ORB 30m'); }
      if (extHi > 1.15) scoreL -= 2;
      if (extLo > 1.15) scoreS -= 2;
    }
    if (rx > 2.2) { scoreL--; scoreS--; }
    if (mkt === 'FX') { if (trend < 2) scoreL--; if (trend > -2) scoreS--; }
    if (mkt !== 'FX' && !allowShort) scoreS = 0;
    if (r14 > 72) scoreL--; if (r14 < 28) scoreS--;
    if (scoreL >= need && scoreL > scoreS) { g.side = 'LONG'; g.strength = Math.min(5, Math.max(1, Math.round(scoreL / 2))); g.why = whyL.slice(0, 4).join(' · '); }
    else if (scoreS >= need && scoreS > scoreL && allowShort) { g.side = 'SHORT'; g.strength = Math.min(5, Math.max(1, Math.round(scoreS / 2))); g.why = whyS.slice(0, 4).join(' · '); }
    else { g.side = 'WAIT'; g.strength = 0; g.why = 'brak konfluencji (L' + scoreL + '/S' + scoreS + ', wymagane ' + need + ')'; }
    if (PRO.requireTrend) {
      if (g.side === 'LONG' && trend < 1) { g.side = 'WAIT'; g.strength = 0; g.why = 'veto: brak HTF up'; }
      if (g.side === 'SHORT' && trend > -1) { g.side = 'WAIT'; g.strength = 0; g.why = 'veto: brak HTF down'; }
    }
    // --- warunki daytradingowe (weta: sygnal kandydat -> WAIT z konkretnym powodem) ---
    var veto = '', rvol = (mkt === 'FX') ? null : rvolOf(b), marketTrend = null;
    if (g.side !== 'WAIT' && rvol != null && rvol < PRO.minRvol) veto = 'niski wolumen (RVOL ' + rvol.toFixed(2) + ' < ' + PRO.minRvol + ')';
    if (!veto && g.side !== 'WAIT' && PRO.marketFilter && mkt === 'US' && m.s !== 'SPY' && m.s !== 'QQQ' && opts.marketBars !== undefined) {
      if (!opts.marketBars || opts.marketBars.length < 63) veto = 'brak danych SPY (filtr rynku)';
      else {
        marketTrend = htfTrend(opts.marketBars).trend;
        if (g.side === 'LONG' && marketTrend <= -1) veto = 'rynek przeciwny: SPY 15m w dol';
        if (g.side === 'SHORT' && marketTrend >= 1) veto = 'rynek przeciwny: SPY 15m w gore';
      }
    }
    if (veto) { g.side = 'WAIT'; g.strength = 0; g.why = 'veto: ' + veto; }
    var hard = '';
    if (nb.blocked && nb.label !== 'weekend') hard = 'news blackout: ' + nb.label;
    else if (!inSession(mkt, ts)) hard = 'poza sesja';
    else {
      var sdef = PRO.sessions[mkt], t = utcMin(ts);
      if (sdef && t >= sdef.close - PRO.closeBufferMin && t < sdef.close) hard = 'ostatnie ' + PRO.closeBufferMin + ' min sesji (tylko zarzadzanie pozycja)';
    }
    if (hard) { g.side = 'WAIT'; g.strength = 0; g.why = hard; scoreL = 0; scoreS = 0; } // zerujemy wyniki, by "miekkie" nakladki nie odwrocily blokady
    g.atr = a;
    g.sd = g.side === 'WAIT' ? a * PRO.atrSlMult : swingStopDist(b, g.side, a);
    g._pro = { scoreL: scoreL, scoreS: scoreS, need: need, trend: trend, t15: ht.t15, t60: ht.t60, zone: zone, sessionQ: sq, mkt: mkt, news: nb,
      vwap: vw, orHi: orr && orr.hi, orLo: orr && orr.lo, sessionBars: sess.length, hard: hard, veto: veto, rvol: rvol, marketTrend: marketTrend };    return g;
  }

  // ================= WYKONANIE / ZARZADZANIE POZYCJA =================
  function symMeta(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i];
    return null;
  }
  function corrGroup(m) {
    var mk = marketOf(m);
    return mk === 'US' ? 'US' : (mk === 'EU' || mk === 'PL' ? 'EU' : m.s);
  }
  function applyCfg() {
    if (!global.CFG) return;
    global.CFG.risk = PRO.riskPct; global.CFG.maxPos = PRO.maxPos; global.CFG.minHold = PRO.minHoldBars;
    global.CFG.dailyLossPct = PRO.dailyLossPct; global.CFG.maxConsecLoss = PRO.maxConsecLoss; global.CFG.maxDayTrades = PRO.maxDayTrades;
    global.CFG.timeStop = global.CFG.timeStop || PRO.timeStopBars;
  }
  function plog(msg, cls) { if (typeof global.log === 'function') global.log(msg, cls || 'mut'); }

  // opcje "zywe" dla evalCore: kierunek + dane SPY do filtra rynku (tylko gdy SPY ma swieza cene LIVE)
  function liveOpts(m) {
    var o = { allowShort: !!(global.CFG && global.CFG.allowShort) };
    if (PRO.marketFilter && marketOf(m) === 'US' && m.s !== 'SPY' && m.s !== 'QQQ') {
      var spy = global.ST && global.ST.series && global.ST.series.SPY;
      var fresh = !global.BTX_LIVE || !global.BTX_LIVE.isFresh || global.BTX_LIVE.isFresh('SPY');
      o.marketBars = (spy && fresh) ? spy : null;
    }
    return o;
  }

  // plan pozycji z kosztami (ta sama matematyka co sizePlan w aplikacji, ale z geometria PRO i stopem strukturalnym)
  function sizePlanPro(m, price, atr, equity, cash, sdOverride) {
    var hasModel = typeof global.feeOf === 'function' && typeof global.rateOf === 'function';
    var rate = hasModel ? (global.rateOf(m) || 1) : 1;
    var f = hasModel ? global.feeOf(m) : { comm: 0, conv: 0, spr: 0 };
    var fx = marketOf(m) === 'FX', lev = fx ? ((global.CFG && global.CFG.fxLev) || 30) : 1, step = fx ? 1000 : 1;
    var sd = sdOverride || (atr || price * 0.004) * PRO.atrSlMult;
    if (!(sd > 0)) return { ok: false, reason: 'ATR=0' };
    var riskAmt = equity * (PRO.riskPct / 100), unitRisk = sd * rate, reason = '';
    var q = Math.floor(riskAmt / unitRisk / step) * step;
    if (q < step) { q = step; if (q * unitRisk > riskAmt * 2.5) reason = 'minimalna pozycja (' + q + ') ryzykuje ' + (q * unitRisk).toFixed(2) + ' > limit ' + (riskAmt * 2.5).toFixed(2); }
    var maxQ = Math.floor(cash * lev / (price * rate) / step) * step; if (q > maxQ) q = maxQ;
    if (q < step && !reason) reason = 'za malo wolnych srodkow';
    var notional = q * price * rate, margin = notional / lev;
    var feeIn = notional * (f.comm + f.conv + f.spr), feeOut = notional * (f.comm + f.conv);
    var costPU = price * (2 * (f.comm + f.conv) + f.spr);
    var netRR = (PRO.tpR * sd - costPU) / (sd + costPU);
    if (!reason && netRR < PRO.minNetRR) reason = 'koszty zjadaja przewage: R:R netto ' + netRR.toFixed(2) + ' < ' + PRO.minNetRR;
    return { ok: !reason, reason: reason, qty: q, sd: sd, rate: rate, lev: lev, margin: margin, feeIn: feeIn, feeOut: feeOut,
      f: { comm: f.comm, conv: f.conv }, netRR: netRR, riskAmt: q * unitRisk };
  }

  // jedno zrodlo prawdy: czy mozna teraz otworzyc pozycje? (uzywane przez openPos i panel "Plan")
  function gateCheck(g, m, ST, ts) {
    ts = ts == null ? Date.now() : ts;
    if (!g || g.side === 'WAIT') return { ok: false, reason: 'brak sygnalu' };
    if (!ST) return { ok: false, reason: 'brak stanu' };
    if (ST.blocked) return { ok: false, reason: 'blokada dnia' };
    var mk = marketOf(m), nb = newsBlocked(ts);
    if (nb.blocked && nb.label !== 'weekend') return { ok: false, reason: 'blokada news: ' + nb.label };
    if (!inSession(mk, ts) || sessionQuality(mk, ts) === 0) return { ok: false, reason: 'poza sesja / okno tylko-zarzadzanie' };
    if (global.BTX_LIVE && global.BTX_LIVE.isFresh && !global.BTX_LIVE.isFresh(g.sym)) return { ok: false, reason: 'brak swiezej ceny LIVE' };
    if ((g.strength || 0) < PRO.minStrengthOpen) return { ok: false, reason: 'sygnal za slaby' };
    if (PRO.strictCore) {
      var pr = g._pro;
      if (!pr) return { ok: false, reason: 'brak scoringu rdzenia' };
      if (pr.veto) return { ok: false, reason: 'veto: ' + pr.veto };
      var sc = g.side === 'LONG' ? pr.scoreL : pr.scoreS, need = pr.need || PRO.scoreMin;
      if (sc < need) return { ok: false, reason: 'rdzen: score ' + sc + ' < ' + need + ' (nakladka obnizyla prog)' };
    }
    if (ST.pos && ST.pos[g.sym]) return { ok: false, reason: 'pozycja juz otwarta' };
    if (Object.keys(ST.pos || {}).length >= PRO.maxPos) return { ok: false, reason: 'limit pozycji (' + PRO.maxPos + ')' };
    if ((ST.dayTrades || 0) >= PRO.maxDayTrades) return { ok: false, reason: 'limit transakcji dnia (' + PRO.maxDayTrades + ')' };
    if ((ST.consecLoss || 0) >= PRO.maxConsecLoss) return { ok: false, reason: 'seria ' + PRO.maxConsecLoss + ' strat' };
    if (ST.cool && ST.cool[g.sym] > 0) return { ok: false, reason: 'cooldown ' + ST.cool[g.sym] + ' swiec' };
    var grp = corrGroup(m);
    for (var k in (ST.pos || {})) {
      var pm = symMeta(k) || { s: k };
      if (corrGroup(pm) === grp && ST.pos[k].side === g.side) return { ok: false, reason: 'korelacja: ' + k + ' (' + grp + ') juz ' + g.side };
    }
    var sp = sizePlanPro(m, g.price, g.atr, ST.equity, ST.cash, g.sd);
    if (!sp.ok) return { ok: false, reason: sp.reason, sp: sp };
    return { ok: true, reason: '', sp: sp };
  }

  function hhmmPL(pseudoMin) { var x = (pseudoMin + 60 + 1440) % 1440; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + (x % 60)).slice(-2); }

  function ticketText(g, sp, m, pr) {
    var f2 = global.f2 || function (x) { return (+x).toFixed(2); }, long = g.side === 'LONG';
    var tp = long ? g.price + PRO.tpR * sp.sd : g.price - PRO.tpR * sp.sd;
    var p1 = long ? g.price + PRO.partialR * sp.sd : g.price - PRO.partialR * sp.sd;
    var stop = long ? g.price - sp.sd : g.price + sp.sd;
    var sdef = PRO.sessions[marketOf(m)] || PRO.sessions.US;
    return ['BTX OTWARTO ' + g.side + ' ' + g.sym + ' x' + sp.qty + ' @ ' + f2(g.price),
      'SL ' + f2(stop) + ' (-1R = ' + f2(sp.riskAmt) + ', ' + (sp.riskAmt / (global.ST.equity || 1) * 100).toFixed(2) + '% kapitalu)',
      'Czesciowe 50% @ ' + f2(p1) + ' (+' + PRO.partialR + 'R), BE po +' + PRO.beR + 'R, TP ' + f2(tp) + ' (+' + PRO.tpR + 'R)',
      'R:R netto po kosztach: ' + sp.netRR.toFixed(2) + ' | koszt wejscia ' + f2(sp.feeIn),
      'Score ' + (long ? pr.scoreL : pr.scoreS) + '/' + pr.need + ' | HTF15m ' + pr.t15 + ' 60m ' + pr.t60 + (pr.marketTrend != null ? ' | SPY15m ' + pr.marketTrend : '') + (pr.rvol != null ? ' | RVOL ' + pr.rvol.toFixed(2) : ''),
      'Powod: ' + g.why,
      'Wyjscie najpozniej: ' + hhmmPL(sdef.close - PRO.flatBeforeCloseMin) + ' PL lub po ' + PRO.timeStopBars + ' swiecach'].join('\n');
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__pro) return;
    global.openPos = function (g) {
      applyCfg();
      var ST = global.ST;
      if (!g || g.side === 'WAIT' || !ST) return;
      var m = symMeta(g.sym) || { s: g.sym, mkt: g.mkt };
      var gc = gateCheck(g, m, ST, Date.now());
      ST.skip = ST.skip || {};
      var key = g.sym + g.side;
      if (!gc.ok) {
        if (ST.skip[key] !== gc.reason) { ST.skip[key] = gc.reason; plog('POMINIETO ' + g.side + ' ' + g.sym + ' — ' + gc.reason, 'i'); }
        return;
      }
      ST.skip[key] = null;
      var sp = gc.sp, long = g.side === 'LONG', sd = sp.sd;
      var stop = long ? g.price - sd : g.price + sd;
      var tgt = long ? g.price + PRO.tpR * sd : g.price - PRO.tpR * sd;
      var partial = long ? g.price + PRO.partialR * sd : g.price - PRO.partialR * sd;
      ST.dayTrades = (ST.dayTrades || 0) + 1;
      ST.pos[g.sym] = { sym: g.sym, side: g.side, qty: sp.qty, entry: g.price, stop: stop, target: tgt,
        partial: partial, partialDone: false, why: '[PRO] ' + g.why, bars: 0,
        risk0: sd, be: false, at: new Date().toLocaleTimeString('pl-PL'), openedAt: Date.now(),
        rate: sp.rate, lev: sp.lev, margin: sp.margin, feeIn: sp.feeIn, f: sp.f, riskAmt: sp.riskAmt, netRR: sp.netRR };
      ST.cash -= sp.margin + sp.feeIn; ST.equity -= sp.feeIn; ST.feesTot = (ST.feesTot || 0) + sp.feeIn;
      var f2 = global.f2 || function (x) { return (+x).toFixed(2); };
      plog('OTWARCIE ' + g.side + ' ' + g.sym + ' x' + sp.qty + ' @ ' + f2(g.price) + ' | SL ' + f2(stop) + ' | pTP ' + f2(partial) +
        ' | TP ' + f2(tgt) + ' | oplata wejscia ' + f2(sp.feeIn) + ' | R:R netto ' + sp.netRR.toFixed(2) + ' — PRO ' + g.why, 'g');
      try { if (g._pro && global.BTX_REPORT && global.BTX_REPORT.notify) global.BTX_REPORT.notify(ticketText(g, sp, m, g._pro)); } catch (e) {}
    };
    global.openPos.__pro = true;
  }
  function patchCoolOnClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__proCool) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var r = orig.apply(this, arguments);
      if (global.ST && global.ST.cool) global.ST.cool[sym] = PRO.coolBars;
      return r;
    };
    Object.keys(orig).forEach(function (k) { try { global.closePos[k] = orig[k]; } catch (e) {} });
    global.closePos.__proCool = true;
  }
  // dyscyplina daytradingu: zadnych pozycji przez noc ani po zamknieciu rynku
  function flatCheck() {
    var ST = global.ST; if (!ST || !ST.pos || typeof global.closePos !== 'function') return;
    var ts = Date.now(), t = utcMin(ts);
    Object.keys(ST.pos).forEach(function (sym) {
      var m = symMeta(sym) || { s: sym }, mk = marketOf(m), sdef = PRO.sessions[mk] || PRO.sessions.US;
      var closed = !inSession(mk, ts);
      if (closed || t >= sdef.close - PRO.flatBeforeCloseMin) global.closePos(sym, closed ? 'flat poza sesja' : 'flat koniec sesji');
    });
  }
  function managePartialAndBE() {
    var ST = global.ST; if (!ST || !ST.pos) return;
    for (var sym in ST.pos) {
      var p = ST.pos[sym];
      var bar = typeof global.last === 'function' ? global.last(sym) : null;
      if (!p || !bar) continue;
      var risk = p.risk0 || Math.abs(p.entry - p.stop) || 0; if (risk <= 0) continue;
      var mv = p.side === 'LONG' ? (bar.c - p.entry) : (p.entry - bar.c);
      var rNow = mv / risk;
      if (!p.be && rNow >= PRO.beR) { p.stop = p.entry; p.be = true; }
      if (!p.partialDone && p.partial != null && p.qty >= 2) {
        var hit = p.side === 'LONG' ? (bar.h >= p.partial) : (bar.l <= p.partial);
        if (hit || rNow >= PRO.partialR) {
          var closeQty = Math.max(1, Math.floor(p.qty * PRO.partialFrac));
          if (closeQty >= p.qty) closeQty = p.qty - 1;
          if (closeQty >= 1) {
            var fill = p.partial, rate = p.rate || 1, share = closeQty / p.qty;
            var gross = (p.side === 'LONG' ? (fill - p.entry) : (p.entry - fill)) * closeQty * rate;
            var feeOut = closeQty * fill * rate * (p.f ? (p.f.comm + p.f.conv) : 0);
            var mShare = (p.margin || 0) * share, fShare = (p.feeIn || 0) * share;
            ST.cash += mShare + gross - feeOut; ST.equity += gross - feeOut; ST.feesTot = (ST.feesTot || 0) + feeOut;
            p.qty -= closeQty; p.margin = (p.margin || 0) - mShare; p.feeIn = (p.feeIn || 0) - fShare; p.partialDone = true;
            if (!p.be) { p.stop = p.entry; p.be = true; }
            if (ST.closed) ST.closed.unshift({ sym: sym, side: p.side, qty: closeQty, entry: p.entry, exit: fill,
              pnl: gross - feeOut - fShare, fees: fShare + feeOut, why: 'partial-1R', bars: p.bars, t: Date.now(),
              R: risk * closeQty * rate > 0 ? Math.round((gross - feeOut - fShare) / (risk * closeQty * rate) * 100) / 100 : undefined });
          }
        }
      }
    }
  }
  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__proPart) return;
    var orig = global.cycle;
    global.cycle = function () { var r = orig.apply(this, arguments); try { managePartialAndBE(); flatCheck(); } catch (e) {} return r; };
    Object.keys(orig).forEach(function (k) { try { global.cycle[k] = orig[k]; } catch (e) {} });
    global.cycle.__proPart = true;
  }
  function patchEvaluate() {
    if (typeof global.evaluate !== 'function') return false;
    global.evaluate = function (m) {
      var ST = global.ST, b = ST && ST.series && ST.series[m.s];
      return evalCore(m, b, Date.now(), liveOpts(m));
    };
    global.evaluate.__pro = true; return true;
  }

  global.BTX_STRATEGY_PRO = PRO;
  global.BTX_PRO = PRO;
  global.BTX_newsBlocked = newsBlocked;
  global.BTX_TIME = { warsawOffsetMin: warsawOffsetMin, pseudoUtcMin: utcMin, isWeekday: weekday, local: local, hhmmPL: hhmmPL };
  global.BTX_STRATEGY_CORE = {
    evalCore: evalCore, inSession: inSession, sessionQuality: sessionQuality, newsBlocked: newsBlocked, marketOf: marketOf,
    sessionSlice: sessionSlice, atrCalc: atrCalc, anchoredVwap: anchoredVwap, openingRange: openingRange,
    aggregate: aggregate, htfTrend: htfTrend, rsiCalc: rsiCalc, corrGroup: corrGroup, sizePlanPro: sizePlanPro,
    sessIdOf: sessIdOf, SESS_START: SESS_START, gateCheck: gateCheck, liveOpts: liveOpts, rvolOf: rvolOf,
    swingStopDist: swingStopDist, flatCheck: flatCheck, symMeta: symMeta, ticketText: ticketText
  };

  if (typeof document === 'undefined') return; // testy w Node: tylko czyste funkcje

  function boot() {
    applyCfg();
    var n = 0, t = setInterval(function () {
      n++; applyCfg(); patchEvaluate(); patchOpenPos(); patchCoolOnClose(); patchCycle();
      if (n > 60) clearInterval(t);
    }, 400);
    setInterval(function () { try { flatCheck(); } catch (e) {} }, 20000);
    try {
      var el = document.getElementById('limit-badge');
      if (el) { el.textContent = 'PRO DT'; el.title = 'Daytrade: rdzen score>=4 (5 poza prime), HTF 15m/60m, VWAP+ORB sesji, RVOL, filtr SPY, stop strukturalny, flat przed zamknieciem'; }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);