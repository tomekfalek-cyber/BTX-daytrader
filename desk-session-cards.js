/**
 * 3 karty sesji — krotkie, czytelne, bez spamu VPVR / drgania.
 */
(function (global) {
  'use strict';
  if (global.__BTX_DESK_CARDS__) return;
  global.__BTX_DESK_CARDS__ = true;

  var ROOT = 'btx-session-cards';
  var lastHtml = '';

  function openPosLevStrip() {
    var ST = global.ST || {};
    var pos = ST.pos || {};
    var keys = Object.keys(pos);
    if (!keys.length) return '<div style="margin-top:8px;font-size:12px;color:#94a3b8">Brak otwartych pozycji</div>';
    var html = '<div style="margin-top:10px">';
    keys.forEach(function (sym) {
      var p = pos[sym];
      if (!p) return;
      var lev = (p.lev != null && +p.lev > 0) ? +p.lev : 1;
      try {
        var list = global.SYMBOLS || [];
        var m = null;
        for (var i = 0; i < list.length; i++) if (list[i].s === sym) { m = list[i]; break; }
        if (m && m.mkt === 'FX') lev = (p.lev != null && +p.lev > 0) ? +p.lev : ((global.CFG && global.CFG.fxLev) || 20);
        else if (!(p.lev > 0)) lev = (global.CFG && global.CFG.eqLev) || 1;
      } catch (e) {}
      var lab = lev <= 1 ? '1× (bez dźwigni)' : (Math.round(lev) + '×');
      var col = lev > 1 ? '#fbbf24' : '#86efac';
      html += '<div style="margin:6px 0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.25);font-size:12.5px;color:#e2e8f0">';
      html += '<b style="color:#fff">' + sym + '</b> ' + (p.side || '') +
        ' · <span style="color:' + col + ';font-weight:800">DŹWIGNIA ' + lab + '</span>';
      if (p.margin != null) html += ' · margin ' + (Number(p.margin).toFixed(2));
      html += '</div>';
    });
    html += '</div>';
    return html;
  }


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

  /** Z surowego why robimy 1-2 zdania dla czlowieka */
  function cleanWhy(raw) {
    if (!raw) return 'Brak opisu setupu.';
    var s = String(raw);
    // wytnij powtorzenia VPVR
    s = s.replace(/(\s*[|·]\s*VPVR:[^|·]*)+/gi, function (m) {
      var one = m.match(/VPVR:[^|·]+/i);
      return one ? (' · ' + one[0].trim()) : '';
    });
    // unikalne fragmenty po separatorach
    var parts = s.split(/\s*[|·]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    var seen = {}, uniq = [];
    parts.forEach(function (p) {
      var k = p.toLowerCase();
      if (seen[k]) return;
      // pomijaj techniczny szum LIVE paper
      if (/seria \(brak LIVE/i.test(p)) return;
      if (/LIVE nieświeże|LIVE nieswieze/i.test(p)) {
        uniq.push('dane paper (LIVE słabe)');
        seen['dane paper'] = 1;
        return;
      }
      if (/ai ostroznie|ai-veto/i.test(p)) {
        uniq.push('AI ostrożnie');
        seen['ai'] = 1;
        return;
      }
      if (/^VPVR:/i.test(p)) {
        if (!seen['vpvr']) {
          uniq.push(p.replace(/^VPVR:\s*/i, 'strefa VPVR: '));
          seen['vpvr'] = 1;
        }
        return;
      }
      seen[k] = 1;
      uniq.push(p);
    });
    // max 4 krotkie punkty
    uniq = uniq.slice(0, 4);
    if (!uniq.length) return 'Setup techniczny bez dodatkowego opisu.';
    return uniq.join(' · ');
  }

  function humanSide(side) {
    return side === 'LONG' ? 'KUP (long)' : (side === 'SHORT' ? 'SPRZEDAJ (short)' : side);
  }

  function best() {
    var sig = (global.ST && global.ST.sig) || [];
    var best = null, score = -1;
    for (var i = 0; i < sig.length; i++) {
      var g = sig[i];
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) continue;
      var sc = (g.strength || 0) * 10 + ((g.desk && g.desk.score) || 0);
      if (sc > score) { score = sc; best = g; }
    }
    return best;
  }

  function whyZero() {
    var ST = global.ST || {};
    var reasons = [];
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    var weekend = /Sat|Sun/i.test(map.weekday || '');
    if (weekend) reasons.push('weekend — brak sesji');
    var posN = ST.pos ? Object.keys(ST.pos).length : 0;
    var maxP = (global.CFG && global.CFG.maxPos) || 2;
    if (posN >= maxP) reasons.push('zajęte wszystkie sloty pozycji (' + posN + '/' + maxP + ')');
    if (!(ST.cash > 0)) reasons.push('brak wolnego cash');
    var act = (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); });
    if (!act.length) reasons.push('brak wystarczająco mocnego sygnału');
    else reasons.push('są sygnały, czekam na autonomię / limity: ' + act.slice(0, 3).map(function (g) { return g.sym; }).join(', '));
    if (ST.blocked) reasons.push('włączona blokada dnia');
    return reasons.join(' · ') || 'oczekiwanie na kolejny skan';
  }

  function plan(g) {
    if (!g) return 'Brak okazji — nie kopiuj nic na XTB.';
    var sd = g.sd || g.atr || (g.price || 0) * 0.004;
    var px = +g.price || 0;
    var sl = g.side === 'LONG' ? px - sd : px + sd;
    var tp = g.side === 'LONG' ? px + 2 * sd : px - 2 * sd;
    var units = '';
    try {
      if (global.BTX_XTB_UNITS && g.qty != null) units = ' · ' + global.BTX_XTB_UNITS.unitLabel(g.sym, g.qty);
    } catch (e) {}
    return '<b>' + xtbSym(g.sym) + '</b> · ' + humanSide(g.side) +
      '<br>Wejście ok. <b>' + f2(px) + '</b> · SL <b>' + f2(sl) + '</b> · TP <b>' + f2(tp) + '</b>' + units +
      '<br><span style="color:#94a3b8">Paper → XTB 1:1: ten sam kierunek, SL/TP; wielkość i margin sprawdź w oknie brokera.</span>';
  }

  function card(title, body, color) {
    return '<div style="padding:12px;border-radius:12px;border:1px solid ' + color +
      ';background:rgba(0,0,0,.28);font-size:12.5px;color:#e2e8f0;line-height:1.45">' +
      '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">' + title + '</div>' +
      '<div>' + body + '</div></div>';
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
    var c1;
    if (g) {
      c1 = '<b style="color:#fff;font-size:16px">' + g.sym + '</b> · ' +
        '<b style="color:' + (g.side === 'LONG' ? '#4ade80' : '#f87171') + '">' + humanSide(g.side) + '</b>' +
        ' · siła <b>' + (g.strength || 0) + '</b>' +
        '<br><span style="color:#cbd5e1">' + cleanWhy(g.why) + '</span>';
    } else {
      c1 = 'Brak aktywnej okazji LONG/SHORT w ostatnim skanie.';
    }
    var c2 = plan(g);
    var c3 = posN > 0
      ? ('Otwarte pozycje: <b>' + posN + '</b> — zarządzaj SL/TP na XTB.')
      : ('0 trade’ów teraz: ' + whyZero());
    var html = card('1. Najlepsza okazja', c1, 'rgba(96,165,250,.4)') +
      card('2. Plan XTB (skopiuj ręcznie)', c2, 'rgba(251,191,36,.35)') +
      card('3. Dlaczego 0 / status', c3, 'rgba(148,163,184,.35)');
    // bez drgania: nie przepisuj DOM gdy to samo
    if (html === lastHtml) return;
    lastHtml = html;
    el.innerHTML = html + openPosLevStrip();
  }

  function boot() {
    render();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(render, 'desk-cards');
    else setInterval(render, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1100); });
  else setTimeout(boot, 1100);
})(typeof window !== 'undefined' ? window : globalThis);
