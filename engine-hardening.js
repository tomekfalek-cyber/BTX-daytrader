/**
 * BTX Engine Hardening — poprawki z audytu (1–15, daytrading)
 * ładuje się na końcu i podmienia funkcje globalne.
 */
(function (global) {
  function warsawParts() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    var wd = map.weekday || '';
    var weekend = /Sat|Sun/i.test(wd);
    return { min: min, weekend: weekend, label: wd + ' ' + map.hour + ':' + map.minute };
  }

  function ensureDayReset() {
    var ST = global.ST;
    if (!ST) return;
    var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    if (ST.dayPL !== today) {
      ST.dayPL = today;
      ST.dayStart = ST.equity != null ? ST.equity : (global.CFG && global.CFG.capital) || 100000;
      ST.dayTrades = 0;
      ST.consecLoss = 0;
      ST.blocked = false;
      if (global.log) global.log('Nowy dzień handlowy PL — reset limitów dnia', 'i');
      try { if (typeof global.save === 'function') global.save(); } catch (e) {}
    }
  }

  function floatingPnl() {
    var ST = global.ST;
    if (!ST || !ST.pos) return 0;
    var sum = 0;
    Object.keys(ST.pos).forEach(function (k) {
      var p = ST.pos[k];
      var b = global.last ? global.last(k) : null;
      var px = b ? b.c : p.entry;
      sum += (p.side === 'LONG' ? (px - p.entry) : (p.entry - px)) * (p.qty || 0);
    });
    return sum;
  }

  function markLive(sym) {
    var ST = global.ST || (global.ST = {});
    ST.liveSource = ST.liveSource || {};
    ST.liveSource[sym] = Date.now();
    global.__BTX_LAST_LIVE_TS = Date.now();
  }

  function isLive(sym) {
    var ST = global.ST;
    if (!ST || !ST.liveSource || !ST.liveSource[sym]) return false;
    // ważne 45 min — potem znowu wolno synth tylko jako fallback
    return Date.now() - ST.liveSource[sym] < 45 * 60 * 1000;
  }

  function anyLive() {
    var ST = global.ST;
    if (!ST || !ST.liveSource) return false;
    var t = Date.now();
    return Object.keys(ST.liveSource).some(function (k) { return t - ST.liveSource[k] < 45 * 60 * 1000; });
  }

  /** 3. Weekend: FX też zamknięty (rynek stoi) */
  function sessionOpenFixed(mkt) {
    var w = warsawParts();
    if (w.weekend) return false;
    var h = w.min / 60;
    if (mkt === 'US') return h >= 15.5 && h < 22;
    if (mkt === 'PL') return h >= 9 && h < 17;
    // FX: pn–pt, bez weekend
    return h >= 1 && h < 23;
  }

  /** 12. RSI Wilder */
  function rsiWilder(closes, n) {
    n = n || 14;
    if (!closes || closes.length < n + 1) return null;
    var gains = 0, losses = 0;
    for (var i = closes.length - n; i < closes.length; i++) {
      var d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    var ag = gains / n, al = losses / n;
    // wygładzenie przybliżone Wildera na ostatnim oknie (bez pełnej historii seed)
    if (al === 0) return 100;
    var rs = ag / al;
    return 100 - 100 / (1 + rs);
  }

  /** 12. ATR Wilder-ish (RMA) */
  function atrWilder(bars, n) {
    n = n || 14;
    if (!bars || bars.length < n + 1) return null;
    var trs = [];
    for (var i = 1; i < bars.length; i++) {
      var x = bars[i], pc = bars[i - 1].c;
      trs.push(Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc)));
    }
    if (trs.length < n) return null;
    var atr = 0;
    for (var j = 0; j < n; j++) atr += trs[j];
    atr /= n;
    for (var k = n; k < trs.length; k++) atr = (atr * (n - 1) + trs[k]) / n;
    return atr;
  }

  /** 12. Session VWAP od ~otwarcia US (dla PL clock 15:30) gdy da się odciąć po timestamp */
  function sessionVwap(bars) {
    if (!bars || !bars.length) return null;
    var startIdx = Math.max(0, bars.length - 78);
    // jeśli są timestampy — od ostatniego "dnia sesji" po 15:30 PL w ms trudne bez TZ per bar;
    // użyj barów od północy UTC-ish: ostatnie bary z tym samym dniem co ostatni
    var lastT = bars[bars.length - 1].t;
    if (lastT) {
      var dayStart = lastT - (12 * 60 * 60 * 1000); // ~12h wstecz jako sesja
      for (var i = bars.length - 1; i >= 0; i--) {
        if (bars[i].t && bars[i].t < dayStart) { startIdx = i + 1; break; }
        startIdx = i;
      }
    }
    var pv = 0, v = 0;
    for (var j = startIdx; j < bars.length; j++) {
      var tp = (bars[j].h + bars[j].l + bars[j].c) / 3;
      var vol = bars[j].v || 1;
      pv += tp * vol;
      v += vol;
    }
    return v ? pv / v : null;
  }

  /** 11. HTF z prawdziwych bloków czasowych jeśli jest t */
  function htfTrendFixed(sym) {
    var ST = global.ST;
    var b = ST && ST.series && ST.series[sym];
    if (!b || b.length < 40) return 'FLAT';
    var buckets = {};
    b.forEach(function (bar) {
      var key;
      if (bar.t) key = Math.floor(bar.t / (60 * 60 * 1000)); // godzina UTC
      else key = null;
      if (key == null) return;
      if (!buckets[key]) buckets[key] = bar.c;
      else buckets[key] = bar.c;
    });
    var keys = Object.keys(buckets).map(Number).sort(function (a, b) { return a - b; });
    var agg;
    if (keys.length >= 5) {
      agg = keys.slice(-20).map(function (k) { return buckets[k]; });
    } else {
      // fallback: co 12 świec 5m
      var closes = b.map(function (x) { return x.c; });
      agg = [];
      for (var k = 0; k + 12 <= closes.length; k += 12) agg.push(closes[k + 11]);
      if (agg.length < 5) agg = closes.slice(-20);
    }
    var s = global.sma ? global.sma(agg, Math.min(5, agg.length)) : null;
    if (s == null) return 'FLAT';
    var last = agg[agg.length - 1];
    if (last > s * 1.001) return 'UP';
    if (last < s * 0.999) return 'DOWN';
    return 'FLAT';
  }

  function applySlip(price, side, isEntry) {
    var CFG = global.CFG || {};
    var slip = Number(CFG.slip || CFG.slippage || 0);
    if (!slip || !price) return price;
    // slip w % ceny
    var s = Math.abs(slip) / 100;
    // kupno drożej, sprzedaż taniej
    if (side === 'LONG') return isEntry ? price * (1 + s) : price * (1 - s);
    return isEntry ? price * (1 - s) : price * (1 + s);
  }

  function patchSession() {
    global.sessionOpen = sessionOpenFixed;
  }

  function patchIndicators() {
    if (typeof global.rsi === 'function') {
      global.rsi = function (cl, n) { return rsiWilder(cl, n || 14); };
    }
    if (typeof global.atr === 'function') {
      global.atr = function (b, n) { return atrWilder(b, n || 14); };
    }
    if (typeof global.vwap === 'function') {
      global.vwap = function (b) { return sessionVwap(b); };
    }
    if (typeof global.htfTrend === 'function') {
      global.htfTrend = htfTrendFixed;
    }
  }

  function patchFetchReal() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__hard) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      // 15. mapowanie symboli Twelve
      var map = {
        EURUSD: 'EUR/USD',
        'XAU/USD': 'XAU/USD',
        XAUUSD: 'XAU/USD'
      };
      var req = map[sym] || sym;
      var r = await orig.call(this, req);
      // jeśli orig używa sym bezpośrednio — drugi strzał z mapą gdy pusto
      try {
        if (global.ST && global.ST.series && global.ST.series[req] && !global.ST.series[sym]) {
          global.ST.series[sym] = global.ST.series[req];
        }
        if (global.ST && global.ST.series && global.ST.series[sym]) markLive(sym);
        if (req !== sym && global.ST && global.ST.series && global.ST.series[req]) markLive(sym);
      } catch (e) {}
      markLive(sym);
      return r;
    };
    global.fetchReal.__hard = true;
  }

  function patchCheckLimits() {
    global.checkLimits = function () {
      ensureDayReset();
      var ST = global.ST;
      var CFG = global.CFG || {};
      if (!ST) return;
      if (!ST.dayStart) ST.dayStart = CFG.capital || ST.equity;
      var floatPnL = floatingPnl();
      var equityNow = (ST.equity || 0) + floatPnL; // equity w ST często już bez float — dodaj
      // jeśli equity już mark-to-market, float~0; bezpiecznie: day pnl = equity + float - dayStart dla pozycji
      var mark = ST.equity;
      // dodaj float tylko jeśli pozycje istnieją i equity nie zawiera MTM
      try {
        if (ST.pos && Object.keys(ST.pos).length) {
          mark = ST.cash;
          Object.keys(ST.pos).forEach(function (k) {
            var p = ST.pos[k];
            var b = global.last && global.last(k);
            var px = b ? b.c : p.entry;
            mark += px * (p.qty || 0);
          });
        }
      } catch (e2) { mark = ST.equity; }
      var dd = (mark - ST.dayStart) / (ST.dayStart || 1);
      var lim = Number(CFG.dailyLoss || 1.5) / 100;
      var blocked =
        dd <= -lim ||
        (ST.dayTrades || 0) >= (CFG.maxTrades || 4) ||
        (ST.consecLoss || 0) >= (CFG.maxConsec || 3);
      ST.blocked = blocked;
      ST._dayDd = dd;
      ST._markEquity = mark;
      var b = document.getElementById('limit-badge');
      if (b && global.fp) {
        b.textContent = blocked ? '⛔ BLOKADA DNIA' : ('✓ limit OK · ' + global.fp(dd));
        b.style.color = blocked ? 'var(--loss)' : 'var(--green)';
      }
    };
  }

  function patchClosePos() {
    if (typeof global.closePos !== 'function') return;
    var orig = global.closePos;
    if (orig.__hard) return;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      var wasBe = p && p.be;
      var entry = p && p.entry;
      // slip na wyjściu
      if (p && px != null) px = applySlip(px, p.side, false);
      var beforeConsec = ST ? ST.consecLoss : 0;
      var ret = orig.apply(this, arguments);
      // 4. BE / wyjście ~0 nie liczy się jako strata do serii
      try {
        if (ST && ST.closed && ST.closed[0] && ST.closed[0].sym === sym) {
          var tr = ST.closed[0];
          var feeOnly = wasBe || why === 'BE' || why === 'be' || (tr.pnl < 0 && Math.abs(tr.pnl) < (entry || 1) * 0.0008 * (tr.qty || 1));
          if (feeOnly && tr.pnl <= 0) {
            ST.consecLoss = beforeConsec; // nie zwiększaj
          }
        }
      } catch (e) {}
      return ret;
    };
    global.closePos.__hard = true;
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function') return;
    var orig = global.openPos;
    if (orig.__hardOpen) return;
    global.openPos = function (g) {
      ensureDayReset();
      var ST = global.ST;
      var CFG = global.CFG || {};
      if (!g || !ST) return;
      if (ST.blocked) return;
      // sesja
      var m = null;
      (global.SYMBOLS || []).forEach(function (x) { if (x.s === g.sym) m = x; });
      var mkt = (m && m.mkt) || (/EUR|XAU|GOLD|USD/.test(g.sym) ? 'FX' : 'US');
      if (!sessionOpenFixed(mkt)) {
        if (global.toast) global.toast('Sesja zamknięta dla ' + g.sym, 'info');
        return;
      }
      // pod koniec US — brak nowych stock
      var w = warsawParts();
      if (mkt === 'US' && w.min >= 21 * 60 + 30) {
        if (global.toast) global.toast('Koniec sesji US — brak nowych wejść', 'info');
        return;
      }

      // 9. size bez przekraczania ryzyka (nie forsuj min 1 gdy risk za duży)
      var riskCash = (ST.equity || CFG.capital || 0) * ((CFG.risk || 0.5) / 100);
      var sd = (g.atr || g.price * 0.004) * 1.5;
      if (sd <= 0) return;
      var q = Math.floor(riskCash / sd);
      if (q < 1) {
        // akcje: nie otwieraj, jeśli 1 sztuka > 1.15× risk
        if (riskCash / sd < 0.85) {
          if (global.log) global.log('Skip ' + g.sym + ': 1 sztuka przekracza risk', 'i');
          return;
        }
        q = 1;
      }
      var entry = applySlip(g.price, g.side, true);
      var g2 = Object.assign({}, g, { price: entry });
      // tymczasowo podmień floor risk path: wołamy orig ale z poprawioną ceną
      // orig sam liczy qty — nadpiszemy po fakcie
      var beforeKeys = Object.keys(ST.pos || {});
      var ret = orig.call(this, g2);
      var afterKeys = Object.keys(ST.pos || {});
      var neu = afterKeys.filter(function (k) { return beforeKeys.indexOf(k) < 0; });
      if (neu.length) {
        var p = ST.pos[neu[0]];
        if (p) {
          // skoryguj qty do q jeśli orig wziął więcej
          if (p.qty > q && q >= 1) {
            var diff = p.qty - q;
            ST.cash += diff * p.entry;
            p.qty = q;
          }
          p.entry = entry;
          p.stop = g.side === 'LONG' ? entry - sd : entry + sd;
          p.target = g.side === 'LONG' ? entry + 3 * sd : entry - 3 * sd;
          p.risk0 = Math.abs(entry - p.stop);
        }
      }
      return ret;
    };
    global.openPos.__hardOpen = true;
  }

  /** 1 + 5 + force flat: nowy cycle */
  function patchCycle() {
    if (typeof global.cycle !== 'function') return;
    if (global.cycle.__hard) return;
    var origCycle = global.cycle;

    global.cycle = function () {
      ensureDayReset();
      var ST = global.ST;
      var CFG = global.CFG || {};
      if (!ST) return origCycle.apply(this, arguments);

      ST.n = (ST.n || 0) + 1;
      if (typeof global.checkLimits === 'function') global.checkLimits();

      var SYMBOLS = global.SYMBOLS || [];
      for (var i = 0; i < SYMBOLS.length; i++) {
        var m = SYMBOLS[i];
        var a = ST.series[m.s];
        if (!a || !a.length) {
          if (typeof global.initSeries === 'function') ST.series[m.s] = global.initSeries(m, 150);
        } else if (!isLive(m.s)) {
          // 1. synth tylko gdy NIE ma świeżych LIVE
          if (typeof global.nextBar === 'function') {
            a.push(global.nextBar(m, a[a.length - 1]));
            if (a.length > 400) a.shift();
          }
        }
        // LIVE: nie doklejaj losowej świecy
        if (ST.cool && ST.cool[m.s] > 0) ST.cool[m.s]--;
      }

      // zarządzanie pozycjami
      var w = warsawParts();
      var forceFlatUS = !w.weekend && w.min >= 21 * 60 + 45; // ~21:45 PL

      for (var k in ST.pos) {
        var p = ST.pos[k];
        var b = global.last && global.last(k);
        if (!b) continue;
        p.bars = (p.bars || 0) + 1;

        if (forceFlatUS) {
          var mm = null;
          SYMBOLS.forEach(function (x) { if (x.s === k) mm = x; });
          if (mm && mm.mkt === 'US') {
            global.closePos(k, 'koniec-sesji', b.c);
            continue;
          }
        }

        var stp0 = p.stop;
        // BE
        if (!p.be) {
          var mv = p.side === 'LONG' ? (b.c - p.entry) : (p.entry - b.c);
          if (mv >= p.risk0) {
            p.stop = p.entry;
            p.be = true;
            if (global.log) global.log('BE: stop na wejściu — ' + p.sym, 'g');
          }
        }

        // 5. TP zawsze aktywny; w minHold tylko wstrzymaj wyjścia "miękkie" (time), nie TP/SL
        var minH = CFG.minHold || 4;
        var inMin = p.bars < minH;

        if (p.side === 'LONG') {
          if (b.l <= stp0) {
            global.closePos(k, p.be && Math.abs(stp0 - p.entry) < 1e-8 ? 'BE-stop' : 'stop', Math.min(stp0, b.o));
            continue;
          }
          if (b.h >= p.target) {
            global.closePos(k, 'target', Math.max(p.target, b.o));
            continue;
          }
        } else {
          if (b.h >= stp0) {
            global.closePos(k, p.be && Math.abs(stp0 - p.entry) < 1e-8 ? 'BE-stop' : 'stop', Math.max(stp0, b.o));
            continue;
          }
          if (b.l <= p.target) {
            global.closePos(k, 'target', Math.min(p.target, b.o));
            continue;
          }
        }

        if (!inMin && p.bars >= (CFG.timeStop || 60)) {
          global.closePos(k, 'time-stop', b.c);
        }
      }

      var sg = typeof global.signals === 'function' ? global.signals() : [];
      ST.sig = sg;
      var opened = 0;
      var ranked = sg.filter(function (x) { return x.side !== 'WAIT'; }).sort(function (a, b) { return b.strength - a.strength; });
      for (var q = 0; q < ranked.length; q++) {
        var g = ranked[q];
        if (ST.pos[g.sym]) continue;
        if (ST.cool && ST.cool[g.sym] > 0) continue;
        if (Object.keys(ST.pos).length >= (CFG.maxPos || 2)) break;
        if (typeof global.openPos === 'function') global.openPos(g);
        opened++;
      }
      ST.eq = ST.eq || [];
      ST.eq.push(ST.equity);
      if (ST.eq.length > 400) ST.eq.shift();
      if (global.log) {
        global.log(
          'Świeca #' + ST.n + ' | LIVE=' + (anyLive() ? 'tak' : 'synth') +
          ' | sygnały ' + ranked.length + ', próby otwarć ' + opened,
          'i'
        );
      }
      if (typeof global.render === 'function') global.render();
      if (typeof global.save === 'function') global.save();
    };
    global.cycle.__hard = true;
  }

  function patchBacktest() {
    if (typeof global.backtest !== 'function' || global.backtest.__hard) return;
    var orig = global.backtest;
    global.backtest = function () {
      orig.apply(this, arguments);
      var el = document.getElementById('bt-out');
      if (el) {
        el.innerHTML +=
          '<div class="mut" style="margin-top:8px;color:#fbbf24">Uwaga: "250" to 250 świec 5-min (symulacja),
           nie 250 sesji dziennych. Wynik orientacyjny na danych demo/synth — nie prognoza.</div>';
      }
    };
    global.backtest.__hard = true;
  }

  function banner() {
    var id = 'btx-engine-hard';
    var el = document.getElementById(id);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = id;
      el.style.cssText =
        'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(52,211,153,.35);' +
        'background:rgba(16,185,129,.08);font-size:12px;color:#d1fae5;line-height:1.45';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var w = warsawParts();
    el.innerHTML =
      '<b>Engine Hardening ON</b> · LIVE bez syntetycznych świec · weekend FX OFF · reset dnia · ' +
      'limit z floating · slip · size≤risk · TP w minHold · flat końcówka US · ' +
      w.label + (anyLive() ? ' · dane LIVE aktywne' : ' · brak świeżego LIVE (synth fallback)');
  }

  function boot() {
    ensureDayReset();
    patchSession();
    patchIndicators();
    patchFetchReal();
    patchCheckLimits();
    patchClosePos();
    patchOpenPos();
    patchCycle();
    patchBacktest();
    banner();
    setInterval(function () {
      ensureDayReset();
      patchSession();
      patchIndicators();
      patchFetchReal();
      patchCheckLimits();
      patchClosePos();
      patchOpenPos();
      patchCycle();
      patchBacktest();
      banner();
    }, 5000);
  }

  global.BTX_HARDENING = {
    ensureDayReset: ensureDayReset,
    sessionOpenFixed: sessionOpenFixed,
    isLive: isLive,
    floatingPnl: floatingPnl
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
