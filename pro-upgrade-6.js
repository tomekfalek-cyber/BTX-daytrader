/**
 * BTX Pro Upgrade ×6
 * 1 Korelacja / max ekspozycja na motyw
 * 2 Twardy status danych — blokada sygnałów przy DEMO/błędzie API
 * 3 Plan XTB do skopiowania (1 klik)
 * 4 News high-only (+ weekend)
 * 5 Tygodniowy review journala
 * 6 Uczciwy backtest — ostrzeżenia demo ≠ live
 */
(function (global) {
  var STYLE = 'btx-pro6-css';
  var WK = 'BTX_WEEKLY_REVIEW';
  var CLUSTERS = {
    TECH: ['NVDA', 'TSLA', 'META', 'AAPL', 'QQQ'],
    INDEX: ['SPY', 'QQQ'],
    FX: ['EURUSD', 'GBPUSD', 'USDJPY'],
    GOLD: ['XAU/USD', 'XAUUSD', 'GOLD']
  };
  var MAX_PER_CLUSTER = 1; // max otwartych z jednego motywu
  var HIGH_NEWS = [
    // minuty = czas polski minus 60 (stale caly rok, DST-safe): patrz BTX_TIME.pseudoUtcMin
    { label: 'US CPI / NFP / dane 14:30 PL', min: 13 * 60 + 30, rank: 'HIGH' },
    { label: 'FOMC 20:00 PL', min: 19 * 60, rank: 'HIGH' },
    { label: 'FOMC konferencja 20:30 PL', min: 19 * 60 + 30, rank: 'HIGH' },
    { label: 'ECB decyzja 14:15 PL', min: 13 * 60 + 15, rank: 'HIGH' }
  ];
  var PAD = 30;

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-pro6{display:grid;gap:12px;margin:12px 0}',
      '#btx-pro6 .p6-card{background:linear-gradient(180deg,var(--bg3,#181d26),var(--bg2,#12161d));border:1px solid var(--line,rgba(255,255,255,.08));border-radius:14px;padding:12px 14px}',
      '#btx-pro6 h3{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--tx3,#889);margin:0 0 8px;font-weight:700}',
      '#btx-pro6 .p6-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '#btx-pro6 .pill{display:inline-flex;padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700}',
      '#btx-pro6 .pill.ok{background:rgba(18,196,139,.15);color:#12c48b}',
      '#btx-pro6 .pill.bad{background:rgba(240,68,82,.15);color:#f87171}',
      '#btx-pro6 .pill.warn{background:rgba(245,179,1,.15);color:#f5b301}',
      '#btx-pro6 .mini{font-size:12px;color:var(--tx2,#9aa);line-height:1.45}',
      '#btx-pro6 textarea,#btx-xtb-copy{width:100%;min-height:90px;background:var(--bg4,#202733);border:1px solid var(--line);color:#fff;border-radius:10px;padding:10px;font:12px/1.45 ui-monospace,monospace}',
      '#btx-pro6 .btn{cursor:pointer;margin-top:6px}',
      '.sig-blocked{opacity:.55}',
      '.btx-bt-warn{border-left:3px solid #f5b301;background:rgba(245,179,1,.08);padding:10px 12px;border-radius:0 10px 10px 0;margin:10px 0;font-size:12px;line-height:1.45;color:var(--tx2)}'
    ].join('');
    document.head.appendChild(s);
  }

  function clusterOf(sym) {
    sym = String(sym || '');
    var out = [];
    Object.keys(CLUSTERS).forEach(function (c) {
      if (CLUSTERS[c].indexOf(sym) >= 0) out.push(c);
    });
    return out.length ? out : ['OTHER'];
  }

  function openClusterCounts() {
    var pos = (global.ST && global.ST.pos) || {};
    var counts = {};
    Object.keys(pos).forEach(function (sym) {
      clusterOf(sym).forEach(function (c) {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return counts;
  }

  function correlationBlock(sym, side) {
    if (side !== 'LONG' && side !== 'SHORT') return null;
    var counts = openClusterCounts();
    var cls = clusterOf(sym);
    for (var i = 0; i < cls.length; i++) {
      var c = cls[i];
      if (c === 'OTHER') continue;
      if ((counts[c] || 0) >= MAX_PER_CLUSTER) {
        return {
          blocked: true,
          reason: 'Klaster ' + c + ': już masz max ' + MAX_PER_CLUSTER + ' pozycję (korelacja / ten sam motyw)'
        };
      }
    }
    // dodatkowy filtr: nie 3 longi tech+index w tę samą stronę rynku
    var sameDir = 0;
    var pos = (global.ST && global.ST.pos) || {};
    Object.keys(pos).forEach(function (s) {
      if (pos[s] && pos[s].side === side) sameDir++;
    });
    if (sameDir >= 2) {
      return { blocked: true, reason: 'Max 2 pozycje w tę samą stronę rynku (ekspozycja)' };
    }
    return { blocked: false, clusters: cls };
  }

  function dataGate() {
    var cfg = global.CFG || {};
    var prov = cfg.provider || 'twelve';
    var key = '';
    try { key = localStorage.getItem('btx_twelve_key') || ''; } catch (e) {}
    key = key || cfg.tdKey || cfg.twelveKey || cfg.apiKey || '';
    key = String(key || '').trim();

    var live = false;
    if (prov === 'twelve' && key) live = true;
    if (prov === 'alpaca' && cfg.alpKey && cfg.alpSec) live = true;
    if (prov === 'stooq') live = true; // EOD — słabe pod DT

    var lastErr = global.__BTX_LAST_DATA_ERR || '';
    if (lastErr) {
      return { ok: false, mode: 'error', label: 'BŁĄD DANYCH', tip: String(lastErr).slice(0, 120), blockSignals: true };
    }
    if (!live || prov === 'demo' || (!key && prov === 'twelve')) {
      return { ok: false, mode: 'demo', label: 'DEMO', tip: 'Brak LIVE Twelve — sygnały tylko edukacyjne, nie do XTB', blockSignals: true };
    }
    if (prov === 'stooq') {
      return { ok: false, mode: 'eod', label: 'EOD STOOQ', tip: 'Za wolne pod daytrading', blockSignals: true };
    }
    return { ok: true, mode: 'live', label: 'LIVE', tip: 'Dane LIVE — sygnały mogą iść na checklistę XTB', blockSignals: false };
  }

  function highNewsNow() {
    var now = new Date();
    var T = global.BTX_TIME;
    var day = T ? T.local(now.getTime()).dow : now.getUTCDay();
    var t = T ? T.pseudoUtcMin(now) : now.getUTCHours() * 60 + now.getUTCMinutes();
    var pl = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    var utc = now.toISOString().slice(11, 16) + ' UTC';
    if (day === 0 || day === 6) {
      return {
        weekend: true,
        blocked: true,
        headline: 'Weekend — brak sesji akcji US',
        detail: pl + ' · ' + utc + ' · stock/ETF: nie otwieraj nowych',
        items: []
      };
    }
    var items = HIGH_NEWS.map(function (w) {
      var dist = w.min - t;
      return { label: w.label, rank: w.rank, dist: dist, active: Math.abs(dist) <= PAD };
    }).sort(function (a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return Math.abs(a.dist) - Math.abs(b.dist);
    });
    var act = items.filter(function (x) { return x.active; })[0];
    return {
      weekend: false,
      blocked: !!act,
      headline: act ? ('HIGH NEWS blackout: ' + act.label) : 'OK — poza oknami HIGH',
      detail: pl + ' · ' + utc + ' · tylko wydarzenia HIGH (±' + PAD + ' min)',
      items: items
    };
  }

  function xtbMap(sym) {
    var m = { 'QQQ': 'US100', 'SPY': 'US500', 'XAU/USD': 'GOLD', 'XAUUSD': 'GOLD', 'NVDA': 'NVDA.US', 'TSLA': 'TSLA.US', 'META': 'META.US', 'AAPL': 'AAPL.US', 'EURUSD': 'EURUSD' };
    return m[sym] || (sym + ' (sprawdź symbol XTB)');
  }

  function buildXtbTicket(g) {
    if (!g) return 'Brak sygnału LONG/SHORT — brak biletu XTB.';
    var plan = null;
    if (global.BTX_PRO_DESK && typeof global.BTX_PRO_DESK.xtbPlan === 'function') {
      try { plan = global.BTX_PRO_DESK.xtbPlan(g); } catch (e) {}
    }
    if (!plan && global.BTX_PRO_DESK && global.xtbPlan) {
      try { plan = global.xtbPlan(g); } catch (e2) {}
    }
    // lokalny fallback
    if (!plan) {
      var price = g.price || 0, atr = g.atr || price * 0.004, sd = atr * 2;
      var eq = (global.ST && global.ST.equity) || (global.CFG && global.CFG.capital) || 100000;
      var riskCash = eq * 0.005;
      var qty = sd > 0 ? Math.max(1, Math.floor(riskCash / sd)) : 1;
      plan = {
        qty: qty, riskPct: 0.5, entry: price,
        sl: g.side === 'SHORT' ? price + sd : price - sd,
        tp: g.side === 'SHORT' ? price - 2.5 * sd : price + 2.5 * sd,
        partial: g.side === 'SHORT' ? price - 1.5 * sd : price + 1.5 * sd
      };
    }
    var f = function (x) {
      if (x == null || !isFinite(x)) return '—';
      return (global.f2 ? global.f2(x) : Number(x).toFixed(2));
    };
    var lines = [];
    lines.push('BTX → XTB (ręcznie)');
    lines.push('Symbol XTB: ' + xtbMap(g.sym));
    lines.push('Strona: ' + g.side);
    lines.push('Wejście ok.: ' + f(plan.entry));
    lines.push('Size (szacunek): ' + plan.qty);
    lines.push('Ryzyko: ' + (plan.riskPct != null ? plan.riskPct : 0.5) + '%');
    lines.push('SL: ' + f(plan.sl));
    lines.push('Partial TP (~50%): ' + f(plan.partial));
    lines.push('TP: ' + f(plan.tp));
    lines.push('BE: przenieś SL na entry po +1R');
    lines.push('Siła sygnału: ' + (g.strength || '?') + '/5');
    if (g.why) lines.push('Setup: ' + String(g.why).slice(0, 140));
    lines.push('Anuluj jeśli: checklista nie OK / news HIGH / dane DEMO');
    return lines.join('\n');
  }

  function bestSignal() {
    var sig = (global.ST && global.ST.sig) || [];
    return sig.filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0] || null;
  }

  function weeklyReview() {
    var closed = (global.ST && global.ST.closed) || [];
    var now = new Date();
    var weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    // closed may not have timestamps — bierz ostatnie max 20 jako "okres"
    var sample = closed.slice(0, 20);
    var wins = 0, losses = 0, sum = 0, byTag = {};
    sample.forEach(function (t) {
      var p = t.pnl || 0;
      sum += p;
      if (p > 0) wins++; else if (p < 0) losses++;
      var setup = String(t.setup || t.why || 'inne').slice(0, 40);
      if (!byTag[setup]) byTag[setup] = { n: 0, pnl: 0 };
      byTag[setup].n++;
      byTag[setup].pnl += p;
    });
    var n = wins + losses;
    var lines = [];
    lines.push('Okres: ostatnie ' + sample.length + ' zamkniętych paper trades (max 20).');
    lines.push('Wynik: ' + (sum >= 0 ? '+' : '') + sum.toFixed(2) + ' · ' + wins + 'W / ' + losses + 'L' + (n ? (' · WR ' + Math.round(wins / n * 100) + '%') : ''));
    if (!sample.length) {
      lines.push('Brak historii — zrób kilka paper trades, żeby review miał treść.');
      return lines.join('\n');
    }
    // najlepszy / najgorszy setup
    var best = null, worst = null;
    Object.keys(byTag).forEach(function (k) {
      var o = byTag[k];
      if (!best || o.pnl > best.pnl) best = { k: k, pnl: o.pnl, n: o.n };
      if (!worst || o.pnl < worst.pnl) worst = { k: k, pnl: o.pnl, n: o.n };
    });
    if (best) lines.push('Powtarzaj: "' + best.k + '" (n=' + best.n + ', P&L ' + best.pnl.toFixed(2) + ')');
    if (worst && worst.k !== (best && best.k)) lines.push('Ogranicz: "' + worst.k + '" (n=' + worst.n + ', P&L ' + worst.pnl.toFixed(2) + ')');
    lines.push('Zasada tygodnia: tylko siła ≥4, checklista OK, max 1 pozycja na klaster, zero wejść przy DEMO/HIGH news.');
    try { localStorage.setItem(WK, JSON.stringify({ t: Date.now(), text: lines.join('\n') })); } catch (e) {}
    return lines.join('\n');
  }

  function annotateSignals() {
    var ST = global.ST;
    if (!ST || !ST.sig) return;
    var gate = dataGate();
    var news = highNewsNow();
    ST.sig.forEach(function (g) {
      if (!g) return;
      g.pro6 = g.pro6 || {};
      var blocks = [];
      if (gate.blockSignals) blocks.push(gate.tip || 'Dane nie-LIVE');
      if (news.blocked && (g.side === 'LONG' || g.side === 'SHORT')) blocks.push(news.headline);
      var corr = correlationBlock(g.sym, g.side);
      if (corr && corr.blocked) blocks.push(corr.reason);
      g.pro6.blocked = blocks.length > 0;
      g.pro6.blockReasons = blocks;
      g.pro6.clusters = clusterOf(g.sym);
      if (g.pro6.blocked && (g.side === 'LONG' || g.side === 'SHORT')) {
        // nie kasuj całkowicie — oznacz i obniż siłę / zmień na WAIT przy twardym gate danych
        if (gate.blockSignals || news.blocked) {
          g._sideBeforePro6 = g._sideBeforePro6 || g.side;
          g.side = 'WAIT';
          g.why = (g.why || '') + ' | BLOK: ' + blocks.join('; ');
        } else if (corr && corr.blocked) {
          g.strength = Math.min(g.strength || 0, 3);
          g.why = (g.why || '') + ' | ' + corr.reason;
        }
      }
    });
  }

  function ensurePanel() {
    injectCss();
    var host = document.getElementById('btx-pro6');
    if (!host) {
      var pane = document.getElementById('pane-desk') || document.getElementById('pane-sig');
      if (!pane) return null;
      host = document.createElement('div');
      host.id = 'btx-pro6';
      if (pane.firstChild) pane.insertBefore(host, pane.firstChild);
      else pane.appendChild(host);
    }
    return host;
  }

  function renderPanel() {
    var host = ensurePanel();
    if (!host) return;
    var gate = dataGate();
    var news = highNewsNow();
    var counts = openClusterCounts();
    var best = bestSignal();
    var ticket = buildXtbTicket(best);
    var review = weeklyReview();

    var clStr = Object.keys(counts).map(function (k) { return k + ':' + counts[k]; }).join(' · ') || 'brak otwartych';

    var html = '';
    // 2 data gate
    html += '<div class="p6-card"><h3>2 · Status danych (twardy)</h3>';
    html += '<span class="pill ' + (gate.ok ? 'ok' : 'bad') + '">' + gate.label + '</span> ';
    html += '<span class="mini">' + gate.tip + '</span>';
    html += '<div class="mini" style="margin-top:6px">' + (gate.blockSignals ? 'Nowe wejścia XTB: <b>ZABLOKOWANE</b> (edukacja / paper only).' : 'Nowe wejścia: dozwolone po checklistie.') + '</div></div>';

    // 1 correlation
    html += '<div class="p6-card"><h3>1 · Korelacja / klastry</h3>';
    html += '<div class="mini">Max <b>' + MAX_PER_CLUSTER + '</b> pozycja na motyw (TECH / INDEX / FX / GOLD). Otwarte: ' + clStr + '</div>';
    html += '<div class="mini">TECH=NVDA TSLA META AAPL QQQ · INDEX=SPY/QQQ · GOLD=XAU · FX=EURUSD</div></div>';

    // 4 news high
    html += '<div class="p6-card"><h3>4 · News HIGH-only</h3>';
    html += '<div class="mini"><b>' + news.headline + '</b><br>' + news.detail + '</div>';
    if (!news.weekend && news.items && news.items.length) {
      html += '<div class="mini" style="margin-top:6px">';
      news.items.slice(0, 4).forEach(function (w) {
        var when = w.active ? 'TERAZ' : (w.dist >= 0 ? ('za ' + w.dist + ' min') : (Math.abs(w.dist) + ' min temu'));
        html += (w.active ? '<b style="color:#f87171">' : '') + '[' + w.rank + '] ' + w.label + ' · ' + when + (w.active ? '</b>' : '') + '<br>';
      });
      html += '</div>';
    }
    html += '</div>';

    // 3 XTB copy
    html += '<div class="p6-card"><h3>3 · Plan XTB (kopiuj)</h3>';
    html += '<textarea id="btx-xtb-copy" readonly>' + ticket.replace(/</g, '&lt;') + '</textarea>';
    html += '<div class="p6-row"><button type="button" class="btn" id="btx-copy-xtb">Kopiuj plan XTB</button>';
    html += '<span class="mini" id="btx-copy-status"></span></div></div>';

    // 5 weekly review
    html += '<div class="p6-card"><h3>5 · Review tygodnia (journal)</h3>';
    html += '<div class="mini" style="white-space:pre-wrap">' + review.replace(/</g, '&lt;') + '</div>';
    html += '<button type="button" class="btn ghost" id="btx-refresh-review" style="margin-top:8px">Odśwież review</button></div>';

    // 6 honest backtest
    html += '<div class="p6-card"><h3>6 · Backtest ≠ live</h3>';
    html += '<div class="btx-bt-warn">Backtest na DEMO / syntetyce <b>nie jest</b> wynikiem live. Porównuj: avg R, max DD, liczbę trade’ów, checklistę — nie sam % win rate. Zanim XTB: min. kilkadziesiąt paper trades i zgodność reguł z zakładką Backtest.</div>';
    html += '<div class="mini">Reguły desk = strategy-pro.js + pro-upgrade-6 (klastry, data gate, news HIGH).</div></div>';

    host.innerHTML = html;

    var b = document.getElementById('btx-copy-xtb');
    if (b) b.onclick = function () {
      var tx = document.getElementById('btx-xtb-copy');
      var text = tx ? tx.value : ticket;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          var st = document.getElementById('btx-copy-status');
          if (st) st.textContent = 'Skopiowano — wklej do notatki / XTB';
          if (global.toast) global.toast('Plan XTB skopiowany', 'ok');
        }).catch(function () { fallbackCopy(text); });
      } else fallbackCopy(text);
    };
    var r = document.getElementById('btx-refresh-review');
    if (r) r.onclick = function () { renderPanel(); };
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (global.toast) global.toast('Plan XTB skopiowany', 'ok');
    } catch (e) {
      if (global.toast) global.toast('Nie udało się skopiować — zaznacz ręcznie', 'err');
    }
  }

  function patchBacktestPane() {
    var pane = document.getElementById('pane-bt');
    if (!pane || document.getElementById('btx-bt-honest')) return;
    var w = document.createElement('div');
    w.id = 'btx-bt-honest';
    w.className = 'btx-bt-warn';
    w.innerHTML = '<b>Uczciwy backtest:</b> wynik na danych demo/syntetycznych ≠ live XTB. Patrz na avg R, drawdown i liczbę trade’ów. Koszty (spread/prowizja) na XTB obniżą wynik.';
    var card = pane.querySelector('.card') || pane;
    if (card.firstChild) card.insertBefore(w, card.firstChild);
    else card.appendChild(w);
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__pro6) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      var gate = dataGate();
      if (gate.blockSignals) {
        if (global.log) global.log('openPos zablokowane: ' + gate.tip, 'i');
        if (global.toast) global.toast('Blokada: ' + gate.label + ' — nie otwieram paper pod XTB', 'info');
        return;
      }
      var news = highNewsNow();
      if (news.blocked) {
        if (global.log) global.log('openPos zablokowane: ' + news.headline, 'i');
        if (global.toast) global.toast(news.headline, 'info');
        return;
      }
      var corr = correlationBlock(g && g.sym, g && g.side);
      if (corr && corr.blocked) {
        if (global.log) global.log(corr.reason, 'i');
        if (global.toast) global.toast(corr.reason, 'info');
        return;
      }
      return orig.apply(this, arguments);
    };
    global.openPos.__pro6 = true;
  }

  // złap błędy fetch Twelve
  function patchFetchErrors() {
    if (global.fetchTwelve && !global.fetchTwelve.__pro6err) {
      var f = global.fetchTwelve;
      global.fetchTwelve = async function () {
        try {
          var r = await f.apply(this, arguments);
          global.__BTX_LAST_DATA_ERR = '';
          return r;
        } catch (e) {
          global.__BTX_LAST_DATA_ERR = e.message || 'fetch error';
          throw e;
        }
      };
      global.fetchTwelve.__pro6err = true;
    }
  }

  function patchRender() {
    if (typeof global.render === 'function' && !global.render.__pro6) {
      var orig = global.render;
      global.render = function () {
        try { annotateSignals(); } catch (e) {}
        var r = orig.apply(this, arguments);
        try { renderPanel(); patchBacktestPane(); } catch (e2) {}
        return r;
      };
      global.render.__pro6 = true;
    }
    if (typeof global.cycle === 'function' && !global.cycle.__pro6) {
      var c = global.cycle;
      global.cycle = function () {
        var r = c.apply(this, arguments);
        try { annotateSignals(); renderPanel(); } catch (e) {}
        return r;
      };
      global.cycle.__pro6 = true;
    }
  }

  function boot() {
    injectCss();
    patchOpen();
    patchFetchErrors();
    patchRender();
    patchBacktestPane();
    try { annotateSignals(); renderPanel(); } catch (e) {}
    setInterval(function () {
      try {
        patchOpen();
        patchFetchErrors();
        patchRender();
        annotateSignals();
        renderPanel();
        patchBacktestPane();
      } catch (e) {}
    }, 4000);
  }

  global.BTX_PRO6 = {
    dataGate: dataGate,
    highNewsNow: highNewsNow,
    correlationBlock: correlationBlock,
    buildXtbTicket: buildXtbTicket,
    weeklyReview: weeklyReview
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
