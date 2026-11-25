
(function (global) {
  'use strict';
  if (global.__BTX_HERO_LEV__) return;
  global.__BTX_HERO_LEV__ = true;
  function run() {
    var hero = document.getElementById('trade-hero') || document.getElementById('btx-trade-hero') || document.querySelector('[data-trade-hero]');
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    var keys = Object.keys(ST.pos);
    var box = document.getElementById('btx-hero-lev');
    if (!keys.length) {
      if (box) box.style.display = 'none';
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'btx-hero-lev';
      box.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(251,191,36,.4);background:rgba(69,26,3,.4);font-size:13px;color:#fde68a';
      var desk = document.getElementById('pane-desk');
      var cards = document.getElementById('btx-session-cards');
      if (cards && cards.parentNode) cards.after(box);
      else if (desk) desk.insertBefore(box, desk.firstChild);
      else return;
    }
    box.style.display = 'block';
    var html = '<b style="color:#fef3c7">Otwarte · dźwignia</b>';
    keys.forEach(function (sym) {
      var p = ST.pos[sym];
      var lev = (p.lev != null && +p.lev > 0) ? +p.lev : 1;
      var lab = lev <= 1 ? '1×' : (Math.round(lev) + '×');
      html += '<div style="margin-top:4px"><b style="color:#fff">' + sym + '</b> ' + p.side +
        ' · <span style="color:#fbbf24;font-weight:800">' + lab + '</span></div>';
    });
    box.innerHTML = html;
  }
  setInterval(run, 4000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 800); });
  else setTimeout(run, 800);
})(typeof window !== 'undefined' ? window : globalThis);
