/**
 * BTX settings fix v5
 * Klucz Twelve: pole tekstowe, zapis przy każdym znaku, test czyta z wielu źródeł
 */
(function (global) {
  var STYLE = 'btx-settings-fix-css';
  var KEY_LS = 'btx_twelve_key';
  var lastKey = '';

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
      '#set-tdkey{ime-mode:active;-webkit-text-security:none}',
      '#btx-key-status{font-size:11px;margin-left:8px;color:var(--tx3)}',
      '#btx-key-status.ok{color:#12c48b}'
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
    t._btxTimer = setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  function getTdInput() {
    var el = document.getElementById('set-tdkey');
    if (el) return el;
    // fallback: input obok etykiety Twelve
    var labels = document.querySelectorAll('label, .mut, span, div');
    for (var i = 0; i < labels.length; i++) {
      var t = (labels[i].textContent || '').toLowerCase();
      if (t.indexOf('twelve') >= 0 && t.indexOf('klucz') >= 0) {
        var row = labels[i].closest('.row') || labels[i].parentElement;
        if (row) {
          var inp = row.querySelector('input');
          if (inp) return inp;
        }
      }
    }
    return null;
  }

  function prepareTdInput() {
    var el = getTdInput();
    if (!el) return null;
    // hasło bywa puste w JS — zamień na text
    if (el.type === 'password') {
      try { el.type = 'text'; } catch (e) {}
    }
    el.autocomplete = 'off';
    el.placeholder = 'wklej klucz API z twelvedata.com';
    el.setAttribute('data-btx-twelve', '1');
    if (!el.__btxInputBound) {
      el.__btxInputBound = true;
      var saveNow = function () {
        var v = String(el.value || '').trim();
        if (v) {
          lastKey = v;
          try { localStorage.setItem(KEY_LS, v); } catch (e) {}
          if (global.CFG) {
            global.CFG.tdKey = v;
            global.CFG.twelveKey = v;
            global.CFG.provider = 'twelve';
          }
          updateKeyStatus(v);
        } else {
          updateKeyStatus('');
        }
      };
      el.addEventListener('input', saveNow);
      el.addEventListener('change', saveNow);
      el.addEventListener('paste', function () { setTimeout(saveNow, 0); });
      el.addEventListener('blur', saveNow);
    }
    return el;
  }

  function updateKeyStatus(v) {
    var st = document.getElementById('btx-key-status');
    var el = getTdInput();
    if (!st && el) {
      st = document.createElement('span');
      st.id = 'btx-key-status';
      if (el.parentNode) el.parentNode.appendChild(st);
    }
    if (!st) return;
    if (v && v.length >= 8) {
      st.textContent = 'klucz w pamięci (' + v.length + ' znaków, ' + v.slice(0, 3) + '…)';
      st.className = 'ok';
    } else if (v) {
      st.textContent = 'za krótki? (' + v.length + ' znaków)';
      st.className = '';
    } else {
      st.textContent = 'brak klucza w polu';
      st.className = '';
    }
  }

  function loadStoredKey() {
    if (lastKey && lastKey.trim()) return lastKey.trim();
    try {
      var k = localStorage.getItem(KEY_LS);
      if (k && k.trim()) { lastKey = k.trim(); return lastKey; }
    } catch (e) {}
    try {
      var raw = localStorage.getItem('btx_v4');
      if (raw) {
        var o = JSON.parse(raw);
        var ck = o && o.CFG && (o.CFG.tdKey || o.CFG.twelveKey || o.CFG.apiKey);
        if (ck && String(ck).trim()) { lastKey = String(ck).trim(); return lastKey; }
      }
    } catch (e2) {}
    if (global.CFG) {
      var c = global.CFG.tdKey || global.CFG.twelveKey || global.CFG.apiKey;
      if (c && String(c).trim()) { lastKey = String(c).trim(); return lastKey; }
    }
    return '';
  }

  function resolveKey() {
    // 1) aktualne pole
    var el = prepareTdInput();
    if (el) {
      var v = String(el.value || '').trim();
      if (v) { lastKey = v; try { localStorage.setItem(KEY_LS, v); } catch (e) {} return v; }
    }
    // 2) activeElement jeśli to input
    var ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') {
      var av = String(ae.value || '').trim();
      if (av && av.length >= 8) { lastKey = av; try { localStorage.setItem(KEY_LS, av); } catch (e) {} return av; }
    }
    // 3) pamięć
    return loadStoredKey();
  }

  function persistKey(key) {
    key = String(key || '').trim();
    if (!key) return;
    lastKey = key;
    try { localStorage.setItem(KEY_LS, key); } catch (e) {}
    if (global.CFG) {
      global.CFG.tdKey = key;
      global.CFG.twelveKey = key;
      global.CFG.provider = 'twelve';
    }
    var el = prepareTdInput();
    if (el && String(el.value || '').trim() !== key) {
      try { el.value = key; } catch (e2) {}
    }
    updateKeyStatus(key);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }
  function num(id, def) {
    var n = Number(val(id));
    return isFinite(n) ? n : def;
  }

  function forceTwelve() {
    if (global.CFG) global.CFG.provider = 'twelve';
    var sel = document.getElementById('set-prov');
    if (sel) sel.value = 'twelve';
    document.body.classList.add('btx-prov-twelve');
  }

  function markAlpacaRows() {
    ['set-alpkey', 'set-alpsec'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('.row') || el.parentElement;
      if (row) row.classList.add('btx-alpaca-row');
    });
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
    CFG.minHold = num('set-minhold', CFG.minHold || 6);
    CFG.autoSec = num('set-autosec', CFG.autoSec || 180);
    CFG.timeStop = num('set-tstop', CFG.timeStop || 60);
    CFG.provider = 'twelve';
    var key = resolveKey();
    if (key) persistKey(key);
    if (typeof global.save === 'function') global.save();
    else {
      try { localStorage.setItem('btx_v4', JSON.stringify({ ST: global.ST, CFG: CFG })); } catch (e) {}
    }
    if (typeof global.log === 'function') global.log('Zapisano ustawienia (twelve)', 'i');
    if (typeof global.render === 'function') global.render();
    return CFG;
  }

  function replaceSaveButton() {
    var btn = document.getElementById('btn-save');
    if (!btn || btn.__btxReplaced) return;
    var neu = btn.cloneNode(true);
    neu.__btxReplaced = true;
    btn.parentNode.replaceChild(neu, btn);
    neu.addEventListener('click', function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
      try {
        applySettings();
        var key = resolveKey();
        if (key) toast('Zapisano · Twelve · klucz (' + key.slice(0, 4) + '…' + key.length + ' znaków)', 'ok');
        else toast('Pole klucza jest puste — wklej klucz Twelve i spróbuj ponownie', 'info');
      } catch (err) {
        toast('Błąd zapisu: ' + (err && err.message ? err.message : '?'), 'err');
      }
    });
  }

  function bindProvButton() {
    var pb = document.getElementById('btn-prov');
    if (!pb || pb.__btxProvV5) return;
    var np = pb.cloneNode(true);
    np.__btxProvV5 = true;
    pb.parentNode.replaceChild(np, pb);
    np.addEventListener('click', function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
      runProviderTest();
    });
  }

  async function runProviderTest() {
    var el = document.getElementById('prov-status');
    forceTwelve();
    prepareTdInput();

    var td = resolveKey();
    if (!td) {
      if (el) { el.textContent = 'Brak klucza — wklej w pole powyżej'; el.style.color = 'var(--loss)'; }
      toast('Nie widzę klucza. Kliknij w pole "Klucz Twelve Data", wklej klucz, odczekaj 1 s, potem Test.', 'err');
      return;
    }

    persistKey(td);
    if (el) { el.textContent = 'Testuję Twelve API…'; el.style.color = 'var(--tx2)'; }
    toast('Testuję klucz (' + td.length + ' znaków)…', 'info');

    try {
      var url = 'https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=1&apikey=' + encodeURIComponent(td);
      var resp = await fetch(url);
      var j = await resp.json();
      if (j && j.values && j.values.length) {
        if (el) { el.textContent = 'Twelve Data: OK'; el.style.color = 'var(--green)'; }
        toast('Twelve Data działa · klucz prawidłowy', 'ok');
      } else if (j && (j.code === 401 || /api key|invalid/i.test(String(j.message || '')))) {
        if (el) { el.textContent = 'Zły klucz API'; el.style.color = 'var(--loss)'; }
        toast('Twelve odrzucił klucz (invalid API key)', 'err');
      } else if (j && /limit|credits|run out/i.test(String(j.message || ''))) {
        if (el) { el.textContent = 'Limit kredytów Twelve'; el.style.color = 'var(--gold,#f5b301)'; }
        toast('Klucz OK, ale limit free (800/dzień) wyczerpany', 'info');
      } else {
        var msg = (j && j.message) || ('HTTP ' + resp.status);
        if (el) { el.textContent = msg; el.style.color = 'var(--loss)'; }
        toast('Twelve: ' + msg, 'err');
      }
    } catch (err) {
      if (el) { el.textContent = 'Błąd sieci'; el.style.color = 'var(--loss)'; }
      toast('Błąd połączenia: ' + err.message, 'err');
    }
  }

  function patchFetch() {
    if (global.__btxFetchV5) return;
    global.__btxFetchV5 = true;
    global.fetchTwelve = async function (sym) {
      var key = resolveKey();
      if (!key) {
        toast('Brak klucza Twelve — wklej w Ustawieniach', 'info');
        return;
      }
      persistKey(key);
      try {
        var url = 'https://api.twelvedata.com/time_series?symbol=' +
          encodeURIComponent(sym) + '&interval=5min&outputsize=120&apikey=' + encodeURIComponent(key);
        var r = await fetch(url);
        var j = await r.json();
        if (!j || !j.values) {
          var msg = (j && j.message) || 'brak danych';
          if (typeof global.log === 'function') global.log('Twelve [' + sym + ']: ' + msg, 'r');
          toast('Twelve [' + sym + ']: ' + msg, 'err');
          return;
        }
        var bars = j.values.slice().reverse().map(function (v) {
          return { t: new Date(v.datetime).getTime(), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) };
        });
        if (global.ST && global.ST.series) global.ST.series[sym] = bars;
        if (typeof global.log === 'function') global.log('Twelve OK: ' + sym + ' (' + bars.length + ')', 'g');
        if (typeof global.render === 'function') global.render();
        return bars;
      } catch (e) {
        toast('Twelve błąd: ' + e.message, 'err');
      }
    };
    global.fetchReal = async function (sym) {
      return global.fetchTwelve(sym);
    };
    global.providerTest = runProviderTest;
  }

  function boot() {
    injectCss();
    forceTwelve();
    markAlpacaRows();
    prepareTdInput();
    var k = loadStoredKey();
    if (k) persistKey(k);
    replaceSaveButton();
    bindProvButton();
    patchFetch();
    global.toast = function (m, kind) {
      if (kind) return toast(m, kind);
      var msg = String(m || '');
      if (/ok|działa|zapisano|prawidłowy/i.test(msg) && !/brak/i.test(msg)) return toast(msg, 'ok');
      if (/błąd|error|zły|nie widzę/i.test(msg)) return toast(msg, 'err');
      return toast(msg, 'info');
    };
    setInterval(function () {
      prepareTdInput();
      replaceSaveButton();
      bindProvButton();
      patchFetch();
      forceTwelve();
      markAlpacaRows();
    }, 4000);
  }

  global.BTX_SETTINGS_FIX = { resolveKey: resolveKey, persistKey: persistKey, runProviderTest: runProviderTest };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
