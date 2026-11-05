/**
 * Handel bota — WSZYSTKIE otwarte pozycje + kapitał z portfela
 */
(function (global) {
  var ROOT = 'btx-trade-hero';
  var STYLE = 'btx-trade-hero-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT + '{display:block!important;margin:0 0 14px;border-radius:16px;overflow:hidden;',
      'border:1px solid rgba(228,0,43,.45);background:linear-gradient(165deg,#1a1216 0%,#0c0f14 55%,#101820 100%);',
      'box-shadow:0 12px 40px rgba(0,0,0,.45);position:relative;z-index:60}',
      '#' + ROOT + ' .th-top{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;',
      'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(228,0,43,.12)}',
      '#' + ROOT + ' .th-brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ffb3c0;font-weight:800}',
      '#' + ROOT + ' .th-status{font-size:12px;color:#c5d0dc}',
      '#' + ROOT + ' .th-list{padding:12px 16px;display:flex;flex-direction:column;gap:12px}',
      '#' + ROOT + ' .th-card{padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28)}',
      '#' + ROOT + ' .th-card .row1{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}',
      '#' + ROOT + ' .th-sym{font-size:22px;font-weight:800;color:#fff}',
      '#' + ROOT + ' .th-side.long{color:#3ddeaa;font-weight:800}',
      '#' + ROOT + ' .th-side.short{color:#ff6b7a;font-weight:800}',
      '#' + ROOT + ' .th-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}',
      '@media(max-width:700px){#' + ROOT + ' .th-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '#' + ROOT + ' .th-metric{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:8px 10px}',
      '#' + ROOT + ' .th-metric span{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8b97a5;margin-bottom:3px}',
      '#' + ROOT + ' .th-metric strong{font-size:14px;color:#eef3f8;font-family:ui-monospace,monospace}',
      '#' + ROOT + ' .th-metric strong.pos{color:#3ddeaa}',
      '#' + ROOT + ' .th-metric strong.neg{color:#ff6b7a}',
      '#' + ROOT + ' .th-why{font-size:12.5px;line-height:1.5;color:#b0becb;margin-top:8px}',
      '#' + ROOT + ' .th-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '#' + ROOT + ' .th-btn{border:0;cursor:pointer;border-radius:10px;padding:10px 14px;font-weight:700;font-size:12px}',
      '#' + ROOT + ' .th-btn.primary{background:linear-gradient(180deg,#e4002b,#b80020);color:#fff}',
      '#' + ROOT + ' .th-btn.ghost{background:rgba(255,255,255,.05);color:#d5dee8;border:1px solid rgba(255,255,255,.1)}',
      '#' + ROOT + ' .th-empty{padding:18px 16px;color:#c5d0dc;font-size:13.5px;line-height:1.55}',
      '#' + ROOT + ' .th-foot{padding:10px 16px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#8b97a5}'
    ].join('');
    document.head.appendChild(s);
  }

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    var n = Number(x);
    if (!isFinite(n)) return '—';
    return Math.abs(n) >= 100 ? n.toFixed(2) : (Math.abs(n) >= 1 ? n.toFixed(4) : n.toFixed(5));
  }
  function money(x) {
    var n = Number(x) || 0;
    return n.toFixed(2) + ' PLN';
  }
  function xtbSym(sym) {
    if (global.BTX_QCAP && global.BTX_QCAP.mapSym) return global.BTX_QCAP.mapSym(sym);
    if (global.BTX_XTB_MAP && global.BTX_XTB_MAP.map) return global.BTX_XTB_MAP.map(sym);
    var m = { QQQ: 'US100', SPY: 'US500', 'XAU/USD': 'GOLD', ASML: 'ASML.NL', SAP: 'SAP.DE', 'SIE.DE': 'SIE.DE' };
    return m[sym] || (sym + '.US');
  }

  function portfolio() {
    var ST = global.ST || {};
    var CFG = global.CFG || {};
    var equity = ST.equity != null ? ST.equity : (CFG.capital || 500);
    var cash = ST.cash != null ? ST.cash : equity;
    return { equity: equity, cash: cash, capital: CFG.capital || equity };
  }

  function lastPx(sym) {
    try {
      if (typeof global.last === 'function') {
        var b = global.last(sym);
        if (b && b.c != null) return b.c;
      }
    } catch (e) {}
    var ST = global.ST;
    if (ST && ST.series && ST.series[sym] && ST.series[sym].length) return ST.series[sym][ST.series[sym].length - 1].c;
    return null;
  }

  function enrichPos(sym, p) {
    var entry = Number(p.entry) || 0;
    var qty = Number(p.qty) || 0;
    var px = lastPx(sym);
    if (px == null) px = entry;
    var notional = Math.abs(entry * qty); // środki zaangażowane (nominał pozycji)
    var pf = portfolio();
    var pctPort = pf.equity > 0 ? (notional / pf.equity) * 100 : 0;
    var pnl = p.side === 'LONG' ? (px - entry) * qty : (entry - px) * qty;
    var pnlPct = entry ? ((p.side === 'LONG' ? (px - entry) : (entry - px)) / entry) * 100 : 0;
    var risk0 = Number(p.risk0) || (p.stop != null ? Math.abs(entry - p.stop) : entry * 0.004);
    var riskCash = risk0 * qty;
    var sl = p.stop != null ? p.stop : (p.side === 'SHORT' ? entry + risk0 : entry - risk0);
    var tp = p.target != null ? p.target : (p.side === 'SHORT' ? entry - 1.6 * risk0 : entry + 1.6 * risk0);
    return {
      sym: sym, side: p.side, entry: entry, qty: qty, px: px, notional: notional, pctPort: pctPort,
      pnl: pnl, pnlPct: pnlPct, riskCash: riskCash, sl: sl, tp: tp, why: p.why || '', bars: p.bars || 0,
      mode: 'OPEN'
    };
  }

  function allOpen() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    return Object.keys(pos).map(function (k) { return enrichPos(k, pos[k]); });
  }

  function copyText(pl) {
    var pf = portfolio();
    return [
      'BTX → XTB',
      pl.side + ' ' + xtbSym(pl.sym) + ' (' + pl.sym + ')',
      'Size: ' + pl.qty,
      'Wejście: ' + f2(pl.entry),
      'SL: ' + f2(pl.sl),
      'TP: ' + f2(pl.tp),
      'Nominał (środki w pozycji): ' + money(pl.notional),
      'Udział w portfelu: ' + pl.pctPort.toFixed(1) + '% (equity ' + money(pf.equity) + ')',
      'Ryzyko ≈ ' + money(pl.riskCash),
      'Powód: ' + String(pl.why || '').slice(0, 200)
    ].join('\n');
  }

  function cardHtml(pl, idx) {
    var long = pl.side === 'LONG';
    var sign = pl.pnl >= 0 ? '+' : '';
    var pnlCls = pl.pnl >= 0 ? 'pos' : 'neg';
    var why = String(pl.why || '').replace(/</g, '');
    if (why.length > 200) why = why.slice(0, 200) + '…';
    return (
      '<div class="th-card" data-sym="' + pl.sym + '">' +
      '<div class="row1">' +
      '<span class="th-sym">' + pl.sym + '</span>' +
      '<span class="th-side ' + (long ? 'long' : 'short') + '">' + pl.side + '</span>' +
      '<span class="th-side ' + pnlCls + '" style="margin-left:auto">' + sign + money(pl.pnl) + ' (' + sign + pl.pnlPct.toFixed(2) + '%)</span>' +
      '</div>' +
      '<div class="th-metrics">' +
      '<div class="th-metric"><span>Wejście</span><strong>' + f2(pl.entry) + '</strong></div>' +
      '<div class="th-metric"><span>Ilość</span><strong>' + pl.qty + '</strong></div>' +
      '<div class="th-metric"><span>Środki w pozycji</span><strong>' + money(pl.notional) + '</strong></div>' +
      '<div class="th-metric"><span>% portfela</span><strong>' + pl.pctPort.toFixed(1) + '%</strong></div>' +
      '<div class="th-metric"><span>Stop Loss</span><strong class="neg">' + f2(pl.sl) + '</strong></div>' +
      '<div class="th-metric"><span>Take Profit</span><strong class="pos">' + f2(pl.tp) + '</strong></div>' +
      '<div class="th-metric"><span>Ryzyko ≈</span><strong>' + money(pl.riskCash) + '</strong></div>' +
      '<div class="th-metric"><span>Cena teraz</span><strong>' + f2(pl.px) + '</strong></div>' +
      '<div class="th-metric"><span>XTB</span><strong>' + xtbSym(pl.sym) + '</strong></div>' +
      '</div>' +
      (why ? '<div class="th-why"><b style="color:#e8eef6">Dlaczego: </b>' + why + '</div>' : '') +
      '<div class="th-actions">' +
      '<button type="button" class="th-btn primary" data-copy="' + idx + '">Kopiuj plan XTB</button>' +
      '</div></div>'
    );
  }

  function ensureHost() {
    injectCss();
    var el = document.getElementById(ROOT);
    var pane = document.getElementById('pane-desk');
    if (!pane) return el;
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    } else if (el.parentNode === pane && pane.firstChild !== el) {
      pane.insertBefore(el, pane.firstChild);
    }
    return el;
  }

  function render() {
    var el = ensureHost();
    if (!el) return;
    var list = allOpen();
    var pf = portfolio();

    if (!list.length) {
      el.innerHTML =
        '<div class="th-top">' +
        '<div class="th-brand">Handel bota · Plan XTB</div>' +
        '<div class="th-status">Portfel ' + money(pf.equity) + ' · gotówka ' + money(pf.cash) + '</div></div>' +
        '<div class="th-empty"><b>Brak otwartych pozycji paper.</b><br>Gdy bot otworzy LONG/SHORT — tu zobaczysz wszystkie naraz, z kwotą środków i % portfela.</div>' +
        '<div class="th-foot">Karta zawsze na górze Pulptu</div>';
      return;
    }

    var totalNom = list.reduce(function (s, p) { return s + p.notional; }, 0);
    var html = '';
    html += '<div class="th-top">';
    html += '<div class="th-brand">Otwarte pozycje · kopiuj na XTB</div>';
    html += '<div class="th-status">' + list.length + ' poz. · portfel ' + money(pf.equity) +
      ' · w pozycjach ' + money(totalNom) + ' (' + (pf.equity ? (totalNom / pf.equity * 100).toFixed(1) : '0') + '%)</div>';
    html += '</div>';
    html += '<div class="th-list">';
    list.forEach(function (pl, idx) { html += cardHtml(pl, idx); });
    html += '</div>';
    html += '<div class="th-foot">„Środki w pozycji” = cena wejścia × ilość (nominał). „% portfela” = ten nominał / equity (np. przy 500 PLN).</div>';
    el.innerHTML = html;

    list.forEach(function (pl, idx) {
      var btn = el.querySelector('[data-copy="' + idx + '"]');
      if (btn) {
        btn.onclick = function () {
          var t = copyText(pl);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t).then(function () {
              if (global.toast) global.toast('Skopiowano plan ' + pl.sym, 'ok');
            });
          } else {
            prompt('Skopiuj plan:', t);
          }
        };
      }
    });
  }

  function boot() {
    injectCss();
    render();
    document.querySelectorAll('button[data-tab], .nav button').forEach(function (btn) {
      if (btn.__thMulti) return;
      btn.__thMulti = true;
      btn.addEventListener('click', function () { setTimeout(render, 50); setTimeout(render, 250); });
    });
    if (typeof global.render === 'function' && !global.render.__tradeHero) {
      var orig = global.render;
      global.render = function () {
        var r = orig.apply(this, arguments);
        try { render(); } catch (e) {}
        return r;
      };
      global.render.__tradeHero = true;
    }
    setInterval(render, 2500);
  }

  global.BTX_TRADE_HERO = { render: render, allOpen: allOpen };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
