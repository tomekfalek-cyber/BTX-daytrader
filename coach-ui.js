/**
 * BTX Coach UI — intuicyjny desk okazji + tłumaczenia dla początkujących
 */
(function (global) {
  var STYLE_ID = 'btx-coach-style';
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '.coach-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px}.opp{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,var(--bg3),var(--bg2));position:relative;overflow:hidden}.opp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}.opp.long::before{background:var(--green)}.opp.short::before{background:var(--red)}.opp.wait::before{background:var(--tx3)}.opp .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.opp .sym{font-weight:700;font-size:15px}.opp .meta{font-size:11px;color:var(--tx3)}.opp .action{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:99px}.opp.long .action{background:rgba(18,196,139,.15);color:var(--green)}.opp.short .action{background:rgba(228,0,43,.15);color:#f87171}.opp.wait .action{background:rgba(100,116,139,.18);color:#94a3b8}.opp .lesson{font-size:12.5px;line-height:1.55;color:var(--tx);margin:8px 0 6px}.opp .lesson b{color:#fff}.opp .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.opp .chip{font-size:10px;padding:3px 7px;border-radius:99px;background:var(--bg4);color:var(--tx2);border:1px solid var(--line)}.opp .chip.ok{border-color:rgba(18,196,139,.35);color:var(--green)}.opp .chip.bad{border-color:rgba(240,68,82,.35);color:#f87171}.opp .chip.ai{border-color:rgba(59,130,246,.4);color:#93c5fd}.coach-banner{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}.coach-stat{flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:10px 12px}.coach-stat .l{font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--tx3);font-weight:600}.coach-stat .v{font-size:18px;font-weight:700;margin-top:4px;font-family:"JetBrains Mono",monospace}.coach-hint{font-size:12px;color:var(--tx2);line-height:1.5;padding:10px 12px;border-left:3px solid var(--red);background:rgba(228,0,43,.06);border-radius:0 10px 10px 0;margin-bottom:14px}';
    document.head.appendChild(s);
  }
  var DICT = [
    { re: /HTF up|HTF mild up/i, long: 'Rynek w trendzie wzrostowym na wy\u017cszym interwale \u2014 kupujemy z kierunkiem, nie pod pr\u0105d.' },
    { re: /HTF down|HTF mild down/i, short: 'Rynek w trendzie spadkowym \u2014 short tylko z kierunkiem spadku.' },
    { re: /discount/i, long: 'Cena w ta\u0144szej strefie zakresu (discount) \u2014 tu instytucje ch\u0119tniej kupuj\u0105.' },
    { re: /premium/i, short: 'Cena w drogiej strefie (premium) \u2014 tu cz\u0119\u015bciej szuka si\u0119 sprzeda\u017cy.' },
    { re: /RSI\(2\)|pullback|PB/i, long: 'Pullback w trendzie wzrostowym \u2014 do\u0142\u0105czanie do trendu, nie gonienie szczytu.' },
    { re: /bounce/i, short: 'Odbicie w trendzie spadkowym \u2014 short po korekcie w g\u00f3r\u0119.' },
    { re: /VWAP/i, long: 'Cena nad VWAP \u2014 popyt intraday ma przewag\u0119.', short: 'Cena pod VWAP \u2014 poda\u017c intraday ma przewag\u0119.' },
    { re: /ORB retest/i, long: 'Wybicie ORB i retest \u2014 poziom utrzyma\u0142 popyt.', short: 'Wybicie w d\u00f3\u0142 i retest \u2014 poziom nie utrzyma\u0142 popytu.' },
    { re: /prime session/i, long: 'Prime time sesji \u2014 najwi\u0119cej p\u0142ynno\u015bci.', short: 'Prime time sesji \u2014 wi\u0119cej ruchu i zmienno\u015bci.' },
    { re: /veto: brak HTF up/i, wait: 'Odrzucone: brak trendu wzrostowego HTF. Unikamy long\u00f3w pod pr\u0105d.' },
    { re: /veto: brak HTF down/i, wait: 'Odrzucone: brak trendu spadkowego HTF.' },
    { re: /news blackout/i, wait: 'Odrzucone: okno news\u00f3w (NFP/CPI/FOMC). Lepiej sta\u0107 z boku.' },
    { re: /ostatnie 45 min/i, wait: 'Odrzucone: ostatnie 45 min sesji \u2014 ma\u0142o czasu na ruch.' },
    { re: /brak konfluencji/i, wait: 'Odrzucone: za ma\u0142o zgodnych sygna\u0142\u00f3w. Czekamy na czystszy setup.' },
    { re: /AI veto|ai-veto/i, wait: 'AI obni\u017cy\u0142o ocen\u0119 \u2014 za s\u0142aba przewaga lub szok zmienno\u015bci.' },
    { re: /regime-shock/i, wait: 'Szok zmienno\u015bci \u2014 AI blokuje wej\u015bcia (stopy zbyt losowe).' }
  ];
  function chipsFromWhy(why) { return String(why || '').split(/\s*[\u00b7|]\s*/).filter(Boolean).slice(0, 6); }
  function explainAiReason(r, conf) {
    var c = conf != null ? ' (~' + Math.round(conf * 100) + '%)' : '';
    if (r === 'regime-shock') return 'rynek w szoku zmienno\u015bci' + c;
    if (r === 'ai-veto-weak') return 'setup za s\u0142aby wed\u0142ug AI' + c;
    if (r === 'ai-disagreement') return 'modele AI si\u0119 nie zgadzaj\u0105' + c;
    return String(r) + c;
  }
  function explainRegime(reg) {
    if (reg === 'trend') return 'trendowy';
    if (reg === 'range') return 'boczny';
    if (reg === 'shock') return 'szok zmienno\u015bci';
    return String(reg || '\u2014');
  }
  function strengthLabel(n) {
    n = n || 0;
    if (n >= 5) return 'bardzo silny (5/5)';
    if (n >= 4) return 'silny (4/5) \u2014 pr\u00f3g auto';
    if (n >= 3) return 'umiarkowany (3/5)';
    if (n >= 1) return 's\u0142aby (' + n + '/5)';
    return 'brak si\u0142y';
  }
  function lessonFor(g) {
    var why = String(g.why || ''), side = g.side || 'WAIT', lines = [];
    DICT.forEach(function (d) {
      if (!d.re.test(why)) return;
      if (side === 'LONG' && d.long) lines.push(d.long);
      if (side === 'SHORT' && d.short) lines.push(d.short);
      if (side === 'WAIT' && d.wait) lines.push(d.wait);
    });
    if (g.ai) {
      if (g.ai.ok && g.ai.conf != null) lines.push('AI szacuje przewag\u0119 na ok. ' + Math.round(g.ai.conf * 100) + '%.');
      else if (g.ai.reason) lines.push('AI: ' + explainAiReason(g.ai.reason, g.ai.conf));
      if (g.ai.regime) lines.push('Re\u017cim: ' + explainRegime(g.ai.regime) + '.');
    }
    if (!lines.length) {
      if (side === 'LONG') lines.push('Sygna\u0142 kupna PRO (trend + lokalizacja + momentum). Si\u0142a min. 4/5 przed XTB.');
      else if (side === 'SHORT') lines.push('Sygna\u0142 short PRO. Na FX naturalny, na akcjach ostro\u017cniej.');
      else lines.push('Brak czystej okazji. Czekanie te\u017c chroni kapita\u0142.');
    }
    if (side === 'LONG') lines.push('Kupuj z trendem po cofni\u0119ciu \u2014 nie goni\u0105c szczytu.');
    if (side === 'SHORT') lines.push('Short z trendem po korekcie w g\u00f3r\u0119 \u2014 nie \u201ebo drogo\u201d.');
    var seen = {}, out = [];
    lines.forEach(function (x) { var k = x.slice(0, 48); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out.slice(0, 4);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }
  function ensureBoard() {
    var host = document.getElementById('coach-board');
    if (host) return host;
    var pane = document.getElementById('pane-sig') || document.getElementById('pane-desk');
    if (!pane) return null;
    var card = document.createElement('div');
    card.className = 'card'; card.id = 'coach-board'; card.style.marginBottom = '12px';
    card.innerHTML = '<h2><span class="dot"></span>Okazje i lekcja (Coach)</h2><div id="coach-body" class="mut">Uruchom cykl, aby zobaczy\u0107 okazje.</div>';
    var first = pane.querySelector('.card');
    if (first && first.parentNode === pane) pane.insertBefore(card, first);
    else pane.insertBefore(card, pane.firstChild);
    return card;
  }
  function cardHtml(g) {
    var side = g.side || 'WAIT';
    var cls = side === 'LONG' ? 'long' : side === 'SHORT' ? 'short' : 'wait';
    var action = side === 'LONG' ? 'KUPNO (LONG)' : side === 'SHORT' ? 'SPRZEDA\u017b (SHORT)' : 'BEZ WEJ\u015aCIA';
    var lessons = lessonFor(g);
    var lessonHtml = lessons.map(function (t, i) { return '<div class="lesson">' + (i === 0 ? '<b>Dlaczego: </b>' : '') + esc(t) + '</div>'; }).join('');
    var chipHtml = chipsFromWhy(g.why).map(function (c) {
      var k = 'chip';
      if (/veto|blackout|brak|AI veto|shock/i.test(c)) k += ' bad';
      else if (/AI \d/i.test(c)) k += ' ai';
      else if (side !== 'WAIT') k += ' ok';
      return '<span class="' + k + '">' + esc(c) + '</span>';
    }).join('');
    var aiLine = '';
    if (g.ai && g.ai.conf != null) {
      aiLine = '<div class="meta">AI: ' + Math.round(g.ai.conf * 100) + '% \u00b7 ' + esc(explainRegime(g.ai.regime)) + (g.ai.ok ? ' \u00b7 potwierdza' : ' \u00b7 nie potwierdza') + '</div>';
    }
    return '<div class="opp ' + cls + '"><div class="head"><div><div class="sym">' + esc(g.sym) + (g.name ? ' <span class="meta">\u00b7 ' + esc(g.name) + '</span>' : '') + '</div><div class="meta">' + esc(strengthLabel(g.strength)) + ' \u00b7 trend ' + esc(String(g.trend || '\u2014')) + (g.price != null ? ' \u00b7 ' + (global.f2 ? global.f2(g.price) : g.price) : '') + '</div></div><span class="action">' + action + '</span></div>' + lessonHtml + aiLine + (chipHtml ? '<div class="chips">' + chipHtml + '</div>' : '') + '</div>';
  }
  function renderCoach() {
    injectCss();
    ensureBoard();
    var body = document.getElementById('coach-body');
    if (!body) return;
    var sig = (global.ST && global.ST.sig) || [];
    if (!sig.length) {
      body.innerHTML = '<div class="coach-hint">Kliknij <b>Wykonaj cykl</b> lub w\u0142\u0105cz <b>Auto</b>. Coach wyja\u015bni okazje LONG/SHORT i odrzucenia.</div>';
      return;
    }
    var longs = sig.filter(function (x) { return x.side === 'LONG'; }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    var shorts = sig.filter(function (x) { return x.side === 'SHORT'; }).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    var waits = sig.filter(function (x) { return x.side === 'WAIT'; });
    var rejects = waits.filter(function (x) { return /veto|blackout|AI veto|konfluencji|regime|ostatnie 45/i.test(String(x.why || '')); }).slice(0, 4);
    var html = '<div class="coach-banner">';
    html += '<div class="coach-stat"><div class="l">Okazje LONG</div><div class="v" style="color:var(--green)">' + longs.length + '</div></div>';
    html += '<div class="coach-stat"><div class="l">Okazje SHORT</div><div class="v" style="color:#f87171">' + shorts.length + '</div></div>';
    html += '<div class="coach-stat"><div class="l">Bez wej\u015bcia</div><div class="v">' + waits.length + '</div></div>';
    var top = longs.concat(shorts).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
    html += '<div class="coach-stat"><div class="l">Najsilniejszy</div><div class="v" style="font-size:14px">' + (top ? top.sym + ' ' + top.side : '\u2014') + '</div></div></div>';
    if (!longs.length && !shorts.length) html += '<div class="coach-hint"><b>Brak okazji teraz.</b> Czekanie to te\u017c decyzja pro. Poni\u017cej dlaczego bot odrzuca.</div>';
    else html += '<div class="coach-hint"><b>Jak czyta\u0107:</b> si\u0142a <b>4\u20135</b> = warto rozwa\u017cy\u0107 na XTB. 1\u20133 = obserwacja.</div>';
    html += '<div class="coach-grid">';
    longs.concat(shorts).slice(0, 8).forEach(function (g) { html += cardHtml(g); });
    rejects.forEach(function (g) { html += cardHtml(g); });
    html += '</div><div style="margin-top:8px;font-size:11px;color:var(--tx3);line-height:1.5"><b>S\u0142ownik:</b> HTF = wy\u017cszy interwa\u0142 \u00b7 VWAP = \u015brednia wa\u017cona wolumenem \u00b7 Discount/Premium = ta\u0144sza/dro\u017csza strefa \u00b7 Pullback = cofni\u0119cie \u00b7 ORB = zakres otwarcia \u00b7 R = wielokrotno\u015b\u0107 SL.</div>';
    body.innerHTML = html;
  }
  function enhanceTableWhy() {
    var tbl = document.getElementById('tbl-sig');
    if (!tbl || !tbl.parentNode) return;
    var sig = (global.ST && global.ST.sig) || [];
    var note = document.getElementById('sig-coach-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'sig-coach-note';
      note.className = 'coach-hint';
      note.style.marginTop = '12px';
      tbl.parentNode.appendChild(note);
    }
    var act = sig.filter(function (x) { return x.side !== 'WAIT'; });
    if (!act.length) note.innerHTML = '<b>Brak sygna\u0142\u00f3w wej\u015bcia.</b> Karty Coach wyja\u015bniaj\u0105 odrzucenia.';
    else {
      var best = act.slice().sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
      var L = lessonFor(best);
      note.innerHTML = '<b>Focus: ' + esc(best.sym) + ' ' + esc(best.side) + '</b> \u2014 ' + esc(L[0] || best.why || '') + ' <span class="meta">(' + esc(strengthLabel(best.strength)) + ')</span>';
    }
  }
  function patchRenderSig() {
    if (typeof global.renderSig !== 'function' || global.renderSig.__coach) return;
    var orig = global.renderSig;
    global.renderSig = function () { var r = orig.apply(this, arguments); try { enhanceTableWhy(); renderCoach(); } catch (e) {} return r; };
    global.renderSig.__coach = true;
  }
  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__coach) return;
    var orig = global.render;
    global.render = function () { var r = orig.apply(this, arguments); try { renderCoach(); } catch (e) {} return r; };
    global.render.__coach = true;
  }
  function boot() {
    injectCss(); ensureBoard(); patchRenderSig(); patchRender(); renderCoach();
    setInterval(function () { patchRenderSig(); patchRender(); }, 1000);
  }
  global.BTX_COACH = { render: renderCoach, lessonFor: lessonFor };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
