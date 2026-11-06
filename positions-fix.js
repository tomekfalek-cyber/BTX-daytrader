/**
 * Pozycje — stabilny render (bez drgania co 2s)
 */
(function (global) {
  var ROOT = 'btx-open-positions';
  var lastTab = '';
  var lastDesk = '';

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function money(x) { return f2(x) + ' PLN'; }
  function setHTML(el, html) {
    if (global.BTX_SET_HTML) return global.BTX_SET_HTML(el, html);
    if (!el || el.innerHTML === html) return false;
    el.innerHTML = html;
    return true;
  }

  function lastPx(sym) {
    try {
      if (typeof global.last === 'function') {
        var b = global.last(sym);
        if (b && b.c != null) return b.c;
      }
    } catch (e) {}
    var ST = global.ST;
    if (ST && ST.series && ST.series[sym] && ST.series[sym].length)
      return ST.series[sym][ST.series[sym].length - 1].c;
    return null;
  }

  function list() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    var equity = ST.equity != null ? ST.equity : ((global.CFG && global.CFG.capital) || 500);
    return Object.keys(pos).map(function (sym) {
      var p = pos[sym];
      var entry = Number(p.entry) || 0;
      var qty = Number(p.qty) || 0;
      var px = lastPx(sym); if (px == null) px = entry;
      // zaokrąglenie ceny do 4 miejsc — mniej zmian HTML co tick
      px = Math.round(px * 10000) / 10000;
      var notional = Math.abs(entry * qty);
      var pnl = p.side === 'LONG' ? (px - entry) * qty : (entry - px) * qty;
      pnl = Math.round(pnl * 100) / 100;
      var pnlPct = entry ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / entry) * 100 : 0;
      pnlPct = Math.round(pnlPct * 100) / 100;
      var pctPort = equity > 0 ? (notional / equity) * 100 : 0;
      return { sym: sym, p: p, entry: entry, qty: qty, px: px, notional: notional, pnl: pnl, pnlPct: pnlPct, pctPort: pctPort, equity: equity };
    });
  }

  function tabHtml(items) {
    if (!items.length) return '<div class="mut">Brak otwartych pozycji paper.</div>';
    var html = '<div style="display:flex;flex-direction:column;gap:10px">';
    items.forEach(function (it) {
      var sign = it.pnl >= 0 ? '+' : '';
      var col = it.pnl >= 0 ? '#12c48b' : '#f87171';
      html += '<div style="padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.2)">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">';
      html += '<b style="font-size:16px;color:#fff">' + it.sym + '</b>';
      html += '<span style="padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.08)">' + it.p.side + '</span>';
      html += '<span style="margin-left:auto;font-weight:800;color:' + col + '">' + sign + money(it.pnl) + ' (' + sign + it.pnlPct.toFixed(2) + '%)</span>';
      html += '</div>';
      html += '<div style="font-size:12.5px;line-height:1.55;color:var(--tx2,#94a3b8)">';
      html += 'Wejście <b style="color:#e2e8f0">' + f2(it.entry) + '</b> · Teraz <b style="color:#e2e8f0">' + f2(it.px) + '</b> · Ilość <b style="color:#e2e8f0">' + it.qty + '</b><br>';
      html += '<b style="color:#fde68a">Środki w pozycji: ' + money(it.notional) + '</b> · <b style="color:#fde68a">' + it.pctPort.toFixed(1) + '% portfela</b> (equity ' + money(it.equity) + ')<br>';
      html += 'SL ' + f2(it.p.stop) + ' · TP ' + f2(it.p.target) + ' · wiek ' + (it.p.bars || 0) + ' świec';
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function deskHtml(items) {
    if (!items.length) return '<div style="font-size:13px;color:#a7f3d0"><b>Otwarte pozycje (0)</b> — brak</div>';
    var html = '<div style="font-size:13px;color:#d1fae5;margin-bottom:8px"><b>Otwarte pozycje paper (' + items.length + ')</b></div>';
    items.forEach(function (it) {
      var sign = it.pnl >= 0 ? '+' : '';
      var col = it.pnl >= 0 ? '#6ee7b7' : '#fca5a5';
      html += '<div style="margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.2);font-size:12.5px;color:#cbd5e1;line-height:1.5">';
      html += '<b style="color:#fff">' + it.sym + '</b> ' + it.p.side +
        ' · <span style="color:' + col + ';font-weight:700">' + sign + money(it.pnl) + ' (' + sign + it.pnlPct.toFixed(2) + '%)</span><br>';
      html += 'Środki w pozycji: <b style="color:#fde68a">' + money(it.notional) + '</b> (' + it.pctPort.toFixed(1) + '% z ' + money(it.equity) + ') · qty ' + it.qty;
      html += '</div>';
    });
    return html;
  }

  function tick() {
    var items = list();
    var host = document.getElementById('tbl-pos');
    if (host) {
      var th = tabHtml(items);
      if (th !== lastTab) { setHTML(host, th); lastTab = th; }
    }
    var pane = document.getElementById('pane-desk');
    if (pane) {
      var el = document.getElementById(ROOT);
      if (!el) {
        el = document.createElement('div');
        el.id = ROOT;
        el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(18,196,139,.35);background:rgba(16,185,129,.07)';
        var hero = document.getElementById('btx-trade-hero');
        if (hero && hero.parentNode === pane) hero.after(el);
        else pane.appendChild(el);
      }
      var dh = deskHtml(items);
      if (dh !== lastDesk) { setHTML(el, dh); lastDesk = dh; }
    }
    var sp = document.getElementById('s-pos');
    if (sp && sp.textContent !== String(items.length)) sp.textContent = String(items.length);
  }

  function boot() {
    tick();
    document.querySelectorAll('button[data-tab], .nav button').forEach(function (btn) {
      if (btn.__posTab) return;
      btn.__posTab = true;
      btn.addEventListener('click', function () { setTimeout(tick, 80); });
    });
    // rzadziej = mniej drgania; PnL i tak odświeży się przy zmianie ceny (po zaokrągleniu)
    setInterval(tick, 8000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
