/**
 * Reczny przycisk "Otworz najlepszy setup" — przechodzi przez TE SAME bramki co automat (strategy-pro.gateCheck):
 * sesja, news, swieza cena LIVE, limity dnia, korelacja, koszty, rozmiar z marginem FX.
 * (Wczesniej omijal bramki i liczyl wielkosc pozycji na sztywno 0.35% bez przelicznika walut/lota.)
 */
(function (global) {
  'use strict';
  if (global.__BTX_FORCE_PAPER__) return;
  global.__BTX_FORCE_PAPER__ = true;

  function say(msg, k) {
    try { if (typeof global.log === 'function') global.log(msg, k || 'g'); } catch (e) {}
    try { if (global.toast) global.toast(msg, k === 'r' ? 'err' : 'ok'); } catch (e2) {}
  }

  function tryBest() {
    var ST = global.ST, P = global.BTX_STRATEGY_PRO || {};
    if (!ST) return;
    if (typeof global.cycle === 'function') { try { global.cycle(); } catch (e) {} }
    var min = P.minStrengthOpen || 3;
    var sig = (ST.sig || []).filter(function (g) {
      return g && (g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= min && !ST.pos[g.sym];
    }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    if (!sig.length) { say('Brak setupu o sile >= ' + min + ' — czekam', 'r'); return; }
    var n0 = Object.keys(ST.pos || {}).length;
    global.openPos(sig[0]);
    if (Object.keys(ST.pos || {}).length > n0) say('OTWARTO ' + sig[0].side + ' ' + sig[0].sym, 'g');
    else say('Bramka odrzucila ' + sig[0].sym + ' — powod w Logu (POMINIETO ...)', 'r');
  }

  function ensureBtn() {
    var pane = document.getElementById('pane-desk');
    if (!pane || document.getElementById('btx-force-open-btn')) return;
    var d = document.createElement('div');
    d.id = 'btx-force-open-wrap';
    d.style.cssText = 'margin:12px 0;padding:14px;border-radius:12px;border:1px solid rgba(18,196,139,.35);background:rgba(18,196,139,.08);';
    d.innerHTML = '<b style="color:#6ee7b7">Reczne otwarcie</b>' +
      '<div style="font-size:12px;color:#94a3b8;margin:6px 0 10px;line-height:1.45">Otwiera najlepszy aktualny setup, ale tylko jesli przejdzie wszystkie bramki bota (sesja, news, LIVE, limity, koszty).</div>' +
      '<button type="button" id="btx-force-open-btn" style="cursor:pointer;padding:10px 14px;border:0;border-radius:8px;background:#0d9488;color:#ecfdf5;font-weight:700">Otworz najlepszy setup (jesli przejdzie bramki)</button>';
    pane.insertBefore(d, pane.firstChild);
    document.getElementById('btx-force-open-btn').onclick = tryBest;
  }

  function boot() { ensureBtn(); setInterval(ensureBtn, 8000); }

  global.BTX_FORCE_PAPER = { tryForce: tryBest };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);