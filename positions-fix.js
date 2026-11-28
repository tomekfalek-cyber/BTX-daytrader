/**
 * Pozycje — stabilny render + kolumna dźwigni / margin.
 */
(function (global) {
  var ROOT = 'btx-open-positions';
  var lastTab = '';
  var lastDesk = '';

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function money(x) {
    var ccy = (global.CFG && global.CFG.ccy) || 'USD';
    return f2(x) + ' ' + ccy;
  }
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

  function metaOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i];
    return { s: sym, mkt: 'US', t: 'Akcja' };
  }

  function levOf(p, m) {
    if (p && p.lev != null && +p.lev > 0) return +p.lev;
    if (m && m.mkt === 'FX') return Math.max(1, Math.min(30, (global.CFG && global.CFG.fxLev) || 20));
    return Math.max(1, Math.min(10, (global.CFG && global.CFG.eqLev) || 1));
  }

  function list() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    var equity = ST.equity != null ? ST.equity : ((global.CFG && global.CFG.capital) || 500);
    return Object.keys(pos).map(function (sym) {
      var p = pos[sym];
      var m = metaOf(sym);
      var entry = Number(p.entry) || 0;
      var qty = Number(p.qty) || 0;
      var rate = Number(p.rate) || 1;
      var lev = levOf(p, m);
      var px = lastPx(sym); if (px == null) px = entry;
      px = Math.round(px * 10000) / 10000;
      var notional = Math.abs(entry * qty * rate);
      var margin = (p.margin != null && +p.margin > 0) ? +p.margin : (notional / Math.max(1, lev));
      var pnl = p.side === 'LONG' ? (px - entry) * qty * rate : (entry - px) * qty * rate;
      pnl = Math.round(pnl * 100) / 100;
      var pnlPct = entry ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / entry) * 100 : 0;
      pnlPct = Math.round(pnlPct * 100) / 100;
      var pctPort = equity > 0 ? (margin / equity) * 100 : 0;
      var levLabel = lev <= 1 ? '1× (bez dźwigni)' : (lev.toFixed(0) + '×');
      return {
        sym: sym, p: p, m: m, entry: entry, qty: qty, px: px, rate: rate, lev: lev, levLabel: levLabel,
        notional: notional, margin: margin, pnl: pnl, pnlPct: pnlPct, pctPort: pctPort, equity: equity
      };
    });
  }

  function tabHtml(items) {
    if (!items.length) return '<div class="mut">Brak otwartych pozycji paper.</div>';
    var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">';
    html += '<thead><tr style="text-align:left;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,.08)">';
    html += '<th style="padding:8px 6px">Symbol</th><th style="padding:8px 6px">Strona</th><th style="padding:8px 6px">Dźwignia</th>';
    html += '<th style="padding:8px 6px">Margin</th><th style="padding:8px 6px">Nominał</th><th style="padding:8px 6px">Qty</th>';
    html += '<th style="padding:8px 6px">Wejście</th><th style="padding:8px 6px">Cena</th><th style="padding:8px 6px">SL</th><th style="padding:8px 6px">TP</th>';
    html += '<th style="padding:8px 6px">P&amp;L</th></tr></thead><tbody>';
    items.forEach(function (it) {
      var sign = it.pnl >= 0 ? '+' : '';
      var col = it.pnl >= 0 ? '#12c48b' : '#f87171';
      var levCol = it.lev > 1 ? '#fbbf24' : '#94a3b8';
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,.06)">';
      html += '<td style="padding:8px 6px"><b style="color:#fff">' + it.sym + '</b></td>';
      html += '<td style="padding:8px 6px">' + it.p.side + '</td>';
      html += '<td style="padding:8px 6px;color:' + levCol + ';font-weight:700">' + it.levLabel + '</td>';
      html += '<td style="padding:8px 6px;color:#fde68a"><b>' + money(it.margin) + '</b><div style="font-size:10px;color:#94a3b8">' + it.pctPort.toFixed(1) + '% portfela</div></td>';
      html += '<td style="padding:8px 6px;color:#cbd5e1">' + money(it.notional) + '</td>';
      html += '<td style="padding:8px 6px">' + it.qty + '</td>';
      html += '<td style="padding:8px 6px">' + f2(it.entry) + '</td>';
      html += '<td style="padding:8px 6px">' + f2(it.px) + '</td>';
      html += '<td style="padding:8px 6px">' + f2(it.p.stop) + '</td>';
      html += '<td style="padding:8px 6px">' + f2(it.p.target) + '</td>';
      html += '<td style="padding:8px 6px;color:' + col + ';font-weight:700">' + sign + money(it.pnl) + '<div style="font-size:10px">' + sign + it.pnlPct.toFixed(2) + '%</div></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div class="mut" style="margin-top:8px;font-size:11px">Dźwignia: ile razy nominał > margin. Akcje/ETF zwykle <b>1×</b>. FX CFD: np. <b>20×</b> — od salda liczy się <b>margin</b>, nie pełny nominał.</div>';
    html += '</div>';
    return html;
  }

  function deskHtml(items) {
    if (!items.length) return '<div style="font-size:13px;color:#a7f3d0"><b>Otwarte pozycje (0)</b> — brak</div>';
    var html = '<div style="font-size:13px;color:#d1fae5;margin-bottom:8px"><b>Otwarte pozycje paper (' + items.length + ')</b></div>';
    items.forEach(function (it) {
      var sign = it.pnl >= 0 ? '+' : '';
      var col = it.pnl >= 0 ? '#6ee7b7' : '#fca5a5';
      var levCol = it.lev > 1 ? '#fbbf24' : '#86efac';
      html += '<div style="margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.2);font-size:12.5px;color:#cbd5e1;line-height:1.5">';
      html += '<b style="color:#fff">' + it.sym + '</b> ' + it.p.side +
        ' · <span style="color:' + levCol + ';font-weight:800">DŹWIGNIA ' + it.levLabel + '</span>' +
        ' · <span style="color:' + col + ';font-weight:700">' + sign + money(it.pnl) + ' (' + sign + it.pnlPct.toFixed(2) + '%)</span><br>';
      html += 'Margin (z salda): <b style="color:#fde68a">' + money(it.margin) + '</b> (' + it.pctPort.toFixed(1) + '%) · nominał ' + money(it.notional) + ' · qty ' + it.qty;
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
    setInterval(tick, 8000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
