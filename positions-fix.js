/**
 * Zakładka Pozycje + lista na Pulpicie — zawsze wszystkie ST.pos
 */
(function (global) {
  var ROOT = 'btx-open-positions';

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function money(x) { return f2(x) + ' PLN'; }

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
      var notional = Math.abs(entry * qty);
      var pnl = p.side === 'LONG' ? (px - entry) * qty : (entry - px) * qty;
      var pnlPct = entry ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / entry) * 100 : 0;
      var pctPort = equity > 0 ? (notional / equity) * 100 : 0;
      return { sym: sym, p: p, entry: entry, qty: qty, px: px, notional: notional, pnl: pnl, pnlPct: pnlPct, pctPort: pctPort, equity: equity };
    });
  }

  function forceTab(items) {
    var host = document.getElementById('tbl-pos');
    if (!host) return;
    if (!items.length) {
      host.innerHTML = '<div class="mut">Brak otwartych pozycji paper.</div>';
      return;
    }
    // Własny HTML — nie zależ od global.tbl / starego renderPos
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
    host.innerHTML = html;
  }

  function forceDesk(items) {
    var el = document.getElementById(ROOT);
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(18,196,139,.35);background:rgba(16,185,129,.07)';
      var hero = document.getElementById('btx-trade-hero');
      if (hero && hero.parentNode === pane) hero.after(el);
      else pane.appendChild(el);
    }
    if (!items.length) {
      el.innerHTML = '<div style="font-size:13px;color:#a7f3d0"><b>Otwarte pozycje (0)</b> — brak</div>';
      return;
    }
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
    el.innerHTML = html;
  }

  function tick() {
    var items = list();
    forceTab(items);
    forceDesk(items);
    // KPI
    var sp = document.getElementById('s-pos');
    if (sp) sp.textContent = String(items.length);
  }

  function patchRenderPos() {
    // Zawsze po starym renderPos — nadpisz wynik
    var prev = global.renderPos;
    global.renderPos = function () {
      try { if (typeof prev === 'function' && !prev.__posFixInner) prev.apply(this, arguments); } catch (e) {}
      tick();
    };
    global.renderPos.__posFix = true;
  }

  function boot() {
    patchRenderPos();
    tick();
    document.querySelectorAll('button[data-tab], .nav button, a[href], .tabs button').forEach(function (btn) {
      if (btn.__posTab) return;
      btn.__posTab = true;
      btn.addEventListener('click', function () { setTimeout(tick, 60); setTimeout(tick, 300); });
    });
    // Mutation: gdy ktoś wyczyści tbl-pos
    var host = document.getElementById('tbl-pos');
    if (host && global.MutationObserver) {
      var mo = new MutationObserver(function () {
        var items = list();
        if (items.length && host.innerHTML.indexOf(items[0].sym) < 0) forceTab(items);
      });
      mo.observe(host, { childList: true, subtree: true });
    }
    setInterval(function () { patchRenderPos(); tick(); }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
