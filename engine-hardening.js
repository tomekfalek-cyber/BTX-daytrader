/**
 * BTX Engine Hardening
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
      if (global.log) global.log('Nowy dzien handlowy PL - reset limitow dnia', 'i');
      try { if (typeof global.save === 'function') global.save(); } catch (e) {}
    }
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
    return Date.now() - ST.liveSource[sym] < 45 * 60 * 1000;
  }

  function anyLive() {
    var ST = global.ST;
    if (!ST || !ST.liveSource) return false;
    var t = Date.now();
    return Object.keys(ST.liveSource).some(function (k) { return t - ST.liveSource[k] < 45 * 60 * 1000; });
  }

  function sessionOpenFixed(mkt) {
    var w = warsawParts();
    if (w.weekend) return false;
    var h = w.min / 60;
    if (mkt === 'US') return h >= 15.5 && h < 22;
    if (mkt === 'PL' || mkt === 'EU') return h >= 9 && h < 17.5;
    return h >= 1 && h < 23;
  }

  function applySlip(price, side, isEntry) {
    var CFG = global.CFG || {};
    var slip = Number(CFG.slip || CFG.slippage || 0);
    if (!slip || !price) return price;
    var s = Math.abs(slip) / 100;
    if (side === 'LONG') return isEntry ? price * (1 + s) : price * (1 - s);
    return isEntry ? price * (1 - s) : price * (1 + s);
  }

  function patchSession() {
    global.sessionOpen = sessionOpenFixed;
  }

  function patchFetchReal() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__hard) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      var map = { EURUSD: 'EUR/USD', 'XAU/USD': 'XAU/USD', XAUUSD: 'XAU/USD' };
      var req = map[sym] || sym;
      var r = await orig.call(this, req);
      try {
        if (global.ST && global.ST.series && global.ST.series[req] && !global.ST.series[sym]) {
          global.ST.series[sym] = global.ST.series[req];
        }
        markLive(sym);
      } catch (e) {}
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
      var mark = ST.equity;
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
      var b = document.getElementById('limit-badge');
      if (b && global.fp) {
        b.textContent = blocked ? 'BLOKADA DNIA' : ('limit OK · ' + global.fp(dd));
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
      if (p && px != null) px = applySlip(px, p.side, false);
      var beforeConsec = ST ? ST.consecLoss : 0;
      var ret = orig.apply(this, arguments);
      try {
        if (ST && ST.closed && ST.closed[0] && ST.closed[0].sym === sym) {
          var tr = ST.closed[0];
          var feeOnly = wasBe || why === 'BE' || why === 'be' || (tr.pnl < 0 && Math.abs(tr.pnl) < (entry || 1) * 0.0008 * (tr.qty || 1));
          if (feeOnly && tr.pnl <= 0) ST.consecLoss = beforeConsec;
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
      var m = null;
      (global.SYMBOLS || []).forEach(function (x) { if (x.s === g.sym) m = x; });
      var mkt = (m && m.mkt) || (/EUR|XAU|GOLD|USD/.test(g.sym) ? 'FX' : 'US');
      if (!sessionOpenFixed(mkt)) return;
      var w = warsawParts();
      if (mkt === 'US' && w.min >= 21 * 60 + 30) return;
      var riskCash = (ST.equity || CFG.capital || 0) * ((CFG.risk || 0.5) / 100);
      var sd = (g.atr || g.price * 0.004) * 1.5;
      if (sd <= 0) return;
      var q = Math.floor(riskCash / sd);
      if (q < 1) {
        if (riskCash / sd < 0.85) return;
        q = 1;
      }
      var entry = applySlip(g.price, g.side, true);
      var g2 = Object.assign({}, g, { price: entry });
      var beforeKeys = Object.keys(ST.pos || {});
      var ret = orig.call(this, g2);
      var afterKeys = Object.keys(ST.pos || {});
      var neu = afterKeys.filter(function (k) { return beforeKeys.indexOf(k) < 0; });
      if (neu.length) {
        var p = ST.pos[neu[0]];
        if (p) {
          if (p.qty > q && q >= 1) {
            ST.cash += (p.qty - q) * p.entry;
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

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__hard) return;
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
          if (typeof global.nextBar === 'function') {
            a.push(global.nextBar(m, a[a.length - 1]));
            if (a.length > 400) a.shift();
          }
        }
        if (ST.cool && ST.cool[m.s] > 0) ST.cool[m.s]--;
      }
      var w = warsawParts();
      var forceFlatUS = !w.weekend && w.min >= 21 * 60 + 45;
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
        if (!p.be) {
          var mv = p.side === 'LONG' ? (b.c - p.entry) : (p.entry - b.c);
          if (mv >= p.risk0) {
            p.stop = p.entry;
            p.be = true;
          }
        }
        var minH = CFG.minHold || 4;
        var inMin = p.bars < minH;
        if (p.side === 'LONG') {
          if (b.l <= stp0) { global.closePos(k, p.be ? 'BE-stop' : 'stop', Math.min(stp0, b.o)); continue; }
          if (b.h >= p.target) { global.closePos(k, 'target', Math.max(p.target, b.o)); continue; }
        } else {
          if (b.h >= stp0) { global.closePos(k, p.be ? 'BE-stop' : 'stop', Math.max(stp0, b.o)); continue; }
          if (b.l <= p.target) { global.closePos(k, 'target', Math.min(p.target, b.o)); continue; }
        }
        if (!inMin && p.bars >= (CFG.timeStop || 60)) global.closePos(k, 'time-stop', b.c);
      }
      var sg = typeof global.signals === 'function' ? global.signals() : [];
      ST.sig = sg;
      var ranked = sg.filter(function (x) { return x.side !== 'WAIT'; }).sort(function (a, b) { return b.strength - a.strength; });
      for (var q = 0; q < ranked.length; q++) {
        var g = ranked[q];
        if (ST.pos[g.sym]) continue;
        if (ST.cool && ST.cool[g.sym] > 0) continue;
        if (Object.keys(ST.pos).length >= (CFG.maxPos || 2)) break;
        if (typeof global.openPos === 'function') global.openPos(g);
      }
      ST.eq = ST.eq || [];
      ST.eq.push(ST.equity);
      if (ST.eq.length > 400) ST.eq.shift();
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
        el.innerHTML += '<div class="mut" style="margin-top:8px;color:#fbbf24">Uwaga: 250 to swiece 5-min, nie 250 sesji. Wynik orientacyjny.</div>';
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
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(52,211,153,.35);background:rgba(16,185,129,.08);font-size:12px;color:#d1fae5';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var w = warsawParts();
    el.innerHTML = '<b>Engine Hardening ON</b> · ' + w.label + (anyLive() ? ' · LIVE' : ' · synth fallback');
  }

  function boot() {
    try { if (global.CFG && (global.CFG.slip == null || global.CFG.slip === '')) global.CFG.slip = 0.03; } catch (e) {}
    ensureDayReset();
    patchSession();
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
    isLive: isLive
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
