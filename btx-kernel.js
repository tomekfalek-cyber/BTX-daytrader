/**
 * BTX KERNEL — jedna warstwa nadrzedna (daytrading paper → reczne XTB).
 * Hierarchia: kernel > dt-config/APEX > strategy-pro > autonomia.
 * Cel: dzialajacy daytrader bez martwych blokad (LIVE/SPY/STOP/observe).
 */
(function (global) {
  'use strict';
  if (global.__BTX_KERNEL__) return;
  global.__BTX_KERNEL__ = true;

  var FULL = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', ccy: 'USD' },
    { s: 'ANT', n: 'Anthropic', t: 'Akcja', b: 83, v: 0.0035, mkt: 'US', xtb: 'ANT.US', ccy: 'USD' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', ccy: 'USD' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', ccy: 'USD' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', ccy: 'USD' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', ccy: 'USD' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', ccy: 'USD' },
    { s: 'ASML', n: 'ASML Holding', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', xtb: 'ASML.NL', ccy: 'EUR' },
    { s: 'SAP', n: 'SAP SE', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', xtb: 'SAP.DE', ccy: 'EUR' },
    { s: 'SIE.DE', n: 'Siemens', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', xtb: 'SIE.DE', ccy: 'EUR' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', ccy: 'USD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', xtb: 'GBPUSD', ccy: 'USD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', xtb: 'USDJPY', ccy: 'JPY' }
  ];

  function warsaw() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function unlockStorage() {
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_LEARNER_MODE', 'trade');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
      if (localStorage.getItem('BTX_ALLOW_STOP_DAY') == null) {
        localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      }
      localStorage.setItem('BTX_SESSION_PROFILE', 'ALL');
    } catch (e) {}
  }

  function applyPro() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    var C = global.CFG;
    if (P) {
      P.scoreMin = 3;
      P.primeExtra = 0;
      P.minStrengthOpen = 2;
      P.minRvol = 0.35;
      P.strictCore = false;
      P.requireTrend = false;
      P.allowShort = true;
      P.closeBufferMin = 15;
      P.flatBeforeCloseMin = 12;
      P.tpR = P.tpR || 2.0;
      P.maxPos = 2;
      P.maxDayTrades = 6;
      P.dailyLossPct = P.dailyLossPct || 1.25;
      if (!P.sessions) P.sessions = {};
      // utcMin zima ≈ PL-60
      P.sessions.US = { open: 14 * 60 + 30, close: 21 * 60, prime: [[14 * 60 + 35, 17 * 60], [18 * 60, 20 * 60 + 30]] };
      P.sessions.EU = { open: 8 * 60, close: 16 * 60 + 30, prime: [[8 * 60 + 5, 11 * 60], [14 * 60, 16 * 60]] };
      P.sessions.FX = { open: 7 * 60, close: 21 * 60, prime: [[8 * 60, 12 * 60], [14 * 60 + 30, 18 * 60]] };
    }
    if (C) {
      C.risk = 0.35;
      C.maxPos = 2;
      C.maxTrades = 6;
      C.dailyLoss = 1.25;
      C.allowShort = true;
      C.scan = { US: true, EU: true, PL: false, FX: true };
      C.autoSec = C.autoSec || 120;
    }
  }

  function applyUniverse() {
    global.SYMBOLS = FULL.map(function (m) {
      return { s: m.s, n: m.n, t: m.t, b: m.b, v: m.v, mkt: m.mkt, xtb: m.xtb, ccy: m.ccy };
    });
    var ST = global.ST;
    if (ST) {
      ST.series = ST.series || {};
      FULL.forEach(function (m) {
        if (!ST.series[m.s] && typeof global.initSeries === 'function') {
          try { ST.series[m.s] = global.initSeries(m, 150); } catch (e) {}
        }
      });
    }
    ['chart-sym', 'ai-sym'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      if (sel.options.length !== FULL.length) {
        sel.innerHTML = FULL.map(function (m) {
          return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + ' (' + m.ccy + ')</option>';
        }).join('');
        if (FULL.some(function (m) { return m.s === cur; })) sel.value = cur;
      }
    });
  }

  function clearBadBlocks() {
    try {
      if (localStorage.getItem('BTX_ALLOW_STOP_DAY') !== '1' && global.ST) {
        global.ST.blocked = false;
        global.ST.stopForDay = false;
      }
    } catch (e) {}
  }

  function refreshSignals() {
    try {
      if (typeof global.signals === 'function' && global.ST) {
        global.ST.sig = global.signals() || [];
      }
    } catch (e) {}
  }

  function tryOpen() {
    try {
      if (global.BTX_APEX && typeof global.BTX_APEX.tryOpen === 'function') {
        var a = global.BTX_APEX.tryOpen();
        if (a) return a;
      }
      if (global.BTX_AUTONOMY) {
        if (typeof global.BTX_AUTONOMY.tryOpenBest === 'function') return global.BTX_AUTONOMY.tryOpenBest();
        if (typeof global.BTX_AUTONOMY.tryOpen === 'function') return global.BTX_AUTONOMY.tryOpen();
      }
    } catch (e) {}
    return null;
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__kernel) return;
    var orig = global.cycle;
    global.cycle = function () {
      unlockStorage();
      applyPro();
      applyUniverse();
      clearBadBlocks();
      var ret = orig.apply(this, arguments);
      refreshSignals();
      tryOpen();
      statusBanner();
      return ret;
    };
    global.cycle.__kernel = true;
  }

  function statusBanner() {
    var el = document.getElementById('btx-kernel-banner');
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-kernel-banner';
      el.style.cssText = 'margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.45);background:linear-gradient(90deg,rgba(16,185,129,.14),rgba(15,23,42,.9));font-size:12.5px;color:#d1fae5';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var w = warsaw();
    var us = !w.weekend && w.min >= 15 * 60 + 30 && w.min < 22 * 60;
    var entry = us && w.min < 21 * 60 + 45;
    var sig = (global.ST && global.ST.sig) || [];
    var act = sig.filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    var pos = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
    var live = 0;
    try {
      if (global.ST && global.ST.liveSource) {
        var now = Date.now();
        Object.keys(global.ST.liveSource).forEach(function (k) {
          if (now - global.ST.liveSource[k] < 45 * 60 * 1000) live++;
        });
      }
    } catch (e2) {}
    el.innerHTML = '<b style="color:#6ee7b7">BTX KERNEL</b> · ' + w.label + ' PL · ' +
      (us ? (entry ? '<b style="color:#86efac">US OPEN</b>' : '<b style="color:#fde68a">US zarządzanie</b>') : '<b style="color:#fca5a5">US zamknięta</b>') +
      ' · skan <b>' + sig.length + '</b> · aktywne <b>' + act.length + '</b> · pozycje <b>' + pos + '</b> · LIVE ' + live + '/' + FULL.length +
      (act.length ? ' · <span style="color:#fbbf24">' + act.map(function (g) { return g.side + ' ' + g.sym; }).join(', ') + '</span>' : '');
  }

  function boot() {
    unlockStorage();
    applyPro();
    applyUniverse();
    clearBadBlocks();
    patchCycle();
    refreshSignals();
    statusBanner();
    setInterval(function () {
      unlockStorage();
      applyPro();
      applyUniverse();
      clearBadBlocks();
      patchCycle();
      refreshSignals();
      statusBanner();
    }, 4000);
  }

  global.BTX_KERNEL = { apply: boot, list: FULL };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
})(typeof window !== 'undefined' ? window : globalThis);
