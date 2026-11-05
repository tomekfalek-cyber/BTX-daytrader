/**
 * Pozycje: wszystkie otwarte, PnL %, kapitał, zakładka Pozycje + Pulpit
 */
(function (global) {
  var ROOT_DESK = 'btx-open-positions';
  var STYLE = 'btx-pos-fix-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT_DESK + '{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(18,196,139,.35);background:rgba(16,185,129,.07)}',
      '#' + ROOT_DESK + ' h3{margin:0 0 10px;font-size:14px;color:#d1fae5}',
      '.btx-pos-grid{display:grid;gap:10px}',
      '.btx-pos-card{padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.22)}',
      '.btx-pos-card .top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px}',
      '.btx-pos-card .sym{font-weight:800;font-size:15px;color:#fff}',
      '.btx-pos-card .meta{font-size:12px;color:var(--tx2,#94a3b8);line-height:1.55}',
      '.btx-pos-card .pnl-pos{color:#12c48b;font-weight:800}',
      '.btx-pos-card .pnl-neg{color:#f87171;font-weight:800}',
      '.btx-pos-card .pill-l{background:rgba(18,196,139,.2);color:#6ee7b7;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700}',
      '.btx-pos-card .pill-s{background:rgba(248,113,113,.2);color:#fca5a5;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700}'
    ].join('');
    document.head.appendChild(s);
  }

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function money(x) {
    if (typeof global.money === 'function') return global.money(x);
    return f2(x) + ' PLN';
  }

  function lastPx(sym) {
    try {
      if (typeof global.last === 'function') {
        var b = global.last(sym);
        if (b && b.c != null) return b.c;
      }
    } catch (e) {}
    var ST = global.ST;
    if (ST && ST.series && ST.series[sym] && ST.series[sym].length) {
      return ST.series[sym][ST.series[sym].length - 1].c;
    }
    return null;
  }

  function posStats(sym, p) {
    var entry = Number(p.entry) || 0;
    var qty = Number(p.qty) || 0;
    var px = lastPx(sym);
    if (px == null) px = entry;
    var pnl = p.side === 'LONG' ? (px - entry) * qty : (entry - px) * qty;
    var notional = Math.abs(entry * qty);
    var pnlPctPrice = entry ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / entry) * 100 : 0;
    var pnlPctCap = notional ? (pnl / notional) * 100 : 0;
    var risk0 = Number(p.risk0);
    if (!risk0 && p.stop != null) risk0 = Math.abs(entry - p.stop);
    if (!risk0) risk0 = entry * 0.004;
    var rMult = risk0 > 0 ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / risk0) : 0;
    return {
      px: px, pnl: pnl, notional: notional, pnlPctPrice: pnlPctPrice,
      pnlPctCap: pnlPctCap, rMult: rMult, riskCash: risk0 * qty
    };
  }

  function allPos() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    return Object.keys(pos).map(function (k) {
      return { sym: k, p: pos[k], st: posStats(k, pos[k]) };
    });
  }

  function cardHtml(item) {
    var p = item.p, st = item.st, sym = item.sym;
    var long = p.side === 'LONG';
    var cls = st.pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
    var sign = st.pnl >= 0 ? '+' : '';
    return (
      '<div class="btx-pos-card">' +
      '<div class="top">' +
      '<span class="sym">' + sym + '</span>' +
      '<span class="' + (long ? 'pill-l' : 'pill-s') + '">' + (long ? 'LONG' : 'SHORT') + '</span>' +
      '<span class="' + cls + '">' + sign + f2(st.pnl) + ' PLN (' + sign + f2(st.pnlPctPrice) + '% ceny \u00b7 ' + sign + f2(st.rMult) + 'R)</span>' +
      '</div>' +
      '<div class="meta">' +
      'Wejście <b>' + f2(p.entry) + '</b> \u00b7 Teraz <b>' + f2(st.px) + '</b><br>' +
      'Ilość <b>' + (p.qty || 0) + '</b> \u00b7 Kapitał w pozycji (nominał) <b>' + money(st.notional) + '</b><br>' +
      'Ryzyko ~ <b>' + money(st.riskCash) + '</b> \u00b7 SL <b>' + f2(p.stop) + '</b> \u00b7 TP <b>' + f2(p.target) + '</b><br>' +
      'Wiek: <b>' + (p.bars || 0) + '</b> świec' + (p.be ? ' \u00b7 BE ON' : '') +
      (p.why ? '<br><span style="opacity:.85">' + String(p.why).slice(0, 160) + '</span>' : '') +
      '</div></div>'
    );
  }

  function renderDesk() {
    injectCss();
    var list = allPos();
    var el = document.getElementById(ROOT_DESK);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT_DESK;
      var hero = document.getElementById('btx-trade-hero');
      if (hero && hero.parentNode === pane) hero.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild.nextSibling);
      else pane.appendChild(el);
    }
    if (!list.length) {
      el.innerHTML = '<h3>Otwarte pozycje paper (0)</h3><div class="meta" style="font-size:12px;color:var(--tx2)">Brak otwartych pozycji.</div>';
      return;
    }
    el.innerHTML =
      '<h3>Otwarte pozycje paper (' + list.length + ')</h3>' +
      '<div class="btx-pos-grid">' + list.map(cardHtml).join('') + '</div>';
  }

  function renderTab() {
    var host = document.getElementById('tbl-pos');
    if (!host) return;
    var list = allPos();
    if (!list.length) {
      host.innerHTML = '<div class="mut">Brak otwartych pozycji.</div>';
      return;
    }
    var rows = list.map(function (item) {
      var p = item.p, st = item.st;
      var sign = st.pnl >= 0 ? '+' : '';
      var cls = st.pnl >= 0 ? 'pos' : 'neg';
      return [
        item.sym,
        '<span class="pill ' + (p.side === 'LONG' ? 'buy' : 'sell') + '">' + p.side + '</span>',
        String(p.qty || 0),
        f2(p.entry),
        f2(st.px),
        f2(p.stop),
        f2(p.target),
        money(st.notional),
        (p.bars || 0) + ' świec',
        '<span class="' + cls + '">' + sign + f2(st.pnl) + ' (' + sign + f2(st.pnlPctPrice) + '% / ' + sign + f2(st.rMult) + 'R)</span>'
      ];
    });
    if (typeof global.tbl === 'function') {
      host.innerHTML = global.tbl(
        ['Symbol', 'Strona', 'Ilość', 'Wejście', 'Cena', 'SL', 'TP', 'Kapitał', 'Wiek', 'P&L'],
        rows
      );
    } else {
      host.innerHTML = list.map(cardHtml).join('');
    }
  }

  function patchRenderPos() {
    var prev = global.renderPos;
    global.renderPos = function () {
      try { if (typeof prev === 'function') prev.apply(this, arguments); } catch (e) {}
      try { renderTab(); } catch (e2) {}
      try { renderDesk(); } catch (e3) {}
    };
    global.renderPos.__posFix = true;
  }

  /** Autonomia: w jednym ticku może otworzyć do wolnego limitu maxPos (nie tylko 1) */
  function patchAutonomyMulti() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.rankSignals) return;
    if (global.BTX_AUTONOMY.__multiOpen) return;
    var tryOne = global.BTX_AUTONOMY.tryOpenBest;
    // nadpisz tick ścieżkę: po rankSignals otwieraj pętlą
    var origStart = global.BTX_AUTONOMY.start;
    // wrap open helper
    global.BTX_AUTONOMY.openAllPass = function () {
      var ST = global.ST;
      var CFG = global.CFG || {};
      if (!ST || ST.blocked) return 0;
      var maxPos = CFG.maxPos || 2;
      var maxTrades = CFG.maxTrades || 6;
      var opened = 0;
      var ranked = global.BTX_AUTONOMY.rankSignals() || [];
      for (var i = 0; i < ranked.length; i++) {
        if (Object.keys(ST.pos || {}).length >= maxPos) break;
        if ((ST.dayTrades || 0) >= maxTrades) break;
        var r = ranked[i];
        if (!r.gr || !r.gr.pass || !r.g) continue;
        if (ST.pos[r.g.sym]) continue;
        if (ST.cool && ST.cool[r.g.sym] > 0) continue;
        if (typeof global.openPos === 'function') {
          var n0 = Object.keys(ST.pos).length;
          global.openPos(r.g);
          if (Object.keys(ST.pos).length > n0) {
            opened++;
            if (global.log) global.log('Autonomia multi: OPEN ' + r.g.side + ' ' + r.g.sym, 'g');
          }
        }
      }
      return opened;
    };
    // patch internal tryOpenBest usage via tick if exposed
    if (typeof global.BTX_AUTONOMY.tick === 'function' && !global.BTX_AUTONOMY.tick.__multi) {
      var ot = global.BTX_AUTONOMY.tick;
      global.BTX_AUTONOMY.tick = async function () {
        if (typeof global.cycle === 'function') {
          try { global.cycle(); } catch (e) {}
        }
        if (global.BTX_AUTONOMY.isOn && global.BTX_AUTONOMY.isOn()) {
          try { global.BTX_AUTONOMY.openAllPass(); } catch (e2) {}
        }
        try { if (global.BTX_AUTONOMY.rankSignals) { /* render via panel */ } } catch (e3) {}
        return ot.apply(this, arguments);
      };
      global.BTX_AUTONOMY.tick.__multi = true;
    }
    global.BTX_AUTONOMY.__multiOpen = true;
  }

  function boot() {
    injectCss();
    patchRenderPos();
    patchAutonomyMulti();
    renderDesk();
    renderTab();
    // przełączenie zakładek
    document.querySelectorAll('button[data-tab], .nav button, [data-pane]').forEach(function (btn) {
      if (btn.__posFix) return;
      btn.__posFix = true;
      btn.addEventListener('click', function () {
        setTimeout(function () { renderTab(); renderDesk(); }, 80);
      });
    });
    setInterval(function () {
      patchRenderPos();
      patchAutonomyMulti();
      renderDesk();
      renderTab();
    }, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
