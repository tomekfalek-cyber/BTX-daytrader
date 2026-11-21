/**
 * BTX Pro Monday — warstwa profesjonalnego daytradera (paper → ręczne XTB).
 * - tablica okazji A+/A/B z uzasadnieniem
 * - karta XTB do skopiowania (symbol, strona, SL, TP, margin, dźwignia)
 * - checklista sesji i dyscypliny
 */
(function (global) {
  'use strict';
  if (global.__BTX_PRO_MONDAY__) return;
  global.__BTX_PRO_MONDAY__ = true;

  var ROOT = 'btx-pro-monday';
  var STYLE = 'btx-pro-monday-css';

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function money(x) {
    var ccy = (global.CFG && global.CFG.ccy) || 'USD';
    return f2(x) + ' ' + ccy;
  }
  function warsaw() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }
  function sessionInfo() {
    var w = warsaw();
    if (w.weekend) return { name: 'Weekend', open: false, entry: false, tip: 'Brak handlu sesyjnego — plan na poniedziałek.' };
    if (w.min >= 15 * 60 + 30 && w.min < 22 * 60) {
      var entry = w.min < 21 * 60 + 45;
      return { name: 'US', open: true, entry: entry, tip: entry ? 'Sesja US — można nowe wejścia.' : 'Tylko zarządzanie / flat przed zamknięciem.' };
    }
    if (w.min >= 9 * 60 && w.min < 17 * 60 + 30) {
      return { name: 'EU/FX', open: true, entry: w.min < 16 * 60 + 30, tip: 'Okno EU/FX 9:00–16:30 — ASML/SAP/SIE + FX. To Twoje główne okno testów; US od 15:30.' };
    }
    return { name: 'Poza sesją', open: false, entry: false, tip: 'Czekaj na sesję (EU ~9:00, US 15:30 PL).' };
  }
  function xtbSym(sym) {
    try {
      if (global.BTX_XTB_MAP && global.BTX_XTB_MAP[sym]) return global.BTX_XTB_MAP[sym];
    } catch (e) {}
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym && list[i].xtb) return list[i].xtb;
    return sym;
  }
  function gradeOf(g) {
    if (g.desk && g.desk.grade) return g.desk;
    if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.gradeSetup === 'function') {
      try { return global.BTX_AUTONOMY.gradeSetup(g); } catch (e) {}
    }
    var str = g.strength || 0;
    return {
      grade: str >= 4 ? 'A+' : (str >= 3 ? 'A' : (str >= 2 ? 'B' : 'REJECT')),
      score: str * 20,
      pass: str >= 2,
      reasons: [g.why || '']
    };
  }
  function ranked() {
    var sig = (global.ST && global.ST.sig) || [];
    var out = [];
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var gr = gradeOf(g);
      out.push({ g: g, gr: gr });
    }
    out.sort(function (a, b) {
      return (b.gr.score || 0) - (a.gr.score || 0) || (b.g.strength || 0) - (a.g.strength || 0);
    });
    return out;
  }
  function planLine(g, gr) {
    var ST = global.ST || {};
    var m = null;
    (global.SYMBOLS || []).forEach(function (x) { if (x.s === g.sym) m = x; });
    m = m || { s: g.sym, mkt: g.mkt || 'US' };
    var sp = null;
    try {
      if (global.BTX_STRATEGY_PRO && global.BTX_STRATEGY_PRO.sizePlanPro) {
        /* not exported */
      }
    } catch (e) {}
    var side = g.side === 'LONG' ? 'KUP' : 'SPRZEDAJ';
    var xtb = xtbSym(g.sym);
    var px = g.price || 0;
    var sd = g.sd || g.atr || px * 0.004;
    var sl = g.side === 'LONG' ? px - sd : px + sd;
    var tpR = (global.BTX_STRATEGY_PRO && global.BTX_STRATEGY_PRO.tpR) || 2;
    var tp = g.side === 'LONG' ? px + tpR * sd : px - tpR * sd;
    var lev = m.mkt === 'FX' ? Math.min(20, (global.CFG && global.CFG.fxLev) || 20) : 1;
    var lines = [
      '=== PLAN XTB (paper BTX) ===',
      'Instrument XTB: ' + xtb + ' (' + g.sym + ')',
      'Kierunek: ' + side + ' (' + g.side + ')',
      'Wejście ok.: ' + f2(px),
      'Stop-Loss: ' + f2(sl),
      'Take-Profit: ' + f2(tp) + ' (cel ~' + tpR + 'R)',
      'Dźwignia: ' + (lev <= 1 ? '1× (akcja/ETF)' : lev + '×'),
      'Siła/ocena: ' + (g.strength || 0) + ' / ' + (gr.grade || '?'),
      'Powód: ' + (g.why || '—'),
      'Uwaga: paper — sprawdź spread i wielkość vs swoje saldo na XTB.',
      '==========================='
    ];
    return lines.join('\n');
  }
  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT + '{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(96,165,250,.35);',
      'background:linear-gradient(135deg,rgba(30,58,138,.25),rgba(15,23,42,.95));color:#e2e8f0}',
      '#' + ROOT + ' h3{margin:0 0 8px;font-size:14px;color:#93c5fd;letter-spacing:.04em}',
      '#' + ROOT + ' .pm-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}',
      '#' + ROOT + ' .pm-chip{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(255,255,255,.06)}',
      '#' + ROOT + ' .pm-ok{color:#86efac} #' + ROOT + ' .pm-warn{color:#fde68a} #' + ROOT + ' .pm-bad{color:#fca5a5}',
      '#' + ROOT + ' .pm-card{margin-top:10px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25)}',
      '#' + ROOT + ' .pm-card b.sym{font-size:16px;color:#fff}',
      '#' + ROOT + ' .pm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
      '#' + ROOT + ' .pm-actions button{cursor:pointer;border:0;border-radius:8px;padding:8px 12px;font-weight:700;font-size:12px}',
      '#' + ROOT + ' .pm-copy{background:#2563eb;color:#eff6ff}',
      '#' + ROOT + ' .pm-muted{font-size:12px;color:#94a3b8;line-height:1.45;margin-top:6px}',
      '#' + ROOT + ' .grade-ap{color:#fbbf24} #' + ROOT + ' .grade-a{color:#86efac} #' + ROOT + ' .grade-b{color:#93c5fd}'
    ].join('');
    document.head.appendChild(s);
  }
  function ensure() {
    injectCss();
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    var ker = document.getElementById('btx-kernel-banner');
    if (ker && ker.parentNode === pane) ker.after(el);
    else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        if (global.toast) global.toast('Skopiowano plan XTB', 'ok');
      }).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (global.toast) global.toast('Skopiowano plan XTB', 'ok');
    } catch (e) {
      if (global.toast) global.toast('Nie udało się skopiować', 'err');
    }
  }
  function checklist(sess) {
    var ST = global.ST || {};
    var items = [];
    items.push({ ok: !sess.weekend && sess.open, t: 'Sesja aktywna (' + sess.name + ')' });
    items.push({ ok: !!sess.entry, t: 'Wolno otwierać nowe (nie bufor zamknięcia)' });
    var hasKey = false;
    try { hasKey = !!(global.BTX_LIVE && global.BTX_LIVE.getKey && global.BTX_LIVE.getKey()); } catch (e) {}
    items.push({ ok: hasKey, t: 'Klucz Twelve Data' });
    var cash = +ST.cash || 0;
    items.push({ ok: cash > 0, t: 'Wolne cash > 0 (' + money(cash) + ')' });
    var posN = ST.pos ? Object.keys(ST.pos).length : 0;
    var maxP = (global.CFG && global.CFG.maxPos) || 2;
    items.push({ ok: posN < maxP, t: 'Wolny slot pozycji (' + posN + '/' + maxP + ')' });
    var blocked = !!ST.blocked;
    items.push({ ok: !blocked, t: 'Brak blokady dnia' });
    var mode = 'trade';
    try { mode = localStorage.getItem('BTX_TRADE_MODE') || 'trade'; } catch (e2) {}
    items.push({ ok: mode !== 'observe', t: 'Tryb TRADE (nie tylko obserwacja)' });
    return items;
  }
  function render() {
    var el = ensure();
    if (!el) return;
    var sess = sessionInfo();
    var w = warsaw();
    sess.weekend = w.weekend;
    var rank = ranked().slice(0, 5);
    var checks = checklist(sess);
    var html = '';
    html += '<h3>PRO DAYTRADER · ' + w.label + ' PL</h3>';
    html += '<div class="pm-row">';
    html += '<span class="pm-chip ' + (sess.open ? 'pm-ok' : 'pm-bad') + '">' + sess.name + (sess.open ? ' OPEN' : ' CLOSED') + '</span>';
    html += '<span class="pm-chip ' + (sess.entry ? 'pm-ok' : 'pm-warn') + '">' + (sess.entry ? 'Nowe wejścia OK' : 'Bez nowych wejść') + '</span>';
    html += '<span class="pm-chip">Max 2 poz. · risk 0.35% · TP 2R · time-stop 24</span>';
    html += '</div>';
    html += '<div class="pm-muted">' + sess.tip + '</div>';
    html += '<div class="pm-muted" style="margin-top:8px"><b>Checklist:</b> ';
    html += checks.map(function (c) {
      return '<span class="' + (c.ok ? 'pm-ok' : 'pm-bad') + '">' + (c.ok ? '✔' : '✖') + ' ' + c.t + '</span>';
    }).join(' · ');
    html += '</div>';

    if (!rank.length) {
      html += '<div class="pm-card pm-muted">Brak aktywnych sygnałów LONG/SHORT w ostatnim skanie. Kliknij „Wykonaj cykl” / Auto. WAIT też jest informacją — bot filtruje słabe setupy.</div>';
    } else {
      rank.forEach(function (r, idx) {
        var g = r.g, gr = r.gr;
        var gcls = gr.grade === 'A+' ? 'grade-ap' : (gr.grade === 'A' ? 'grade-a' : 'grade-b');
        html += '<div class="pm-card">';
        html += '<div><b class="sym">' + g.sym + '</b> · <b style="color:' + (g.side === 'LONG' ? '#4ade80' : '#f87171') + '">' + g.side + '</b>';
        html += ' · ocena <b class="' + gcls + '">' + (gr.grade || '?') + '</b> · siła ' + (g.strength || 0);
        html += (gr.pass ? ' · <span class="pm-ok">kandydat</span>' : ' · <span class="pm-bad">słaby</span>');
        html += '</div>';
        html += '<div class="pm-muted">Cena ' + f2(g.price) + ' · ' + (g.why || 'brak opisu') + '</div>';
        if (gr.reasons && gr.reasons.length) {
          html += '<div class="pm-muted">Notatki: ' + gr.reasons.slice(0, 3).join('; ') + '</div>';
        }
        html += '<div class="pm-actions">';
        html += '<button type="button" class="pm-copy" data-pm-copy="' + idx + '">Kopiuj plan XTB</button>';
        html += '</div></div>';
      });
    }
    html += '<div class="pm-muted" style="margin-top:10px">Workflow pro: 1) checklist OK → 2) tylko A+/A gdy się uczysz → 3) kopiuj plan na XTB ręcznie → 4) nie dogrywaj poza planem → 5) flat przed końcem sesji.</div>';
    el.innerHTML = html;

    var plans = rank.map(function (r) { return planLine(r.g, r.gr); });
    el.querySelectorAll('[data-pm-copy]').forEach(function (btn) {
      btn.onclick = function () {
        var i = +btn.getAttribute('data-pm-copy');
        if (plans[i]) copyText(plans[i]);
      };
    });
  }

  function enforceProDefaults() {
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      if (localStorage.getItem('BTX_ALLOW_STOP_DAY') == null) localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_REQUIRE_LIVE', '0');
    } catch (e) {}
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (P) {
      P.scoreMin = 3;
      P.minStrengthOpen = 2;
      P.primeExtra = 0;
      P.timeStopBars = 24;
      P.coolBars = 2;
      P.minHoldBars = 2;
      P.tpR = 2;
      P.riskPct = 0.35;
      P.maxPos = 2;
    }
    if (global.CFG) {
      global.CFG.timeStop = 24;
      global.CFG.minHold = 2;
      global.CFG.confirm = 1;
      global.CFG.maxPos = 2;
      global.CFG.risk = 0.35;
    }
  }

  function boot() {
    enforceProDefaults();
    render();
    setInterval(function () {
      enforceProDefaults();
      render();
    }, 5000);
    if (typeof global.cycle === 'function' && !global.cycle.__proMon) {
      var orig = global.cycle;
      global.cycle = function () {
        enforceProDefaults();
        var r = orig.apply(this, arguments);
        setTimeout(render, 50);
        return r;
      };
      global.cycle.__proMon = true;
    }
  }

  global.BTX_PRO_MONDAY = { render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})(typeof window !== 'undefined' ? window : globalThis);
