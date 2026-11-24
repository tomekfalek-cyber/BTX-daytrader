/**
 * BTX Quality Cap — domyka lukę do 9/10
 *
 * 1. Macierz zdrowia całego systemu (widać co pada)
 * 2. Master kill switch (natychmiastowy stop)
 * 3. XTB ARM + real/demo order gdy xAPI ONLINE (świadomie)
 * 4. Mapowanie symboli BTX → XTB
 * 5. Auto-arm autonomii paper na otwarcie US
 * 6. Snapshot dnia (raport)
 */
(function (global) {
  var STYLE = 'btx-qcap-css';
  var LS_KILL = 'BTX_KILL_SWITCH';
  var LS_ARM = 'BTX_XTB_ARM'; // user must arm before any broker order
  var LS_REP = 'BTX_DAY_REPORT';
  var armedUS = false;

  var XTB_SYMBOL = {
    NVDA: 'NVDA.US',
    TSLA: 'TSLA.US',
    META: 'META.US',
    AAPL: 'AAPL.US',
    QQQ: 'US100',
    SPY: 'US500',
    EURUSD: 'EURUSD',
    'XAU/USD': 'GOLD',
    XAUUSD: 'GOLD'
  };

  function killed() {
    try { return localStorage.getItem(LS_KILL) === '1'; } catch (e) { return false; }
  }
  function setKill(v) {
    try { localStorage.setItem(LS_KILL, v ? '1' : '0'); } catch (e) {}
  }
  function xtbArmed() {
    try { return localStorage.getItem(LS_ARM) === '1'; } catch (e) { return false; }
  }
  function setArm(v) {
    try { localStorage.setItem(LS_ARM, v ? '1' : '0'); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-qcap{margin:10px 0;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25)}',
      '#btx-qcap h3{margin:0 0 8px;font-size:14px}',
      '#btx-qcap table{width:100%;border-collapse:collapse;font-size:12px}',
      '#btx-qcap td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '#btx-qcap .ok{color:#12c48b;font-weight:700}',
      '#btx-qcap .bad{color:#f87171;font-weight:700}',
      '#btx-qcap .warn{color:#f5b301;font-weight:700}',
      '#btx-qcap .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}',
      '#btx-qcap .why{font-size:12px;color:var(--tx2);line-height:1.45;margin:6px 0}'
    ].join('');
    document.head.appendChild(s);
  }

  function health() {
    var rows = [];
    function add(name, ok, detail, level) {
      rows.push({ name: name, ok: ok, detail: detail || '', level: level || (ok ? 'ok' : 'bad') });
    }

    add('CFG / risk PRO', !!(global.CFG && global.CFG.risk <= 0.75), global.CFG ? ('risk=' + global.CFG.risk + ' maxPos=' + global.CFG.maxPos) : 'brak CFG');
    add('Twelve / dane',
      !!(global.BTX_PRO6 && global.BTX_PRO6.dataGate && global.BTX_PRO6.dataGate().ok),
      global.BTX_PRO6 && global.BTX_PRO6.dataGate ? global.BTX_PRO6.dataGate().label : 'brak dataGate');
    add('Strategy PRO', !!global.BTX_PRO, global.BTX_PRO ? 'strategy-pro załadowany' : 'brak');
    add('Signal Desk', !!global.BTX_AUTONOMY, global.BTX_AUTONOMY ? 'gradeSetup OK' : 'brak autonomy-pro');
    add('Asystent operacyjny', !!global.BTX_ASSISTANT, global.BTX_ASSISTANT ? 'pro-assistant OK' : 'brak');
    add('VPVR', !!global.BTX_VPVR, global.BTX_VPVR ? 'strefy wolumenu' : 'opcjonalne', global.BTX_VPVR ? 'ok' : 'warn');
    add('Learner / STOP', !!global.BTX_LEARN, global.BTX_LEARN ? 'STOP FOR DAY aktywny' : 'brak');
    add('Kalendarz makro', !!global.BTX_MACRO, global.BTX_MACRO ? 'feed/fallback' : 'brak', global.BTX_MACRO ? 'ok' : 'warn');
    add('XTB xAPI',
      !!(global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected()),
      (global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected()) ? 'ONLINE' : 'offline — handel ręczny/plan',
      (global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected()) ? 'ok' : 'warn');
    add('Kill switch', !killed(), killed() ? 'WŁĄCZONY — zero nowych wejść' : 'wyłączony (normalna praca)', killed() ? 'bad' : 'ok');
    add('XTB ARM', xtbArmed(), xtbArmed() ? 'UZBROJONY — możliwe zlecenie API' : 'rozbrojony (bezpiecznie)', xtbArmed() ? 'warn' : 'ok');

    var score = rows.filter(function (r) { return r.level === 'ok'; }).length;
    var total = rows.length;
    return { rows: rows, score: score, total: total, pct: Math.round(100 * score / total) };
  }

  function mapSym(sym) {
    return XTB_SYMBOL[sym] || sym;
  }

  /** Bezpieczne openPos: honoruj kill */
  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__qcap) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      if (killed()) {
        if (global.toast) global.toast('KILL SWITCH — brak nowych wejść', 'err');
        return;
      }
      return orig.apply(this, arguments);
    };
    global.openPos.__qcap = true;
  }

  /** Po paper open — jeśli ARM + xAPI, spróbuj mirror na XTB */
  function patchOpenMirror() {
    if (typeof global.openPos !== 'function' || global.openPos.__qcapMirror) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      var ret = orig.apply(this, arguments);
      tryMirrorXtb(g);
      return ret;
    };
    global.openPos.__qcapMirror = true;
  }

  async function tryMirrorXtb(g) {
    if (!g || !xtbArmed() || killed()) return;
    if (!global.BTX_XTB_API || !global.BTX_XTB_API.isConnected || !global.BTX_XTB_API.isConnected()) return;
    if (!global.BTX_XTB_API.tradeMarket) return;

    // volume: bardzo ostrożnie — 0.01 lot FX / 1 stock unit szacunek z paper qty
    var vol = 0.01;
    if (global.ST && global.ST.pos && global.ST.pos[g.sym]) {
      var q = global.ST.pos[g.sym].qty || 1;
      // akcje: min 1; FX: 0.01
      if (/EUR|USD|XAU|GOLD/.test(g.sym)) vol = 0.01;
      else vol = Math.max(1, Math.min(q, 5));
    }
    var xtbSym = mapSym(g.sym);
    try {
      if (global.toast) global.toast('XTB ARM: wysyłam ' + g.side + ' ' + xtbSym + ' vol ' + vol, 'info');
      var res = await global.BTX_XTB_API.tradeMarket(xtbSym, g.side, vol);
      if (global.log) global.log('XTB order res: ' + JSON.stringify(res).slice(0, 200), 'g');
      if (global.toast) global.toast('XTB: zlecenie wysłane (' + xtbSym + ')', 'ok');
    } catch (e) {
      if (global.log) global.log('XTB order fail: ' + e.message, 'r');
      if (global.toast) global.toast('XTB order fail: ' + e.message, 'err');
    }
  }

  function maybeAutoArmUS() {
    if (!global.BTX_ASSISTANT || !global.BTX_ASSISTANT.opsStatus) return;
    var st = global.BTX_ASSISTANT.opsStatus();
    if (st.code === 'WORK' && !armedUS) {
      armedUS = true;
      // auto włącz autonomię paper na start sesji US (nie XTB ARM!)
      try {
        if (localStorage.getItem('BTX_AUTONOMY_ON') !== '1') {
          localStorage.setItem('BTX_AUTONOMY_ON', '1');
          localStorage.setItem('BTX_TRADE_MODE', 'trade');
          if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start) global.BTX_AUTONOMY.start();
          if (global.toast) global.toast('Sesja US: autonomia paper AUTO-ON', 'ok');
        }
      } catch (e) {}
    }
    if (st.hb && st.hb.ses && st.hb.ses.phase === 'AFTER_US') armedUS = false;
  }

  function dayReport() {
    var ST = global.ST || {};
    var closed = ST.closed || [];
    var wins = 0, losses = 0, sum = 0;
    closed.slice(0, 30).forEach(function (t) {
      sum += t.pnl || 0;
      if ((t.pnl || 0) > 0) wins++; else if ((t.pnl || 0) < 0) losses++;
    });
    var h = health();
    var txt = [
      'BTX raport ' + new Date().toLocaleString('pl-PL'),
      'Health: ' + h.score + '/' + h.total + ' (' + h.pct + '%)',
      'Paper trades (ostatnie): ' + wins + 'W / ' + losses + 'L · P&L ' + sum.toFixed(2),
      'Equity: ' + (ST.equity != null ? ST.equity : '—'),
      'Kill: ' + (killed() ? 'ON' : 'off') + ' · XTB ARM: ' + (xtbArmed() ? 'ON' : 'off'),
      'XTB: ' + (global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected() ? 'ONLINE' : 'offline')
    ].join('\n');
    try { localStorage.setItem(LS_REP, txt); } catch (e) {}
    return txt;
  }

  function ensure() {
    injectCss();
    var el = document.getElementById('btx-qcap');
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-qcap';
    if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function render() {
    var el = ensure();
    if (!el) return;
    maybeAutoArmUS();
    var h = health();
    var html = '<h3>Quality Cap · zdrowie systemu (' + h.pct + '%)</h3>';
    html += '<p class="why">Tu widać, czy asystent jest naprawdę gotowy do pracy — nie czy "jest ładny".</p>';
    html += '<table>';
    h.rows.forEach(function (r) {
      html += '<tr><td>' + r.name + '</td><td class="' + r.level + '">' + (r.level === 'ok' ? 'OK' : (r.level === 'warn' ? 'UWAGA' : 'SŁABE')) + '</td><td>' + r.detail + '</td></tr>';
    });
    html += '</table>';
    html += '<div class="row">';
    html += '<button type="button" class="btn" id="qcap-kill" style="background:#f04452;border-color:#f04452">' + (killed() ? 'Zdejmij KILL' : 'KILL SWITCH') + '</button>';
    html += '<button type="button" class="btn ghost" id="qcap-arm">' + (xtbArmed() ? 'Rozbrój XTB ARM' : 'Uzbrój XTB ARM') + '</button>';
    html += '<button type="button" class="btn ghost" id="qcap-rep">Raport dnia</button>';
    html += '</div>';
    html += '<p class="why"><b>XTB ARM</b> = świadoma zgoda na wysłanie zlecenia przez xAPI po sygnale paper. Domyślnie wyłączone. Włączaj tylko na DEMO, gdy test połączenia jest ONLINE.</p>';
    el.innerHTML = html;

    document.getElementById('qcap-kill').onclick = function () {
      setKill(!killed());
      if (global.toast) global.toast(killed() ? 'KILL ON' : 'KILL OFF', killed() ? 'err' : 'ok');
      render();
    };
    document.getElementById('qcap-arm').onclick = function () {
      if (!xtbArmed()) {
        var ok = confirm('Uzbroić XTB ARM?\nZlecenia mog\u0105 i\u015b\u0107 na konto DEMO/REAL przez xAPI po sygnale.\nTylko gdy Po\u0142\u0105cz/Test = ONLINE.');
        if (!ok) return;
        setArm(true);
      } else setArm(false);
      render();
    };
    document.getElementById('qcap-rep').onclick = function () {
      var t = dayReport();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t);
      alert(t);
    };
  }

  function boot() {
    injectCss();
    patchOpen();
    patchOpenMirror();
    render();
    setInterval(function () {
      patchOpen();
      patchOpenMirror();
      render();
    }, 4000);
  }

  global.BTX_QCAP = { health: health, killed: killed, mapSym: mapSym, dayReport: dayReport };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
