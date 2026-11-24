/**
 * Radar vs kolejka — zawsze widoczny na Pulpicie.
 */
(function (global) {
  'use strict';
  if (global.__BTX_SKIP_UI__) return;
  global.__BTX_SKIP_UI__ = true;

  var ROOT = 'btx-skip-panel';
  var last = '';

  function ensureEl() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      // na samej gorze pulpitu
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    el.classList.remove('btx-desk-hidden');
    el.removeAttribute('data-slim-off');
    el.style.cssText = [
      'display:block!important',
      'visibility:visible!important',
      'opacity:1!important',
      'margin:10px 0',
      'padding:14px 16px',
      'border-radius:12px',
      'border:2px solid #fbbf24',
      'background:linear-gradient(135deg,rgba(69,26,3,.95),rgba(20,15,0,.95))',
      'font-size:13px',
      'color:#fde68a',
      'line-height:1.5',
      'z-index:20',
      'position:relative'
    ].join(';');
    return el;
  }

  function render() {
    var el = ensureEl();
    if (!el) return;

    var ranked = [];
    try {
      if (global.BTX_ENTRY && typeof global.BTX_ENTRY.rankTop === 'function') {
        ranked = global.BTX_ENTRY.rankTop() || [];
      } else if (global.ST && global.ST.sig) {
        ranked = (global.ST.sig || [])
          .filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); })
          .map(function (g) { return { g: g, q: (g.strength || 0) * 20 }; })
          .sort(function (a, b) { return b.q - a.q; });
      }
    } catch (e) {}

    var lines = [];
    lines.push('<div style="font-size:15px;font-weight:800;color:#fef3c7;margin-bottom:8px">RADAR SYGNAŁÓW → KOLEJKA OTWARCIA</div>');
    lines.push('<div style="color:#fcd34d;margin-bottom:8px;font-size:12px">To nie jest zakładka „Sygnały”. Tu widać, czy setup może wejść w pozycję, czy jest SKIP.</div>');

    if (!ranked.length) {
      lines.push('<div>Brak LONG/SHORT w tym cyklu — radar pusty (czekam na skan / sesję).</div>');
    } else {
      ranked.slice(0, 6).forEach(function (r, idx) {
        var g = r.g;
        var skip = '';
        try {
          if (global.BTX_ENTRY && global.BTX_ENTRY.skipReason) skip = global.BTX_ENTRY.skipReason(g) || '';
        } catch (e2) {}
        var tag = skip
          ? ('<span style="color:#f87171;font-weight:700">SKIP: ' + skip + '</span>')
          : '<span style="color:#4ade80;font-weight:700">W KOLEJCE / może OPEN</span>';
        lines.push('<div style="margin:4px 0">' + (idx + 1) + '. <b style="color:#fff">' + g.sym + '</b> ' +
          g.side + ' · siła ' + (g.strength || 0) + ' — ' + tag + '</div>');
      });
    }

    var html = lines.join('');
    if (html === last) return;
    last = html;
    el.innerHTML = html;
  }

  function boot() {
    render();
    setInterval(render, 3000);
    // po zmianie taba na pulpit — odswiez
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var b = t.closest && t.closest('[data-tab="desk"]');
      if (b) setTimeout(render, 100);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  else setTimeout(boot, 500);
})(typeof window !== 'undefined' ? window : globalThis);
