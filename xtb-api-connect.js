/**
 * BTX ↔ XTB xAPI (WebSocket)
 * XTB NIE wydaje osobnego "API key" jak Twelve.
 * Logowanie: Account ID (userId) + hasło xStation, demo/real.
 *
 * Endpointy oficjalne:
 *   wss://ws.xtb.com/demo  |  wss://ws.xtb.com/real
 *   stream: wss://ws.xtb.com/demoStream | realStream
 */
(function (global) {
  var LS = 'BTX_XTB_XAPI_V1';
  var STYLE = 'btx-xtb-api-css';
  var state = {
    ws: null,
    stream: null,
    connected: false,
    streamSessionId: null,
    lastError: '',
    lastInfo: '',
    balance: null
  };

  function loadCfg() {
    try {
      return JSON.parse(localStorage.getItem(LS) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveCfg(c) {
    try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {}
    if (global.CFG) {
      global.CFG.xtbUserId = c.userId || '';
      global.CFG.xtbMode = c.mode || 'demo';
      // hasła nie trzymaj w CFG globalnym do logów
    }
  }

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-xtb-api{margin:14px 0;padding:16px;border-radius:14px;',
      'border:1px solid rgba(228,0,43,.4);background:rgba(228,0,43,.06)}',
      '#btx-xtb-api h3{margin:0 0 6px;font-size:14px}',
      '#btx-xtb-api .why{font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 12px}',
      '#btx-xtb-api label{display:block;font-size:11px;color:var(--tx3);margin:8px 0 4px}',
      '#btx-xtb-api input,#btx-xtb-api select{width:100%;max-width:360px;padding:8px 10px;',
      'border-radius:8px;border:1px solid var(--line);background:var(--bg4,#202733);color:#fff}',
      '#btx-xtb-api .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}',
      '#btx-xtb-api .pill{display:inline-flex;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700}',
      '#btx-xtb-api .pill.ok{background:rgba(18,196,139,.2);color:#12c48b}',
      '#btx-xtb-api .pill.bad{background:rgba(240,68,82,.18);color:#f87171}',
      '#btx-xtb-api .pill.warn{background:rgba(245,179,1,.15);color:#f5b301}',
      '#btx-xtb-api .status{font-size:12.5px;margin-top:10px;line-height:1.45}'
    ].join('');
    document.head.appendChild(s);
  }

  function wsUrl(mode, stream) {
    mode = mode === 'real' ? 'real' : 'demo';
    return stream ? ('wss://ws.xtb.com/' + mode + 'Stream') : ('wss://ws.xtb.com/' + mode);
  }

  function send(ws, cmd, args, tag) {
    return new Promise(function (resolve, reject) {
      if (!ws || ws.readyState !== 1) return reject(new Error('WebSocket niepołączony'));
      var id = tag || ('btx_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8));
      var payload = { command: cmd, arguments: args || {}, customTag: id };
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('Timeout komendy: ' + cmd));
      }, 15000);
      function onMsg(ev) {
        try {
          var j = JSON.parse(ev.data);
          if (j.customTag && j.customTag !== id) return;
          // niektóre odpowiedzi bez taga tuż po login
          if (!j.customTag && cmd !== 'login') return;
          done = true;
          cleanup();
          if (j.status === false) {
            reject(new Error((j.errorCode || '') + ' ' + (j.errorDescr || 'Błąd XTB')));
          } else resolve(j);
        } catch (e) {
          /* ignore parse of unrelated */
        }
      }
      function cleanup() {
        clearTimeout(t);
        ws.removeEventListener('message', onMsg);
      }
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify(payload));
    });
  }

  function disconnect() {
    try { if (state.ws) state.ws.close(); } catch (e) {}
    try { if (state.stream) state.stream.close(); } catch (e2) {}
    state.ws = null;
    state.stream = null;
    state.connected = false;
    state.streamSessionId = null;
    state.lastInfo = 'Rozłączono';
    render();
  }

  async function connect(userId, password, mode) {
    disconnect();
    state.lastError = '';
    state.lastInfo = 'Łączenie z wss://ws.xtb.com/' + (mode === 'real' ? 'real' : 'demo') + ' …';
    render();

    userId = String(userId || '').trim();
    password = String(password || '');
    mode = mode === 'real' ? 'real' : 'demo';
    if (!userId || !password) throw new Error('Podaj Account ID i hasło xStation');

    var url = wsUrl(mode, false);
    var ws = new WebSocket(url);
    state.ws = ws;

    await new Promise(function (resolve, reject) {
      var to = setTimeout(function () {
        reject(new Error('Timeout TCP/WebSocket do XTB (sieć / blokada / API niedostępne w przeglądarce)'));
      }, 12000);
      ws.onopen = function () { clearTimeout(to); resolve(); };
      ws.onerror = function () {
        clearTimeout(to);
        reject(new Error('WebSocket error — przeglądarka może blokować połączenie lub host niedostępny'));
      };
      ws.onclose = function () {
        state.connected = false;
      };
    });

    // login
    var loginRes = await send(ws, 'login', { userId: userId, password: password }, 'btx_login');
    state.streamSessionId = (loginRes.streamSessionId) || (loginRes.returnData && loginRes.returnData.streamSessionId) || null;
    // niektóre implementacje zwracają streamSessionId w returnData
    if (!state.streamSessionId && loginRes.returnData && typeof loginRes.returnData === 'object') {
      state.streamSessionId = loginRes.returnData.streamSessionId || null;
    }
    state.connected = true;
    state.lastInfo = 'Zalogowano do XTB (' + mode + ')' + (state.streamSessionId ? ' · sesja OK' : '');

    // ping + balance
    try {
      await send(ws, 'ping', {}, 'btx_ping');
    } catch (e) { /* optional */ }

    try {
      var bal = await send(ws, 'getMarginLevel', {}, 'btx_bal');
      state.balance = bal.returnData || bal;
      if (state.balance && state.balance.balance != null) {
        state.lastInfo += ' · balance: ' + state.balance.balance + ' ' + (state.balance.currency || '');
      }
    } catch (e2) {
      state.lastInfo += ' · (balance: brak uprawnień / inna odpowiedź)';
    }

    // keep alive
    if (ws.__btxPing) clearInterval(ws.__btxPing);
    ws.__btxPing = setInterval(function () {
      if (ws.readyState === 1) {
        try { ws.send(JSON.stringify({ command: 'ping', arguments: {}, customTag: 'ka_' + Date.now() })); } catch (e) {}
      }
    }, 25000);

    ws.addEventListener('close', function () {
      state.connected = false;
      state.lastError = 'Połączenie zamknięte przez serwer/sieć';
      render();
    });

    return loginRes;
  }

  /** Market order helper — tylko gdy user świadomie włączy real trade */
  async function tradeMarket(symbol, side, volume) {
    if (!state.connected || !state.ws) throw new Error('Najpierw połącz XTB');
    var cmd = 0; // BUY
    if (side === 'SHORT' || side === 'SELL') cmd = 1;
    var trade = {
      cmd: cmd,
      symbol: symbol,
      volume: volume,
      type: 0, // OPEN
      price: 0,
      sl: 0,
      tp: 0
    };
    return send(state.ws, 'tradeTransaction', { tradeTransInfo: trade }, 'btx_tr_' + Date.now());
  }

  function ensurePanel() {
    injectCss();
    var el = document.getElementById('btx-xtb-api');
    if (el) return el;
    var pane = document.getElementById('pane-cfg');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = 'btx-xtb-api';
    // na górze ustawień, pod kluczem Twelve jeśli jest
    var twelve = document.getElementById('btx-key-panel');
    if (twelve && twelve.parentNode === pane) twelve.after(el);
    else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function render() {
    var el = ensurePanel();
    if (!el) return;
    var cfg = loadCfg();
    var html = '';
    html += '<h3>Połączenie XTB (xAPI)</h3>';
    html += '<p class="why"><b>Ważne:</b> XTB <u>nie daje osobnego klucza API</u> jak Twelve Data. '
      + 'Używasz <b>numeru konta (Account ID)</b> i <b>hasła do xStation</b>. '
      + 'Połączenie idzie WebSocketem na ws.xtb.com. '
      + 'Hasło zapisuje się tylko w <b>localStorage tej przeglądarki</b> — nie udostępniaj kompa.</p>';
    html += '<p class="why">Jeśli broker / regulamin / typ konta nie udostępnia xAPI, test zwróci błąd — to nie bug BTX, tylko uprawnienia konta.</p>';

    html += '<label>Account ID (userId z xStation)</label>';
    html += '<input id="xtb-user" type="text" autocomplete="username" placeholder="np. 12345678" value="' + (cfg.userId || '').replace(/"/g, '') + '">';
    html += '<label>Hasło xStation</label>';
    html += '<input id="xtb-pass" type="password" autocomplete="current-password" placeholder="hasło" value="' + (cfg.password || '').replace(/"/g, '') + '">';
    html += '<label>Konto</label>';
    html += '<select id="xtb-mode"><option value="demo"' + ((cfg.mode || 'demo') === 'demo' ? ' selected' : '') + '>DEMO</option>';
    html += '<option value="real"' + (cfg.mode === 'real' ? ' selected' : '') + '>REAL</option></select>';

    html += '<div class="row">';
    html += '<button type="button" class="btn" id="xtb-save">Zapisz dane</button>';
    html += '<button type="button" class="btn" id="xtb-connect">Połącz / Test</button>';
    html += '<button type="button" class="btn ghost" id="xtb-disconnect">Rozłącz</button>';
    html += state.connected ? '<span class="pill ok">ONLINE</span>' : '<span class="pill bad">OFFLINE</span>';
    html += '</div>';

    html += '<div class="status">';
    if (state.lastInfo) html += '<div>' + state.lastInfo + '</div>';
    if (state.lastError) html += '<div style="color:#f87171">' + state.lastError + '</div>';
    if (state.balance) {
      html += '<div style="margin-top:6px">Margin level data: <code style="font-size:11px">' +
        JSON.stringify(state.balance).slice(0, 220) + '</code></div>';
    }
    html += '</div>';

    html += '<p class="why" style="margin-top:12px">Po udanym teście: BTX może trzymać sesję (ping). '
      + 'Wysyłanie zleceń real/demo z automatu włączymy osobno i ostrożnie — najpierw musi przejść <b>Połącz / Test</b>.</p>';

    el.innerHTML = html;

    document.getElementById('xtb-save').onclick = function () {
      var c = {
        userId: document.getElementById('xtb-user').value.trim(),
        password: document.getElementById('xtb-pass').value,
        mode: document.getElementById('xtb-mode').value
      };
      saveCfg(c);
      if (global.toast) global.toast('Zapisano dane XTB (lokalnie w przeglądarce)', 'ok');
    };
    document.getElementById('xtb-connect').onclick = async function () {
      var c = {
        userId: document.getElementById('xtb-user').value.trim(),
        password: document.getElementById('xtb-pass').value,
        mode: document.getElementById('xtb-mode').value
      };
      saveCfg(c);
      try {
        await connect(c.userId, c.password, c.mode);
        if (global.toast) global.toast('XTB: połączono', 'ok');
      } catch (e) {
        state.connected = false;
        state.lastError = (e && e.message) ? e.message : String(e);
        state.lastInfo = 'Nie udało się połączyć';
        if (global.toast) global.toast('XTB: ' + state.lastError, 'err');
      }
      render();
    };
    document.getElementById('xtb-disconnect').onclick = function () {
      disconnect();
      if (global.toast) global.toast('XTB rozłączony', 'info');
    };
  }

  function boot() {
    render();
    setInterval(function () {
      if (!document.getElementById('btx-xtb-api')) render();
    }, 4000);
  }

  global.BTX_XTB_API = {
    connect: connect,
    disconnect: disconnect,
    tradeMarket: tradeMarket,
    isConnected: function () { return !!state.connected; },
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
