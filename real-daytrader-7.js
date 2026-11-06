/**
 * 7 punktów pod realny daytrading XTB
 * 1 LIVE bez nextBar  2 FX weekend OFF  3 SL/TP od 1. świecy
 * 4 BE + koszty  5 Telegram  6 Worker keys  7 CSV sygnałów+transakcji
 */
(function (global) {
  var LS_CFG = 'BTX_REAL7_CFG';
  var LS_SIG = 'BTX_SIGNAL_LOG_V1';
  var LS_TR = 'BTX_TRADE_LOG_V1';
  var ROOT = 'btx-real7-settings';

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}'); } catch (e) { return {}; }
  }
  function saveCfg(c) {
    try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {}
    global.BTX_REAL7_CFG = c;
  }
  function cfg() {
    return global.BTX_REAL7_CFG || loadCfg();
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

  function isLive(sym) {
    if (global.BTX_HARDENING && global.BTX_HARDENING.isLive) return global.BTX_HARDENING.isLive(sym);
    if (global.BTX_LIVE_GATE && global.BTX_LIVE_GATE.isSymLive) return global.BTX_LIVE_GATE.isSymLive(sym);
    var ST = global.ST;
    if (ST && ST.liveSource && ST.liveSource[sym] && Date.now() - ST.liveSource[sym] < 25 * 60 * 1000) return true;
    return false;
  }
  function anyLive() {
    var ST = global.ST;
    if (!ST || !ST.liveSource) return false;
    var t = Date.now();
    return Object.keys(ST.liveSource).some(function (k) { return t - ST.liveSource[k] < 25 * 60 * 1000; });
  }

  // ========== 1) Zero nextBar przy LIVE ==========
  function patchNoSynthWhenLive() {
    if (typeof global.nextBar !== 'function' || global.nextBar.__r7) return;
    var orig = global.nextBar;
    global.nextBar = function (m, last) {
      var sym = m && (m.s || m.sym);
      if (sym && isLive(sym)) return last; // nie doklejaj losowej świecy
      if (anyLive() && sym && global.ST && global.ST.series && global.ST.series[sym] && global.ST.series[sym].length > 20) {
        // przy globalnym LIVE też nie fałszuj serii instrumentu, który ma historię
        if (isLive(sym)) return last;
      }
      return orig.apply(this, arguments);
    };
    global.nextBar.__r7 = true;

    // cycle: nie pushuj nextBar gdy LIVE
    if (typeof global.cycle === 'function' && !global.cycle.__r7live) {
      var oc = global.cycle;
      global.cycle = function () {
        // twardy patch serii przed orig
        try {
          var ST = global.ST;
          if (ST && ST.series) {
            (global.SYMBOLS || []).forEach(function (m) {
              if (isLive(m.s) && ST.series[m.s]) {
                // oznacz — hardening też pilnuje
                ST._noSynth = ST._noSynth || {};
                ST._noSynth[m.s] = true;
              }
            });
          }
        } catch (e) {}
        return oc.apply(this, arguments);
      };
      global.cycle.__r7live = true;
    }
  }

  // ========== 2) FX weekend OFF ==========
  function patchWeekendFx() {
    if (typeof global.sessionOpen === 'function' && !global.sessionOpen.__r7) {
      var prev = global.sessionOpen;
      global.sessionOpen = function (mkt) {
        var w = warsaw();
        if (w.weekend) return false; // FX też OFF
        return prev.apply(this, arguments);
      };
      global.sessionOpen.__r7 = true;
    }
    // pro-assistant czasem wymusza fxOk=true w weekend — zdejmij
    if (global.BTX_ASSIST && global.BTX_ASSIST.state) {
      try {
        var w = warsaw();
        if (w.weekend) global.BTX_ASSIST.state.fxOk = false;
      } catch (e) {}
    }
  }

  // ========== 3) SL + TP od pierwszej świecy ==========
  function patchTpFromBar1() {
    if (typeof global.cycle !== 'function' || global.cycle.__r7tp) return;
    // post-process: po każdym cycle upewnij się że TP/SL działają nawet przy bars=0..minHold
    var prev = global.cycle;
    global.cycle = function () {
      var r = prev.apply(this, arguments);
      try {
        var ST = global.ST;
        if (!ST || !ST.pos) return r;
        Object.keys(ST.pos).forEach(function (sym) {
          var p = ST.pos[sym];
          var b = typeof global.last === 'function' ? global.last(sym) : null;
          if (!p || !b) return;
          var stp = p.stop, tgt = p.target;
          if (stp == null || tgt == null) return;
          if (p.side === 'LONG') {
            if (b.l <= stp) global.closePos(sym, p.be ? 'BE-stop' : 'stop', Math.min(stp, b.o));
            else if (b.h >= tgt) global.closePos(sym, 'target', Math.max(tgt, b.o));
          } else if (p.side === 'SHORT') {
            if (b.h >= stp) global.closePos(sym, p.be ? 'BE-stop' : 'stop', Math.max(stp, b.o));
            else if (b.l <= tgt) global.closePos(sym, 'target', Math.min(tgt, b.o));
          }
        });
      } catch (e) {}
      return r;
    };
    global.cycle.__r7tp = true;
  }

  // ========== 4) BE z zapasem na koszty ==========
  function costBufferPrice(entry, qty) {
    var CFG = global.CFG || {};
    var notional = Math.abs(entry * (qty || 1));
    var spread = Number(CFG.spreadPct != null ? CFG.spreadPct : 0.03) / 100;
    var slip = Number(CFG.slip != null ? CFG.slip : 0.03) / 100;
    var fx = Number(CFG.fxPct != null ? CFG.fxPct : 0.5) / 100 * 0.25;
    var pct = spread + slip + fx + 0.0005; // mały zapas
    return entry * pct; // dystans ceny
  }

  function patchBE() {
    if (typeof global.cycle !== 'function' || global.cycle.__r7be) return;
    var prev = global.cycle;
    global.cycle = function () {
      var r = prev.apply(this, arguments);
      try {
        var ST = global.ST;
        if (!ST || !ST.pos) return r;
        Object.keys(ST.pos).forEach(function (sym) {
          var p = ST.pos[sym];
          if (!p || p.be) return;
          var b = typeof global.last === 'function' ? global.last(sym) : null;
          if (!b) return;
          var risk0 = p.risk0 || Math.abs(p.entry - p.stop) || p.entry * 0.004;
          var buf = costBufferPrice(p.entry, p.qty);
          var mv = p.side === 'LONG' ? (b.c - p.entry) : (p.entry - b.c);
          // BE dopiero gdy ruch >= 1R i jest zapas na koszty
          if (mv >= risk0 + buf) {
            if (p.side === 'LONG') p.stop = p.entry + buf;
            else p.stop = p.entry - buf;
            p.be = true;
            if (global.log) global.log('BE+koszty: ' + sym + ' stop=' + p.stop.toFixed(4), 'g');
          }
        });
      } catch (e) {}
      return r;
    };
    global.cycle.__r7be = true;

    // nie licz BE/fee-only jako strata do serii
    if (typeof global.closePos === 'function' && !global.closePos.__r7be) {
      var oc = global.closePos;
      global.closePos = function (sym, why, px) {
        var ST = global.ST;
        var p = ST && ST.pos && ST.pos[sym];
        var wasBe = p && p.be;
        var before = ST ? ST.consecLoss : 0;
        var ret = oc.apply(this, arguments);
        try {
          if (wasBe || /BE/i.test(String(why || ''))) {
            if (ST) ST.consecLoss = before;
          }
        } catch (e) {}
        return ret;
      };
      global.closePos.__r7be = true;
    }
  }

  // ========== 7) Log sygnałów i transakcji ==========
  function pushLog(key, row) {
    try {
      var arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift(row);
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 5000)));
    } catch (e) {}
  }

  function logSignal(g, meta) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return;
    pushLog(LS_SIG, {
      ts: new Date().toISOString(),
      sym: g.sym,
      side: g.side,
      strength: g.strength,
      price: g.price,
      atr: g.atr,
      why: g.why || '',
      score: meta && meta.score,
      grade: meta && meta.grade
    });
  }

  function patchSignalLog() {
    if (typeof global.signals !== 'function' || global.signals.__r7) return;
    var orig = global.signals;
    global.signals = function () {
      var out = orig.apply(this, arguments) || [];
      out.forEach(function (g) {
        if (g && (g.side === 'LONG' || g.side === 'SHORT')) {
          var meta = {};
          try {
            if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.gradeSetup) {
              var gr = global.BTX_AUTONOMY.gradeSetup(g);
              meta.score = gr.score; meta.grade = gr.grade;
            }
          } catch (e) {}
          // dedupe: ten sam sym+side w ciągu 3 min nie loguj 100×
          var k = g.sym + '|' + g.side;
          global.__r7sigTs = global.__r7sigTs || {};
          if (!global.__r7sigTs[k] || Date.now() - global.__r7sigTs[k] > 180000) {
            global.__r7sigTs[k] = Date.now();
            logSignal(g, meta);
            // Telegram przy PASS
            if (meta.grade === 'A' || meta.grade === 'A+' || (g.strength || 0) >= 3) {
              notifyTelegram(g, meta);
            }
          }
        }
      });
      return out;
    };
    global.signals.__r7 = true;
  }

  function patchTradeLog() {
    if (typeof global.closePos !== 'function' || global.closePos.__r7log) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      var snap = p ? { sym: sym, side: p.side, qty: p.qty, entry: p.entry, why: p.why, bars: p.bars } : null;
      var ret = orig.apply(this, arguments);
      if (snap) {
        var pnl = snap.side === 'LONG' ? (px - snap.entry) * snap.qty : (snap.entry - px) * snap.qty;
        pushLog(LS_TR, {
          ts: new Date().toISOString(),
          sym: snap.sym,
          side: snap.side,
          qty: snap.qty,
          entry: snap.entry,
          exit: px,
          pnl: Math.round(pnl * 100) / 100,
          whyOut: why || '',
          whyIn: snap.why || '',
          bars: snap.bars || 0
        });
      }
      return ret;
    };
    global.closePos.__r7log = true;
  }

  function exportCsv(key, filename) {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    if (!arr.length) { alert('Brak danych do eksportu'); return; }
    var cols = Object.keys(arr[0]);
    var lines = [cols.join(',')].concat(arr.map(function (r) {
      return cols.map(function (c) {
        var v = r[c];
        if (v == null) return '';
        return JSON.stringify(String(v));
      }).join(',');
    }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  // ========== 5) Telegram ==========
  function notifyTelegram(g, meta) {
    var c = cfg();
    if (!c.tgToken || !c.tgChat) return;
    var ST = global.ST || {};
    var equity = ST.equity != null ? ST.equity : ((global.CFG && global.CFG.capital) || 500);
    var atr = g.atr || (g.price * 0.004);
    var sd = atr * 1.2;
    var riskPct = (global.CFG && global.CFG.risk) || 0.5;
    var qty = Math.max(1, Math.floor(equity * (riskPct / 100) / sd));
    var sl = g.side === 'LONG' ? g.price - sd : g.price + sd;
    var tp = g.side === 'LONG' ? g.price + 1.6 * sd : g.price - 1.6 * sd;
    var xtb = g.sym;
    try {
      if (global.BTX_QCAP && global.BTX_QCAP.mapSym) xtb = global.BTX_QCAP.mapSym(g.sym);
    } catch (e) {}
    var text = [
      'BTX SYGNAŁ ' + (meta && meta.grade ? meta.grade : '') +
      '\n' + g.side + ' ' + xtb + ' (' + g.sym + ')' +
      '\nWejście ≈ ' + Number(g.price).toFixed(4) +
      '\nSize ≈ ' + qty +
      '\nSL ' + sl.toFixed(4) + ' | TP ' + tp.toFixed(4) +
      '\nSiła ' + (g.strength || 0) + (meta && meta.score != null ? ' | score ' + meta.score : '') +
      '\n' + String(g.why || '').slice(0, 180) +
      '\n→ xStation: ręcznie KUP/SPRZEDAJ z SL/TP'
    ].join('');
    // Telegram Bot API (z przeglądarki — CORS może blokować; wtedy Worker)
    var url = 'https://api.telegram.org/bot' + c.tgToken + '/sendMessage';
    var body = JSON.stringify({ chat_id: c.tgChat, text: text, disable_web_page_preview: true });
    if (c.workerUrl) {
      fetch(c.workerUrl.replace(/\/$/, '') + '/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: c.tgToken, chat_id: c.tgChat, text: text })
      }).catch(function () {
        // fallback bezpośredni
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).catch(function () {});
      });
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }).catch(function () {});
    }
    // Browser Notification
    try {
      if (global.Notification && Notification.permission === 'granted') {
        new Notification('BTX ' + g.side + ' ' + g.sym, { body: text.slice(0, 120) });
      }
    } catch (e2) {}
  }

  // ========== 6) Worker jako proxy kluczy ==========
  function patchFetchViaWorker() {
    var c = cfg();
    if (!c.workerUrl) return;
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__r7w) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      try {
        var base = c.workerUrl.replace(/\/$/, '');
        var q = encodeURIComponent(sym);
        var r = await fetch(base + '/bars?symbol=' + q);
        if (r.ok) {
          var data = await r.json();
          if (data && data.bars && global.ST) {
            global.ST.series = global.ST.series || {};
            global.ST.series[sym] = data.bars;
            global.ST.liveSource = global.ST.liveSource || {};
            global.ST.liveSource[sym] = Date.now();
            return data.bars;
          }
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    global.fetchReal.__r7w = true;
  }

  // ========== Settings UI (Telegram + Worker) ==========
  function ensureSettings() {
    var pane = document.getElementById('pane-set') || document.getElementById('pane-settings');
    if (!pane) return;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:14px 0;padding:16px 18px;border-radius:14px;border:1px solid rgba(59,130,246,.4);background:rgba(30,58,138,.12)';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var c = cfg();
    el.innerHTML =
      '<h3 style="margin:0 0 8px;font-size:14px;color:#dbeafe">Powiadomienia i Worker (real daytrader)</h3>' +
      '<p style="margin:0 0 10px;font-size:12px;color:var(--tx2,#94a3b8);line-height:1.45">Telegram: token bota + chat ID. Worker (opcjonalnie): URL Cloudflare Workera — klucze API trzymaj po stronie Workera, nie tylko w przeglądarce.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;max-width:480px">' +
      '<label style="font-size:12px">Telegram bot token<br><input id="btx-tg-token" type="password" style="width:100%;padding:8px;border-radius:8px;border:1px solid #333;background:#0a0d12;color:#fff" value="' + (c.tgToken || '').replace(/"/g, '') + '"/></label>' +
      '<label style="font-size:12px">Telegram chat ID<br><input id="btx-tg-chat" style="width:100%;padding:8px;border-radius:8px;border:1px solid #333;background:#0a0d12;color:#fff" value="' + (c.tgChat || '').replace(/"/g, '') + '"/></label>' +
      '<label style="font-size:12px">Worker URL (https://…workers.dev)<br><input id="btx-worker-url" style="width:100%;padding:8px;border-radius:8px;border:1px solid #333;background:#0a0d12;color:#fff" value="' + (c.workerUrl || '').replace(/"/g, '') + '" placeholder="https://btx-proxy.xxx.workers.dev"/></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">' +
      '<button type="button" id="btx-r7-save" style="cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700">Zapisz</button>' +
      '<button type="button" id="btx-r7-tgtest" style="cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700">Test Telegram</button>' +
      '<button type="button" id="btx-r7-notify" style="cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#334155;color:#fff;font-weight:700">Włącz push przeglądarki</button>' +
      '<button type="button" id="btx-r7-exps" style="cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#7c3aed;color:#fff;font-weight:700">CSV sygnały</button>' +
      '<button type="button" id="btx-r7-expt" style="cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#7c3aed;color:#fff;font-weight:700">CSV transakcje</button>' +
      '</div>' +
      '<div id="btx-r7-msg" style="margin-top:8px;font-size:12px;color:#93c5fd"></div></div>';

    document.getElementById('btx-r7-save').onclick = function () {
      var n = {
        tgToken: (document.getElementById('btx-tg-token').value || '').trim(),
        tgChat: (document.getElementById('btx-tg-chat').value || '').trim(),
        workerUrl: (document.getElementById('btx-worker-url').value || '').trim()
      };
      saveCfg(n);
      patchFetchViaWorker();
      document.getElementById('btx-r7-msg').textContent = 'Zapisano ustawienia Telegram / Worker.';
      if (global.toast) global.toast('Zapisano Telegram/Worker', 'ok');
    };
    document.getElementById('btx-r7-tgtest').onclick = function () {
      var n = {
        tgToken: (document.getElementById('btx-tg-token').value || '').trim(),
        tgChat: (document.getElementById('btx-tg-chat').value || '').trim(),
        workerUrl: (document.getElementById('btx-worker-url').value || '').trim()
      };
      saveCfg(n);
      notifyTelegram(
        { sym: 'TEST', side: 'LONG', price: 100, strength: 4, atr: 0.5, why: 'Test powiadomienia BTX' },
        { grade: 'A', score: 70 }
      );
      document.getElementById('btx-r7-msg').textContent = 'Wysłano test (sprawdź Telegram). Przy blokadzie CORS użyj Workera.';
    };
    document.getElementById('btx-r7-notify').onclick = function () {
      if (!global.Notification) { alert('Brak Notification API'); return; }
      Notification.requestPermission();
    };
    document.getElementById('btx-r7-exps').onclick = function () { exportCsv(LS_SIG, 'btx-signals.csv'); };
    document.getElementById('btx-r7-expt').onclick = function () { exportCsv(LS_TR, 'btx-trades.csv'); };
  }

  function boot() {
    global.BTX_REAL7_CFG = loadCfg();
    patchNoSynthWhenLive();
    patchWeekendFx();
    patchTpFromBar1();
    patchBE();
    patchSignalLog();
    patchTradeLog();
    patchFetchViaWorker();
    ensureSettings();

    document.querySelectorAll('button[data-tab], .nav button').forEach(function (btn) {
      if (btn.__r7) return;
      btn.__r7 = true;
      btn.addEventListener('click', function () { setTimeout(ensureSettings, 100); });
    });

    setInterval(function () {
      patchNoSynthWhenLive();
      patchWeekendFx();
      patchTpFromBar1();
      patchBE();
      patchSignalLog();
      patchTradeLog();
      patchFetchViaWorker();
    }, 8000);
  }

  global.BTX_REAL7 = {
    notifyTelegram: notifyTelegram,
    exportSignals: function () { exportCsv(LS_SIG, 'btx-signals.csv'); },
    exportTrades: function () { exportCsv(LS_TR, 'btx-trades.csv'); },
    cfg: cfg
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
