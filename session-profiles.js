/**
 * Profile sesji: RANO / US / ALL — zawsze widoczny na górze Pulptu
 */
(function (global) {
  var LS = 'BTX_SESSION_PROFILE';
  var ROOT = 'btx-session-profile';

  function getProfile() {
    try { return localStorage.getItem(LS) || 'ALL'; } catch (e) { return 'ALL'; }
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

  function filterSymbols(list) {
    list = list || global.SYMBOLS || [];
    return list.filter(function (m) { return allowedSym(m.s || m); });
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

  function ensureHost() {
    var el = document.getElementById(ROOT);
    if (el && el.parentNode) return el;

    el = document.createElement('div');
    el.id = ROOT;
    el.style.cssText = [
      'display:block!important;visibility:visible!important;opacity:1!important;',
      'margin:0 0 14px!important;padding:14px 16px;border-radius:14px;',
      'border:2px solid #3b82f6!important;',
      'background:linear-gradient(180deg,#1e3a5f,#0f172a)!important;',
      'font-size:13px;color:#e2e8f0;position:relative;z-index:50;',
      'box-shadow:0 8px 24px rgba(37,99,235,.3)'
    ].join('');

    var pane = document.getElementById('pane-desk');
    if (pane) {
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
      return el;
    }
    var nav = document.querySelector('.nav');
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(el, nav.nextSibling);
      return el;
    }
    document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  function render() {
    var el = ensureHost();
    if (!el) return;
    // trzymaj na samej górze pulpitu
    var pane = document.getElementById('pane-desk');
    if (pane && el.parentNode === pane && pane.firstChild !== el) {
      pane.insertBefore(el, pane.firstChild);
    }

    var p = getProfile();
    var allowed = filterSymbols().map(function (m) { return m.s; }).join(', ');

    function btn(name) {
      var on = name === p;
      return '<button type="button" id="btx-prof-' + name + '" style="' +
        'cursor:pointer;border:0;border-radius:10px;padding:10px 16px;font-weight:800;font-size:13px;' +
        (on ? 'background:#2563eb;color:#fff;' : 'background:rgba(255,255,255,.1);color:#cbd5e1;') +
        '">' + name + (on ? ' \u2713' : '') + '</button>';
    }

    el.innerHTML =
      '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd;font-weight:800;margin-bottom:8px">Profil sesji</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">' +
      btn('RANO') + btn('US') + btn('ALL') +
      '</div>' +
      '<div><b>Aktywny: ' + p + '</b> \u2192 ' + (allowed || '\u2014') + '</div>' +
      '<div style="margin-top:4px;font-size:11px;color:#94a3b8">RANO = EU+FX \u00b7 US = akcje US+FX \u00b7 ALL = wszystko</div>';

    ['RANO', 'US', 'ALL'].forEach(function (name) {
      var b = document.getElementById('btx-prof-' + name);
      if (b) b.onclick = function () {
        setProfile(name);
        if (global.toast) global.toast('Profil sesji: ' + name, 'ok');
        else alert('Profil sesji: ' + name);
        render();
      };
    });
  }

  function boot() {
    patchSignals();
    patchRank();
    render();
    document.querySelectorAll('button[data-tab]').forEach(function (btn) {
      if (btn.__profBound) return;
      btn.__profBound = true;
      btn.addEventListener('click', function () {
        setTimeout(render, 40);
        setTimeout(render, 250);
      });
    });
    setInterval(function () {
      patchSignals();
      patchRank();
      render();
    }, 2500);
  }

  global.BTX_PROFILE = {
    get: getProfile,
    set: setProfile,
    allowedSym: allowedSym,
    filterSymbols: filterSymbols
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  if (global.addEventListener) global.addEventListener('load', function () { setTimeout(boot, 80); });
})(typeof window !== 'undefined' ? window : globalThis);
