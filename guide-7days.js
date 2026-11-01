/** BTX — Plan 7 dni (tekst + pobranie .txt) */
(function (global) {
  var PLAN = [
    { d: 1, t: 'Instalacja i dane', a: 'Twelve LIVE, tryb obserwacja, Playbook. Sukces: znasz DEMO vs LIVE.' },
    { d: 2, t: 'Czytanie sygnału', a: 'Cykl, Coach, VPVR, checklista — bez XTB. Sukces: 1 zdanie "dlaczego".' },
    { d: 3, t: 'Plan XTB bez klikania', a: 'Kopiuj plan XTB, sprawdź pola SL/TP w brokerze. Bez transakcji.' },
    { d: 4, t: 'Paper z regułami', a: 'Tryb handel, 1–2 A+, oznacz Wszedłem/Pominąłem.' },
    { d: 5, t: 'News i emocje', a: 'Kalendarz HIGH, zero wejść w blackoucie, STOP gdy seria strat.' },
    { d: 6, t: 'Koszty i R', a: 'Spread/prowizja, R brutto vs netto, review tygodnia.' },
    { d: 7, t: 'Podsumowanie', a: 'Co powtarzasz / wyrzucasz. Bez podnoszenia ryzyka na tydzień 2.' }
  ];

  function inject() {
    if (document.getElementById('btx-guide7')) return document.getElementById('btx-guide7');
    var pane = document.getElementById('pane-desk') || document.getElementById('pane-cfg');
    if (!pane) return null;
    var el = document.createElement('div');
    el.id = 'btx-guide7';
    el.style.cssText = 'margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(59,130,246,.35);background:rgba(59,130,246,.08)';
    pane.appendChild(el);
    return el;
  }

  function fullText() {
    var lines = ['BTX DayTrader — plan na 7 dni', 'Handel XTB = ręcznie. Bot = sygnały + reguły ryzyka.', ''];
    PLAN.forEach(function (p) {
      lines.push('Dzień ' + p.d + ' — ' + p.t);
      lines.push(p.a);
      lines.push('');
    });
    lines.push('Zasady stałe: 0,5% risk, max 2 pos, max 4/dzień, A+, STOP FOR DAY.');
    lines.push('Pełna wersja: plik GUIDE-7-DAYS.md w repozytorium GitHub.');
    return lines.join('\n');
  }

  function render() {
    var el = inject();
    if (!el) return;
    var html = '<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;font-weight:700;margin-bottom:6px">Plan nauki · 7 dni</div>';
    html += '<div style="font-size:12px;color:var(--tx2);line-height:1.5;margin-bottom:10px"><b>Po co:</b> przez tydzień ćwiczysz proces (dane → sygnał → plan → decyzja), a nie "polowanie na zysk".</div>';
    html += '<ol style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.55;color:var(--tx)">';
    PLAN.forEach(function (p) {
      html += '<li style="margin-bottom:6px"><b>Dzień ' + p.d + ' — ' + p.t + '</b><br>' + p.a + '</li>';
    });
    html += '</ol>';
    html += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button type="button" class="btn" id="btx-dl-guide">Pobierz plan (.txt)</button>';
    html += '<a class="btn ghost" id="btx-md-guide" href="GUIDE-7-DAYS.md" target="_blank" rel="noopener">Otwórz GUIDE-7-DAYS.md</a>';
    html += '</div>';
    el.innerHTML = html;
    var b = document.getElementById('btx-dl-guide');
    if (b) b.onclick = function () {
      var blob = new Blob([fullText()], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'BTX-plan-7-dni.txt';
      a.click();
      if (global.toast) global.toast('Pobrano plan 7 dni', 'ok');
    };
  }

  function boot() {
    render();
    setInterval(render, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
