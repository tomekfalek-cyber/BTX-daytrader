/**
 * BTX settings fix v3
 * - osobny localStorage na klucz Twelve (nie ginie przy zapisie)
 * - wymiana przycisku Zapisz (usuwa stare handlery kasujące klucz)
 * - prawdziwy test Twelve API
 */
(function (global) {
  var STYLE = 'btx-settings-fix-css';
  var KEY_LS = 'btx_twelve_key';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#toast.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(120%);',
      'z-index:99999;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;',
      'background:var(--bg4,#202733);color:#fff;border:1px solid rgba(255,255,255,.12);',
      'box-shadow:0 12px 30px rgba(0,0,0,.45);opacity:0;pointer-events:none;',
      'transition:transform .25s ease,opacity .25s ease;max-width:90vw;text-align:center}',
      '#toast.toast.on{transform:translateX(-50%) translateY(0);opacity:1}',
      '#toast.toast.ok{border-left:4px solid #12c48b;background:rgba(18,196,139,.15);color:#d1fae5}',
      '#toast.toast.err{border-left:4px solid #f04452;background:rgba(240,68,82,.14);color:#fecaca}',
      '#toast.toast.info{border-left:4px solid #3b82f6;background:rgba(59,130,246,.14);color:#dbeafe}'
    ].join('');
    document.head.appendChild(s);
  }

  function toast(msg, kind) {
    injectCss();
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast on ' + (kind || 'ok');
    clearTimeout(t._btxTimer);
    t._btxTimer = setTimeout(function () { t.className = 'toast'; }, 3000);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }
  function num(id, def) {
    var n = Number(val(id));
    return isFinite(n) ? n : def;
  }

  function loadStoredKey() {
    try {
      var k = localStorage.getItem(KEY_LS);
      if (k && k.trim()) return k.trim();
    } catch (e) {}
    try {
      var raw = localStorage.getItem('btx_v4');
      if (raw) {
        var o = JSON.parse(raw);
        var ck = o && o.CFG && (o.CFG.tdKey || o.CFG.twelveKey || o.CFG.apiKey);
        if (ck && String(ck).trim()) return String(ck).trim();
      }
    } catch (e2) {}
    if (global.CFG) {
      var c = global.CFG.tdKey || global.CFG.twelveKey || global.CFG.apiKey;
      if (c && String(c).trim()) return String(c).trim();
    }
    return '';
  }

  function persistKey(key) {
    key = String(key || '').trim();
    if (!key) return;
    try { localStorage.setItem(KEY_LS, key); } catch (e) {}
    if (global.CFG) {
      global.CFG.tdKey = key;
      global.CFG.twelveKey = key;
    }
    var el = document.getElementById('set-tdkey');
    if (el) {
      try { el.value = key; } catch (e2) {}
    }
  }

  function readKeyFromUi() {
    var fromInput = val('set-tdkey').trim();
    if (fromInput) return fromInput;
    return loadStoredKey();
  }

  function applySettings() {
    var CFG = global.CFG;
    if (!CFG) throw new Error('CFG niedostępne');

    CFG.risk = num('set-risk', CFG.risk || 0.5);
    CFG.maxPos = num('set-max', CFG.maxPos || 2);
    CFG.capital = num('set-cap', CFG.capital || 100000);
    CFG.allowShort = val('set-short') === '1';
    CFG.dailyLoss = num('set-dloss', CFG.dailyLoss || 3);
    CFG.maxTrades = num('set-dtrades', CFG.maxTrades || 10);
    CFG.maxConsec = num('set-dconsec', CFG.maxConsec || 3);
    CFG.workerUrl = val('set-worker').trim() || CFG.workerUrl || '';
    CFG.provider = val('set-prov') || CFG.provider || 'twelve';
    CFG.minHold = num('set-minhold', CFG.minHold || 6);
    CFG.autoSec = num('set-autosec', CFG.autoSec || 180);
    CFG.timeStop = num('set-tstop', CFG.timeStop || 60);

    var alpIn = val('set-alpkey').trim();
    var alpSecIn = val('set-alpsec').trim();
    if (alpIn) CFG.alpKey = alpIn;
    if (alpSecIn) CFG.alpSec = alpSecIn;

    var key = readKeyFromUi();
    if (key) persistKey(key);
    else {
      // nie kasuj istniejącego
      key = loadStoredKey();
      if (key) persistKey(key);
    }

    if (global.ST && global.ST.eq && !global.ST.eq.length) {
      global.ST.equity = CFG.capital;
      global.ST.cash = CFG.capital;
    }

    if (typeof global.save === 'function') global.save();
    else {
      try { localStorage.setItem('btx_v4', JSON.stringify({ ST: global.ST, CFG: CFG })); } catch (e) {}
    }
    if (typeof global.log === 'function') global.log('Zapisano ustawienia', 'i');
    if (typeof global.render === 'function') global.render();
    return CFG;
  }

  function replaceSaveButton() {
    var btn = document.getElementById('btn-save');
    if (!btn || btn.__btxReplaced) return btn;
    var neu = btn.cloneNode(true);
    neu.__btxReplaced = true;
    btn.parentNode.replaceChild(neu, btn);
    neu.addEventListener('click', function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
      try {
        var CFG = applySettings();
        var key = readKeyFromUi() || loadStoredKey();
        var prov = (CFG.provider || 'twelve');
        if (prov === 'twelve') {
          if (key) toast('Zapisano · Twelve Data · klucz zapisany (' + key.slice(0, 4) + '…) · Auto ' + (CFG.autoSec || 180) + 's', 'ok');
          else toast('Zapisano — wklej klucz Twelve Data do pola i zapisz ponownie', 'info');
        } else {
          toast('Zapisano ustawienia', 'ok');
        }
      } catch (err) {
        toast('Błąd zapisu: ' + (err && err.message ? err.message : 'nieznany'), 'err');
      }
    });
    return neu;
  }

  function patchProviderTest() {
    global.providerTest = async function () {
      var el = document.getElementById('prov-status');
      var prov = val('set-prov') || (global.CFG && global.CFG.provider) || 'twelve';
      if (global.CFG) global.CFG.provider = prov;

      if (prov === 'alpaca') {
        var key = val('set-alpkey').trim() || (global.CFG && global.CFG.alpKey) || '';
        var sec = val('set-alpsec').trim() || (global.CFG && global.CFG.alpSec) || '';
        if (!key || !sec) {
          if (el) { el.textContent = 'Alpaca: brak kluczy'; el.style.color = 'var(--tx3)'; }
          toast('Brak kluczy Alpaca', 'info');
          return;
        }
        try {
          var r = await fetch('https://data.alpaca.markets/v2/stocks/SPY/bars?timeframe=1Day&limit=1&feed=iex', {
            headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': sec }
          });
          if (el) {
            el.textContent = r.ok ? 'Alpaca: OK' : ('Alpaca: HTTP ' + r.status);
            el.style.color = r.ok ? 'var(--green)' : 'var(--loss)';
          }
          toast(r.ok ? 'Alpaca działa' : ('Alpaca HTTP ' + r.status), r.ok ? 'ok' : 'err');
        } catch (e) {
          if (el) { el.textContent = 'Alpaca: błąd'; el.style.color = 'var(--loss)'; }
          toast('Alpaca: ' + e.message, 'err');
        }
        return;
      }

      if (prov === 'stooq') {
        if (el) { el.textContent = 'Stooq: EOD (bez klucza)'; el.style.color = 'var(--green)'; }
        toast('Stooq aktywny (EOD)', 'ok');
        return;
      }

      // Twelve — prawdziwy test API
      var td = readKeyFromUi() || loadStoredKey();
      if (!td) {
        if (el) { el.textContent = 'Twelve Data: brak klucza'; el.style.color = 'var(--loss)'; }
        toast('Brak klucza Twelve Data — wklej do pola i Zapisz', 'info');
        return;
      }
      persistKey(td);
      if (el) { el.textContent = 'Twelve Data: testuję…'; el.style.color = 'var(--tx2)'; }
      try {
        var url = 'https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=1&apikey=' + encodeURIComponent(td);
        var resp = await fetch(url);
        var j = await resp.json();
        if (j && j.values && j.values.length) {
          if (el) { el.textContent = 'Twelve Data: OK (klucz działa)'; el.style.color = 'var(--green)'; }
          toast('Twelve Data: klucz działa', 'ok');
        } else if (j && (j.code === 401 || /api key/i.test(String(j.message || '')))) {
          if (el) { el.textContent = 'Twelve Data: zły klucz'; el.style.color = 'var(--loss)'; }
          toast('Twelve Data: nieprawidłowy klucz', 'err');
        } else if (j && /limit|credits/i.test(String(j.message || ''))) {
          if (el) { el.textContent = 'Twelve Data: limit API'; el.style.color = 'var(--gold,#f5b301)'; }
          toast('Twelve Data: klucz OK, ale limit kredytów', 'info');
        } else {
          var msg = (j && j.message) || ('HTTP ' + resp.status);
          if (el) { el.textContent = 'Twelve Data: ' + msg; el.style.color = 'var(--loss)'; }
          toast('Twelve Data: ' + msg, 'err');
        }
      } catch (e) {
        if (el) { el.textContent = 'Twelve Data: błąd sieci'; el.style.color = 'var(--loss)'; }
        toast('Twelve Data: ' + e.message, 'err');
      }
    };

    var pb = document.getElementById('btn-prov');
    if (pb && !pb.__btxProv) {
      var np = pb.cloneNode(true);
      np.__btxProv = true;
      pb.parentNode.replaceChild(np, pb);
      np.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        global.providerTest();
      });
    }
  }

  function hydrateKeyField() {
    var key = loadStoredKey();
    if (!key) return;
    if (global.CFG) {
      global.CFG.tdKey = key;
      global.CFG.twelveKey = key;
    }
    var el = document.getElementById('set-tdkey');
    if (el && !String(el.value || '').trim()) {
      try { el.value = key; } catch (e) {}
    }
  }

  function boot() {
    injectCss();
    hydrateKeyField();
    replaceSaveButton();
    patchProviderTest();
    // global toast
    global.toast = function (m, kind) {
      if (kind) return toast(m, kind);
      var msg = String(m || '');
      if (/zapisano|ok|działa|aktywny|saved/i.test(msg) && !/brak/i.test(msg)) return toast(msg, 'ok');
      if (/błąd|error|zły|nieprawid/i.test(msg)) return toast(msg, 'err');
      return toast(msg, 'info');
    };
    setInterval(function () {
      hydrateKeyField();
      replaceSaveButton();
      patchProviderTest();
    }, 3000);
  }

  global.BTX_SETTINGS_FIX = { toast: toast, applySettings: applySettings, loadStoredKey: loadStoredKey };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
