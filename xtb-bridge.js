/**
 * BTX ↔ XTB most — status uczciwy
 * Brak fałszywej automatyki. Opis oficjalnego API i checklista na przyszłość.
 */
(function (global) {
  function inject() {
    if (document.getElementById('btx-xtb-bridge')) return document.getElementById('btx-xtb-bridge');
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-cfg');
    if (!pane) return null;
    var el = document.createElement('div');
    el.id = 'btx-xtb-bridge';
    el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(228,0,43,.35);background:rgba(228,0,43,.06)';
    pane.appendChild(el);
    return el;
  }

  function render() {
    var el = inject();
    if (!el) return;
    var html = '';
    html += '<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#f87171;font-weight:700;margin-bottom:6px">Most XTB · automatyka</div>';
    html += '<h3 style="margin:0 0 8px;font-size:14px">Status: RĘCZNIE (bez auto-zleceń)</h3>';
    html += '<p style="font-size:12px;color:var(--tx2);line-height:1.5;margin:0 0 10px"><b>Po co ta karta:</b> żeby było jasne — bot <b>nie wysyła</b> zleceń do XTB. To świadomy wybór: uczysz się decyzji, a broker wykonuje to, co klikniesz Ty.</p>';
    html += '<div style="font-size:12.5px;line-height:1.55">';
    html += '<b>Jak działa dziś</b><br>';
    html += '1. BTX liczy sygnał i plan (size, SL, TP)<br>';
    html += '2. Kopiujesz plan przyciskiem<br>';
    html += '3. Składasz zlecenie w xStation / aplikacji XTB<br><br>';
    html += '<b>Kiedy automatyka miałaby sens</b><br>';
    html += '• Oficjalne API XTB (xAPI / dokumentacja dla konta, które je wspiera)<br>';
    html += '• Osobny klucz API + reguły risk po stronie klienta<br>';
    html += '• Testy na koncie demo brokera, nie od razu real<br>';
    html += '• Zgodność z regulaminem XTB (nie każde konto / kraj = to samo)<br><br>';
    html += '<b>Czego nie robimy teraz</b><br>';
    html += '• Nie logujemy się hasłem do XTB z poziomu strony GitHub Pages<br>';
    html += '• Nie obchodzimy API "półoficjalnymi" skryptami<br>';
    html += '• Nie obiecujemy auto-profit<br><br>';
    html += '<b>Checklist na przyszłość (gdy będziesz gotowy)</b><br>';
    html += '[ ] Przeczytana oficjalna dokumentacja xAPI XTB<br>';
    html += '[ ] Konto z dostępem API / demo
<br>';
    html += '[ ] Min. 50 paper trades BTX z journalem<br>';
    html += '[ ] Twarde limity risk w kodzie mostu<br>';
    html += '[ ] Świadoma zgoda: automatyka też traci</div>';
    html += '<div style="margin-top:10px;font-size:12px;color:var(--tx3)">Na dziś najlepszy "most" to: sygnał A+ → kopiuj plan → ręczne XTB → wpis w journalu.</div>';
    el.innerHTML = html;
  }

  function boot() {
    render();
    setInterval(render, 15000);
  }
  global.BTX_XTB_BRIDGE = { status: 'manual', render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
