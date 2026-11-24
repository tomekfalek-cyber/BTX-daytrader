/**
 * Budżet API Twelve — ostrzeżenie przy 11 symbolach / free tier
 */
(function (global) {
  var LS = 'BTX_API_HITS';
  var ROOT = 'btx-api-budget';

  function dayKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  }

  function state() {
    try {
      var o = JSON.parse(localStorage.getItem(LS) || '{}');
      if (o.day !== dayKey()) return { day: dayKey(), hits: 0, errs: 0 };
      return o;
    } catch (e) {
      return { day: dayKey(), hits: 0, errs: 0 };
    }
  }

  function save(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {}
  }

  function hit(ok) {
    var o = state();
    o.hits = (o.hits || 0) + 1;
    if (!ok) o.errs = (o.errs || 0) + 1;
    save(o);
  }

  function estimateDaily() {
    var n = (global.SYMBOLS || []).length || 11;
    var sec = (global.CFG && global.CFG.autoSec) || 180;
    // przybliżenie: pełny skan wszystkich symboli co autoSec, sesja ~8h
    var scansPerHour = 3600 / sec;
    var hours = 8;
    return Math.round(n * scansPerHour * hours);
  }

  function patchFetch() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__budget) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      try {
        var r = await orig.apply(this, arguments);
        hit(true);
        return r;
      } catch (e) {
        hit(false);
        throw e;
      }
    };
    global.fetchReal.__budget = true;
  }

  function render() {
    var el = document.getElementById(ROOT);
    if (!el) {
      var pane = document.getElementById('pane-cfg') || document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(251,191,36,.4);background:rgba(245,158,11,.1);font-size:12.5px;color:#fde68a;line-height:1.5';
      pane.appendChild(el);
    }
    var o = state();
    var n = (global.SYMBOLS || []).length || 11;
    var est = estimateDaily();
    var freeHint = 800; // orientacyjny darmowy limit dzienny Twelve (zależy od planu)
    var warn = est > freeHint * 0.8 || o.hits > freeHint * 0.8;
    el.innerHTML =
      '<b>Budżet API (Twelve)</b><br>' +
      'Symboli: <b>' + n + '</b> · Auto co ' + ((global.CFG && global.CFG.autoSec) || 180) + 's<br>' +
      'Szacunek requestów / dzień (~8h skanu): <b>' + est + '</b><br>' +
      'Licznik dziś (fetchReal): <b>' + (o.hits || 0) + '</b> · błędy: ' + (o.errs || 0) + '<br>' +
      (warn
        ? '<span style="color:#fecaca"><b>Uwaga:</b> przy free tier 11 symboli może wyczerpać limit. Zwiększ interwał (np. 240–300s) albo profil RANO/US zamiast ALL.</span>'
        : '<span style="color:#bbf7d0">Szacunek w rozsądnym limicie przy 180s+ — i tak obserwuj błędy API.</span>');
  }

  function boot() {
    patchFetch();
    render();
    setInterval(function () { patchFetch(); render(); }, 5000);
  }

  global.BTX_API_BUDGET = { state: state, estimateDaily: estimateDaily, hit: hit };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
