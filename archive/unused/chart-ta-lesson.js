/**
 * BTX — pełna, edukacyjna analiza techniczna pod wykresem
 * Dla wybranego instrumentu: długi, prosty opis do nauki (nie skrót wskaźników).
 */
(function (global) {
  var ROOT = 'btx-chart-ta';
  var STYLE = 'btx-chart-ta-css';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#' + ROOT + '{margin-top:14px;padding:16px 18px;border-radius:14px;',
      'border:1px solid var(--line,rgba(255,255,255,.08));',
      'background:linear-gradient(180deg,var(--bg3,#181d26),var(--bg2,#12161d));',
      'max-width:100%;line-height:1.65;font-size:13.5px;color:var(--tx,#c9d4e0)}',
      '#' + ROOT + ' h3{margin:0 0 8px;font-size:15px;color:#e8eef7}',
      '#' + ROOT + ' h4{margin:16px 0 6px;font-size:12px;letter-spacing:.08em;',
      'text-transform:uppercase;color:var(--tx3,#889);font-weight:700}',
      '#' + ROOT + ' p{margin:0 0 10px}',
      '#' + ROOT + ' .meta{font-size:12px;color:var(--tx2);margin-bottom:12px}',
      '#' + ROOT + ' .box{padding:10px 12px;border-radius:10px;margin:10px 0;',
      'background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.22)}',
      '#' + ROOT + ' .warn{background:rgba(245,179,1,.08);border-color:rgba(245,179,1,.28)}',
      '#' + ROOT + ' .risk{background:rgba(240,68,82,.08);border-color:rgba(240,68,82,.25)}',
      '#' + ROOT + ' ul{margin:6px 0 10px 18px;padding:0}',
      '#' + ROOT + ' li{margin-bottom:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  function bars(sym) {
    var ST = global.ST;
    if (!ST || !ST.series || !ST.series[sym]) return [];
    return ST.series[sym];
  }

  function sma(arr, n) {
    if (arr.length < n) return null;
    var s = 0;
    for (var i = arr.length - n; i < arr.length; i++) s += arr[i];
    return s / n;
  }

  function emaLast(arr, n) {
    if (arr.length < n) return null;
    var k = 2 / (n + 1), e = arr[0];
    for (var i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  }

  function atr(bs, n) {
    n = n || 14;
    if (bs.length < n + 1) return null;
    var trs = [];
    for (var i = 1; i < bs.length; i++) {
      var h = bs[i].h, l = bs[i].l, pc = bs[i - 1].c;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    var s = 0;
    for (var j = trs.length - n; j < trs.length; j++) s += trs[j];
    return s / n;
  }

  function rsi(closes, n) {
    n = n || 14;
    if (closes.length < n + 1) return null;
    var gains = 0, losses = 0;
    for (var i = closes.length - n; i < closes.length; i++) {
      var d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    if (losses < 1e-12) return 100;
    var rs = (gains / n) / (losses / n);
    return 100 - (100 / (1 + rs));
  }

  function swingLevels(bs, look) {
    look = look || 40;
    var slice = bs.slice(-look);
    var hi = -Infinity, lo = Infinity;
    slice.forEach(function (b) {
      if (b.h > hi) hi = b.h;
      if (b.l < lo) lo = b.l;
    });
    return { hi: hi, lo: lo };
  }

  function fmt(x, sym) {
    if (x == null || !isFinite(x)) return '—';
    var s = String(sym || '');
    if (/EUR|USD|GBP|JPY/.test(s) && !/XAU/.test(s)) return Number(x).toFixed(5);
    if (/XAU|GOLD/.test(s)) return Number(x).toFixed(2);
    return Number(x).toFixed(2);
  }

  function metaName(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].n || sym;
    return sym;
  }

  function marketKind(sym) {
    if (/EUR|USD|GBP|JPY/.test(sym) && !/XAU/.test(sym)) return 'FX';
    if (/XAU|GOLD/.test(sym)) return 'GOLD';
    if (/QQQ|SPY/.test(sym)) return 'ETF';
    return 'STOCK';
  }

  function buildLesson(sym) {
    var bs = bars(sym);
    var name = metaName(sym);
    var kind = marketKind(sym);
    var now = new Date();
    var when = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', hour: '2-digit', minute: '2-digit' });

    if (!bs || bs.length < 30) {
      return {
        html: '<h3>Analiza techniczna · ' + sym + '</h3>' +
          '<p class="meta">Za mało świec, żeby uczciwie opisać wykres. Uruchom cykl albo pobierz dane LIVE (Twelve), potem wróć tutaj.</p>' +
          '<div class="box">Na początek zapamiętaj: analiza techniczna to czytanie <b>ceny i struktury</b>, a nie zgadywanie przyszłości. Bez danych nie ma lekcji — tylko czekanie.</div>'
      };
    }

    var closes = bs.map(function (b) { return b.c; });
    var c = closes[closes.length - 1];
    var c5 = closes[Math.max(0, closes.length - 6)];
    var c20 = closes[Math.max(0, closes.length - 21)];
    var sma20 = sma(closes, 20);
    var sma50 = closes.length >= 50 ? sma(closes, 50) : sma(closes, Math.min(40, closes.length));
    var e12 = emaLast(closes.slice(-60), 12);
    var e26 = emaLast(closes.slice(-60), 26);
    var a = atr(bs, 14);
    var r = rsi(closes, 14);
    var sw = swingLevels(bs, 50);
    var chg5 = c5 ? ((c - c5) / c5) * 100 : 0;
    var chg20 = c20 ? ((c - c20) / c20) * 100 : 0;
    var atrPct = a && c ? (a / c) * 100 : null;

    // trend narrative
    var trendShort = 'mieszany';
    if (sma20 != null) {
      if (c > sma20 * 1.002 && sma20 >= (sma50 || sma20) * 0.999) trendShort = 'wzrostowy';
      else if (c < sma20 * 0.998 && sma20 <= (sma50 || sma20) * 1.001) trendShort = 'spadkowy';
    }

    var mom = 'neutralny';
    if (r != null) {
      if (r >= 65) mom = 'mocno zakupowy (ryzyko przegrzania)';
      else if (r >= 55) mom = 'lekko zakupowy';
      else if (r <= 35) mom = 'mocno sprzedażowy (ryzyko wyprzedania)';
      else if (r <= 45) mom = 'lekko sprzedażowy';
    }

    var volTalk = 'normalna';
    if (atrPct != null) {
      if (atrPct > 1.8) volTalk = 'wysoka — ruchy są duże, łatwiej o stop-out';
      else if (atrPct < 0.4) volTalk = 'niska — rynek ściszony, wybicia bywają fałszywe';
    }

    // position in range
    var rangePos = 0.5;
    if (sw.hi > sw.lo) rangePos = (c - sw.lo) / (sw.hi - sw.lo);
    var whereInRange = 'w środku zakresu';
    if (rangePos > 0.8) whereInRange = 'blisko góry zakresu (opór / FOMO risk)';
    else if (rangePos > 0.6) whereInRange = 'w górnej połowie zakresu';
    else if (rangePos < 0.2) whereInRange = 'blisko dołu zakresu (wsparcie / kapitulacja risk)';
    else if (rangePos < 0.4) whereInRange = 'w dolnej połowie zakresu';

    // VPVR if available
    var vpvrLine = '';
    if (global.BTX_VPVR && global.BTX_VPVR.getProfile) {
      try {
        var prof = global.BTX_VPVR.getProfile(sym);
        if (prof) {
          var cls = global.BTX_VPVR.classify(c, prof);
          vpvrLine = 'Profil wolumenu sesji (uproszczony): POC ok. <b>' + fmt(prof.poc, sym) + '</b>, Value Area <b>' +
            fmt(prof.val, sym) + '–' + fmt(prof.vah, sym) + '</b>. ' +
            'Cena jest teraz: <b>' + (cls.label || cls.zone) + '</b>. ' + (cls.tip || '');
        }
      } catch (e) {}
    }

    // instrument-specific teaching
    var instIntro = '';
    if (kind === 'STOCK') {
      instIntro = sym + ' (' + name + ') to akcja. W daytradingu ważna jest sesja USA i ogólny nastrój Nasdaq/S&P. Sam wykres akcji bez kontekstu indeksu bywa mylący: czasem NVDA spada, bo spada cały rynek tech, a nie dlatego, że "świeca wygląda źle".';
    } else if (kind === 'ETF') {
      instIntro = sym + ' to ETF na szeroki rynek (indeks). Traktuj go jak "temperaturę" rynku. Gdy ' + sym + ' jest słabe, longi na pojedynczych spółkach tech wymagają większej ostrożności.';
    } else if (kind === 'FX') {
      instIntro = sym + ' to para walutowa. Tu nie ma "otwarcia giełdy" jak na akcjach USA w tym samym sensie, ale płynność i reakcje na dane makro (USD/EUR) są kluczowe. Wolumen z darmowego API bywa słaby — więcej wagi przykładaj do struktury ceny.';
    } else {
      instIntro = 'Złoto (XAU) często reaguje na dolara, realne stopy i stres rynkowy. Ruchy bywają płynne, ale w godzinach danych USA zmienność skacze.';
    }

    var html = '';
    html += '<h3>Lekcja z wykresu · ' + sym + ' — ' + name + '</h3>';
    html += '<p class="meta">Stan na <b>' + when + '</b> (PL) · na podstawie ostatnich <b>' + bs.length + '</b> świec z bota (demo albo LIVE). To materiał edukacyjny, nie sygnał "kup teraz".</p>';

    html += '<h4>1. Co w ogóle widzisz na tym instrumencie</h4>';
    html += '<p>' + instIntro + '</p>';
    html += '<p>Ostatnia cena: <b>' + fmt(c, sym) + '</b>. ' +
      'Od ok. 5 świec zmiana wynosi ok. <b>' + chg5.toFixed(2) + '%</b>, a w szerszym oknie (~20 świec) ok. <b>' + chg20.toFixed(2) + '%</b>. ' +
      'Te procenty mówią tylko o tym, czy rynek ostatnio "pchał" cenę w górę czy w dół — nie mówią, co będzie za godzinę.</p>';

    html += '<h4>2. Trend — czy rynek ma kierunek?</h4>';
    html += '<p>Na daytradingu najpierw pytamy: <b>czy cena układa się wyżej, niżej, czy w bok?</b> ';
    html += 'Tu krótki trend wygląda na <b>' + trendShort + '</b>. ';
    if (sma20 != null) {
      html += 'Cena jest ' + (c >= sma20 ? '<b>powyżej</b>' : '<b>poniżej</b>') + ' średniej z ok. 20 świec (' + fmt(sma20, sym) + '). ';
    }
    if (sma50 != null) {
      html += 'Średnia dłuższa jest koło ' + fmt(sma50, sym) + '. ';
    }
    html += '</p>';
    html += '<div class="box">Prosta reguła nauki: w trendzie wzrostowym łatwiej szukać <b>odbić w górę po cofnięciu</b> (long po pullbacku), a nie shortów "bo drogo". W trendzie spadkowym odwrotnie. Gdy trend mieszany — rynek często ścina obie strony; wtedy mniej trade’ów = więcej nauki.</div>';

    html += '<h4>3. Zakres, wsparcie i opór (struktura)</h4>';
    html += '<p>W ostatnim fragmencie wykresu lokalny szczyt jest koło <b>' + fmt(sw.hi, sym) + '</b>, a dołek koło <b>' + fmt(sw.lo, sym) + '</b>. ';
    html += 'Cena jest <b>' + whereInRange + '</b>.</p>';
    html += '<p>Wsparcie to strefa, gdzie wcześniej kupujący częściej wygrywali (cena odbijała w górę). Opór — gdzie sprzedający częściej zatrzymywali wzrost. ';
    html += 'Nie są to magiczne linie z przyszłości — to <b>pamięć rynku</b> z ostatnich sesji. Im częściej poziom był broniony, tym więcej osób go widzi.</p>';
    html += '<ul>';
    html += '<li>Blisko oporu: long "na styk" jest trudniejszy — uczysz się cierpliwości albo czekasz na wybicie z domknięciem świecy.</li>';
    html += '<li>Blisko wsparcia: short "w ciemno" też bywa pułapką — najpierw zobacz, czy wsparcie pęka domknięciem, czy tylko testuje knotem.</li>';
    html += '</ul>';

    if (vpvrLine) {
      html += '<h4>4. Strefy wolumenu (VPVR sesji)</h4>';
      html += '<p>' + vpvrLine + '</p>';
      html += '<p>Do nauki: cena lubi wracać do miejsc, gdzie wcześniej było dużo handlu (POC / Value Area). Wejście "w próżni" (daleko od tych stref) często oznacza gorszy stosunek ryzyka do nagrody.</p>';
    }

    html += '<h4>5. Momentum i "siła ruchu"</h4>';
    html += '<p>Momentum odpowiada na pytanie: <b>czy ruch ma jeszcze pary, czy już się dławi?</b> ';
    if (r != null) {
      html += 'Uproszczony RSI(14) wychodzi ok. <b>' + r.toFixed(0) + '</b> — odczyt: <b>' + mom + '</b>. ';
    }
    html += 'RSI to nie przycisk kupna. Wysoki RSI w silnym trendzie może trwać długo; niski RSI w bessie też. Używaj go jako ostrzeżenia "tu tłum jest już mocno po jednej stronie", a nie jako wyroczni.</p>';
    if (e12 != null && e26 != null) {
      html += '<p>Szybka EMA jest ' + (e12 >= e26 ? 'powyżej' : 'poniżej') + ' wolniejszej — to kolejny sposób powiedzenia, czy krótki impuls zgadza się z nieco szerszym kierunkiem.</p>';
    }

    html += '<h4>6. Zmienność i gdzie stawiać stop</h4>';
    html += '<p>Zmienność wygląda na <b>' + volTalk + '</b>. ';
    if (a != null) {
      html += 'ATR(14) ≈ <b>' + fmt(a, sym) + '</b> (' + (atrPct != null ? atrPct.toFixed(2) + '% ceny' : '') + '). ';
    }
    html += 'ATR pomaga myśleć o stopie: zbyt ciasny SL przy wysokim ATR = ścinanie przez szum. Zbyt szeroki = za duże ryzyko na sztukę. W strategii PRO bota SL opiera się o wielokrotność ATR właśnie po to, by dopasować oddychanie rynku.</p>';
    html += '<div class="box warn">Ćwiczenie: zanim klikniesz XTB, powiedz na głos: "Mój stop jest tu: ___. Jeśli tam dojdzie, mylę się i wychodzę." Jeśli nie potrafisz dokończyć zdania — nie ma setupu.</div>';

    html += '<h4>7. Co z tego wynika dla decyzji (nauka, nie rozkaz)</h4>';
    if (trendShort === 'wzrostowy') {
      html += '<p>Scenariusz lekcyjny LONG: czekaj na <b>cofnięcie</b> w stronę średniej / strefy VA / wsparcia, a nie gonienie ceny na szczycie zakresu. Scenariusz SHORT tylko gdy struktura się psuje (domknięcie pod wsparciem) — inaczej walczysz z kierunkiem.</p>';
    } else if (trendShort === 'spadkowy') {
      html += '<p>Scenariusz lekcyjny SHORT: odbicia w górę do oporu/średniej bywają okazją sprzedażową. LONG "bo tanio" bez odwrócenia struktury to częsta pułapka początkujących.</p>';
    } else {
      html += '<p>Rynek mieszany: najlepsza lekcja to często <b>WAIT</b>. Handel w chopie uczy frustracji szybciej niż cierpliwości. Zapisz w journalu: "brak kierunku — nie wchodzę".</p>';
    }

    html += '<h4>8. Checklista adeptów daytradingu przy tym wykresie</h4>';
    html += '<ul>';
    html += '<li>Czy wiem, jaki jest szerszy kontekst (SPY/QQQ przy akcjach, dolar przy złocie/EURUSD)?</li>';
    html += '<li>Czy cena jest przy poziomie, który ma sens (wsparcie/opór/VA), czy "w środku niczego"?</li>';
    html += '<li>Czy mam miejsce na SL bez łamania reguły 0,5% ryzyka?</li>';
    html += '<li>Czy nie jestem w HIGH news / weekencie / STOP FOR DAY?</li>';
    html += '<li>Czy potrafę opisać setup jednym zdaniem bez słowa "wydaje mi się"?</li>';
    html += '</ul>';

    html += '<div class="box risk"><b>Ważne:</b> ta analiza aktualizuje się wraz z danymi bota dla <b>' + sym + '</b>, ale nie zastępuje Twojej decyzji na XTB. Rynek może unieważnić każdy opis w jednej świecy. Uczysz się procesu — nie "pewniaków".</div>';

    return { html: html };
  }

  function ensureRoot() {
    injectCss();
    var pane = document.getElementById('pane-chart');
    if (!pane) return null;
    var el = document.getElementById(ROOT);
    if (el) return el;
    // wstaw pod kartą wykresu
    var card = pane.querySelector('.card') || pane;
    el = document.createElement('div');
    el.id = ROOT;
    card.appendChild(el);
    return el;
  }

  function currentSym() {
    var sel = document.getElementById('chart-sym');
    if (sel && sel.value) return sel.value;
    if (global.SYMBOLS && global.SYMBOLS[0]) return global.SYMBOLS[0].s;
    return 'SPY';
  }

  function render() {
    var el = ensureRoot();
    if (!el) return;
    var sym = currentSym();
    try {
      var lesson = buildLesson(sym);
      el.innerHTML = lesson.html;
    } catch (e) {
      el.innerHTML = '<p>Nie udało się zbudować lekcji: ' + (e.message || e) + '</p>';
    }
  }

  function bind() {
    var sel = document.getElementById('chart-sym');
    if (sel && !sel.__taLesson) {
      sel.__taLesson = true;
      sel.addEventListener('change', function () { render(); });
    }
    if (typeof global.drawCandles === 'function' && !global.drawCandles.__taLesson) {
      var orig = global.drawCandles;
      global.drawCandles = function () {
        var r = orig.apply(this, arguments);
        try { render(); } catch (e) {}
        return r;
      };
      global.drawCandles.__taLesson = true;
    }
    if (typeof global.render === 'function' && !global.render.__taLesson) {
      var r0 = global.render;
      global.render = function () {
        var out = r0.apply(this, arguments);
        try {
          var pane = document.getElementById('pane-chart');
          if (pane && pane.className.indexOf('on') >= 0) render();
        } catch (e) {}
        return out;
      };
      global.render.__taLesson = true;
    }
  }

  function boot() {
    injectCss();
    bind();
    render();
    setInterval(function () { bind(); render(); }, 5000);
  }

  global.BTX_CHART_TA = { render: render, buildLesson: buildLesson };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
