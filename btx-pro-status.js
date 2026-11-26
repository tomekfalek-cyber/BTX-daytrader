/**
 * Jeden czytelny pasek statusu PRO na pulpicie (zamiast chaosu wielu boxow).
 */
(function (global) {
  'use strict';
  if (global.__BTX_PRO_STATUS__) return;
  global.__BTX_PRO_STATUS__ = true;

  function el() {
    var desk = document.getElementById('pane-desk');
    if (!desk) return null;
    var n = document.getElementById('btx-pro-status');
    if (!n) {
      n = document.createElement('div');
      n.id = 'btx-pro-status';
      n.style.cssText = 'margin:10px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,rgba(15,23,42,.95),rgba(6,30,50,.9));color:#e2e8f0;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      desk.insertBefore(n, desk.firstChild);
    }
    return n;
  }

  function tick() {
    var n = el();
    if (!n) return;
    var ST = global.ST || {};
    var C = global.BTX_CANON || {};
    var td = ST.dayTrades || 0;
    var openN = ST.pos ? Object.keys(ST.pos).length : 0;
    var eq = ST.equity != null ? ST.equity : (ST.cash || 0);
    var blocked = ST.blocked ? 'BLOKADA' : 'AKTYWNY';
    var col = ST.blocked ? '#f87171' : '#4ade80';
    var live = 'DEMO';
    try {
      if (global.BTX_LIVE && global.BTX_LIVE.getKey && global.BTX_LIVE.getKey()) live = 'TWELVE';
    } catch (e) {}
    n.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center">' +
      '<div><b style="color:#f8fafc;font-size:14px">BTX PRO</b> <span style="color:#94a3b8">' + (C.version || '') + '</span></div>' +
      '<div>Status: <b style="color:' + col + '">' + blocked + '</b></div>' +
      '<div>Dane: <b style="color:#38bdf8">' + live + '</b></div>' +
      '<div>Equity: <b>' + (Number(eq).toFixed(2)) + '</b></div>' +
      '<div>Dziś: <b>' + td + '</b> / cel ' + (C.targetTradesPerDay || 2) + ' · otwarte <b>' + openN + '</b>/' + (C.maxPos || 2) + '</div>' +
      '<div>Risk <b>' + (C.riskPct || 0.35) + '%</b> · min siła <b>' + (C.minStrengthOpen || 3) + '</b></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:11.5px;color:#94a3b8">Paper → ręczne XTB · EOD flat · partial+trail · gate PRO · backtest vs RANDOM przy kluczu Twelve</div>';
  }

  function boot() {
    tick();
    setInterval(tick, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
})(typeof window !== 'undefined' ? window : globalThis);
