/**
 * Most XTB — status i zasady (bez prostackiego auto-hacku)
 */
(function (global) {
  var ROOT = 'btx-xtb-bridge';
  var STYLE = 'btx-xtb-bridge-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent =
      '#' + ROOT + '{margin:12px 0;padding:14px 16px;border-radius:14px;' +
      'border:1px solid rgba(228,0,43,.28);background:rgba(228,0,43,.06)}' +
      '#' + ROOT + ' h3{margin:0 0 8px;font-size:14px;color:#ffe4e8}' +
      '#' + ROOT + ' .why{font-size:12.5px;line-height:1.55;color:var(--tx2)}';
    document.head.appendChild(s);
  }

  function ensure() {
    injectCss();
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-cfg');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    pane.appendChild(el);
    return el;
  }

  function render() {
    var el = ensure();
    if (!el) return;
    var online = !!(global.BTX_XTB_API && global.BTX_XTB_API.isConnected && global.BTX_XTB_API.isConnected());
    var html = '';
    html += '<h3>Most XTB</h3>';
    html += '<div class="why">';
    html += '<b>Status:</b> ' + (online ? 'xAPI ONLINE' : 'offline / handel ręczny') + '<br><br>';
    html += '<b>Jak działa dziś</b><br>';
    html += '• Bot daje sygnał A/A+ i plan (wejście, SL, TP, size)<br>';
    html += '• Ty składasz zlecenie w xStation albo uzbroisz XTB ARM (DEMO!)<br><br>';
    html += '<b>Co jest potrzebne do automatyki</b><br>';
    html += '• Oficjalne API XTB (xAPI / dokumentacja dla konta, które je wspiera)<br>';
    html += '• Osobny klucz API + reguły risk po stronie klienta<br>';
    html += '• Testy na koncie demo brokera, nie od razu real<br>';
    html += '• Zgodność z regulaminem XTB (nie każde konto / kraj = to samo)<br><br>';
    html += '<b>Czego nie robimy teraz</b><br>';
    html += '• Nie obchodzimy API półoficjalnymi skryptami<br>';
    html += '• Nie obiecujemy auto-profit<br><br>';
    html += '<b>Checklist na przyszłość</b><br>';
    html += '[ ] Przeczytana oficjalna dokumentacja xAPI XTB<br>';
    html += '[ ] Konto z dostępem API / demo<br>';
    html += '[ ] Min. 50 paper trades BTX z journalem<br>';
    html += '[ ] Twarde limity risk w kodzie mostu<br>';
    html += '[ ] Świadoma zgoda: automatyka też traci</div>';
    html += '<div style="margin-top:10px;font-size:12px;color:var(--tx3)">Na dziś najlepszy most: sygnał A+ → kopiuj plan → ręczne XTB → journal.</div>';
    el.innerHTML = html;
  }

  function boot() {
    render();
    setInterval(render, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
