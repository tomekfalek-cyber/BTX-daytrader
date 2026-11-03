/**
 * Profile sesji: RANO (EU+FX) / US / ALL
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

  function patchEvaluateLoop() {
    // openPos / autonomy rank już dostaną odfiltrowane sig
    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals && !global.BTX_AUTONOMY.rankSignals.__prof) {
      var orig = global.BTX_AUTONOMY.rankSignals;
      global.BTX_AUTONOMY.rankSignals = function () {
        var ranked = orig.apply(this, arguments) || [];
        return ranked.filter(function (r) { return r && r.g && allowedSym(r.g.sym); });
      };
      global.BTX_AUTONOMY.rankSignals.__prof = true;
    }
  }

  function render() {
    var el = document.getElementById(ROOT);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(96,165,250,.35);background:rgba(37,99,235,.1);font-size:12.5px;color:#dbeafe';
      var hero = document.getElementById('btx-trade-hero');
      if (hero && hero.parentNode === pane) hero.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var p = getProfile();
    var allowed = filterSymbols().map(function (m) { return m.s; }).join(', ');
    el.innerHTML =
      '<b>Profil sesji</b> · które rynki skanuje bot<br>' +
      '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px">' +
      btn('RANO', p) + btn('US', p) + btn('ALL', p) +
      '</div>' +
      '<div style="margin-top:8px;opacity:.9">Teraz: <b>' + p + '</b> → ' + allowed + '</div>' +
      '<div style="margin-top:4px;font-size:11px;opacity:.75">RANO = EU+FX (~9–17:30). US = akcje/ETF US+FX (od ~15:30). ALL = wszystko w swoich godzinach.</div>';

    ['RANO', 'US', 'ALL'].forEach(function (name) {
      var b = document.getElementById('btx-prof-' + name);
      if (b) b.onclick = function () {
        setProfile(name);
        if (global.toast) global.toast('Profil: ' + name, 'ok');
        render();
      };
    });
  }

  function btn(name, cur) {
    var on = name === cur;
    return '<button type="button" class="btn" id="btx-prof-' + name + '" style="' +
      (on ? 'background:#2563eb;color:#fff;' : '') + '">' + name + (on ? ' ✓' : '') + '</button>';
  }

  function boot() {
    patchSignals();
    patchEvaluateLoop();
    render();
    setInterval(function () {
      patchSignals();
      patchEvaluateLoop();
      render();
    }, 4000);
  }

  global.BTX_PROFILE = {
    get: getProfile,
    set: setProfile,
    allowedSym: allowedSym,
    filterSymbols: filterSymbols
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
