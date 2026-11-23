/**
 * BTX Pro Trade Level — handel + dashboard na wyzszym poziomie.
 * - dedupe why (koniec spamu VPVR/LIVE)
 * - autonomia zawsze proboje po cyklu
 * - BE po +1R (daytrading)
 * - ranking jakosci A+/A preferowany
 * - czystszy styl pulpitu
 */
(function (global) {
  'use strict';
  if (global.__BTX_PRO_TRADE_LEVEL__) return;
  global.__BTX_PRO_TRADE_LEVEL__ = true;

  function dedupeWhy(why) {
    if (!why) return '';
    var s = String(why);
    s = s.replace(/(\s*[|·]\s*VPVR:[^|·]*)+/gi, function (m) {
      var one = m.match(/VPVR:[^|·]+/i);
      return one ? (' · ' + one[0].trim()) : '';
    });
    var parts = s.split(/\s*[|·]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    var seen = {}, out = [];
    parts.forEach(function (p) {
      var k = p.toLowerCase().replace(/\s+/g, ' ');
      if (seen[k]) return;
      if (/LIVE nieświeże|LIVE nieswieze/i.test(p)) {
        if (!seen['live-weak']) { out.push('dane paper'); seen['live-weak'] = 1; }
        return;
      }
      if (/seria \(brak LIVE/i.test(p)) return;
      seen[k] = 1;
      out.push(p);
    });
    return out.slice(0, 6).join(' · ');
  }

  function cleanSignals() {
    var ST = global.ST;
    if (!ST || !ST.sig) return;
    ST.sig.forEach(function (g) {
      if (!g) return;
      if (g.why) g.why = dedupeWhy(g.why);
    });
  }

  function forceTradeFlags() {
    try {
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
      localStorage.setItem('BTX_KILL_SWITCH', '0');
    } catch (e) {}
    if (global.ST) {
      global.ST.blocked = false;
      global.ST.stopForDay = false;
    }
  }

  function tryOpenSmart() {
    forceTradeFlags();
    cleanSignals();
    if (global.BTX_APEX && typeof global.BTX_APEX.tryOpen === 'function') {
      var a = global.BTX_APEX.tryOpen();
      if (a) return a;
    }
    if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.tryOpenBest === 'function') {
      return global.BTX_AUTONOMY.tryOpenBest();
    }
    // fallback: najlepszy sygnal z strength>=2
    var ST = global.ST;
    if (!ST || !ST.sig) return null;
    var maxP = (global.CFG && global.CFG.maxPos) || 2;
    if (Object.keys(ST.pos || {}).length >= maxP) return null;
    var list = ST.sig.filter(function (g) {
      return g && (g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 2 && !ST.pos[g.sym];
    }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    if (!list.length || typeof global.openPos !== 'function') return null;
    global.openPos(list[0]);
    if (global.log) global.log('PRO-LEVEL OPEN ' + list[0].side + ' ' + list[0].sym, 'g');
    return list[0];
  }

  /** BE: gdy cena poszla +1R, stop na entry */
  function manageBE() {
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    Object.keys(ST.pos).forEach(function (sym) {
      var p = ST.pos[sym];
      if (!p || p.be) return;
      var px = null;
      try {
        if (typeof global.last === 'function' && global.last(sym)) px = global.last(sym).c;
      } catch (e) {}
      if (px == null && ST.series && ST.series[sym] && ST.series[sym].length) {
        px = ST.series[sym][ST.series[sym].length - 1].c;
      }
      if (px == null) return;
      var risk = p.risk0 || Math.abs(p.entry - p.stop) || 0;
      if (!(risk > 0)) return;
      var move = p.side === 'LONG' ? (px - p.entry) : (p.entry - px);
      if (move >= risk * 1.0) {
        p.stop = p.entry;
        p.be = true;
        if (global.log) global.log('BE ' + sym + ' @ ' + p.entry, 'i');
      }
    });
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__proLevel) return;
    var orig = global.cycle;
    global.cycle = function () {
      forceTradeFlags();
      var r = orig.apply(this, arguments);
      try {
        cleanSignals();
        manageBE();
        tryOpenSmart();
      } catch (e) {}
      return r;
    };
    global.cycle.__proLevel = true;
  }

  function injectDashCss() {
    if (document.getElementById('btx-pro-level-css')) return;
    var s = document.createElement('style');
    s.id = 'btx-pro-level-css';
    s.textContent = [
      '#pane-desk{max-width:1100px}',
      '#btx-session-cards{margin:12px 0!important}',
      '#btx-trade-hero{order:1}',
      '#btx-session-cards{order:2}',
      '#btx-open-positions{order:3}',
      '#btx-cap-banner,#btx-kernel-banner,#btx-eu-morning{font-size:12px!important}',
      '.topbar h1{letter-spacing:.04em}',
      '#pane-desk .card h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}',
      'body.btx-desk-min #pane-desk > div{margin-bottom:10px}'
    ].join('');
    document.head.appendChild(s);
  }

  function statusLine() {
    var el = document.getElementById('btx-pro-level-status');
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-pro-level-status';
      el.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:10px;border:1px solid rgba(52,211,153,.3);background:rgba(6,78,59,.25);font-size:12px;color:#a7f3d0';
      var bar = document.getElementById('btx-desk-min-bar');
      if (bar) bar.after(el);
      else pane.insertBefore(el, pane.firstChild);
    }
    var ST = global.ST || {};
    var posN = ST.pos ? Object.keys(ST.pos).length : 0;
    var act = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); }).length;
    el.textContent = 'PRO LEVEL · autonomia ON · STOP DAY off · sygnały ' + act + ' · pozycje ' + posN +
      '/' + ((global.CFG && global.CFG.maxPos) || 2) + ' · cash ' + (ST.cash != null ? Number(ST.cash).toFixed(2) : '—');
  }

  function boot() {
    forceTradeFlags();
    injectDashCss();
    patchCycle();
    cleanSignals();
    manageBE();
    statusLine();
    setInterval(function () {
      forceTradeFlags();
      patchCycle();
      cleanSignals();
      manageBE();
      statusLine();
    }, 4000);
  }

  global.BTX_PRO_LEVEL = { tryOpenSmart: tryOpenSmart, cleanSignals: cleanSignals };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})(typeof window !== 'undefined' ? window : globalThis);
