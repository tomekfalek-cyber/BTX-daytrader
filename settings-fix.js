/**
 * BTX settings fix — zielony toast + nie kasuj klucza Twelve przy zapisie
 */
(function (global) {
  var STYLE = 'btx-settings-fix-css';

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
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast on ' + (kind || 'ok');
    clearTimeout(t._btxTimer);
    t._btxTimer = setTimeout(function () { t.className = 'toast'; }, 2800);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }
  function num(id, def) {
    var n = Number(val(id));
    return isFinite(n) ? n : def;
  }

  function readTwelveKey() {
    var fromInput = String(val('set-tdkey') || '').trim();
    var fromCfg = '';
    if (global.CFG) {
      fromCfg = String(global.CFG.tdKey || global.CFG.twelveKey || global.CFG.apiKey || '').trim();
    }
    // pole password bywa "puste" w DOM mimo zapisanego klucza — nie kasuj
    return fromInput || fromCfg;
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

    var key = readTwelveKey();
    CFG.tdKey = key;
    CFG.twelveKey = key;

    CFG.workerUrl = String(val('set-worker') || CFG.workerUrl || '').trim();
    CFG.provider = val('set-prov') || CFG.provider || 'twelve';
    CFG.minHold = num('set-minhold', CFG.minHold || 6);
    CFG.autoSec = num('set-autosec', CFG.autoSec || 180);
    CFG.timeStop = num('set-tstop', CFG.timeStop || 60);

    var alpIn = String(val('set-alpkey') || '').trim();
    var alpSecIn = String(val('set-alpsec') || '').trim();
    if (alpIn) CFG.alpKey = alpIn;
    if (alpSecIn) CFG.alpSec = alpSecIn;

    if (global.ST && global.ST.eq && !global.ST.eq.length) {
      global.ST.equity = CFG.capital;
      global.ST.cash = CFG.capital;
    }

    // przywróć widok pola (jeśli przeglądarka wyczyściła password)
    var keyEl = document.getElementById('set-tdkey');
    if (keyEl && key && !String(keyEl.value || '').trim()) {
      keyEl.value = key;
    }

    if (typeof global.save === 'function') global.save();
    else {
      try { localStorage.setItem('btx_v4', JSON.stringify({ ST: global.ST, CFG: CFG })); } catch (e) {}
    }
    if (typeof global.log === 'function') global.log('Zapisano ustawienia', 'i');
    if (typeof global.render === 'function') global.render();
    return CFG;
  }

  function bindSave() {
    var btn = document.getElementById('btn-save');
    if (!btn || btn.__btxSaveFix) return;
    btn.addEventListener('click', function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      try {
        var CFG = applySettings();
        var prov = CFG.provider || 'twelve';
        var key = String(CFG.tdKey || '').trim();
        if (prov === 'twelve' && key) {
          toast('Zapisano · Twelve Data OK · klucz aktywny · Auto ' + (CFG.autoSec || 180) + 's', 'ok');
        } else if (prov === 'twelve' && !key) {
          toast('Zapisano ustawienia — brak klucza Twelve Data w polu i pamięci', 'info');
        } else if (prov === 'alpaca') {
          toast(CFG.alpKey && CFG.alpSec ? 'Zapisano · Alpaca OK' : 'Zapisano — uzupełnij klucz/sekret Alpaca', CFG.alpKey && CFG.alpSec ? 'ok' : 'info');
        } else {
          toast('Zapisano ustawienia', 'ok');
        }
      } catch (err) {
        try { console.warn('save settings', err); } catch (e2) {}
        toast('Błąd zapisu: ' + (err && err.message ? err.message : 'nieznany'), 'err');
      }
    }, true);
    btn.__btxSaveFix = true;
  }

  function patchToast() {
    global.toast = function (m, kind) {
      if (kind) return toast(m, kind);
      var msg = String(m || '');
      if (/zapisano|ok|udało|saved|aktywny/i.test(msg)) return toast(msg, 'ok');
      if (/błąd|error|nie udało/i.test(msg)) return toast(msg, 'err');
      return toast(msg, 'info');
    };
  }

  function boot() {
    injectCss();
    patchToast();
    bindSave();
    setInterval(bindSave, 2000);
  }

  global.BTX_SETTINGS_FIX = { toast: toast, applySettings: applySettings, readTwelveKey: readTwelveKey };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
