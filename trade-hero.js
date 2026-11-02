/**
 * BTX Trade Hero — zawsze widoczny na górze Pulptu
 */
(function (global) {
  var ROOT = 'btx-trade-hero';
  var STYLE = 'btx-trade-hero-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT + '{display:block!important;visibility:visible!important;opacity:1!important;',
      'margin:0 0 16px!important;border-radius:18px;overflow:hidden;position:relative;z-index:5;',
      'border:1px solid rgba(228,0,43,.35)!important;',
      'background:radial-gradient(1000px 380px at 8% -30%,rgba(228,0,43,.22),transparent 55%),',
      'linear-gradient(180deg,#1a1014 0%,#12161d 55%,#0e1319 100%)!important;',
      'box-shadow:0 14px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05)}',
      '#' + ROOT + ' .th-top{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;',
      'justify-content:space-between;padding:14px 16px 8px}',
      '#' + ROOT + ' .th-brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;',
      'color:#f5a3b0;font-weight:800}',
      '#' + ROOT + ' .th-status{font-size:12px;color:#c5d0dc}',
      '#' + ROOT + ' .th-main{padding:6px 16px 14px;display:grid;grid-template-columns:1.15fr 1fr;gap:14px}',
      '@media(max-width:820px){#' + ROOT + ' .th-main{grid-template-columns:1fr}}',
      '#' + ROOT + ' .th-side{font-size:12px;font-weight:800;letter-spacing:.1em}',
      '#' + ROOT + ' .th-side.long{color:#3ddeaa}',
      '#' + ROOT + ' .th-side.short{color:#ff6b7a}',
      '#' + ROOT + ' .th-sym{font-size:30px;line-height:1.05;font-weight:800;color:#fff;',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:4px 0 8px}',
      '#' + ROOT + ' .th-why{font-size:13px;line-height:1.55;color:#b0becb}',
      '#' + ROOT + ' .th-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '#' + ROOT + ' .th-metric{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);',
      'border-radius:12px;padding:10px 12px}',
      '#' + ROOT + ' .th-metric span{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;',
      'color:#8b97a5;margin-bottom:4px;font-weight:700}',
      '#' + ROOT + ' .th-metric strong{font-size:15px;color:#eef3f8;font-family:ui-monospace,monospace}',
      '#' + ROOT + ' .th-metric strong.pos{color:#3ddeaa}',
      '#' + ROOT + ' .th-metric strong.neg{color:#ff6b7a}',
      '#' + ROOT + ' .th-actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 14px}',
      '#' + ROOT + ' .th-btn{border:0;cursor:pointer;border-radius:10px;padding:11px 14px;font-weight:700;font-size:12px}',
      '#' + ROOT + ' .th-btn.primary{background:linear-gradient(180deg,#e4002b,#b80020);color:#fff}',
      '#' + ROOT + ' .th-btn.ghost{background:rgba(255,255,255,.05);color:#d5dee8;border:1px solid rgba(255,255,255,.1)}',
      '#' + ROOT + ' .th-empty{padding:18px 16px 20px;color:#c5d0dc;font-size:13.5px;line-height:1.55}',
      '#' + ROOT + ' .th-empty b{color:#fff;font-size:15px}',
      '#' + ROOT + ' .th-foot{padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#8b97a5}',
      '#' + ROOT + ' .th-pill{display:inline-flex;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,.06);',
      'border:1px solid rgba(255,255,255,.08);font-size:10px;color:#c5d0dc;margin:2px 4px 2px 0}'
    ].join('');
    document.head.appendChild(s);
  }

  function f2(x, sym) {
    if (x == null || !isFinite(+x)) return '—';
    var s = String(sym || '');
    if (/EUR|USD|GBP|JPY/.test(s) && !/XAU/.test(s)) return Number(x).toFixed(5);
    return Number(x).toFixed(2);
  }

  function xtbSym(sym) {
    if (global.BTX_QCAP && global.BTX_QCAP.mapSym) return global.BTX_QCAP.mapSym(sym);
    var m = { QQQ: 'US100', SPY: 'US500', 'XAU/USD': 'GOLD', NVDA: 'NVDA.US', TSLA: 'TSLA.US', META: 'META.US', AAPL: 'AAPL.US', EURUSD: 'EURUSD' };
    return m[sym] || sym;
  }

  function planFromPos(sym, p) {
    var b = global.ST && global.ST.series && global.ST.series[sym];
    var last = b && b.length ? b[b.length - 1].c : p.entry;
    var risk = Math.abs(p.entry - (p.stop != null ? p.stop : p.entry)) || (p.entry * 0.004);
    if (!risk) risk = p.entry * 0.004;
    var tp = p.tp != null ? p.tp : (p.side === 'SHORT' ? p.entry - 2.5 * risk : p.entry + 2.5 * risk);
    var sl = p.stop != null ? p.stop : (p.side === 'SHORT' ? p.entry + risk : p.entry - risk);
    var partial = p.side === 'SHORT' ? p.entry - 1.5 * risk : p.entry + 1.5 * risk;
    var pnl = p.side === 'LONG' ? (last - p.entry) * (p.qty || 0) : (p.entry - last) * (p.qty || 0);
    return {
      mode: 'OPEN', sym: sym, side: p.side, entry: p.entry, last: last, sl: sl, tp: tp, partial: partial,
      qty: p.qty || 1, pnl: pnl, why: p.why || p.setup || 'Pozycja paper otwarta przez bota',
      strength: p.strength, bars: p.bars
    };
  }

  function planFromSignal(g) {
    if (!g) return null;
    var price = g.price || 0;
    var atr = g.atr || price * 0.004;
    var sd = atr * 2;
    var eq = (global.ST && global.ST.equity) || 100000;
    var riskPct = (global.CFG && global.CFG.risk) || 0.5;
    var qty = sd > 0 ? Math.max(1, Math.floor(eq * (riskPct / 100) / sd)) : 1;
    return {
      mode: 'SIGNAL', sym: g.sym, side: g.side, entry: price, last: price,
      sl: g.side === 'SHORT' ? price + sd : price - sd,
      tp: g.side === 'SHORT' ? price - 2.5 * sd : price + 2.5 * sd,
      partial: g.side === 'SHORT' ? price - 1.5 * sd : price + 1.5 * sd,
      qty: qty, pnl: null,
      why: g.why || 'Setup z Signal Desk',
      strength: g.strength, score: g.desk && g.desk.score, grade: g.desk && g.desk.grade
    };
  }

  function currentPlan() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    var keys = Object.keys(pos);
    if (keys.length) return planFromPos(keys[0], pos[keys[0]]);
    try {
      if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
        var ranked = global.BTX_AUTONOMY.rankSignals();
        for (var i = 0; i < ranked.length; i++) {
          if (ranked[i].gr && ranked[i].gr.pass && ranked[i].g) {
            var pl = planFromSignal(ranked[i].g);
            if (pl) { pl.score = ranked[i].gr.score; pl.grade = ranked[i].gr.grade; return pl; }
          }
        }
      }
    } catch (e) {}
    var sig = (ST.sig || []).filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
    if (sig && (sig.strength || 0) >= 4) return planFromSignal(sig);
    return null;
  }

  function ticketText(pl) {
    return [
      pl.mode === 'OPEN' ? 'BTX POZYCJA → XTB' : 'BTX SYGNAŁ → XTB',
      'Symbol XTB: ' + xtbSym(pl.sym),
      'Strona: ' + pl.side,
      'Wejście: ' + f2(pl.entry, pl.sym),
      'Size: ' + pl.qty,
      'SL: ' + f2(pl.sl, pl.sym),
      'Partial: ' + f2(pl.partial, pl.sym),
      'TP: ' + f2(pl.tp, pl.sym),
      'Siła: ' + (pl.strength != null ? pl.strength : '—'),
      'Dlaczego: ' + String(pl.why || '').replace(/\s+/g, ' ').slice(0, 220)
    ].join('\n');
  }

  function getDeskPane() {
    return document.getElementById('pane-desk') || document.querySelector('#pane-desk') || document.querySelector('[id="pane-desk"]');
  }

  function ensureHost() {
    injectCss();
    var pane = getDeskPane();
    var el = document.getElementById(ROOT);

    // jeśli ktoś skasował — odtwórz
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
    }

    // zawsze przenieś na SAMĄ GÓRĘ pane-desk
    if (pane) {
      if (el.parentNode !== pane || pane.firstChild !== el) {
        if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
        else pane.appendChild(el);
      }
    } else if (!el.parentNode) {
      // awaryjnie body
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function render() {
    var el = ensureHost();
    if (!el) return;

    var pl = currentPlan();
    if (!pl) {
      el.innerHTML =
        '<div class="th-top">' +
          '<div class="th-brand">Handel bota · Plan XTB</div>' +
          '<div class="th-status">Brak otwartej pozycji i brak A/A+ w tej chwili</div>' +
        '</div>' +
        '<div class="th-empty">' +
          '<b>Tu pojawia się LONG/SHORT, size, SL, TP i powód.</b><br>' +
          'Gdy bot zajmie paper albo pojawi się sygnał PASS — ta karta wypełni się automatycznie. ' +
          'Wtedy kopiujesz plan jednym kliknięciem do XTB.' +
        '</div>' +
        '<div class="th-foot">Karta jest zawsze na górze zakładki Pulpit</div>';
      return;
    }

    var isLong = pl.side === 'LONG';
    var sideCls = isLong ? 'long' : 'short';
    var why = String(pl.why || '').replace(/</g, '');
    if (why.length > 260) why = why.slice(0, 260) + '…';

    var html = '';
    html += '<div class="th-top">';
    html += '<div class="th-brand">' + (pl.mode === 'OPEN' ? 'Pozycja otwarta · skopiuj na XTB' : 'Sygnał gotowy · skopiuj na XTB') + '</div>';
    html += '<div class="th-status">Natychmiastowy podgląd handlu bota</div>';
    html += '</div>';
    html += '<div class="th-main"><div>';
    html += '<div class="th-side ' + sideCls + '">' + pl.side + (pl.grade ? (' · ' + pl.grade) : '') + '</div>';
    html += '<div class="th-sym">' + pl.sym + '</div>';
    html += '<div class="th-why"><b style="color:#e8eef6">Dlaczego: </b>' + why + '</div>';
    html += '<div style="margin-top:10px">';
    html += '<span class="th-pill">XTB ' + xtbSym(pl.sym) + '</span>';
    if (pl.strength != null) html += '<span class="th-pill">Siła ' + pl.strength + '/5</span>';
    if (pl.score != null) html += '<span class="th-pill">Score ' + pl.score + '</span>';
    html += '</div></div>';
    html += '<div class="th-metrics">';
    html += '<div class="th-metric"><span>Wejście</span><strong>' + f2(pl.entry, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Size</span><strong>' + pl.qty + '</strong></div>';
    html += '<div class="th-metric"><span>Stop Loss</span><strong class="neg">' + f2(pl.sl, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Take Profit</span><strong class="pos">' + f2(pl.tp, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Partial ~50%</span><strong>' + f2(pl.partial, pl.sym) + '</strong></div>';
    if (pl.mode === 'OPEN' && pl.pnl != null) {
      html += '< '<div class="th-metric"><span>Paper P&L</span><strong class="' + (pl.pnl >= 0 ? 'pos' : 'neg') + '">' +
        (pl.pnl >= 0 ? '+' : '') + Number(pl.pnl).toFixed(2) + '</strong></div>';
    } else {
      html += '<div class="th-metric"><span>Prognoza</span><strong>TP 2.5R · BE po 1R</strong></div>';
    }
    html += '</div></div>';
    html += '<div class="th-actions">';
    html += '<button type="button" class="th-btn primary" id="th-copy">Kopiuj plan do XTB</button>';
    html += '<button type="button" class="th-btn ghost" id="th-refresh">Odśwież kartę</button>';
    html += '</div>';
    html += '<div class="th-foot">Ustaw SL w XTB zanim klikniesz kup/sprzedaj · risk 0,5%</div>';
    el.innerHTML = html;

    var b = document.getElementById('th-copy');
    if (b) b.onclick = function () {
      var t = ticketText(pl);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {
          if (global.toast) global.toast('Plan XTB skopiowany', 'ok');
          else alert('Skopiowano plan XTB');
        });
      } else alert(t);
    };
    var r = document.getElementById('th-refresh');
    if (r) r.onclick = function () { render(); };
  }

  function bindTabs() {
    document.querySelectorAll('.nav button[data-tab], button[data-tab]').forEach(function (btn) {
      if (btn.__thBound) return;
      btn.__thBound = true;
      btn.addEventListener('click', function () {
        setTimeout(render, 30);
        setTimeout(render, 200);
      });
    });
  }

  function boot() {
    injectCss();
    render();
    bindTabs();
    // obserwuj kasowanie węzła
    var pane = getDeskPane();
    if (pane && !pane.__thObs) {
      pane.__thObs = true;
      try {
        var obs = new MutationObserver(function () {
          if (!document.getElementById(ROOT) || (pane.firstChild && pane.firstChild.id !== ROOT)) {
            render();
          }
        });
        obs.observe(pane, { childList: true });
      } catch (e) {}
    }
    if (typeof global.render === 'function' && !global.render.__tradeHero) {
      var orig = global.render;
      global.render = function () {
        var out = orig.apply(this, arguments);
        try { render(); } catch (e) {}
        return out;
      };
      global.render.__tradeHero = true;
    }
    setInterval(function () { bindTabs(); render(); }, 2500);
  }

  global.BTX_TRADE_HERO = { render: render, currentPlan: currentPlan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  // dodatkowy start po pełnym załadowaniu skryptów
  global.addEventListener && global.addEventListener('load', function () { setTimeout(boot, 50); });
})(typeof window !== 'undefined' ? window : globalThis);
