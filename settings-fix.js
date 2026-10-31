/**
 * BTX settings fix v6
 * Wyraźna karta "Klucz Twelve Data" na górze Ustawień + działający test
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
      '#btx-key-panel{display:block!important;visibility:visible!important;opacity:1!important;',
      'margin:0 0 14px;padding:16px 18px;border-radius:14px;',
      'background:linear-gradient(180deg,rgba(18,196,139,.12),rgba(18,196,139,.04));',
      'border:1px solid rgba(18,196,139,.35);position:relative;z-index:5}',
      '#btx-key-panel h3{margin:0 0 8px;font-size:14px;font-weight:700;color:#d1fae5}',
      '#btx-key-panel p{margin:0 0 12px;font-size:12px;color:var(--tx2);line-height:1.45}',
      '#btx-key-panel .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '#btx-tdkey-main{flex:1;min-width:220px;max-width:420px;padding:10px 12px;border-radius:10px;',
      'border:1px solid var(--line2,#333);background:var(--bg,#0a0d12);color:#fff;font-size:14px;',
      'font-family:ui-monospace,monospace}',
      '#btx-key-panel .btn{cursor:pointer}',
      '#btx-key-status{font-size:12px;margin-top:8px;color:var(--tx3)}',
      '#btx-key-status.ok{color:#12c48b;font-weight:600}',
      '.btx-prov-twelve .btx-alpaca-row{display:none!important}',
      '#set-tdkey{display:block!important}'
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

  function setStatus(v) {
    var st = document.getElementById('btx-key-status');
    if (!st) return;
    if (v && v.length >= 8) {
      st.textContent = 'Zapisany klucz: ' + v.slice(0, 4) + '\u2026 (' + v.length + ' znak\u00f3w)';
      st.className = 'ok';
    } else {
      st.textContent = 'Brak klucza \u2014 wklej powy\u017cej i kliknij Zapisz klucz';
      st.className = '';
    }
  }

  function persistKey(key) {
    key = String(key || '').trim();
    if (!key) return false;
    lastKey = key;
    try { localStorage.setItem(KEY_LS, key); } catch (e) {}
    if (global.CFG) {
      global.CFG.tdKey = key;
      global.CFG.twelveKey = key;
      global.CFG.provider = 'twelve';
    }
    var main = document.getElementById('btx-tdkey-main');
    if (main) main.value = key;
    var old = document.getElementById('set-tdkey');
    if (old) { try { old.value = key; } catch (e2) {} }
    setStatus(key);
    if (typeof global.save === 'function') {
      try { global.save(); } catch (e3) {}
    }
    return true;
  }

  function resolveKey() {
    var main = document.getElementById('btx-tdkey-main');
    if (main) {
      var v = String(main.value || '').trim();
      if (v) return v;
    }
    var old = document.getElementById('set-tdkey');
    if (old) {
      var v2 = String(old.value || '').trim();
      if (v2) return v2;
    }
    return loadStoredKey();
  }

  function ensureKeyPanel() {
    var pane = document.getElementById('pane-cfg');
    if (!pane) return;

    var panel = document.getElementById('btx-key-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'btx-key-panel';
      panel.innerHTML = [
        '<h3>Klucz API Twelve Data</h3>',
        '<p>Wklej tutaj <b>jeden</b> klucz z twelvedata.com (Basic / free). Pola Alpaca nie s\u0105 potrzebne.</p>',
        '<div class="row">',
        '<input id="btx-tdkey-main" type="text" autocomplete="off" spellcheck="false" placeholder="np. abc123..." />',
        '<button type="button" class="btn" id="btx-btn-save-key">Zapisz klucz</button>',
        '<button type="button" class="btn ghost" id="btx-btn-test-key">Test klucza</button>',
        '</div>',
        '<div id="btx-key-status">\u2014</div>'
      ].join('');

      // wstaw na sam\u0105 g\u00f3r\u0119 ustawie\u0144
      if (pane.firstChild) pane.insertBefore(panel, pane.firstChild);
      else pane.appendChild(panel);
    }

    // poka\u017c zapisany klucz
    var k = loadStoredKey();
    var main = document.getElementById('btx-tdkey-main');
    if (main && k && !String(main.value || '').trim()) main.value = k;
    setStatus(k);

    var bSave = document.getElementById('btx-btn-save-key');
    if (bSave && !bSave.__bound) {
      bSave.__bound = true;
      bSave.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        var key = resolveKey();
        if (!key) {
          toast('Pole jest puste \u2014 wklej klucz Twelve Data', 'err');
          return;
        }
        persistKey(key);
        toast('Klucz Twelve zapisany (' + key.length + ' znak\u00f3w)', 'ok');
      });
    }

    var bTest = document.getElementById('btx-btn-test-key');
    if (bTest && !bTest.__bound) {
      bTest.__bound = true;
      bTest.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        runProviderTest();
      });
    }

    if (main && !main.__bound) {
      main.__bound = true;
      var onType = function () {
        var v = String(main.value || '').trim();
        if (v) {
          lastKey = v;
          try { localStorage.setItem(KEY_LS, v); } catch (e) {}
          if (global.CFG) { global.CFG.tdKey = v; global.CFG.twelveKey = v; }
          setStatus(v);
        } else setStatus('');
      };
      main.addEventListener('input', onType);
      main.addEventListener('change', onType);
      main.addEventListener('paste', function () { setTimeout(onType, 0); });
    }
  }

  async function runProviderTest() {
    var el = document.getElementById('prov-status');
    var st = document.getElementById('btx-key-status');
    var td = resolveKey();
    if (!td) {
      if (el) { el.textContent = 'Brak klucza'; el.style.color = 'var(--loss)'; }
      toast('Najpierw wklej klucz w zielonej karcie na g\u00f3rze Ustawie\u0144', 'err');
      // otw\u00f3rz ustawienia
      openSettings();
      return;
    }
    persistKey(td);
    if (el) { el.textContent = 'Testuj\u0119\u2026'; el.style.color = 'var(--tx2)'; }
    if (st) st.textContent = 'Testuj\u0119 po\u0142\u0105czenie z Twelve Data\u2026';
    toast('Testuj\u0119 klucz (' + td.length + ' znak\u00f3w)\u2026', 'info');
    try {
      var url = 'https://api.twelvedata.com/time_series?symbol=SPY&interval=1day&outputsize=1&apikey=' + encodeURIComponent(td);
      var resp = await fetch(url);
      var j = await resp.json();
      if (j && j.values && j.values.length) {
        if (el) { el.textContent = 'Twelve Data: OK'; el.style.color = 'var(--green)'; }
        if (st) { st.textContent = 'Twelve Data dzia\u0142a \u00b7 klucz OK'; st.className = 'ok'; }
        toast('Twelve Data dzia\u0142a \u00b7 klucz prawid\u0142owy', 'ok');
      } else if (j && (j.code === 401 || /api key|invalid/i.test(String(j.message || '')))) {
        if (el) { el.textContent = 'Z\u0142y klucz'; el.style.color = 'var(--loss)'; }
        toast('Twelve odrzuci\u0142 klucz (invalid)', 'err');
      } else if (j && /limit|credits|run out/i.test(String(j.message || ''))) {
        if (el) { el.textContent = 'Limit API'; el.style.color = 'var(--gold,#f5b301)'; }
        toast('Klucz OK, ale limit free wyczerpany', 'info');
      } else {
        var msg = (j && j.message) || ('HTTP ' + resp.status);
        if (el) { el.textContent = msg; el.style.color = 'var(--loss)'; }
        toast('Twelve: ' + msg, 'err');
      }
    } catch (err) {
      if (el) { el.textContent = 'B\u0142\u0105d sieci'; el.style.color = 'var(--loss)'; }
      toast('B\u0142\u0105d: ' + err.message, 'err');
    }
  }

  function openSettings() {
    try {
      var btn = document.querySelector('.nav button[data-tab="cfg"]');
      if (btn) btn.click();
      var panes = document.querySelectorAll('.pane');
      for (var i = 0; i < panes.length; i++) {
        var on = panes[i].id === 'pane-cfg';
        var base = (panes[i].className || 'pane').replace(/\bon\b/g, '').replace(/\s+/g, ' ').trim();
        panes[i].className = on ? (base + ' on') : base;
      }
      var navBtns = document.querySelectorAll('.nav button');
      for (var j = 0; j < navBtns.length; j++) {
        navBtns[j].className = (navBtns[j].getAttribute('data-tab') === 'cfg') ? 'on' : '';
      }
    } catch (e) {}
  }

  function markAlpacaRows() {
    ['set-alpkey', 'set-alpsec'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var row = el.closest('.row') || el.parentElement;
      if (row) row.classList.add('btx-alpaca-row');
    });
    document.body.classList.add('btx-prov-twelve');
    var sel = document.getElementById('set-prov');
    if (sel) sel.value = 'twelve';
    if (global.CFG) global.CFG.provider = 'twelve';
  }

  function patchFetch() {
    if (global.__btxFetchV6) return;
    global.__btxFetchV6 = true;
    global.fetchTwelve = async function (sym) {
      var key = resolveKey();
      if (!key) {
        toast('Brak klucza Twelve \u2014 otw\u00f3rz Ustawienia i wklej klucz', 'info');
        openSettings();
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
        toast('Twelve b\u0142\u0105d: ' + e.message, 'err');
      }
    };
    global.fetchReal = function (sym) { return global.fetchTwelve(sym); };
    global.providerTest = runProviderTest;
  }

  function bindOldButtons() {
    var pb = document.getElementById('btn-prov');
    if (pb && !pb.__v6) {
      var np = pb.cloneNode(true);
      np.__v6 = true;
      pb.parentNode.replaceChild(np, pb);
      np.addEventListener('click', function (e) {
        if (e) e.preventDefault();
        runProviderTest();
      });
    }
    var sb = document.getElementById('btn-save');
    if (sb && !sb.__v6) {
      var ns = sb.cloneNode(true);
      ns.__v6 = true;
      sb.parentNode.replaceChild(ns, sb);
      ns.addEventListener('click', function (e) {
        if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
        var key = resolveKey();
        if (key) persistKey(key);
        if (global.CFG) {
          var num = function (id, def) {
            var el = document.getElementById(id);
            var n = el ? Number(el.value) : NaN;
            return isFinite(n) ? n : def;
          };
          global.CFG.risk = num('set-risk', global.CFG.risk || 0.5);
          global.CFG.maxPos = num('set-max', global.CFG.maxPos || 2);
          global.CFG.capital = num('set-cap', global.CFG.capital || 100000);
          global.CFG.autoSec = num('set-autosec', 180);
          global.CFG.provider = 'twelve';
        }
        if (typeof global.save === 'function') global.save();
        toast(key ? ('Zapisano \u00b7 klucz Twelve OK') : 'Zapisano ustawienia (bez klucza)', key ? 'ok' : 'info');
      });
    }
  }

  function boot() {
    injectCss();
    ensureKeyPanel();
    markAlpacaRows();
    patchFetch();
    bindOldButtons();
    var k = loadStoredKey();
    if (k) persistKey(k);

    global.toast = function (m, kind) {
      if (kind) return toast(m, kind);
      var msg = String(m || '');
      if (/ok|dzia\u0142a|zapisano|prawid\u0142owy/i.test(msg) && !/brak/i.test(msg)) return toast(msg, 'ok');
      if (/b\u0142\u0105d|error|z\u0142y|puste/i.test(msg)) return toast(msg, 'err');
      return toast(msg, 'info');
    };

    setInterval(function () {
      ensureKeyPanel();
      markAlpacaRows();
      patchFetch();
      bindOldButtons();
    }, 3000);
  }

  global.BTX_SETTINGS_FIX = { resolveKey: resolveKey, persistKey: persistKey, openSettings: openSettings, runProviderTest: runProviderTest };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
