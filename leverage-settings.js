/**
 * Dźwignia z ustawień — synchronizacja CFG + podpowiedź na pulpicie.
 */
(function (global) {
  'use strict';
  if (global.__BTX_LEV_SET__) return;
  global.__BTX_LEV_SET__ = true;

  function clamp() {
    var CFG = global.CFG;
    if (!CFG) return;
    CFG.fxLev = Math.max(1, Math.min(30, +(CFG.fxLev || 20) || 20));
    CFG.eqLev = Math.max(1, Math.min(10, +(CFG.eqLev || 1) || 1));
    try {
      localStorage.setItem('BTX_FX_LEV', String(CFG.fxLev));
      localStorage.setItem('BTX_EQ_LEV', String(CFG.eqLev));
    } catch (e) {}
  }

  function fromLS() {
    var CFG = global.CFG;
    if (!CFG) return;
    try {
      if (CFG.fxLev == null) {
        var a = localStorage.getItem('BTX_FX_LEV');
        if (a != null) CFG.fxLev = +a;
      }
      if (CFG.eqLev == null) {
        var b = localStorage.getItem('BTX_EQ_LEV');
        if (b != null) CFG.eqLev = +b;
      }
    } catch (e) {}
    if (CFG.fxLev == null) CFG.fxLev = 20;
    if (CFG.eqLev == null) CFG.eqLev = 1;
    clamp();
  }

  function tip() {
    var el = document.getElementById('btx-lev-tip');
    var pane = document.getElementById('pane-cfg');
    if (!pane) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-lev-tip';
      el.style.cssText = 'margin:10px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(96,165,250,.3);background:rgba(30,58,138,.2);font-size:12px;color:#bfdbfe';
      pane.appendChild(el);
    }
    var CFG = global.CFG || {};
    el.innerHTML = '<b>Dźwignia aktywna:</b> FX <b>' + (CFG.fxLev || 20) + '×</b> · Akcje/ETF CFD <b>' + (CFG.eqLev || 1) +
      '×</b>. W pozycjach kolumna „Dźwignia” pokazuje wartość użytej przy otwarciu.';
  }

  function boot() {
    fromLS();
    clamp();
    tip();
    setInterval(function () { fromLS(); clamp(); tip(); }, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})(typeof window !== 'undefined' ? window : globalThis);
