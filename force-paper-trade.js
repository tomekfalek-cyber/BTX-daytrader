/**
 * Paper helper PRO — tylko ręczny przycisk, siła ≥ 3, risk 0.35%.
 */
(function (global) {
  'use strict';
  if (global.__BTX_FORCE_PAPER__) return;
  global.__BTX_FORCE_PAPER__ = true;

  function log(msg, k) {
    try { if (typeof global.log === 'function') global.log(msg, k || 'g'); } catch (e) {}
    try { if (global.toast) global.toast(msg, k === 'r' ? 'err' : 'ok'); } catch (e2) {}
  }

  function lastPrice(sym) {
    var ST = global.ST;
    var a = ST && ST.series && ST.series[sym];
    if (a && a.length) return +a[a.length - 1].c;
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return +list[i].b || 100;
    return 100;
  }

  function paperOpen(g) {
    var ST = global.ST, CFG = global.CFG;
    if (!ST || !CFG || !g) return false;
    if (ST.blocked) { log('Limit dnia — nie otwieram', 'r'); return false; }
    if (g.side !== 'LONG' && g.side !== 'SHORT') return false;
    if ((g.strength || 0) < 3) { log('Siła < 3 — za słaby setup PRO', 'r'); return false; }
    if (ST.pos[g.sym]) return false;
    if (Object.keys(ST.pos || {}).length >= (CFG.maxPos || 2)) return false;
    if ((ST.dayTrades || 0) >= (CFG.maxTrades || 4)) return false;

    var price = +g.price || lastPrice(g.sym);
    if (!(price > 0)) return false;
    var atr = +g.atr || price * 0.003;
    var sd = Math.max(price * 0.0015, atr * 1.2);
    var riskAmt = (ST.equity || CFG.capital || 10000) * 0.0035;
    var q = Math.max(1, Math.floor(riskAmt / sd));
    var maxN = (ST.equity || 10000) * 0.15;
    if (q * price > maxN) q = Math.max(1, Math.floor(maxN / price));
    if (q < 1) return false;

    var stop = g.side === 'LONG' ? price - sd : price + sd;
    var tgt = g.side === 'LONG' ? price + 2.0 * sd : price - 2.0 * sd;
    var margin = Math.min((ST.cash || riskAmt) * 0.25, riskAmt * 1.5);

    ST.dayTrades = (ST.dayTrades || 0) + 1;
    ST.pos[g.sym] = {
      sym: g.sym, side: g.side, qty: q, entry: price, stop: stop, target: tgt,
      why: (g.why || '') + ' [PRO paper]', bars: 0, risk0: sd, be: false,
      at: new Date().toLocaleTimeString('pl-PL'), openedAt: Date.now(),
      margin: margin, riskAmt: riskAmt, paper: true
    };
    if (ST.cash > margin) ST.cash -= margin;
    log('PRO OPEN ' + g.side + ' ' + g.sym + ' x' + q + ' risk~' + riskAmt.toFixed(2), 'g');
    try {
      if (typeof global.render === 'function') global.render();
      if (typeof global.save === 'function') global.save();
    } catch (e) {}
    return true;
  }

  function tryBestQuality() {
    var ST = global.ST;
    if (!ST || ST.blocked) return;
    if (Object.keys(ST.pos || {}).length > 0) return;
    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }
    var sig = (ST.sig || []).filter(function (g) {
      return g && (g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 3;
    });
    sig.sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    if (sig.length) paperOpen(sig[0]);
    else log('Brak setupu siła≥3 — czekam (PRO)', 'r');
  }

  function ensureBtn() {
    var pane = document.getElementById('pane-desk');
    if (!pane || document.getElementById('btx-force-open-btn')) return;
    var d = document.createElement('div');
    d.id = 'btx-force-open-wrap';
    d.style.cssText = 'margin:12px 0;padding:14px;border-radius:12px;border:1px solid rgba(18,196,139,.35);background:rgba(18,196,139,.08);';
    d.innerHTML = '<b style="color:#6ee7b7">PRO paper</b>' +
      '<div style="font-size:12px;color:#94a3b8;margin:6px 0 10px;line-height:1.45">' +
      'Tylko setup siła ≥ 3. Ryzyko 0,35% / trade. Max 4 trade’y / dzień. Limit straty dnia 1%.</div>' +
      '<button type="button" id="btx-force-open-btn" style="cursor:pointer;padding:10px 14px;border:0;border-radius:8px;background:#0d9488;color:#ecfdf5;font-weight:700">' +
      'Otwórz najlepszy setup PRO (jeśli jest)</button>';
    pane.insertBefore(d, pane.firstChild);
    document.getElementById('btx-force-open-btn').onclick = function () { tryBestQuality(); };
  }

  function boot() {
    ensureBtn();
    setInterval(ensureBtn, 8000);
  }

  global.BTX_FORCE_PAPER = { open: paperOpen, tryForce: tryBestQuality };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
