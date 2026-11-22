/**
 * 4) Minimalne 3 karty sesji: najlepsza okazja / plan XTB / dlaczego 0 tradeow.
 */
(function (global) {
  'use strict';
  if (global.__BTX_DESK_CARDS__) return;
  global.__BTX_DESK_CARDS__ = true;

  var ROOT = 'btx-session-cards';

  function f2(x) {
    if (typeof global.f2 === 'function') return global.f2(x);
    return (Number(x) || 0).toFixed(2);
  }
  function xtbSym(sym) {
    try {
      if (global.BTX_XTB_MAP && global.BTX_XTB_MAP[sym]) return global.BTX_XTB_MAP[sym];
    } catch (e) {}
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym && list[i].xtb) return list[i].xtb;
    return sym;
  }
  function best() {
    var sig = (global.ST && global.ST.sig) || [];
    var best = null, score = -1;
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var sc = (g.strength || 0) * 10 + (g.desk && g.desk.score || 0);
      if (sc > score) { score = sc; best = g; }
    }
    return best;
  }
  function whyZero() {
    var ST = global.ST || {};
    var reasons = [];
    var w = (function () {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
      var map = {};
      fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
      return { min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10), weekend: /Sat|Sun/i.test(map.weekday || '') };
    })();
    if (w.weekend) reasons.push('weekend');
    var posN = ST.pos ? Object.keys(ST.pos).length : 0;
    var maxP = (global.CFG && global.CFG.maxPos) || 2;
    if (posN >= maxP) reasons.push('max pozycji (' + posN + '/' + maxP + ')');
    if (!(ST.cash > 0)) reasons.push('brak cash');
    var act = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    if (!act.length) reasons.push('brak sygnałów LONG/SHORT (filtry score/sesja)');
    else reasons.push('sygnały: ' + act.map(function (g) { return g.sym + ' ' + g.side; }).join(', '));
    if (ST.blocked) reasons.push('blokada dnia');
    if (!reasons.length) reasons.push('oczekiwanie na cykl / autonomia');
    return reasons.join(' · ');
  }
  function plan(g) {
    if (!g) return 'Brak okazji do planu.';
    var sd = g.sd || g.atr || (g.price || 0) * 0.004;
    var px = g.price || 0;
    var sl = g.side === 'LONG' ? px - sd : px + sd;
    var tp = g.side === 'LONG' ? px + 2 * sd : px - 2 * sd;
    return 'XTB ' + xtbSym(g.sym) + ' · ' + (g.side === 'LONG' ? 'KUP' : 'SPRZEDAJ') +
      ' · wejście ~' + f2(px) + ' · SL ' + f2(sl) + ' · TP ' + f2(tp) + ' · ' + (g.why || '');
  }
  function render() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))';
      var bar = document.getElementById('btx-desk-min-bar');
      if (bar && bar.parentNode === pane) bar.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild.nextSibling);
      else pane.appendChild(el);
    }
    var g = best();
    var posN = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
    var card = function (title, body, color) {
      return '<div style="padding:12px;border-radius:12px;border:1px solid ' + color + ';background:rgba(0,0,0,.28);font-size:12.5px;color:#e2e8f0;line-height:1.45">' +
        '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">' + title + '</div>' +
        '<div>' + body + '</div></div>';
    };
    var c1 = g
      ? '<b style="color:#fff;font-size:16px">' + g.sym + '</b> · <b style="color:' + (g.side === 'LONG' ? '#4ade80' : '#f87171') + '">' + g.side + '</b> · siła ' + (g.strength || 0) + '<br>' + (g.why || '')
      : 'Brak aktywnej okazji LONG/SHORT w ostatnim skanie.';
    var c2 = plan(g);
    var c3 = posN > 0 ? ('Otwarte pozycje: <b>' + posN + '</b> — zarządzaj SL/TP na XTB.') : ('0 trade’ów teraz: ' + whyZero());
    el.innerHTML = card('1. Najlepsza okazja', c1, 'rgba(96,165,250,.4)') +
      card('2. Plan XTB (skopiuj ręcznie)', c2, 'rgba(251,191,36,.35)') +
      card('3. Dlaczego 0 / status', c3, 'rgba(148,163,184,.35)');
  }

  function boot() {
    render();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(render, 'desk-cards');
    else setInterval(render, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1100); });
  else setTimeout(boot, 1100);
})(typeof window !== 'undefined' ? window : globalThis);
