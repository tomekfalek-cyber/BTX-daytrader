/**
 * Most XTB
 */
(function (global) {
  var ROOT = 'btx-xtb-bridge';
  function ensure() {
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-cfg');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(228,0,43,.28);background:rgba(228,0,43,.06)';
    pane.appendChild(el);
    return el;
  }
  function render() {
    var el = ensure();
    if (!el) return;
    var online = !!(global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected());
    el.innerHTML = '<h3 style="margin:0 0 8px;font-size:14px;color:#ffe4e8">Most XTB</h3>' +
      '<div style="font-size:12.5px;line-height:1.55;color:var(--tx2)">' +
      '<b>Status:</b> ' + (online ? 'xAPI ONLINE' : 'offline / handel reczny') + '<br><br>' +
      'Sygnal A/A+ i plan (SL/TP/size) \u2192 XTB recznie albo ARM na DEMO.<br>' +
      'CFD XTB: shorty akcji to CFD (koszty/swap inne niz cash equity).<br>' +
      'Checklist: dokumentacja xAPI, konto demo, 50 paper trades, limity risk.</div>';
  }
  function boot() { render(); setInterval(render, 5000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
