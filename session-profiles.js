/**
 * Profile sesji + loadExtras (master fix na końcu).
 */
(function (global) {
  var LS = 'BTX_SESSION_PROFILE';
  var LS_AUTO = 'BTX_SESSION_AUTO';
  var ROOT = 'btx-session-profile';

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

  function suggestedProfile() {
    var w = warsaw();
    if (w.weekend) return 'ALL';
    if (w.min >= 9 * 60 && w.min < 15 * 60 + 30) return 'RANO';
    if (w.min >= 15 * 60 + 30 && w.min < 22 * 60) return 'US';
    return 'ALL';
  }

  function autoOn() {
    try { return localStorage.getItem(LS_AUTO) !== '0'; } catch (e) { return true; }
  }
  function setAuto(on) {
    try { localStorage.setItem(LS_AUTO, on ? '1' : '0'); } catch (e) {}
  }
  function getProfile() {
    if (autoOn()) {
      var s = suggestedProfile();
      try { localStorage.setItem(LS, s); } catch (e) {}
      return s;
    }
    try { return localStorage.getItem(LS) || suggestedProfile(); } catch (e) { return 'ALL'; }
  }
  function setProfile(p) {
    if (['RANO', 'US', 'ALL'].indexOf(p) < 0) p = 'ALL';
    try { localStorage.setItem(LS, p); } catch (e) {}
  }

  function mktOf(sym) {
    var list = (global.BTX_CANON && global.BTX_CANON.list) || (global.SYMBOLS || []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].s === sym) return list[i].mkt || 'US';
    }
    if (/EUR|XAU|GOLD/.test(sym)) return 'FX';
    if (/ASML|SAP|SIE/.test(sym)) return 'EU';
    return 'US';
  }

  function allowedSym(sym) {
    var p = getProfile();
    var m = mktOf(sym);
    if (p === 'ALL') return true;
    if (p === 'RANO') return m === 'EU' || m === 'FX' || m === 'PL';
    if (p === 'US') return m === 'US' || m === 'FX';
    return true;
  }

  function patchSignals() {
    if (typeof global.signals !== 'function' || global.signals.__prof) return;
    var orig = global.signals;
    global.signals = function () {
      var out = orig.apply(this, arguments) || [];
      return out.filter(function (g) { return g && allowedSym(g.sym); });
    };
    global.signals.__prof = true;
  }

  function patchRank() {
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals && !global.BTX_AUTONOMY.rankSignals.__prof) {
      var orig = global.BTX_AUTONOMY.rankSignals;
      global.BTX_AUTONOMY.rankSignals = function () {
        var ranked = orig.apply(this, arguments) || [];
        return ranked.filter(function (r) { return r && r.g && allowedSym(r.g.sym); });
      };
      global.BTX_AUTONOMY.rankSignals.__prof = true;
    }
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__prof) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      if (g && g.sym && !allowedSym(g.sym)) return;
      return orig.apply(this, arguments);
    };
    global.openPos.__prof = true;
  }

  function ensureHost() {
    var el = document.getElementById(ROOT);
    var pane = document.getElementById('pane-desk');
    if (!pane) return el;
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'display:block;margin:0 0 14px;padding:14px 16px;border-radius:14px;border:2px solid #3b82f6;background:linear-gradient(180deg,#1e3a5f,#0f172a);font-size:13px;color:#e2e8f0;z-index:50';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    return el;
  }

  function render() {
    var el = ensureHost();
    if (!el) return;
    var p = getProfile();
    var w = warsaw();
    el.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">' +
      '<div><b style="color:#93c5fd">Profil sesji</b> \u00b7 ' + w.label + ' PL</div>' +
      '<div style="display:flex;gap:6px">' +
      ['RANO', 'US', 'ALL'].map(function (x) {
        var on = p === x;
        return '<button type="button" data-p="' + x + '" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:0;font-weight:700;' +
          (on ? 'background:#2563eb;color:#fff' : 'background:#334155;color:#e2e8f0') + '">' + x + '</button>';
      }).join('') + '</div></div>';
    el.querySelectorAll('button[data-p]').forEach(function (btn) {
      btn.onclick = function () {
        setAuto(false);
        setProfile(btn.getAttribute('data-p'));
        render();
      };
    });
  }

  function loadExtras() {
    var files = [
      'readiness.js', 'pass-telegram-only.js', 'stop-day-control.js', 'status-fix.js',
      'why-zero.js', 'currency-ui.js', 'fix-learner-gate.js', 'force-paper-trade.js'
    ]; // usuniete: trade-path-boot / paper-open-engine / btx-master-fix (co 5-8 s nadpisywaly progi starymi wartosciami i ustawialy ST.blocked)
    files.forEach(function (src) {
      try {
        if (!document.querySelector('script[src*="' + src + '"]')) {
          var el = document.createElement('script');
          el.src = src + '?v=master3';
          (document.body || document.documentElement).appendChild(el);
        }
      } catch (e) {}
    });
    try {
      localStorage.setItem('BTX_TRADE_MODE', 'trade');
      localStorage.setItem('BTX_ALLOW_STOP_DAY', '0');
      localStorage.setItem('BTX_AUTONOMY_ON', '1');
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
      localStorage.removeItem('BTX_STOP_DAY');
    } catch (e2) {}
  }

  function boot() {
    getProfile();
    patchSignals();
    patchRank();
    patchOpen();
    render();
    loadExtras();
    setInterval(function () {
      patchSignals();
      patchRank();
      patchOpen();
    }, 30000);
  }

  global.BTX_SESSION_PROFILE = { get: getProfile, set: setProfile, allowed: allowedSym, suggested: suggestedProfile, autoOn: autoOn };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
