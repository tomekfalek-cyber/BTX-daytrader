/**
 * BTX APEX — ranking jakości + dyscyplina małego konta.
 */
(function (global) {
  'use strict';
  if (global.__BTX_APEX__) return;
  global.__BTX_APEX__ = true;

  var PRI = ['SPY', 'QQQ', 'EURUSD', 'NVDA', 'AAPL', 'META', 'TSLA', 'GBPUSD', 'ASML', 'USDJPY', 'SAP', 'SIE.DE'];

  function P() { return global.BTX_STRATEGY_PRO || global.BTX_PRO || {}; }
  function CFG() { return global.CFG || {}; }
  function prio(sym) { var i = PRI.indexOf(sym); return i < 0 ? 50 : i; }
  function corrFamily(sym) {
    if (/SPY|QQQ|NVDA|TSLA|META|AAPL/.test(sym)) return 'US_RISK';
    if (/ASML|SAP|SIE/.test(sym)) return 'EU_RISK';
    if (/EURUSD|GBPUSD/.test(sym)) return 'FX_EU';
    if (/USDJPY/.test(sym)) return 'FX_JP';
    return sym;
  }
  function openFamilies() {
    var ST = global.ST, out = {};
    if (!ST || !ST.pos) return out;
    Object.keys(ST.pos).forEach(function (s) { out[corrFamily(s)] = true; });
    return out;
  }
  function warsawMin() {
    try {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false });
      var map = {};
      fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
      return parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    } catch (e) { return 12 * 60; }
  }
  function inPrimeRough() {
    var m = warsawMin();
    return (m >= 8 * 60 + 30 && m <= 11 * 60) ||
      (m >= 15 * 60 + 30 && m <= 18 * 60) ||
      (m >= 19 * 60 && m <= 20 * 60 + 30);
  }
  function qualityScore(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return -1;
    var s = (g.strength || 0) * 20;
    s += Math.max(0, 12 - prio(g.sym));
    if (/ORB/i.test(g.why || '')) s += 8;
    if (/RSI\(2\)|HTF|VWAP/i.test(g.why || '')) s += 6;
    if (inPrimeRough()) s += 10; else s -= 5;
    var fam = openFamilies();
    if (fam[corrFamily(g.sym)]) s -= 40;
    try {
      if (global.BTX_LIVE && global.BTX_LIVE.isFresh && global.BTX_LIVE.isFresh(g.sym)) s += 15;
      else s -= 25;
    } catch (e) {}
    return s;
  }
  function rank() {
    var sig = (global.ST && global.ST.sig) || [], out = [];
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      out.push({ g: g, q: qualityScore(g) });
    }
    out.sort(function (a, b) { return b.q - a.q; });
    return out;
  }
  function canTradeMore() {
    var ST = global.ST, C = CFG(), Pr = P();
    if (!ST || ST.blocked) return false;
    if (Object.keys(ST.pos || {}).length >= (C.maxPos || Pr.maxPos || 2)) return false;
    if ((ST.dayTrades || 0) >= (C.maxTrades || Pr.maxDayTrades || 6)) return false;
    if (Pr.dailyLossPct > 0 && ST.dayStart > 0 && ST.equity != null) {
      var dd = (ST.equity - ST.dayStart) / ST.dayStart * 100;
      if (dd <= -Pr.dailyLossPct) return false;
    }
    if ((ST.consecLoss || 0) >= (C.maxConsec || Pr.maxConsecLoss || 3)) return false;
    return true;
  }
  function tryOpen() {
    if (!canTradeMore()) return null;
    var need = P().minStrengthOpen || 2;
    if (!inPrimeRough()) need = Math.max(need, 3);
    var ranked = rank();
    for (var i = 0; i < ranked.length; i++) {
      var r = ranked[i];
      if (r.q < 25) continue;
      if ((r.g.strength || 0) < need) continue;
      if (global.ST.pos && global.ST.pos[r.g.sym]) continue;
      if (global.ST.cool && global.ST.cool[r.g.sym] > 0) continue;
      if (typeof global.openPos === 'function') {
        global.openPos(r.g);
        if (global.log) global.log('APEX OPEN ' + r.g.side + ' ' + r.g.sym + ' q=' + Math.round(r.q) + ' s' + (r.g.strength || 0) + (inPrimeRough() ? ' prime' : ' off-prime'), 'g');
        return r;
      }
    }
    return null;
  }
  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || global.BTX_AUTONOMY.__apex) return;
    var prev = global.BTX_AUTONOMY.tryOpenBest;
    global.BTX_AUTONOMY.tryOpenBest = function () {
      var r = tryOpen();
      if (r) return r;
      return typeof prev === 'function' ? prev.apply(this, arguments) : null;
    };
    global.BTX_AUTONOMY.__apex = true;
  }
  function banner() {
    var el = document.getElementById('btx-apex-banner');
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-apex-banner';
      el.style.cssText = 'margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(245,179,1,.35);background:rgba(245,179,1,.08);font-size:12.5px;line-height:1.45;color:#fde68a';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var C = CFG(), Pr = P();
    el.innerHTML = '<b style="color:#fbbf24">APEX daytrade</b> \u00b7 risk <b>' + (C.risk || Pr.riskPct || 0.35) + '%</b> \u00b7 max <b>' +
      (C.maxPos || 2) + '</b> poz. \u00b7 \u2264<b>' + (C.maxTrades || 6) + '</b> trade/dzie\u0144 \u00b7 limit dnia <b>' +
      (C.dailyLoss || Pr.dailyLossPct || 1.25) + '%</b> \u00b7 TP <b>' + (Pr.tpR || 2) + 'R</b> \u00b7 ' +
      (inPrimeRough() ? '<span style="color:#86efac">okno PRIME</span>' : '<span style="color:#fca5a5">poza prime \u2192 tylko si\u0142a\u22653</span>');
  }
  function boot() {
    patchAutonomy();
    banner();
    setInterval(function () { patchAutonomy(); banner(); }, 5000);
  }
  global.BTX_APEX = { rank: rank, tryOpen: tryOpen, qualityScore: qualityScore, inPrime: inPrimeRough };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
