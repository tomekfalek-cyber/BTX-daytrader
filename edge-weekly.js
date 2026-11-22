/**
 * 5) Tygodniowy log setupow + przypomnienie testu vs losowe wejscia.
 */
(function (global) {
  'use strict';
  if (global.__BTX_EDGE_WEEK__) return;
  global.__BTX_EDGE_WEEK__ = true;

  var LS = 'BTX_EDGE_WEEK_V1';

  function load() {
    try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {}
  }
  function weekKey() {
    var d = new Date();
    var onejan = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + week;
  }
  function onClose(sym, why, px) {
    try {
      var ST = global.ST;
      if (!ST || !ST.closed || !ST.closed.length) return;
      var t = ST.closed[0];
      if (!t) return;
      var o = load();
      var wk = weekKey();
      o[wk] = o[wk] || { n: 0, wins: 0, byGrade: {}, byMkt: {} };
      var b = o[wk];
      b.n++;
      if ((t.pnl || 0) > 0) b.wins++;
      var gr = (t.grade || t.deskGrade || 'B');
      b.byGrade[gr] = b.byGrade[gr] || { n: 0, wins: 0 };
      b.byGrade[gr].n++;
      if ((t.pnl || 0) > 0) b.byGrade[gr].wins++;
      var mkt = t.mkt || 'US';
      b.byMkt[mkt] = b.byMkt[mkt] || { n: 0, wins: 0, pnl: 0 };
      b.byMkt[mkt].n++;
      if ((t.pnl || 0) > 0) b.byMkt[mkt].wins++;
      b.byMkt[mkt].pnl += (+t.pnl || 0);
      save(o);
    } catch (e) {}
  }
  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__edgeWeek) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var r = orig.apply(this, arguments);
      onClose(sym, why, px);
      return r;
    };
    global.closePos.__edgeWeek = true;
  }
  function summaryText() {
    var o = load();
    var wk = weekKey();
    var b = o[wk];
    if (!b || !b.n) return 'Ten tydzień: brak zamkniętych paper trade’ów. Zbieraj historię 2–3 tygodnie i porównaj z backtestem „losowe wejścia”.';
    var wr = Math.round(100 * b.wins / b.n);
    var g = Object.keys(b.byGrade || {}).map(function (k) {
      var x = b.byGrade[k];
      return k + ' ' + x.wins + '/' + x.n;
    }).join(', ');
    return 'Tydzień ' + wk + ': ' + b.n + ' trade’ów, WR ' + wr + '% · grade: ' + (g || '—') +
      '. Jeśli WR ≈ losowego backtestu przy tych samych SL/TP — brak przewagi.';
  }
  function banner() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var el = document.getElementById('btx-edge-week');
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-edge-week';
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(167,139,250,.35);background:rgba(76,29,149,.2);font-size:12px;color:#ddd6fe';
      pane.appendChild(el);
    }
    // only show in full desk or always compact one line
    el.textContent = summaryText();
  }
  function boot() {
    patchClose();
    banner();
    if (global.BTX_TICK && global.BTX_TICK.on) {
      global.BTX_TICK.on(function () { patchClose(); banner(); }, 'edge-week');
    } else setInterval(function () { patchClose(); banner(); }, 8000);
  }
  global.BTX_EDGE_WEEK = { summary: summaryText };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1400); });
  else setTimeout(boot, 1400);
})(typeof window !== 'undefined' ? window : globalThis);
