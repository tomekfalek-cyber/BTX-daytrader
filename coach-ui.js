/**
 * BTX Coach UI — intuicyjny desk okazji + tłumaczenia dla początkujących
 * LONG / SHORT / odrzucenia w zrozumiałym języku + lekcja „dlaczego”.
 */
(function (global) {
  var STYLE_ID = 'btx-coach-style';

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.coach-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px}',
      '.opp{border:1px solid var(--line);border-radius:14px;padding:14px 14px 12px;background:linear-gradient(180deg,var(--bg3),var(--bg2));position:relative;overflow:hidden}',
      '.opp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}',
      '.opp.long::before{background:var(--green)}',
      '.opp.short::before{background:var(--red)}',
      '.opp.wait::before{background:var(--tx3)}',
      '.opp .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}',
      '.opp .sym{font-weight:700;font-size:15px;letter-spacing:-.01em}',
      '.opp .meta{font-size:11px;color:var(--tx3)}',
      '.opp .action{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:99px}',
      '.opp.long .action{background:rgba(18,196,139,.15);color:var(--green)}',
      '.opp.short .action{background:rgba(228,0,43,.15);color:#f87171}',
      '.opp.wait .action{background:rgba(100,116,139,.18);color:#94a3b8}',
      '.opp .lesson{font-size:12.5px;line-height:1.55;color:var(--tx);margin:8px 0 6px}',
      '.opp .lesson b{color:#fff}',
      '.opp .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}',
      '.opp .chip{font-size:10px;padding:3px 7px;border-radius:99px;background:var(--bg4);color:var(--tx2);border:1px solid var(--line)}',
      '.opp .chip.ok{border-color:rgba(18,196,139,.35);color:var(--green)}',
      '.opp .chip.bad{border-color:rgba(240,68,82,.35);color:#f87171}',
      '.opp .chip.ai{border-color:rgba(59,130,246,.4);color:#93c5fd}',
      '.coach-banner{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch;margin-bottom:14px}',
      '.coach-stat{flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:10px 12px}',
      '.coach-stat .l{font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx3);font-weight:600}',
      '.coach-stat .v{font-size:18px;font-weight:700;margin-top:4px;font-family:"JetBrains Mono",monospace}',
      '.coach-hint{font-size:12px;color:var(--tx2);line-height:1.5;padding:10px 12px;border-left:3px solid var(--red);background:rgba(228,0,43,.06);border-radius:0 10px 10px 0;margin-bottom:14px}',
      '#coach-board h2{margin-bottom:10px}',
      '.why-row{font-size:12px;color:var(--tx2);max-width:420px;line-height:1.45}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var DICT = [
    { re: /HTF up|HTF mild up/i, long: 'Rynek jest w trendzie wzrostowym na wy\u017cszym interwale \u2014 kupujemy z kierunkiem, nie pod pr\u0105d.' },
    { re: /HTF down|HTF mild down/i, short: 'Rynek jest w trendzie spadkowym na wy\u017cszym interwale \u2014 short tylko z kierunkiem spadku.' },
    { re: /discount/i, long: 'Cena jest w \u201eta\u0144szej\u201d strefie zakresu (discount) \u2014 historycznie tu instytucje ch\u0119tniej kupuj\u0105.' },
    { re: /premium/i, short: 'Cena jest w \u201edrogiej\u201d strefie zakresu (premium) \u2014 tu cz\u0119\u015bciej szuka si\u0119 sprzeda\u017cy.' },
    { re: /RSI\(2\)|pullback|PB/i, long: 'Kr\u00f3tki spadek (pullback) w trendzie wzrostowym \u2014 klasyczne miejsce do\u0142\u0105czania do trendu, nie gonienia szczytu.' },
    { re: /bounce/i, short: 'Kr\u00f3tkie odbicie w trendzie spadkowym \u2014 okazja do shorta po korekcie w g\u00f3r\u0119.' },
    { re: /VWAP|>VWAP|<VWAP/i, long: 'Cena nad VWAP (\u015brednia dzienna wolumenowa) \u2014 strona popytu intraday ma przewag\u0119.', short: 'Cena pod VWAP \u2014 strona poda\u017cy intraday ma przewag\u0119.' },
    { re: /ORB retest/i, long: 'Wybicie zakresu otwarcia i retest \u2014 rynek przetestowa\u0142 poziom i utrzyma\u0142 si\u0119 powy\u017cej.', short: 'Wybicie w d\u00f3\u0142 i retest \u2014 poziom nie utrzyma\u0142 popytu.' },
    { re: /prime session/i, long: 'Jeste\u015bmy w prime time sesji (otwarcie / power hour) \u2014 najwi\u0119cej p\u0142ynno\u015bci i ruchu.', short: 'Prime time sesji \u2014 wi\u0119cej ruchu, ale te\u017c zmienno\u015bci.' },
    { re: /RSI OS|oversold/i, long: 'RSI pokazuje wyprzedanie \u2014 przy trendzie wzrostowym to bywa paliwo do odbicia.' },
    { re: /RSI OB|overbought/i, short: 'RSI pokazuje wykupienie \u2014 przy trendzie spadkowym to bywa paliwo do spadku.' },
    { re: /veto: brak HTF up/i, wait: 'Odrzucone: nie ma potwierdzonego trendu wzrostowego na wy\u017cszym interwale. Unikamy long\u00f3w pod pr\u0105d.' },
    { re: /veto: brak HTF down/i, wait: 'Odrzucone: nie ma potwierdzonego trendu spadkowego. Short bez trendu to cz\u0119sto strata.' },
    { re: /news blackout/i, wait: 'Odrzucone: okno news\u00f3w (NFP/CPI/FOMC/ECB). Przed i po danych bywa chaos \u2014 lepiej sta\u0107 z boku.' },
    { re: /ostatnie 45 min/i, wait: 'Odrzucone: ostatnie 45 minut sesji. Nowe wej\u015bcia s\u0105 ryzykowne \u2014 ma\u0142o czasu na rozw\u00f3j ruchu.' },
    { re: /brak konfluencji/i, wait: 'Odrzucone: za ma\u0142o zgodnych sygna\u0142\u00f3w naraz (trend + lokalizacja + momentum). Czekamy na czystszy setup.' },
    { re: /AI veto|ai-veto/i, wait: 'AI obni\u017cy\u0142o ocen\u0119 setupu \u2014 modele nie widz\u0105 wystarczaj\u0105cej przewagi albo rynek jest w szoku zmienno\u015bci.' },
    { re: /regime-shock/i, wait: 'Re\u017cim szokowy (du\u017ca zmienno\u015b\u0107) \u2014 AI blokuje nowe wej\u015bcia, bo stop-lossy s\u0105 wtedy losowe.' },
    { re: /AI \d+%/i, long: 'Ensemble AI potwierdza setup (pewno\u015b\u0107 w %). To filtr jako\u015bci, nie gwarancja zysku.', short: 'Ensemble AI potwierdza setup (pewno\u015b\u0107 w %). To filtr jako\u015bci, nie gwarancja zysku.' }
  ];

  function chipsFromWhy(why) {
    return String(why || '').split(/\s*[\u00b7|]\s*/).filter(Boolean).slice(0, 6);
  }

  function lessonFor(g) {
    var why = String(g.why || '');
    var side = g.side || 'WAIT';
    var lines = [];
    DICT.forEach(function (d) {
      if (!d.re.test(why)) return;
      if (side === 'LONG' && d.long) lines.push(d.long);
      if (side === 'SHORT' && d.short) lines.push(d.short);
      if (side === 'WAIT' && d.wait) lines.push(d.wait);
    });
    if (g.ai) {
      if (g.ai.ok && g.ai.conf != null) {
        lines.push('AI szacuje przewag\u0119 setupu na ok. ' + Math.round(g.ai.conf * 100) + '%. Im wy\u017cej, tym wi\u0119ksza zgodno\u015b\u0107 modeli.');
      } else if (g.ai.reason) {
        lines.push('AI: ' + explainAiReason(g.ai.reason, g.ai.conf));
      }
      if (g.ai.regime) lines.push('Re\u017cim rynku: ' + explainRegime(g.ai.regime) + '.');
    }
    if (!lines.length) {
      if (side === 'LONG') lines.push('Sygna\u0142 kupna z regu\u0142 PRO (trend + lokalizacja + momentum). Si\u0142a min. 4/5 zanim wejdziesz r\u0119cznie na XTB.');
      else if (side === 'SHORT') lines.push('Sygna\u0142 sprzeda\u017cy (short) z regu\u0142 PRO. Na akcjach short bywa trudniejszy \u2014 na FX naturalny.');
      else lines.push('Brak czystej okazji. Czekanie to te\u017c decyzja \u2014 ochrona kapita\u0142u jest cz\u0119\u015bci\u0105 daytradingu.');
    }
    if (side === 'LONG') lines.push('Jak my\u015ble\u0107: kupujesz gdy trend sprzyja i cena cofn\u0119\u0142a si\u0119 w ta\u0144sz\u0105 stref\u0119, nie gdy wszyscy goni\u0105 szczyt.');
    if (side === 'SHORT') lines.push('Jak my\u015ble\u0107: shortujesz z trendem spadkowym po korekcie w g\u00f3r\u0119 \u2014 nie \u201ebo drogo\u201d.');
    var seen = {}, out = [];
    lines.forEach(function (x) {
      var k = x.slice(0, 48);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(x);
    });
    return out.slice(0, 4);
  }

  function explainAiReason(r, conf) {
    var c = conf != null ? ' (pewno\u015b\u0107 ~' + Math.round(conf * 100) + '%)' : '';
    if (r === 'regime-shock') return 'rynek w szoku zmienno\u015bci \u2014 za du\u017co losowo\u015bci na stopach' + c;
    if (r === 'ai-veto-weak') return 'setup za s\u0142aby wed\u0142ug modeli' + c;
    if (r === 'ai-disagreement') return 'modele AI si\u0119 nie zgadzaj\u0105 co do kierunku' + c;
    if (r === 'below-threshold') return 'wynik poni\u017cej progu jako\u015bci' + c;
    if (r === 'no-features') return 'za ma\u0142o danych \u015bwiecowych do oceny';
    return String(r) + c;
  }

  function explainRegime(reg) {
    if (reg === 'trend') return 'trendowy (\u0142atwiej jecha\u0107 z kierunkiem)';
    if (reg === 'range') return 'boczny / konsolidacja (wi\u0119cej fa\u0142szywych wybi\u0107)';
    if (reg === 'shock') return 'szok zmienno\u015bci (unikaj nowych wej\u015b\u0107)';
    if (reg === 'mixed') return 'mieszany';
    return String(reg);
  }

  function strengthLabel(n) {
    n = n || 0;
    if (n >= 5) return 'bardzo silny (5/5)';
    if (n >= 4) return 'silny (4/5) \u2014 pr\u00f3g auto';
    if (n >= 3) return 'umiarkowany (3/5) \u2014 ostro\u017cnie';
    if (n >= 1) return 's\u0142aby (' + n + '/5) \u2014 raczej obserwacja';
    return 'brak si\u0142y';
  }

  function ensureBoard() {
    var host = document.getElementById('coach-board');
    if (host) return host;
    var pane = document.getElementById('pane-sig') || document.getElementById('pane-desk');
    if (!pane) return null;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'coach-board';
    card.style.marginBottom = '12px';
    card.innerHTML = '<h2><span class="dot"></span>Okazje i lekcja (Coach)</h2><div id="coach-body" class="mut">Uruchom cykl, aby zobaczy\u0107 okazje LONG/SHORT z wyja\u015bnieniem.</div>';
    var first = pane.querySelector('.card');
    if (first && first.parentNode === pane) pane.insertBefore(card, first);
    else pane.insertBefore(card, pane.firstChild);
    return card;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cardHtml(g) {
    var side = g.side || 'WAIT';
    var cls = side === 'LONG' ? 'long' : side === 'SHORT' ? 'short' : 'wait';
    var action = side === 'LONG' ? 'KUPNO (LONG)' : side === 'SHORT' ? 'SPRZEDA\u017b (SHORT)' : 'BEZ WEJ\u015aCIA';
    var lessons = lessonFor(g);
    var lessonHtml = lessons.map(function (t, i) {
      return '<div class="lesson">' + (i === 0 ? '<b>Dlaczego: </b>' : '') + esc(t) + '</div>';
    }).join('');
    var chipHtml = chipsFromWhy(g.why).map(function (c) {
      var k = 'chip';
      if (/veto|blackout|brak|AI veto|shock/i.test(c)) k += ' bad';
      else if (/AI \d/i.test(c)) k += ' ai';
      else if (side !== 'WAIT') k += ' ok';
      return '<span class="' + k + '">' + esc(c) + '</span>';
    }).join('');
    var aiLine = '';
    if (g.ai && g.ai.conf != null) {
      aiLine = '<div class="meta">AI: ' + Math.round(g.ai.conf * 100) + '% \u00b7 re\u017cim ' + esc(String(g.ai.regime || '\u2014')) +
        (g.ai.ok ? ' \u00b7 potwierdza' : ' \u00b7 nie potwierdza') + '</div>';
    }
    return (
      '<div class="opp ' + cls + '">' +
        '<div class="head">' +
          '<div><div class="sym">' + esc(g.sym) + (g.name ? ' <span class="meta">\u00b7 ' + esc(g.name) + '</span>' : '') + '</div>' +
          '<div class="meta">' + esc(strengthLabel(g.strength)) + ' \u00b7 trend ' + esc(String(g.trend || '\u2014')) +
          (g.price != null ? ' \u00b7 ' + (global.f2 ? global.f2(g.price) : g.price) : '') + '</div></div>' +
          '<span class="action">' + action + '</span>' +
        '</div>' +
        lessonHtml + aiLine +
        (chipHtml ? '<div class="chips">' + chipHtml + '</div>' : '') +
      '</div>'
    );
  }

  function renderCoach() {
    injectCss();
    var board = ensureBoard();
    if (!board) return;
    var body = document.getElementById('coach-body');
    if (!body) return;
    var sig = (global.ST && global.ST.sig) || [];
    if (!sig.length) {
      body.innerHTML = '<div class="coach-hint">Kliknij <b>Wykonaj cykl</b> lub w\u0142\u0105cz <b>Auto</b>. Coach poka\u017ce okazje LONG/SHORT oraz dlaczego bot co\u015b odrzuca.</div>';
      return;
    }
    var longs = sig.filter(function (x) { return x.side === 'LONG'; }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    var shorts = sig.filter(function (x) { return x.side === 'SHORT'; }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    var waits = sig.filter(function (x) { return x.side === 'WAIT'; });
    var rejects = waits.filter(function (x) {
      return /veto|blackout|AI veto|konfluencji|regime|ostatnie 45/i.test(String(x.why || ''));
    }).slice(0, 4);

    var html = '';
    html += '<div class="coach-banner">';
    html += '<div class="coach-stat"><div class="l">Okazje LONG</div><div class="v" style="color:var(--green)">' + longs.length + '</div></div>';
    html += '<div class="coach-stat"><div class="l">Okazje SHORT</div><div class="v" style="color:#f87171">' + shorts.length + '</div></div>';
    html += '<div class="coach-stat"><div class="l">Bez wej\u015bcia</div><div class="v">' + waits.length + '</div></div>';
    var top = longs.concat(shorts).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
    html += '<div class="coach-stat"><div class="l">Najsilniejszy</div><div class="v" style="font-size:14px">' + (top ? top.sym + ' ' + top.side : '\u2014') + '</div></div>';
    html += '</div>';

    if (!longs.length && !shorts.length) {
      html += '<div class="coach-hint"><b>Brak okazji teraz.</b> To normalne. Profesjonalny daytrading to g\u0142\u00f3wnie czekanie. Poni\u017cej dlaczego bot nic nie bierze.</div>';
    } else {
      html += '<div class="coach-hint"><b>Jak czyta\u0107:</b> bierz pod uwag\u0119 sygna\u0142y z si\u0142\u0105 <b>4\u20135</b>. Si\u0142a 1\u20133 to raczej obserwacja. Na XTB wchodzisz r\u0119cznie.</div>';
    }

    html += '<div class="coach-grid">';
    longs.concat(shorts).slice(0, 8).forEach(function (g) { html += cardHtml(g); });
    rejects.forEach(function (g) { html += cardHtml(g); });
    html += '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:var(--tx3);line-height:1.5">';
    html += '<b>S\u0142ownik:</b> HTF = wy\u017cszy interwa\u0142 \u00b7 VWAP = \u015brednia wa\u017cona wolumenem \u00b7 Discount/Premium = ta\u0144sza/dro\u017csza strefa \u00b7 Pullback = cofni\u0119cie w trendzie \u00b7 ORB = zakres otwarcia \u00b7 R = wielokrotno\u015b\u0107 ryzyka (SL).';
    html += '</div>';
    body.innerHTML = html;
  }

  function enhanceTableWhy() {
    var tbl = document.getElementById('tbl-sig');
    if (!tbl) return;
    var sig = (global.ST && global.ST.sig) || [];
    var note = document.getElementById('sig-coach-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'sig-coach-note';
      note.className = 'coach-hint';
      note.style.marginTop = '12px';
      if.parentNode.appendChild(note);
    }
    var act = sig.filter(function (x) { return x.side !== 'WAIT'; });
    if (!act.length) {
      note.innerHTML = '<b>Brak sygna\u0142\u00f3w wej\u015bcia.</b> Przejrzyj karty Coach \u2014 odrzucenia te\u017c ucz\u0105.';
    } else {
      var best = act.slice().sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
      var L = lessonFor(best);
      note.innerHTML = '<b>Focus: ' + esc(best.sym) + ' ' + esc(best.side) + '</b> \u2014 ' + esc(L[0] || best.why || '') +
        ' <span class="meta">(' + esc(strengthLabel(best.strength)) + ')</span>';
    }
  }

  function patchRenderSig() {
    if (typeof global.renderSig !== 'function' || global.renderSig.__coach) return;
    var orig = global.renderSig;
    global.renderSig = function () {
      var r = orig.apply(this, arguments);
      try { enhanceTableWhy(); renderCoach(); } catch (e) {}
      return r;
    };
    global.renderSig.__coach = true;
  }

  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__coach) return;
    var orig = global.render;
    global.render = function () {
      var r = orig.apply(this, arguments);
      try { renderCoach(); } catch (e) {}
      return r;
    };
    global.render.__coach = true;
  }

  function boot() {
    injectCss();
    ensureBoard();
    patchRenderSig();
    patchRender();
    renderCoach();
    setInterval(function () {
      patchRenderSig();
      patchRender();
    }, 1000);
  }

  global.BTX_COACH = { render: renderCoach, lessonFor: lessonFor };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
