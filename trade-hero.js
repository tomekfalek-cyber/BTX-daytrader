/**
 * BTX Trade Hero — góra Pulptu: natychmiast widać pozycję / plan XTB
 * Elegancki pasek handlowy (nie prostacki panel)
 */
(function (global) {
  var ROOT = 'btx-trade-hero';
  var STYLE = 'btx-trade-hero-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT + '{margin:0 0 16px;border-radius:18px;overflow:hidden;',
      'border:1px solid rgba(255,255,255,.08);',
      'background:radial-gradient(1200px 400px at 10% -20%,rgba(228,0,43,.18),transparent 55%),',
      'radial-gradient(900px 300px at 90% 0%,rgba(18,196,139,.12),transparent 50%),',
      'linear-gradient(180deg,#141a22 0%,#0e1319 100%);',
      'box-shadow:0 12px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)}',
      '#' + ROOT + ' .th-top{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;',
      'justify-content:space-between;padding:16px 18px 10px}',
      '#' + ROOT + ' .th-brand{font-size:10px;letter-spacing:.16em;text-transform:uppercase;',
      'color:#8b9aab;font-weight:700}',
      '#' + ROOT + ' .th-status{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#c5d0dc}',
      '#' + ROOT + ' .th-dot{width:8px;height:8px;border-radius:50%;background:#64748b;',
      'box-shadow:0 0 0 4px rgba(100,116,139,.15)}',
      '#' + ROOT + ' .th-dot.live{background:#12c48b;box-shadow:0 0 0 4px rgba(18,196,139,.15)}',
      '#' + ROOT + ' .th-dot.long{background:#12c48b;box-shadow:0 0 0 4px rgba(18,196,139,.18)}',
      '#' + ROOT + ' .th-dot.short{background:#f04452;box-shadow:0 0 0 4px rgba(240,68,82,.18)}',
      '#' + ROOT + ' .th-main{padding:4px 18px 18px;display:grid;',
      'grid-template-columns:1.2fr 1fr;gap:16px}',
      '@media(max-width:820px){#' + ROOT + ' .th-main{grid-template-columns:1fr}}',
      '#' + ROOT + ' .th-side{font-size:13px;font-weight:800;letter-spacing:.08em}',
      '#' + ROOT + ' .th-side.long{color:#3ddeaa}',
      '#' + ROOT + ' .th-side.short{color:#ff6b7a}',
      '#' + ROOT + ' .th-sym{font-size:28px;line-height:1.1;font-weight:800;color:#f3f6fa;',
      'font-family:"JetBrains Mono",ui-monospace,monospace;margin:4px 0 8px}',
      '#' + ROOT + ' .th-why{font-size:13px;line-height:1.55;color:#9aabbc;max-width:52ch}',
      '#' + ROOT + ' .th-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '#' + ROOT + ' .th-metric{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);',
      'border-radius:12px;padding:10px 12px}',
      '#' + ROOT + ' .th-metric span{display:block;font-size:10px;letter-spacing:.1em;',
      'text-transform:uppercase;color:#7f8b99;margin-bottom:4px;font-weight:700}',
      '#' + ROOT + ' .th-metric strong{font-size:15px;color:#eef3f8;',
      'font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}',
      '#' + ROOT + ' .th-metric strong.pos{color:#3ddeaa}',
      '#' + ROOT + ' .th-metric strong.neg{color:#ff6b7a}',
      '#' + ROOT + ' .th-actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 18px 16px}',
      '#' + ROOT + ' .th-btn{border:0;cursor:pointer;border-radius:10px;padding:10px 14px;',
      'font-weight:700;font-size:12px;letter-spacing:.02em}',
      '#' + ROOT + ' .th-btn.primary{background:linear-gradient(180deg,#e4002b,#c00024);color:#fff;',
      'box-shadow:0 6px 18px rgba(228,0,43,.25)}',
      '#' + ROOT + ' .th-btn.ghost{background:rgba(255,255,255,.04);color:#d5dee8;',
      'border:1px solid rgba(255,255,255,.08)}',
      '#' + ROOT + ' .th-empty{padding:22px 18px;color:#93a1b0;font-size:13px;line-height:1.5}',
      '#' + ROOT + ' .th-empty b{color:#e7eef7}',
      '#' + ROOT + ' .th-foot{padding:10px 18px 14px;border-top:1px solid rgba(255,255,255,.05);',
      'font-size:11px;color:#7b8794;display:flex;flex-wrap:wrap;gap:8px 14px}',
      '#' + ROOT + ' .th-pill{display:inline-flex;padding:3px 8px;border-radius:99px;',
      'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:10px;color:#b7c2ce}'
    ].join('');
    document.head.appendChild(s);
  }

  function f2(x, sym) {
    if (x == null || !isFinite(x)) return '—';
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
    var price = p.entry;
    var b = global.ST && global.ST.series && global.ST.series[sym];
    var last = b && b.length ? b[b.length - 1].c : price;
    var atr = p.atr || Math.abs((p.stop != null ? p.entry - p.stop : price * 0.008));
    if (p.stop == null && atr) {
      p.stop = p.side === 'SHORT' ? p.entry + atr : p.entry - atr;
    }
    var risk = Math.abs(p.entry - (p.stop != null ? p.stop : p.entry)) || atr || price * 0.004;
    var tp = p.tp != null ? p.tp : (p.side === 'SHORT' ? p.entry - 2.5 * risk : p.entry + 2.5 * risk);
    var partial = p.side === 'SHORT' ? p.entry - 1.5 * risk : p.entry + 1.5 * risk;
    var pnl = p.side === 'LONG' ? (last - p.entry) * (p.qty || 0) : (p.entry - last) * (p.qty || 0);
    return {
      mode: 'OPEN',
      sym: sym,
      side: p.side,
      entry: p.entry,
      last: last,
      sl: p.stop,
      tp: tp,
      partial: partial,
      qty: p.qty || 1,
      pnl: pnl,
      why: p.why || p.setup || 'Pozycja paper otwarta przez bota / desk',
      strength: p.strength,
      bars: p.bars
    };
  }

  function planFromSignal(g) {
    if (!g) return null;
    var price = g.price || 0;
    var atr = g.atr || price * 0.004;
    var sd = atr * 2;
    var eq = (global.ST && global.ST.equity) || (global.CFG && global.CFG.capital) || 100000;
    var riskPct = (global.CFG && global.CFG.risk) || 0.5;
    var riskCash = eq * (riskPct / 100);
    var qty = sd > 0 ? Math.max(1, Math.floor(riskCash / sd)) : 1;
    return {
      mode: 'SIGNAL',
      sym: g.sym,
      side: g.side,
      entry: price,
      last: price,
      sl: g.side === 'SHORT' ? price + sd : price - sd,
      tp: g.side === 'SHORT' ? price - 2.5 * sd : price + 2.5 * sd,
      partial: g.side === 'SHORT' ? price - 1.5 * sd : price + 1.5 * sd,
      qty: qty,
      pnl: null,
      why: g.why || (g.desk && g.desk.reasons && g.desk.reasons.join('; ')) || 'Setup z Signal Desk',
      strength: g.strength,
      score: g.desk && g.desk.score,
      grade: g.desk && g.desk.grade
    };
  }

  function currentPlan() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    var keys = Object.keys(pos);
    if (keys.length) {
      // najnowsza / pierwsza
      var sym = keys[0];
      return planFromPos(sym, pos[sym]);
    }
    // sygnał PASS
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
      var ranked = global.BTX_AUTONOMY.rankSignals();
      for (var i = 0; i < ranked.length; i++) {
        if (ranked[i].gr && ranked[i].gr.pass && ranked[i].g) {
          var pl = planFromSignal(ranked[i].g);
          if (pl) {
            pl.score = ranked[i].gr.score;
            pl.grade = ranked[i].gr.grade;
            return pl;
          }
        }
      }
    }
    var sig = (ST.sig || []).filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
    if (sig && (sig.strength || 0) >= 4) return planFromSignal(sig);
    return null;
  }

  function ticketText(pl) {
    if (!pl) return '';
    var lines = [];
    lines.push(pl.mode === 'OPEN' ? 'BTX POZYCJA OTWARTA → XTB' : 'BTX SYGNAŁ → XTB');
    lines.push('Symbol XTB: ' + xtbSym(pl.sym));
    lines.push('Strona: ' + pl.side);
    lines.push('Wejście: ' + f2(pl.entry, pl.sym));
    lines.push('Size: ' + pl.qty);
    lines.push('SL: ' + f2(pl.sl, pl.sym));
    lines.push('Partial ~50%: ' + f2(pl.partial, pl.sym));
    lines.push('TP: ' + f2(pl.tp, pl.sym));
    lines.push('BE: po +1R przenieś SL na entry');
    if (pl.strength != null) lines.push('Siła: ' + pl.strength + '/5');
    if (pl.grade) lines.push('Grade: ' + pl.grade + (pl.score != null ? (' (' + pl.score + ')') : ''));
    lines.push('Dlaczego: ' + String(pl.why || '').replace(/\s+/g, ' ').slice(0, 220));
    return lines.join('\n');
  }

  function ensure() {
    injectCss();
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    // absolutny top pulpitu
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function render() {
    var el = ensure();
    if (!el) return;
    var pl = currentPlan();
    var live = false;
    try {
      if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) live = !!global.BTX_PRO6.dataGate().ok;
    } catch (e) {}

    if (!pl) {
      el.innerHTML = '<div class="th-top"><div class="th-brand">BTX Desk · Handel</div>' +
        '<div class="th-status"><span class="th-dot' + (live ? ' live' : '') + '"></span>' +
        (live ? 'Dane LIVE · brak pozycji / A+ teraz' : 'Brak pozycji · czekam na setup') + '</div></div>' +
        '<div class="th-empty"><b>Brak aktywnego handlu do skopiowania.</b><br>' +
        'Gdy bot otworzy paper albo pojawi się A/A+, tutaj zobaczysz LONG/SHORT, size, SL, TP i powód — gotowe pod XTB.</div>';
      return;
    }

    var isLong = pl.side === 'LONG';
    var sideCls = isLong ? 'long' : 'short';
    var title = pl.mode === 'OPEN' ? 'POZYCJA OTWARTA' : 'SYGNAŁ GOTOWY';
    var why = String(pl.why || '').replace(/</g, '&lt;');
    if (why.length > 280) why = why.slice(0, 280) + '…';

    var html = '';
    html += '<div class="th-top">';
    html += '<div class="th-brand">BTX Desk · ' + title + '</div>';
    html += '<div class="th-status"><span class="th-dot ' + sideCls + '"></span>' +
      (pl.mode === 'OPEN' ? 'Bot trzyma paper · skopiuj te same poziomy na XTB' : 'Setup do ręcznego wejścia na XTB') +
      (live ? ' · LIVE' : '') + '</div>';
    html += '</div>';

    html += '<div class="th-main">';
    html += '<div>';
    html += '<div class="th-side ' + sideCls + '">' + pl.side + (pl.grade ? (' · ' + pl.grade) : '') + '</div>';
    html += '<div class="th-sym">' + pl.sym + '</div>';
    html += '<div class="th-why"><b style="color:#cfd9e6">Dlaczego: </b>' + why + '</div>';
    html += '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">';
    html += '<span class="th-pill">XTB: ' + xtbSym(pl.sym) + '</span>';
    if (pl.strength != null) html += '<span class="th-pill">Siła ' + pl.strength + '/5</span>';
    if (pl.score != null) html += '<span class="th-pill">Score ' + pl.score + '</span>';
    if (pl.bars != null) html += '<span class="th-pill">Świece: ' + pl.bars + '</span>';
    html += '</div></div>';

    html += '<div class="th-metrics">';
    html += '<div class="th-metric"><span>Wejście</span><strong>' + f2(pl.entry, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Size (szt. / est.)</span><strong>' + pl.qty + '</strong></div>';
    html += '<div class="th-metric"><span>Stop Loss</span><strong class="neg">' + f2(pl.sl, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Take Profit</span><strong class="pos">' + f2(pl.tp, pl.sym) + '</strong></div>';
    html += '<div class="th-metric"><span>Partial ~50%</span><strong>' + f2(pl.partial, pl.sym) + '</strong></div>';
    if (pl.mode === 'OPEN' && pl.pnl != null) {
      html += '<div class="th-metric"><span>Paper P&L</span><strong class="' + (pl.pnl >= 0 ? 'pos' : 'neg') + '">' +
        (pl.pnl >= 0 ? '+' : '') + f2(pl.pnl, pl.sym) + '</strong></div>';
    } else {
      html += '<div class="th-metric"><span>Prognoza</span><strong>TP 2.5R · partial 1.5R · BE 1R</strong></div>';
    }
    html += '</div></div>';

    html += '<div class="th-actions">';
    html += '<button type="button" class="th-btn primary" id="th-copy">Kopiuj plan do XTB</button>';
    html += '<button type="button" class="th-btn ghost" id="th-refresh">Odśwież</button>';
    html += '</div>';
    html += '<div class="th-foot"><span>Wklej poziomy w xStation ręcznie</span><span>SL zanim wejdziesz</span><span>Risk 0,5% · max 2 pos</span></div>';

    el.innerHTML = html;

    var b = document.getElementById('th-copy');
    if (b) b.onclick = function () {
      var t = ticketText(pl);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {
          if (global.toast) global.toast('Plan XTB skopiowany', 'ok');
        });
      } else if (global.toast) global.toast('Zaznacz plan ręcznie', 'info');
    };
    var r = document.getElementById('th-refresh');
    if (r) r.onclick = function () { render(); };
  }

  function boot() {
    injectCss();
    render();
    if (typeof global.render === 'function' && !global.render.__tradeHero) {
      var orig = global.render;
      global.render = function () {
        var out = orig.apply(this, arguments);
        try { render(); } catch (e) {}
        return out;
      };
      global.render.__tradeHero = true;
    }
    setInterval(render, 3000);
  }

  global.BTX_TRADE_HERO = { render: render, currentPlan: currentPlan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
