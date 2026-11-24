/**
 * Panel: dlaczego 0 pozycji — diagnostyka + skan.
 */
(function (global) {
  'use strict';
  if (global.__BTX_WHY_ZERO__) return;
  global.__BTX_WHY_ZERO__ = true;

  var ROOT = 'btx-why-zero';

  function reasons() {
    var out = [];
    var ST = global.ST || {};
    var nPos = Object.keys(ST.pos || {}).length;
    if (nPos > 0) out.push('OK: otwarte pozycje: ' + nPos);

    var auto = false;
    try { auto = localStorage.getItem('BTX_AUTONOMY_ON') === '1'; } catch (e) {}
    if (!auto) out.push('Autonomia paper OFF — włącz na Pulpicie');

    var liveOk = 0, liveN = 0;
    try {
      if (global.BTX_LIVE && global.SYMBOLS) {
        (global.SYMBOLS || []).forEach(function (m) {
          liveN++;
          if (global.BTX_LIVE.isFresh && global.BTX_LIVE.isFresh(m.s)) liveOk++;
        });
      }
    } catch (e2) {}
    if (liveN && liveOk === 0) out.push('Brak świeżych cen LIVE (0/' + liveN + ') — klucz Twelve + poczekaj');
    else if (liveN) out.push('LIVE: ' + liveOk + '/' + liveN);

    var sig = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    out.push('Sygnały LONG/SHORT: ' + sig.length);
    if (!sig.length) out.push('Brak sygnałów strategii — kliknij skan');

    if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
      try {
        var r = global.BTX_AUTONOMY.rankSignals() || [];
        var pass = r.filter(function (x) { return x.gr && x.gr.pass; });
        out.push('Signal Desk PASS: ' + pass.length + ' / ' + r.length);
        if (r.length && !pass.length && r[0].gr) {
          out.push('Najlepszy odrzut: ' + r[0].g.sym + ' — ' + (r[0].gr.reasons || []).join('; '));
        }
      } catch (e3) {}
    }

    if ((ST.dayTrades || 0) >= ((global.CFG && global.CFG.maxTrades) || 6)) {
      out.push('Limit transakcji dnia wyczerpany');
    }
    if (ST.blocked) out.push('ST.blocked=true');

    var prof = 'ALL';
    try {
      if (global.BTX_SESSION_PROFILE) prof = global.BTX_SESSION_PROFILE.get();
    } catch (e4) {}
    out.push('Profil sesji: ' + prof);
    return out;
  }

  function ensure() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(251,191,36,.4);background:rgba(120,53,15,.18);font-size:12.5px;color:#fde68a;line-height:1.55';
      pane.appendChild(el);
      el.addEventListener('click', function (ev) {
        if (ev.target && ev.target.id === 'btx-why-scan') {
          try {
            localStorage.setItem('BTX_AUTONOMY_ON', '1');
            if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.start) global.BTX_AUTONOMY.start();
            if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.tick) global.BTX_AUTONOMY.tick();
            else if (typeof global.cycle === 'function') global.cycle();
            if (global.toast) global.toast('Skan + autonomia ON', 'ok');
            render();
          } catch (e) {}
        }
      });
    }
    return el;
  }

  function render() {
    var el = ensure();
    if (!el) return;
    var rs = reasons();
    var html = '<b style="color:#fbbf24">Dlaczego 0 pozycji?</b><ul style="margin:6px 0 8px 18px">';
    rs.forEach(function (r) { html += '<li>' + r + '</li>'; });
    html += '</ul>';
    html += '<button type="button" id="btx-why-scan" style="cursor:pointer;padding:8px 12px;border:0;border-radius:8px;background:#d97706;color:#111;font-weight:700">Włącz autonomię + skan teraz</button>';
    el.innerHTML = html;
  }

  function boot() {
    render();
    setInterval(render, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
