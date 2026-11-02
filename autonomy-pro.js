/**
 * BTX Autonomy PRO + Signal Desk 9/10
 *
 * 1) Autonomia paper: sam skanuje, otwiera, zarządza, zamyka (w limicie PRO)
 * 2) System sygnałowy: jeden twardy gate jakości A+ / odrzucenia z powodami
 * 3) XTB nadal RĘCZNIE — ale kolejka + auto-kopiowanie planu przy każdym wejściu paper
 *
 * Uwaga: prawdziwe 9/10 auto na koncie XTB wymaga oficjalnego API brokera.
 * Tu max autonomii = paper + asysta pod ręczny XTB.
 */
(function (global) {
  var LS_AUTO = 'BTX_AUTONOMY_ON';
  var LS_Q = 'BTX_XTB_QUEUE';
  var STYLE = 'btx-autonomy-css';
  var timer = null;
  var lastScan = 0;
  var lastAction = '';

  function on() {
    try { return localStorage.getItem(LS_AUTO) === '1'; } catch (e) { return false; }
  }
  function setOn(v) {
    try { localStorage.setItem(LS_AUTO, v ? '1' : '0'); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-auto-panel{margin:12px 0;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(18,196,139,.4);background:rgba(18,196,139,.07)}',
      '#btx-auto-panel h3{margin:0 0 6px;font-size:14px}',
      '#btx-auto-panel .why{font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 10px}',
      '#btx-auto-panel .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '#btx-auto-panel .pill{display:inline-flex;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700}',
      '#btx-auto-panel .pill.on{background:rgba(18,196,139,.2);color:#12c48b}',
      '#btx-auto-panel .pill.off{background:rgba(240,68,82,.15);color:#f87171}',
      '#btx-auto-panel table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}',
      '#btx-auto-panel th,#btx-auto-panel td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}',
      '#btx-auto-panel .rej{color:#f87171}',
      '#btx-auto-panel .ok{color:#12c48b}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Centralny gate jakości sygnału — serce systemu 9/10 */
  function gradeSetup(g) {
    var reasons = [];
    var score = 0;
    if (!g) return { pass: false, score: 0, grade: 'NONE', reasons: ['brak setupu'] };

    var side = g.side;
    if (side !== 'LONG' && side !== 'SHORT') {
      return { pass: false, score: 0, grade: 'WAIT', reasons: ['brak kierunku LONG/SHORT'] };
    }

    var str = g.strength || 0;
    if (str >= 5) score += 35;
    else if (str >= 4) score += 28;
    else {
      reasons.push('siła ' + str + '/5 < 4');
    }

    // dane LIVE
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var dg = global.BTX_PRO6.dataGate();
      if (dg.blockSignals) reasons.push('dane: ' + (dg.label || 'nie-LIVE'));
      else score += 15;
    } else score += 5;

    // news HIGH / makro
    if (global.__BTX_MACRO_BLOCK) reasons.push('makro HIGH: ' + (global.__BTX_MACRO_BLOCK.title || 'event'));
    else if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
      var hn = global.BTX_PRO6.highNewsNow();
      if (hn.blocked) reasons.push(hn.headline || 'news blackout');
      else score += 10;
    } else score += 5;

    // STOP FOR DAY
    if (global.BTX_LEARN && global.BTX_LEARN.checkHardStop) {
      var st = global.BTX_LEARN.checkHardStop();
      if (st.stopped) reasons.push('STOP FOR DAY');
      else score += 10;
    } else score += 5;

    // korelacja
    if (global.BTX_PRO6 && global.BTX_PRO6.correlationBlock) {
      var cb = global.BTX_PRO6.correlationBlock(g.sym, side);
      if (cb && cb.blocked) reasons.push(cb.reason || 'klaster');
      else score += 10;
    } else score += 5;

    // sesja (strategy-pro)
    try {
      if (global.BTX_PRO && global.BTX_newsBlocked) {
        var nb = global.BTX_newsBlocked(new Date());
        if (nb && nb.blocked) reasons.push('sesja/news PRO: ' + (nb.label || ''));
        else score += 8;
      } else score += 4;
    } catch (e) { score += 2; }

    // weekend stock block
    var day = new Date().getUTCDay();
    var isFx = /EUR|USD|XAU|GOLD|GBP|JPY/.test(g.sym || '');
    if ((day === 0 || day === 6) && !isFx) reasons.push('weekend — stock/ETF');
    else score += 5;

    // VPVR lekka kara za złą lokalizację
    if (g.vpvr && (g.vpvr.zone === 'high' || g.vpvr.zone === 'low')) {
      if ((side === 'LONG' && g.vpvr.zone === 'high') || (side === 'SHORT' && g.vpvr.zone === 'low')) {
        score -= 8;
        reasons.push('VPVR: słaba lokalizacja (' + g.vpvr.zone + ')');
      } else score += 4;
    } else score += 3;

    // max pozycji / day trades
    var ST = global.ST || {};
    var nPos = Object.keys(ST.pos || {}).length;
    var maxPos = (global.CFG && global.CFG.maxPos) || 2;
    if (nPos >= maxPos) reasons.push('max pozycji (' + maxPos + ')');
    else score += 5;
    if ((ST.dayTrades || 0) >= ((global.CFG && global.CFG.maxTrades) || 4)) reasons.push('max trade\'ów dziennie');
    else score += 5;

    if (ST.blocked) reasons.push('konto zablokowane limitami');
    if (ST.cool && ST.cool[g.sym] > 0) reasons.push('cooldown instrumentu');

    // unikalny dedupe: nie otwieraj jak już jest pozycja
    if (ST.pos && ST.pos[g.sym]) reasons.push('już jest pozycja na ' + g.sym);

    var pass = reasons.length === 0 && str >= 4 && score >= 70;
    var grade = !pass ? 'REJECT' : (score >= 88 || str >= 5 ? 'A+' : 'A');
    return { pass: pass, score: Math.max(0, Math.min(100, score)), grade: grade, reasons: reasons, side: side, sym: g.sym, strength: str };
  }

  function rankSignals() {
    var sig = (global.ST && global.ST.sig) || [];
    var ranked = sig.map(function (g) {
      var gr = gradeSetup(g);
      return { g: g, gr: gr };
    }).sort(function (a, b) {
      if (a.gr.pass !== b.gr.pass) return a.gr.pass ? -1 : 1;
      return b.gr.score - a.gr.score;
    });
    return ranked;
  }

  function queuePush(ticket, meta) {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(LS_Q) || '[]'); } catch (e) {}
    arr.unshift({
      t: Date.now(),
      ticket: ticket,
      sym: meta.sym,
      side: meta.side,
      grade: meta.grade,
      score: meta.score
    });
    arr = arr.slice(0, 20);
    try { localStorage.setItem(LS_Q, JSON.stringify(arr)); } catch (e) {}
    // clipboard assist
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ticket);
      }
    } catch (e2) {}
  }

  function buildTicket(g) {
    if (global.BTX_PRO6 && global.BTX_PRO6.buildXtbTicket) return global.BTX_PRO6.buildXtbTicket(g);
    return (g.side || '') + ' ' + (g.sym || '') + ' @ ' + (g.price || '') + ' | ręcznie na XTB';
  }

  function tryOpen(g, gr) {
    if (!g || !gr || !gr.pass) return false;
    // włącz tryb trade w learnerze na czas autonomii
    try { localStorage.setItem('BTX_TRADE_MODE', 'trade'); } catch (e) {}

    if (typeof global.openPos !== 'function') return false;
    try {
      // openPos może być patchowany — wywołaj
      global.openPos(g);
      // sprawdź czy pozycja wstała
      if (global.ST && global.ST.pos && global.ST.pos[g.sym]) {
        var ticket = buildTicket(g);
        queuePush(ticket, gr);
        lastAction = 'OPEN ' + gr.grade + ' ' + g.side + ' ' + g.sym + ' (score ' + gr.score + ')';
        if (global.log) global.log(lastAction, 'g');
        if (global.toast) global.toast(lastAction + ' · plan XTB w schowku', 'ok');
        return true;
      }
    } catch (e) {
      if (global.log) global.log('auto open fail: ' + e.message, 'r');
    }
    return false;
  }

  function manageExits() {
    // strategy-pro już robi partial/BE w cycle; tu dodatkowy twardy time/risk guard
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    var minHold = (global.CFG && global.CFG.minHold) || 4;
    var timeStop = (global.CFG && global.CFG.timeStop) || 60;
    Object.keys(ST.pos).forEach(function (sym) {
      var p = ST.pos[sym];
      if (!p) return;
      var b = ST.series && ST.series[sym] && ST.series[sym].length ? ST.series[sym][ST.series[sym].length - 1] : null;
      if (!b) return;
      // hard SL / TP if missing engine
      if (p.stop != null) {
        if (p.side === 'LONG' && b.l <= p.stop && typeof global.closePos === 'function') {
          global.closePos(sym, 'AUTO SL', p.stop);
          lastAction = 'CLOSE SL ' + sym;
        }
        if (p.side === 'SHORT' && b.h >= p.stop && typeof global.closePos === 'function') {
          global.closePos(sym, 'AUTO SL', p.stop);
          lastAction = 'CLOSE SL ' + sym;
        }
      }
      if (p.tp != null) {
        if (p.side === 'LONG' && b.h >= p.tp && typeof global.closePos === 'function') {
          global.closePos(sym, 'AUTO TP', p.tp);
          lastAction = 'CLOSE TP ' + sym;
        }
        if (p.side === 'SHORT' && b.l <= p.tp && typeof global.closePos === 'function') {
          global.closePos(sym, 'AUTO TP', p.tp);
          lastAction = 'CLOSE TP ' + sym;
        }
      }
      if ((p.bars || 0) >= timeStop && (p.bars || 0) >= minHold && typeof global.closePos === 'function') {
        global.closePos(sym, 'AUTO time-stop', b.c);
        lastAction = 'CLOSE time ' + sym;
      }
    });
  }

  function enrichSignals() {
    var ranked = rankSignals();
    // zapisz status na sygnałach
    ranked.forEach(function (x) {
      if (!x.g) return;
      x.g.desk = {
        score: x.gr.score,
        grade: x.gr.grade,
        pass: x.gr.pass,
        reasons: x.gr.reasons.slice()
      };
      if (!x.gr.pass && (x.g.side === 'LONG' || x.g.side === 'SHORT')) {
        // nie kasuj side całkowicie jeśli to tylko ranking — oznacz
        x.g.why = (x.g.why || '') + ' | Desk ' + x.gr.grade + ' (' + x.gr.score + '): ' + x.gr.reasons.join('; ');
      } else if (x.gr.pass) {
        x.g.why = (x.g.why || '') + ' | Desk ' + x.gr.grade + ' score ' + x.gr.score;
      }
    });
    return ranked;
  }

  async function autonomousTick() {
    if (!on()) return;
    lastScan = Date.now();

    // 1 cycle market
    if (typeof global.cycle === 'function') {
      try { global.cycle(); } catch (e) {}
    }
    // 2 optional live refresh best symbols (throttle)
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate && global.BTX_PRO6.dataGate().ok && typeof global.fetchReal === 'function') {
      // nie spamuj free API — max 1 symbol co tick rotacyjnie
      try {
        var syms = (global.SYMBOLS || []).map(function (m) { return m.s; });
        if (syms.length) {
          var idx = Math.floor(Date.now() / 60000) % syms.length;
          await global.fetchReal(syms[idx]);
        }
      } catch (e2) {}
    }

    manageExits();
    var ranked = enrichSignals();

    // 3 open at most one new A/A+ per tick
    var opened = false;
    for (var i = 0; i < ranked.length; i++) {
      if (opened) break;
      if (ranked[i].gr.pass) {
        opened = tryOpen(ranked[i].g, ranked[i].gr);
      }
    }
    if (!opened && !lastAction) lastAction = 'skan: brak A/A+';

    if (typeof global.render === 'function') {
      try { global.render(); } catch (e3) {}
    }
    renderPanel();
  }

  function startLoop() {
    stopLoop();
    if (!on()) return;
    var sec = (global.CFG && global.CFG.autoSec) || 180;
    sec = Math.max(60, Math.min(600, sec));
    // pierwszy tick zaraz
    autonomousTick();
    timer = setInterval(autonomousTick, sec * 1000);
  }
  function stopLoop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function queueList() {
    try { return JSON.parse(localStorage.getItem(LS_Q) || '[]'); } catch (e) { return []; }
  }

  function ensurePanel() {
    injectCss();
    var el = document.getElementById('btx-auto-panel');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-auto-panel';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function renderPanel() {
    var el = ensurePanel();
    if (!el) return;
    var ranked = enrichSignals().slice(0, 8);
    var q = queueList().slice(0, 5);
    var html = '';
    html += '<h3>Autonomia paper + Signal Desk</h3>';
    html += '<p class="why"><b>Po co:</b> bot sam skanuje i handluje <u>paper</u> tylko setupy A/A+ w limitach PRO. '
      + 'Na XTB nadal składasz zlecenie ręcznie — przy każdym wejściu plan ląduje w schowku i kolejce.</p>';
    html += '<div class="row">';
    html += '<span class="pill ' + (on() ? 'on' : 'off') + '">' + (on() ? 'AUTONOMIA PAPER WŁĄCZONA' : 'AUTONOMIA WYŁĄCZONA') + '</span>';
    html += '<button type="button" class="btn" id="btx-auto-on">Włącz autonomię</button>';
    html += '<button type="button" class="btn ghost" id="btx-auto-off">Wyłącz</button>';
    html += '<button type="button" class="btn ghost" id="btx-auto-tick">Skan teraz</button>';
    html += '</div>';
    html += '<div class="why" style="margin-top:8px">Ostatnia akcja: <b>' + (lastAction || '—') + '</b>';
    if (lastScan) html += ' · skan: ' + new Date(lastScan).toLocaleTimeString('pl-PL');
    html += '</div>';

    html += '<div class="why"><b>Signal Desk</b> — ocena setupów (pass od score ≥ 70 i siła ≥ 4, zero blokad):</div>';
    html += '<table><thead><tr><th>Symbol</th><th>Side</th><th>Siła</th><th>Score</th><th>Grade</th><th>Decyzja</th></tr></thead><tbody>';
    if (!ranked.length) html += '<tr><td colspan="6">Brak sygnałów — uruchom cykl / autonomię</td></tr>';
    ranked.forEach(function (x) {
      var g = x.g || {}, gr = x.gr || {};
      html += '<tr>';
      html += '<td>' + (g.sym || '') + '</td><td>' + (g.side || '') + '</td><td>' + (g.strength || 0) + '</td>';
      html += '<td>' + (gr.score || 0) + '</td><td>' + (gr.grade || '') + '</td>';
      html += '<td class="' + (gr.pass ? 'ok' : 'rej') + '">' + (gr.pass ? 'WEJŚCIE OK' : ('ODRZUT: ' + (gr.reasons || []).join('; '))) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';

    html += '<div class="why" style="margin-top:10px"><b>Kolejka planów XTB</b> (ostatnie automatyczne wejścia paper):</div>';
    if (!q.length) html += '<div class="why">Pusta — pojawi się po AUTO OPEN.</div>';
    else {
      html += '<table><thead><tr><th>Czas</th><th>Grade</th><th>Setup</th><th></th></tr></thead><tbody>';
      q.forEach(function (item, idx) {
        html += '<tr><td>' + new Date(item.t).toLocaleTimeString('pl-PL') + '</td><td>' + item.grade + '</td><td>' +
          item.side + ' ' + item.sym + ' (' + item.score + ')</td><td><button type="button" class="btn ghost" data-q="' + idx + '">Kopiuj</button></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div class="why" style="margin-top:8px">Autonomia <b>nie loguje się do XTB</b>. 9/10 tutaj = paper + twardy desk + asysta zlecenia. Pełne 10/10 broker-auto = oficjalne API XTB.</div>';

    el.innerHTML = html;
    var bOn = document.getElementById('btx-auto-on');
    if (bOn) bOn.onclick = function () {
      setOn(true);
      try { localStorage.setItem('BTX_TRADE_MODE', 'trade'); } catch (e) {}
      startLoop();
      if (global.toast) global.toast('Autonomia paper ON', 'ok');
      renderPanel();
    };
    var bOff = document.getElementById('btx-auto-off');
    if (bOff) bOff.onclick = function () {
      setOn(false);
      stopLoop();
      if (global.toast) global.toast('Autonomia OFF', 'info');
      renderPanel();
    };
    var bTick = document.getElementById('btx-auto-tick');
    if (bTick) bTick.onclick = function () { autonomousTick(); };
    el.querySelectorAll('[data-q]').forEach(function (btn) {
      btn.onclick = function () {
        var arr = queueList();
        var it = arr[+btn.getAttribute('data-q')];
        if (!it) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(it.ticket).then(function () {
            if (global.toast) global.toast('Plan XTB skopiowany', 'ok');
          });
        }
      };
    });
  }

  function patchRender() {
    if (typeof global.render === 'function' && !global.render.__autoPro) {
      var orig = global.render;
      global.render = function () {
        var r = orig.apply(this, arguments);
        try { enrichSignals(); renderPanel(); } catch (e) {}
        return r;
      };
      global.render.__autoPro = true;
    }
  }

  function boot() {
    injectCss();
    patchRender();
    renderPanel();
    if (on()) startLoop();
    setInterval(function () {
      patchRender();
      if (on() && !timer) startLoop();
      renderPanel();
    }, 5000);
  }

  global.BTX_AUTONOMY = {
    gradeSetup: gradeSetup,
    rankSignals: rankSignals,
    start: function () { setOn(true); startLoop(); },
    stop: function () { setOn(false); stopLoop(); },
    tick: autonomousTick,
    isOn: on
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
