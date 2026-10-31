/**
 * BTX settings fix v4 — Twelve Data first
 * - jeden klucz Twelve
 * - Alpaca schowane gdy provider=twelve
 * - fetch korzysta z zapisanego klucza Twelve
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
      '#toast.toast.info{border-left:4px solid #3b82f6;background:rgba(59,130,246,.14);color:#dbeafe}',
      '.btx-prov-twelve .btx-alpaca-row{display:none!important}',
      '.btx-key-hint{font-size:11px;color:var(--tx3);margin:4px 0 0 200px;max-width:320px;line-height:1.4}'
    ].join('');
    document.head.appendChild(s);
  }

  function toast(msg, kind) {
    injectCss();
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast on ' + (kind || 'ok');
    clearTimeout(t._btxTimer);
    t._btxTimer = setTimeout(function () { t.className = 'toast'; }, 3200);
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
      global.CFG.provider = global.CFG.provider || 'twelve';
    }
    var el = document.getElementById('set-tdkey');
    if (el) { try { el.value = key; } catch (e2) {} }
  }

  function readKeyFromUi() {
    var fromInput = val('set-tdkey').trim();
    if (fromInput) return fromInput;
    return loadStoredKey();
  }

  function forceTwelveProvider() {
    if (global.CFG) global.CFG.provider = 'twelve';
    var sel = document.getElementById('set-prov');
    if (sel) sel.value = 'twelve';
    document.body.classList.add('btx-prov-twelve');
    document.body.classList.remove('btx-prov-alpaca');
  }

  function toggleProviderUi() {
    var prov = val('set-prov') || (global.CFG && global.CFG.provider) || 'twelve';
    if (prov === 'twelve') {
      document.body.classList.add('btx-prov-twelve');
      document.body.classList.remove('btx-prov-alpaca');
    } else if (prov === 'alpaca') {
      document.body.classList.add('btx-prov-alpaca');
      document.body.classList.remove('btx-prov-twelve');
    } else {
      document.body.classList.remove('btx-prov-twelve');
      document.body.classList.remove('btx-prov-alpaca');
    }
  }

  function markAlpacaRows() {
    ['set-alpkey', 'set-alpsec'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('.row') || el.parentElement;
      if (row) row.classList.add('btx-alpaca-row');
    });
    // hint under twelve key
    var td = document.getElementById('set-tdkey');
    if (td && !document.getElementById('btx-twelve-hint')) {
      var hint = document.createElement('div');
      hint.id = 'btx-twelve-hint';
      hint.className = 'btx-key-hint';
      hint.textContent = 'Twelve Data = jeden klucz API. Pola Alpaca s\u0105 opcjonalne i ukryte przy Twelve.';
      var row = td.closest('.row') || td.parentElement;
      if (row && row.parentNode) row.parentNode.insertBefore(hint, row.nextSibling);
      td.placeholder = 'wklej klucz Twelve Data';
    }
    // label clarity
    var lab = document.querySelector('label[for="set-tdkey"]');
    // no for attr - find by proximity
    var rows = document.querySelectorAll('#pane-cfg .row, .pane .row');
    rows.forEach(function (r) {
      if (r.querySelector('#set-tdkey')) {
        var l = r.querySelector('label');
        if (l) l.textContent = 'Klucz Twelve Data (jedyny potrzebny)';
      }
    });
  }

  function applySettings() {
    var CFG = global.CFG;
    if (!CFG) throw new Error('CFG niedost\u0119pne');

    CFG.risk = num('set-risk', CFG.risk || 0.5);
    CFG.maxPos = num('set-max', CFG.maxPos || 2);
    CFG.capital = num('set-cap', CFG.capital || 100000);
    CFG.allowShort = val('set-short') === '1';
    CFG.dailyLoss = num('set-dloss', CFG.dailyLoss || 3);
    CFG.maxTrades = num('set-dtrades', CFG.maxTrades || 10);
    CFG.maxConsec = num('set-dconsec', CFG.maxConsec || 3);
    CFG.workerUrl = val('set-worker').trim() || CFG.workerUrl || '';
    CFG.minHold = num('set-minhold', CFG.minHold || 6);
    CFG.autoSec = num('set-autosec', CFG.autoSec || 180);
    CFG.timeStop = num('set-tstop', CFG.timeStop || 60);

    // provider: domy\u015blnie twelve
    var prov = val('set-prov') || 'twelve';
    CFG.provider = prov;

    // Twelve key — g\u0142\u00f3wny
    var key = readKeyFromUi();
    if (key) persistKey(key);
    else {
      key = loadStoredKey();
      if (key) persistKey(key);
    }

    // Alpaca tylko gdy wybrane
    if (prov === 'alpaca') {
      var alpIn = val('set-alpkey').trim();
      var alpSecIn = val('set-alpsec').trim();
      if (alpIn) CFG.alpKey = alpIn;
      if (alpSecIn) CFG.alpSec = alpSecIn;
    }

    if (global.ST && global.ST.eq && !global.ST.eq.length) {
      global.ST.equity = CFG.capital;
      global.ST.cash = CFG.capital;
    }

    if (typeof global.save === 'function') global.save();
    else {
      try { localStorage.setItem('btx_v4', JSON.stringify({ ST: global.ST, CFG: CFG })); } catch (e) {}
    }
    if (typeof global.log === 'function') global.log('Zapisano ustawienia (' + prov + ')', 'i');
    if (typeof global.render === 'function') global.render();
    toggleProviderUi();
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
        var key = loadStoredKey();
        var prov = CFG.provider || 'twelve';
        if (prov === 'twelve') {
          if (key) toast('Zapisano \u00b7 Twelve Data \u00b7 klucz OK (' + key.slice(0, 4) + '\u2026) \u00b7 Auto ' + (CFG.autoSec || 180) + 's', 'ok');
          else toast('Wklej klucz Twelve Data do pola \u201eKlucz Twelve Data\u201d i kliknij Zapisz', 'info');
        } else if (prov === 'alpaca') {
          toast((CFG.alpKey && CFG.alpSec) ? 'Zapisano \u00b7 Alpaca' : 'Zapisano \u2014 uzupe\u0142nij oba pola Alpaca', (CFG.alpKey && CFG.alpSec) ? 'ok' : 'info');
        } else {
          toast('Zapisano \u00b7 ' + prov, 'ok');
        }
      } catch (err) {
        toast('B\u0142\u0105d zapisu: ' + (err && err.message ? err.message : 'nieznany'), 'err');
      }
    });
    return neu;
  }

  function patchProviderTest() {
    global.providerTest = async function () {
      var el = document.getElementById('prov-status');
      var prov = val('set-prov') || (global.CFG && global.CFG.provider) || 'twelve';
      if (global.CFG) global.CFG.provider = prov;
      toggleProviderUi();

      if (prov === 'alpaca') {
        toast('Wybrano Alpaca \u2014 potrzebne 2 pola (Key + Secret). Dla jednego klucza ustaw Twelve Data.', 'info');
        if (el) el.textContent = 'Prze\u0142\u0105cz na Twelve Data (1 klucz)';
        return;
      }
      if (prov === 'stooq') {
        if (el) { el.textContent = 'Stooq: EOD bez klucza'; el.style.color = 'var(--green)'; }
        toast('Stooq aktywny (EOD)', 'ok');
        return;
      }

      var td = readKeyFromUi() || loadStoredKey();
      if (!td) {
        if (el) { el.textContent = 'Twelve: brak klucza'; el.style.color = 'var(--loss)'; }
        toast('Wklej klucz Twelve Data i kliknij Zapisz', 'info');
        return;
      }
      persistKey(td);
      forceTwelveProvider();
      if (el) { el.textContent = 'Twelve Data: testuj\u0119\u2026'; el.style.color = 'var(--tx2)'; }
      try {
        var url = 'https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=1&apikey=' + encodeURIComponent(td);
        var resp = await fetch(url);
        var j = await resp.json();
        if (j && j.values && j.values.length) {
          if (el) { el.textContent = 'Twelve Data: OK'; el.style.color = 'var(--green)'; }
          toast('Twelve Data dzia\u0142a \u00b7 klucz prawid\u0142owy', 'ok');
        } else if (j && (j.code === 401 || /api key|invalid/i.test(String(j.message || '')))) {
          if (el) { el.textContent = 'Twelve: z\u0142y klucz'; el.style.color = 'var(--loss)'; }
          toast('Nieprawid\u0142owy klucz Twelve Data', 'err');
        } else if (j && /limit|credits|run out/i.test(String(j.message || ''))) {
          if (el) { el.textContent = 'Twelve: limit kredyt\u00f3w'; el.style.color = 'var(--gold,#f5b301)'; }
          toast('Klucz OK, ale wyczerpany limit free Twelve (800/dzie\u0144)', 'info');
        } else {
          var msg = (j && j.message) || ('HTTP ' + resp.status);
          if (el) { el.textContent = 'Twelve: ' + msg; el.style.color = 'var(--loss)'; }
          toast('Twelve: ' + msg, 'err');
        }
      } catch (e) {
        if (el) { el.textContent = 'Twelve: b\u0142\u0105d sieci/CORS'; el.style.color = 'var(--loss)'; }
        toast('B\u0142\u0105d po\u0142\u0105czenia z Twelve: ' + e.message, 'err');
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

  /** Fetch Twelve zawsze z zapisanego klucza */
  function patchFetch() {
    if (global.__btxFetchPatched) return;
    global.__btxFetchPatched = true;

    var origTwelve = global.fetchTwelve;
    // fetchReal by\u0142 orygina\u0142em twelve zanim go nadpisano
    global.fetchTwelve = async function (sym) {
      var key = loadStoredKey() || readKeyFromUi();
      if (!key) {
        toast('Brak klucza Twelve Data \u2014 Ustawienia \u2192 wklej klucz \u2192 Zapisz', 'info');
        return;
      }
      persistKey(key);
      if (global.CFG) global.CFG.provider = 'twelve';
      try {
        // XAU/USD wymaga symbolu XAU/USD w API
        var url = 'https://api.twelvedata.com/time_series?symbol=' +
          encodeURIComponent(sym) + '&interval=5min&outputsize=120&apikey=' + encodeURIComponent(key);
        var r = await fetch(url);
        var j = await r.json();
        if (!j || !j.values) {
          var msg = (j && j.message) || 'brak danych';
          if (typeof global.log === 'function') global.log('Twelve Data [' + sym + ']: ' + msg, 'r');
          toast('Twelve [' + sym + ']: ' + msg, 'err');
          return;
        }
        var bars = j.values.slice().reverse().map(function (v) {
          return {
            t: new Date(v.datetime).getTime(),
            o: +v.open, h: +v.high, l: +v.low, c: +v.close,
            v: +(v.volume || 0)
          };
        });
        if (global.ST && global.ST.series) global.ST.series[sym] = bars;
        if (typeof global.log === 'function') global.log('Twelve OK: ' + sym + ' (' + bars.length + ' \u015bwiec)', 'g');
        if (typeof global.render === 'function') global.render();
        return bars;
      } catch (e) {
        if (typeof global.log === 'function') global.log('Twelve b\u0142\u0105d: ' + e.message, 'r');
        toast('Twelve b\u0142\u0105d: ' + e.message, 'err');
      }
    };

    global.fetchReal = async function (sym) {
      var p = String((global.CFG && global.CFG.provider) || val('set-prov') || 'twelve');
      if (p === 'alpaca' && typeof global.fetchAlpaca === 'function') return global.fetchAlpaca(sym);
      if (p === 'stooq' && typeof global.fetchStooq === 'function') return global.fetchStooq(sym);
      // domy\u015blnie zawsze Twelve
      return global.fetchTwelve(sym);
    };
  }

  function hydrate() {
    var key = loadStoredKey();
    if (key) persistKey(key);
    forceTwelveProvider();
    markAlpacaRows();
    toggleProviderUi();
    var sel = document.getElementById('set-prov');
    if (sel && !sel.__btxCh) {
      sel.__btxCh = true;
      sel.addEventListener('change', toggleProviderUi);
    }
  }

  function boot() {
    injectCss();
    hydrate();
    replaceSaveButton();
    patchProviderTest();
    patchFetch();
    global.toast = function (m, kind) {
      if (kind) return toast(m, kind);
      var msg = String(m || '');
      if (/zapisano|ok|dzia\u0142a|prawid\u0142owy/i.test(msg) && !/brak/i.test(msg)) return toast(msg, 'ok');
      if (/b\u0142\u0105d|error|z\u0142y|nieprawid/i.test(msg)) return toast(msg, 'err');
      return toast(msg, 'info');
    };
    setInterval(function () {
      hydrate();
      replaceSaveButton();
      patchProviderTest();
      patchFetch();
    }, 3000);
  }

  global.BTX_SETTINGS_FIX = {
    toast: toast,
    applySettings: applySettings,
    loadStoredKey: loadStoredKey,
    forceTwelveProvider: forceTwelveProvider
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
