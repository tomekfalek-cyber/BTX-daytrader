/**
 * Radar vs kolejka + powody SKIP przy top sygnalach.
 */
(function (global) {
  'use strict';
  if (global.__BTX_SKIP_UI__) return;
  global.__BTX_SKIP_UI__ = true;

  var ROOT = 'btx-skip-panel';
  var last = '';

  function render() {
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-sig');
    if (!pane) return;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(251,191,36,.35);background:rgba(30,20,0,.35);font-size:12.5px;color:#fde68a;line-height:1.45';
      var host = document.getElementById('btx-session-cards');
      if (host && host.parentNode) host.after(el);
      else pane.insertBefore(el, pane.firstChild);
    }
    var ranked = (global.BTX_ENTRY && global.BTX_ENTRY.rankTop) ? global.BTX_ENTRY.rankTop() : [];
    var lines = [];
    lines.push('<b style="color:#fef3c7">Radar sygnałów</b> (informacja) vs <b style="color:#86efac">Kolejka otwarcia</b> (tylko to, co przechodzi filtry)');
    if (!ranked.length) {
      lines.push('Brak LONG/SHORT na radarze w tym cyklu.');
    } else {
      ranked.slice(0, 5).forEach(function (r, idx) {
        var g = r.g;
        var skip = (global.BTX_ENTRY && global.BTX_ENTRY.skipReason) ? global.BTX_ENTRY.skipReason(g) : '';
        var tag = skip
          ? ('<span style="color:#f87171">SKIP: ' + skip + '</span>')
          : '<span style="color:#4ade80">W KOLEJCE / może OPEN</span>';
        lines.push((idx + 1) + '. <b>' + g.sym + '</b> ' + g.side + ' siła ' + (g.strength || 0) + ' — ' + tag);
      });
    }
    var html = lines.join('<br>');
    if (html === last) return;
    last = html;
    el.innerHTML = html;
  }

  function boot() {
    render();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(render, 'skip-ui');
    else setInterval(render, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1600); });
  else setTimeout(boot, 1600);
})(typeof window !== 'undefined' ? window : globalThis);
