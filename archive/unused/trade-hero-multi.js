/**
 * Karta handlu: wszystkie otwarte pozycje (nie tylko pierwsza)
 */
(function (global) {
  function patch() {
    if (!global.BTX_TRADE_HERO && !document.getElementById('btx-trade-hero')) return;
    // jeśli trade-hero eksponuje currentPlan — nie zawsze
    // render własny podsumowania multi pod hero
    var hero = document.getElementById('btx-trade-hero');
    if (!hero) return;
    var box = document.getElementById('btx-hero-multi');
    if (!box) {
      box = document.createElement('div');
      box.id = 'btx-hero-multi';
      box.style.cssText = 'margin-top:10px;font-size:12px;line-height:1.5;color:#e2e8f0';
      hero.appendChild(box);
    }
    var ST = global.ST || {};
    var keys = Object.keys(ST.pos || {});
    if (!keys.length) {
      box.innerHTML = '<span style="opacity:.75">Brak otwartych pozycji paper — plan z sygnału powyżej (jeśli jest).</span>';
      return;
    }
    var html = '<b>Otwarte (' + keys.length + '):</b> ';
    html += keys.map(function (sym) {
      var p = ST.pos[sym];
      var px = (typeof global.last === 'function' && global.last(sym)) ? global.last(sym).c : p.entry;
      var pnl = p.side === 'LONG' ? (px - p.entry) * p.qty : (p.entry - px) * p.qty;
      var pct = p.entry ? ((p.side === 'LONG' ? (px - p.entry) : (p.entry - px)) / p.entry) * 100 : 0;
      var sign = pnl >= 0 ? '+' : '';
      var col = pnl >= 0 ? '#6ee7b7' : '#fca5a5';
      return '<span style="margin-right:12px"><b>' + sym + '</b> ' + p.side +
        ' \u00b7 <span style="color:' + col + '">' + sign + pnl.toFixed(2) + ' (' + sign + pct.toFixed(2) + '%)</span>' +
        ' \u00b7 qty ' + p.qty + ' \u00b7 nom. ' + (p.entry * p.qty).toFixed(0) + '</span>';
    }).join(' ');
    box.innerHTML = html;
  }

  function boot() {
    patch();
    setInterval(patch, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
