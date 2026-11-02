/**
 * BTX UI Plain Polish — wszystko zrozumiałe bez dokumentacji
 * Legenda, proste etykiety, opisy "co to / po co" przy panelach.
 */
(function (global) {
  var STYLE = 'btx-plain-ui-css';
  var ROOT = 'btx-plain-legend';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      /* czytelniejsze panele */
      '.pane .card h2{font-size:15px!important;letter-spacing:0!important;text-transform:none!important}',
      '.mut,.sub,.why{line-height:1.5!important}',
      /* pasek pomocy */
      '#btx-helpbar{position:sticky;top:0;z-index:40;padding:10px 14px;margin:0 0 12px;',
      'background:linear-gradient(90deg,#1a2332,#121820);border:1px solid rgba(255,255,255,.1);',
      'border-radius:12px;font-size:13px;color:#d5deea;line-height:1.45}',
      '#btx-helpbar b{color:#fff}',
      '#btx-helpbar .hint{color:#9fb0c3;font-size:12px;margin-top:4px}',
      /* legenda */
      '#' + ROOT + '{margin:12px 0;padding:14px 16px;border-radius:14px;',
      'border:1px solid rgba(147,197,253,.35);background:rgba(59,130,246,.08)}',
      '#' + ROOT + ' h3{margin:0 0 8px;font-size:15px;color:#e8f1ff}',
      '#' + ROOT + ' details{margin:6px 0;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px;background:rgba(0,0,0,.18)}',
      '#' + ROOT + ' summary{cursor:pointer;font-weight:700;font-size:13px;color:#e7eef8}',
      '#' + ROOT + ' details p{margin:8px 0 0;font-size:12.5px;line-height:1.55;color:#b7c4d4}',
      '#' + ROOT + ' .tag{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:6px}',
      '#' + ROOT + ' .tag.work{background:rgba(18,196,139,.2);color:#12c48b}',
      '#' + ROOT + ' .tag.wait{background:rgba(245,179,1,.18);color:#f5b301}',
      '#' + ROOT + ' .tag.block{background:rgba(240,68,82,.18);color:#f87171}',
      /* etykiety przy istniejących panelach */
      '.btx-explain{display:block;font-size:12px;color:#9fb0c3;line-height:1.45;margin:0 0 10px;padding:8px 10px;',
      'border-left:3px solid rgba(147,197,253,.55);background:rgba(59,130,246,.06);border-radius:0 8px 8px 0}',
      '.btx-explain b{color:#dce8f6}'
    ].join('');
    document.head.appendChild(s);
  }

  var GLOSSARY = [
    {
      q: 'Co robi ten bot w jednym zdaniu?',
      a: 'Pokazuje setupy daytradingowe (LONG/SHORT/WAIT), pilnuje reguł ryzyka i pomaga przygotować zlecenie na XTB. Sam nie musi klikać brokera — chyba że połączysz xAPI i świadomie uzbroisz XTB ARM.'
    },
    {
      q: 'PRACUJE / CZEKA / BLOKADA — co to znaczy?',
      a: '<span class="tag work">PRACUJE</span> sesja US + dane LIVE, może szukać wejść. '
        + '<span class="tag wait">CZEKA</span> za wcześnie/za późno na sesję albo weekend — analizuje, nie forsuj trade’ów. '
        + '<span class="tag block">BLOKADA</span> nie wolno nowych wejść (brak LIVE, news HIGH, STOP FOR DAY, kill switch).'
    },
    {
      q: 'DEMO vs LIVE',
      a: '<b>DEMO</b> = dane ćwiczeniowe / syntetyczne — uczysz się, ale nie traktuj jak prawdziwy rynek. <b>LIVE</b> = klucz Twelve działa i bot czyta realniejsze świece. Do poważnych decyzji chcesz LIVE.'
    },
    {
      q: 'Siła sygnału (np. 4/5) i Score',
      a: '<b>Siła</b> = jak mocno reguły "głosują" za LONG/SHORT. Od 4 w górę wolno rozważać wejście. <b>Score</b> = ocena biurka (dane, news, sesja, klastry…). Wejście paper zwykle od score 70+.'
    },
    {
      q: 'A+ / A / REJECT',
      a: '<b>A+</b> = najwyższa jakość (warto rozważyć). <b>A</b> = dopuszczalny. <b>REJECT</b> = odrzut — obok jest powód (np. news, brak LIVE, klaster). REJECT to też lekcja: uczysz się kiedy NIE wchodzić.'
    },
    {
      q: 'Autonomia paper',
      a: 'Bot sam skanuje i może otwierać/zamykać pozycje <b>ćwiczeniowe w bocie</b>. To nie jest automatycznie to samo co zlecenie na Twoim koncie XTB.'
    },
    {
      q: 'Plan XTB / schowek / kolejka',
      a: 'Gotowy tekst: co kupić/sprzedać, ile, gdzie SL i TP. Kopiujesz i składasz zlecenie w XTB ręcznie (albo gdy xAPI ONLINE + ARM).'
    },
    {
      q: 'STOP FOR DAY',
      a: 'Hamulec bezpieczeństwa: po większej stracie dnia albo serii strat bot mówi "dość na dziś". Chroni kapitał i głowę — nie "odbijaj się" emocjami.'
    },
    {
      q: 'Kill switch vs XTB ARM',
      a: '<b>Kill switch</b> = natychmiastowy stop nowych wejść. <b>XTB ARM</b> = świadoma zgoda, że po sygnale może pójść zlecenie przez API. Domyślnie ARM jest wyłączony — tak ma być.'
    },
    {
      q: 'Klastry / korelacja',
      a: 'NVDA, META, QQQ często chodzą razem. Bot nie pozwala ładować wielu pozycji z tego samego motywu — żeby jedna zła fala tech nie uderzyła kilka razy.'
    },
    {
      q: 'VPVR / strefy ceny i wolumenu',
      a: 'Pokazuje gdzie rynek dużo handlował (POC, Value Area). Wejście "w próżni" bywa gorsze niż przy strefie, którą rynek zna.'
    },
    {
      q: 'Playbook i tryb obserwacja',
      a: '<b>Playbook</b> = krótka odprawa dnia. <b>Obserwacja</b> = patrzysz i uczysz się bez klikania. Włącz handel dopiero gdy rozumiesz setup.'
    },
    {
      q: 'Jakiej kolejności używać codziennie?',
      a: '1) Spójrz na status asystenta (PRACUJE/CZEKA/BLOKADA). 2) Czy dane LIVE? 3) Playbook. 4) Signal Desk — tylko A/A+. 5) Plan XTB. 6) Po trade: journal Wszedłem/Pominąłem. 7) STOP albo KILL gdy trzeba.'
    }
  ];

  function helpText() {
    var st = 'Status: —';
    try {
      if (global.BTX_ASSISTANT && global.BTX_ASSISTANT.opsStatus) {
        var o = global.BTX_ASSISTANT.opsStatus();
        st = o.title + ' — ' + o.detail;
      }
    } catch (e) {}
    return st;
  }

  function ensureHelpbar() {
    var bar = document.getElementById('btx-helpbar');
    if (bar) return bar;
    var host = document.querySelector('main') || document.querySelector('.wrap') || document.body;
    bar = document.createElement('div');
    bar.id = 'btx-helpbar';
    if (host.firstChild) host.insertBefore(bar, host.firstChild);
    else host.appendChild(bar);
    return bar;
  }

  function renderHelpbar() {
    var bar = ensureHelpbar();
    if (!bar) return;
    bar.innerHTML = '<b>Jak czytać BTX teraz:</b> ' + helpText()
      + '<div class="hint">Zielony / PRACUJE = można szukać setupów · Żółty / CZEKA = ucz się, nie forsuj · Czerwony / BLOKADA = zero nowych wejść. Szczegóły rozwijasz w legendzie na Pulpicie.</div>';
  }

  function ensureLegend() {
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    // pod statusem asystenta jeśli jest
    var ops = document.getElementById('btx-ops');
    if (ops && ops.parentNode === pane) ops.after(el);
    else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
    else pane.appendChild(el);
    return el;
  }

  function renderLegend() {
    var el = ensureLegend();
    if (!el) return;
    var html = '<h3>Słowniczek BTX — co jest czym (kliknij, żeby rozwinąć)</h3>';
    html += '<p class="btx-explain" style="margin-top:0"><b>Po co ta sekcja:</b> żebyś nie musiał wracać do dokumentacji. Każde ważne słowo z dashboardu masz tu prostym językiem.</p>';
    GLOSSARY.forEach(function (g, i) {
      html += '<details' + (i === 0 ? ' open' : '') + '><summary>' + g.q + '</summary><p>' + g.a + '</p></details>';
    });
    el.innerHTML = html;
  }

  /** Doklej proste opisy do znanych paneli */
  function annotatePanels() {
    var map = [
      { id: 'btx-ops', text: '<b>Co to:</b> centrum dowodzenia. <b>Po co:</b> jednym rzutem oka wiesz czy bot pracuje, czeka na sesję, czy ma blokadę i dlaczego.' },
      { id: 'btx-qcap', text: '<b>Co to:</b> przegląd zdrowia systemu + hamulce. <b>Po co:</b> KILL = stop natychmiast. XTB ARM = zgoda na zlecenie przez API (domyślnie wyłącz).' },
      { id: 'btx-auto-panel', text: '<b>Co to:</b> autonomia paper i tabela ocen sygnałów. <b>Po co:</b> bot sam ćwiczy wejścia tylko wysokiej jakości; przy wejściu dostajesz plan pod XTB.' },
      { id: 'btx-pro6', text: '<b>Co to:</b> dane, klastry, news HIGH, plan XTB, review. <b>Po co:</b> mniej przypadkowych pozycji i czytelny plan zlecenia.' },
      { id: 'btx-learn', text: '<b>Co to:</b> pakiet nauki (playbook, tryb obserwacji, STOP, koszty, decyzje). <b>Po co:</b> budujesz nawyk profesjonalisty, nie hazardzisty.' },
      { id: 'btx-macro-cal', text: '<b>Co to:</b> kalendarz ważnych danych makro. <b>Po co:</b> nie wchodzisz w trade chwilę przed CPI/NFP/Fed.' },
      { id: 'btx-guide7', text: '<b>Co to:</b> plan nauki na 7 dni. <b>Po co:</b> wiesz co ćwiczyć każdego dnia zamiast chaotycznie klikać.' },
      { id: 'btx-xtb-bridge', text: '<b>Co to:</b> status mostu do XTB. <b>Po co:</b> jasno: ręcznie vs kiedy API miałoby sens.' },
      { id: 'btx-chart-ta', text: '<b>Co to:</b> lekcja analizy technicznej wybranego instrumentu. <b>Po co:</b> uczysz się czytać wykres pełnymi zdaniami, nie jednym skrótem wskaźnika.' },
      { id: 'btx-xtb-api', text: '<b>Co to:</b> logowanie do XTB xAPI (Account ID + hasło). <b>Po co:</b> test czy broker w ogóle przyjmuje połączenie z bota.' }
    ];
    map.forEach(function (m) {
      var el = document.getElementById(m.id);
      if (!el) return;
      if (el.querySelector('.btx-explain[data-plain="1"]')) return;
      var d = document.createElement('div');
      d.className = 'btx-explain';
      d.setAttribute('data-plain', '1');
      d.innerHTML = m.text;
      if (el.firstChild) el.insertBefore(d, el.firstChild);
      else el.appendChild(d);
    });

    // proste podpowiedzi przy selectach wykresu
    var chartInfo = document.getElementById('chart-info');
    if (chartInfo && !chartInfo.dataset.plain) {
      chartInfo.dataset.plain = '1';
      chartInfo.textContent = 'Wybierz 1 z 8 instrumentów — pod wykresem dostaniesz długą lekcję TA.';
    }
  }

  /** Uproszczone etykiety zakładek jeśli są techniczne */
  function softNavHints() {
    var tips = {
      desk: 'Pulpit — status, sygnały, nauka',
      chart: 'Wykres + lekcja',
      sig: 'Sygnały',
      mkt: 'Rynek',
      pos: 'Pozycje paper',
      ai: 'Analiza regułowa',
      bt: 'Backtest',
      cfg: 'Ustawienia (klucze, XTB)',
      log: 'Dziennik'
    };
    var btns = document.querySelectorAll('.nav button[data-tab]');
    btns.forEach(function (b) {
      var t = b.getAttribute('data-tab');
      if (tips[t] && !b.title) b.title = tips[t];
    });
  }

  function boot() {
    injectCss();
    renderHelpbar();
    renderLegend();
    annotatePanels();
    softNavHints();
    setInterval(function () {
      renderHelpbar();
      renderLegend();
      annotatePanels();
      softNavHints();
    }, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
