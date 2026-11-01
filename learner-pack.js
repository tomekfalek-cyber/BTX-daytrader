/**
 * BTX Learner Pack — funkcje edukacyjne + ochrona konta
 * Wszystko z opisem "co to daje" prostym językiem.
 */
(function (global) {
  var STYLE = 'btx-learner-css';
  var LS_MODE = 'BTX_TRADE_MODE'; // observe | trade
  var LS_SIGLOG = 'BTX_SIG_LOG_V1';
  var LS_STOP = 'BTX_STOP_DAY';
  var LS_COSTS = 'BTX_COST_MODEL';

  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '#btx-learn{display:grid;gap:12px;margin:12px 0 16px}',
      '#btx-learn .ln-card{background:linear-gradient(180deg,var(--bg3,#181d26),var(--bg2,#12161d));border:1px solid var(--line,rgba(255,255,255,.08));border-radius:14px;padding:14px 16px}',
      '#btx-learn h3{margin:0 0 6px;font-size:13px;font-weight:700;color:#e8eef7}',
      '#btx-learn .why{font-size:12px;color:var(--tx2,#9aa4b2);line-height:1.5;margin:0 0 10px}',
      '#btx-learn .why b{color:#d1e0f0}',
      '#btx-learn .body{font-size:12.5px;line-height:1.5;color:var(--tx,#c9d4e0)}',
      '#btx-learn .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}',
      '#btx-learn .pill{display:inline-flex;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700}',
      '#btx-learn .pill.ok{background:rgba(18,196,139,.15);color:#12c48b}',
      '#btx-learn .pill.bad{background:rgba(240,68,82,.18);color:#f87171}',
      '#btx-learn .pill.warn{background:rgba(245,179,1,.15);color:#f5b301}',
      '#btx-learn .pill.info{background:rgba(59,130,246,.15);color:#93c5fd}',
      '#btx-learn table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}',
      '#btx-learn th,#btx-learn td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}',
      '#btx-learn th{color:var(--tx3);font-size:10px;text-transform:uppercase;letter-spacing:.06em}',
      '#btx-stop-banner{display:none;position:sticky;top:0;z-index:50;margin:0 0 12px;padding:12px 16px;border-radius:12px;background:rgba(240,68,82,.16);border:1px solid rgba(240,68,82,.45);color:#fecaca;font-weight:700;font-size:14px}',
      '#btx-stop-banner.on{display:block}',
      '#btx-learn input[type=number]{width:90px;background:var(--bg4,#202733);border:1px solid var(--line);color:#fff;border-radius:8px;padding:6px 8px}',
      '#btx-learn .btn{cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  function modeGet() {
    try { return localStorage.getItem(LS_MODE) || 'observe'; } catch (e) { return 'observe'; }
  }
  function modeSet(m) {
    try { localStorage.setItem(LS_MODE, m); } catch (e) {}
  }

  function costsGet() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_COSTS) || '{}');
      return {
        spreadPct: o.spreadPct != null ? +o.spreadPct : 0.02, // % ceny orientacyjnie
        commission: o.commission != null ? +o.commission : 0 // PLN na stronę
      };
    } catch (e) {
      return { spreadPct: 0.02, commission: 0 };
    }
  }
  function costsSet(c) {
    try { localStorage.setItem(LS_COSTS, JSON.stringify(c)); } catch (e) {}
  }

  function stopState() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_STOP) || 'null');
      if (!o) return { stopped: false };
      // reset po zmianie dnia (lokalnie PL)
      var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      if (o.day !== day) return { stopped: false };
      return o;
    } catch (e) { return { stopped: false }; }
  }
  function stopSet(reason) {
    var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    var o = { stopped: true, reason: reason || 'limit dnia', day: day, t: Date.now() };
    try { localStorage.setItem(LS_STOP, JSON.stringify(o)); } catch (e) {}
    return o;
  }
  function stopClear() {
    try { localStorage.removeItem(LS_STOP); } catch (e) {}
  }

  function dayPnlAndStreak() {
    var ST = global.ST || {};
    var closed = ST.closed || [];
    var dayPnl = 0, consecLoss = 0;
    // ostatnie trade'y — licz serię strat od najnowszych
    for (var i = 0; i < closed.length; i++) {
      dayPnl += (closed[i].pnl || 0);
    }
    for (var j = 0; j < closed.length; j++) {
      if ((closed[j].pnl || 0) < 0) consecLoss++;
      else break;
    }
    var eq = ST.equity != null ? ST.equity : ((global.CFG && global.CFG.capital) || 100000);
    var start = (global.CFG && global.CFG.capital) || eq;
    var ddPct = start ? ((start - eq) / start) * 100 : 0;
    // dzienny limit ~1.5% od kapitału startowego sesji paper
    var lossPct = start ? Math.max(0, -dayPnl / start * 100) : 0;
    return { dayPnl: dayPnl, consecLoss: consecLoss, lossPct: lossPct, eq: eq, start: start, n: closed.length };
  }

  function checkHardStop() {
    var st = stopState();
    if (st.stopped) return st;
    var d = dayPnlAndStreak();
    var maxLoss = (global.BTX_PRO && global.BTX_PRO.dailyLossPct) || 1.5;
    var maxConsec = (global.BTX_PRO && global.BTX_PRO.maxConsecLoss) || 3;
    if (d.lossPct >= maxLoss) return stopSet('Dzienny limit straty (~' + maxLoss + '%) osiągnięty. Koniec nowych wejść na dziś.');
    if (d.consecLoss >= maxConsec) return stopSet('3 straty z rzędu. STOP FOR DAY — chroń głowę i kapitał.');
    return { stopped: false };
  }

  function sigLogLoad() {
    try { return JSON.parse(localStorage.getItem(LS_SIGLOG) || '[]'); } catch (e) { return []; }
  }
  function sigLogSave(arr) {
    try { localStorage.setItem(LS_SIGLOG, JSON.stringify(arr.slice(0, 80))); } catch (e) {}
  }
  function sigLogAdd(entry) {
    var arr = sigLogLoad();
    // unikaj duplikatu tego samego sym+side w krótkim czasie
    var key = entry.sym + '|' + entry.side + '|' + entry.strength;
    if (arr[0] && arr[0]._key === key && (Date.now() - arr[0].t) < 10 * 60 * 1000) return;
    entry._key = key;
    entry.t = Date.now();
    arr.unshift(entry);
    sigLogSave(arr);
  }

  function isAPlus(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return false;
    if ((g.strength || 0) < 4) return false;
    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var dg = global.BTX_PRO6.dataGate();
      if (dg.blockSignals) return false;
    }
    if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
      var n = global.BTX_PRO6.highNewsNow();
      if (n.blocked) return false;
    }
    var stop = checkHardStop();
    if (stop.stopped) return false;
    if (modeGet() === 'observe') return false; // alerty A+ tylko gdy tryb trade
    return true;
  }

  var lastAPlusKey = '';
  function maybeAPlusAlert() {
    var sig = (global.ST && global.ST.sig) || [];
    var best = sig.filter(isAPlus).sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })[0];
    if (!best) return;
    var key = best.sym + best.side + best.strength;
    if (key === lastAPlusKey) return;
    lastAPlusKey = key;
    // dźwięk jeśli włączony globalnie
    try {
      if (localStorage.getItem('BTX_ALERTS_ON') !== '0' && global.BTX_PRO_DESK) {
        /* pro-desk może mieć własny beep — tu krótki beep */
        var ctx = global.__btxAudio || (global.__btxAudio = new (window.AudioContext || window.webkitAudioContext)());
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.03; o.start(); o.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {}
    if (global.toast) global.toast('A+ sygnał: ' + best.side + ' ' + best.sym + ' (siła ' + best.strength + ')', 'ok');
    if (global.log) global.log('A+ alert: ' + best.side + ' ' + best.sym, 'g');
  }

  function playbook() {
    var lines = [];
    var now = new Date();
    var pl = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', hour: '2-digit', minute: '2-digit' });
    lines.push('Dziś: ' + pl);

    var day = now.getDay();
    if (day === 0 || day === 6) {
      lines.push('Dzień: WEEKEND — nie otwieraj stock/ETF.');
    } else {
      lines.push('Dzień roboczy — główne okno akcji US po południu (PL).');
    }

    if (global.BTX_PRO6 && global.BTX_PRO6.dataGate) {
      var dg = global.BTX_PRO6.dataGate();
      lines.push('Dane: ' + dg.label + ' — ' + dg.tip);
    } else {
      lines.push('Dane: sprawdź Ustawienia (Twelve LIVE).');
    }

    if (global.BTX_PRO_DESK && global.BTX_PRO_DESK.newsToday) {
      /* optional */
    }
    if (global.BTX_PRO6 && global.BTX_PRO6.highNewsNow) {
      var hn = global.BTX_PRO6.highNewsNow();
      lines.push('News: ' + hn.headline);
    }

    // reżim SPY prosto
    try {
      var b = global.ST && global.ST.series && global.ST.series.SPY;
      if (b && b.length > 30) {
        var c = b[b.length - 1].c, s = 0, n = Math.min(20, b.length);
        for (var i = b.length - n; i < b.length; i++) s += b[i].c;
        s /= n;
        lines.push(c >= s ? 'SPY: powyżej średniej krótkiej → łatwiej o LONG tylko z trendem.' : 'SPY: poniżej średniej → ostrożnie z longami.');
      } else lines.push('SPY: brak danych — uruchom cykl.');
    } catch (e) {}

    lines.push('Limit dnia: max 4 trade’y, ryzyko 0,5%/trade, stop po ~1,5% straty lub 3 stratach z rzędu.');
    lines.push('Dziś handluję tylko setupy A+ (siła ≥ 4, LIVE, poza HIGH news, klaster OK).');
    return lines;
  }

  function applyCostToR(t) {
    if (!t) return null;
    var costs = costsGet();
    var entry = t.entry || 0;
    var exit = t.exit != null ? t.exit : entry;
    var qty = t.qty || 1;
    var risk = t.risk0 != null ? t.risk0 : Math.abs(entry - (t.stop != null ? t.stop : entry));
    if (!risk || risk < 1e-12) return null;
    var gross = t.side === 'LONG' ? (exit - entry) : (entry - exit);
    // koszt orientacyjny: spread% * cena * 2 (wej+wyj) / jednostkę + prowizja
    var spreadCost = entry * (costs.spreadPct / 100) * 2;
    var fee = (costs.commission || 0) * 2 / Math.max(qty, 1);
    var net = gross - spreadCost - fee;
    return { rGross: gross / risk, rNet: net / risk, spreadCost: spreadCost, fee: fee };
  }

  function ensureRoot() {
    injectCss();
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    var ban = document.getElementById('btx-stop-banner');
    if (!ban) {
      ban = document.createElement('div');
      ban.id = 'btx-stop-banner';
      if (pane.firstChild) pane.insertBefore(ban, pane.firstChild);
      else pane.appendChild(ban);
    }
    var root = document.getElementById('btx-learn');
    if (!root) {
      root = document.createElement('div');
      root.id = 'btx-learn';
      // po bannerze
      if (ban.nextSibling) pane.insertBefore(root, ban.nextSibling);
      else pane.appendChild(root);
    }
    return root;
  }

  function render() {
    var root = ensureRoot();
    if (!root) return;
    var stop = checkHardStop();
    var ban = document.getElementById('btx-stop-banner');
    if (ban) {
      if (stop.stopped) {
        ban.className = 'on';
        ban.innerHTML = 'STOP FOR DAY — ' + (stop.reason || 'limit dnia') + ' <button type="button" class="btn ghost" id="btx-stop-clear" style="margin-left:10px">Odblokuj (świadomie)</button>';
        var cl = document.getElementById('btx-stop-clear');
        if (cl) cl.onclick = function () { stopClear(); render(); };
      } else {
        ban.className = '';
        ban.innerHTML = '';
      }
    }

    var mode = modeGet();
    var costs = costsGet();
    var pb = playbook();
    var d = dayPnlAndStreak();
    var log = sigLogLoad().slice(0, 12);

    // loguj bieżące A / sygnały
    var sig = (global.ST && global.ST.sig) || [];
    sig.filter(function (g) { return g.side === 'LONG' || g.side === 'SHORT'; }).slice(0, 3).forEach(function (g) {
      sigLogAdd({
        sym: g.sym,
        side: g.side,
        strength: g.strength || 0,
        aPlus: isAPlus(g),
        entered: null, // użytkownik oznacza
        note: ''
      });
    });
    log = sigLogLoad().slice(0, 12);

    var html = '';

    // PLAYBOOK
    html += '<div class="ln-card">';
    html += '<h3>1. Playbook dnia — "co dziś robię?"</h3>';
    html += '<p class="why"><b>Po co:</b> zanim klikniesz cokolwiek na XTB, wiesz czy w ogóle dziś handlujesz, jakie są limity i czy dane / news pozwalają. To jak krótka odprawa przed sesją.</p>';
    html += '<div class="body">';
    pb.forEach(function (l) { html += '• ' + l + '<br>'; });
    html += '</div></div>';

    // MODE
    html += '<div class="ln-card">';
    html += '<h3>2. Tryb: obserwacja albo handel</h3>';
    html += '<p class="why"><b>Po co:</b> w słaby dzień albo po stratach łatwo "się odegrać". Tryb obserwacji wyłącza myślenie "muszę kliknąć". Uczysz się też czytać rynek bez presji.</p>';
    html += '<div class="row">';
    html += '<span class="pill ' + (mode === 'observe' ? 'info' : 'ok') + '">' + (mode === 'observe' ? 'OBSERWACJA' : 'MOGĘ KLIKAĆ XTB') + '</span>';
    html += '<button type="button" class="btn" id="btx-mode-obs">Tylko obserwuję</button>';
    html += '<button type="button" class="btn" id="btx-mode-trade">Mogę klikać XTB</button>';
    html += '</div>';
    html += '<div class="body" style="margin-top:8px">' + (mode === 'observe'
      ? 'Teraz uczysz się: patrzysz na sygnały, checklistę i plan — <b>bez</b> nowych wejść paper pod XTB.'
      : 'Tryb handlu: wolno rozważać wejścia A+ na XTB ręcznie (nadal limity PRO).') + '</div></div>';

    // STOP FOR DAY
    html += '<div class="ln-card">';
    html += '<h3>3. STOP FOR DAY — twardy hamulec</h3>';
    html += '<p class="why"><b>Po co:</b> profesjonaliści chronią kapitał limitem dziennym. Po serii strat emocje rosną — bot ma Cię zatrzymać, zanim "odzyskasz straty" jeszcze większym ryzykiem.</p>';
    html += '<div class="row">';
    html += stop.stopped
      ? '<span class="pill bad">STOP AKTYWNY</span>'
      : '<span class="pill ok">Dzień otwarty</span>';
    html += '<span class="body">P&L paper (suma zamkniętych): <b>' + (d.dayPnl >= 0 ? '+' : '') + d.dayPnl.toFixed(2) + '</b> · straty z rzędu: <b>' + d.consecLoss + '</b></span>';
    html += '</div>';
    html += '<div class="body" style="margin-top:6px">Próg: ~1,5% straty dziennej albo 3 straty z rzędu → baner czerwony i brak nowych wejść.</div></div>';

    // A+ ALERTS
    html += '<div class="ln-card">';
    html += '<h3>4. Alerty tylko A+ (jakość, nie ilość)</h3>';
    html += '<p class="why"><b>Po co:</b> za dużo alertów = ignorujesz je. A+ to sygnał z siłą ≥ 4, danymi LIVE, poza HIGH news, bez STOP FOR DAY i tylko w trybie handlu. Uczysz się czekać na jakość.</p>';
    var aCnt = sig.filter(isAPlus).length;
    html += '<div class="row"><span class="pill ' + (aCnt ? 'ok' : 'info') + '">' + (aCnt ? (aCnt + ' A+ teraz') : 'Brak A+ w tej chwili') + '</span>';
    html += '<span class="body">W trybie obserwacji alerty A+ są wyciszone celowo.</span></div></div>';

    // COSTS
    html += '<div class="ln-card">';
    html += '<h3>5. Koszty (spread / prowizja) w myśleniu o R</h3>';
    html += '<p class="why"><b>Po co:</b> na papierze łatwo wygrać "bez spredu". Na XTB zysk zjada spread i prowizja. Tu ustawiasz proste koszty orientacyjne, żeby myśleć realniej o R (zysk względem ryzyka).</p>';
    html += '<div class="row">Spread ~ <input type="number" step="0.01" id="btx-spread" value="' + costs.spreadPct + '"> % ceny (w+wy) · Prowizja <input type="number" step="0.01" id="btx-comm" value="' + costs.commission + '"> PLN / strona';
    html += '<button type="button" class="btn" id="btx-save-costs">Zapisz koszty</button></div>';
    var last = (global.ST && global.ST.closed && global.ST.closed[0]) || null;
    if (last) {
      var rr = applyCostToR(last);
      if (rr) {
        html += '<div class="body" style="margin-top:8px">Ostatni trade: R brutto <b>' + rr.rGross.toFixed(2) + 'R</b> → po kosztach ~ <b>' + rr.rNet.toFixed(2) + 'R</b></div>';
      }
    } else {
      html += '<div class="body" style="margin-top:8px">Jak zamkniesz paper trade, zobaczysz porównanie R brutto vs po kosztach.</div>';
    }
    html += '</div>';

    // SIGNAL vs YOU
    html += '<div class="ln-card">';
    html += '<h3>6. Sygnał bota vs Twoja decyzja</h3>';
    html += '<p class="why"><b>Po co:</b> uczysz się, czy tracisz bo bot daje słabe sygnały, czy bo wchodzisz wybiórczo / emocjonalnie. Zaznacz: wszedłem / pominąłem.</p>';
    if (!log.length) {
      html += '<div class="body">Brak zapisanych sygnałów — uruchom cykl w sesji.</div>';
    } else {
      html += '<table><thead><tr><th>Czas</th><th>Sygnał</th><th>Siła</th><th>A+</th><th>Twoja decyzja</th></tr></thead><tbody>';
      log.forEach(function (e, idx) {
        var tm = new Date(e.t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        html += '<tr><td>' + tm + '</td><td>' + e.side + ' ' + e.sym + '</td><td>' + e.strength + '</td><td>' + (e.aPlus ? 'tak' : 'nie') + '</td><td>';
        html += '<button type="button" class="btn ghost" data-sig-enter="' + idx + '">Wszedłem</button> ';
        html += '<button type="button" class="btn ghost" data-sig-skip="' + idx + '">Pominąłem</button> ';
        if (e.entered === true) html += '<span class="pill ok">wejście</span>';
        if (e.entered === false) html += '<span class="pill warn">skip</span>';
        html += '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    root.innerHTML = html;

    // binds
    var bObs = document.getElementById('btx-mode-obs');
    if (bObs) bObs.onclick = function () { modeSet('observe'); if (global.toast) global.toast('Tryb: tylko obserwacja', 'info'); render(); };
    var bTr = document.getElementById('btx-mode-trade');
    if (bTr) bTr.onclick = function () { modeSet('trade'); if (global.toast) global.toast('Tryb: możesz klikać XTB (A+)', 'ok'); render(); };
    var bCost = document.getElementById('btx-save-costs');
    if (bCost) bCost.onclick = function () {
      var sp = document.getElementById('btx-spread');
      var cm = document.getElementById('btx-comm');
      costsSet({ spreadPct: sp ? +sp.value : 0.02, commission: cm ? +cm.value : 0 });
      if (global.toast) global.toast('Zapisano model kosztów', 'ok');
      render();
    };
    root.querySelectorAll('[data-sig-enter]').forEach(function (btn) {
      btn.onclick = function () {
        var arr = sigLogLoad();
        var i = +btn.getAttribute('data-sig-enter');
        if (arr[i]) { arr[i].entered = true; sigLogSave(arr); render(); }
      };
    });
    root.querySelectorAll('[data-sig-skip]').forEach(function (btn) {
      btn.onclick = function () {
        var arr = sigLogLoad();
        var i = +btn.getAttribute('data-sig-skip');
        if (arr[i]) { arr[i].entered = false; sigLogSave(arr); render(); }
      };
    });
  }

  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__learner) return;
    var orig = global.openPos;
    global.openPos = function () {
      if (modeGet() === 'observe') {
        if (global.toast) global.toast('Tryb obserwacji — bez nowych wejść. Przełącz na "Mogę klikać XTB".', 'info');
        return;
      }
      var st = checkHardStop();
      if (st.stopped) {
        if (global.toast) global.toast('STOP FOR DAY: ' + st.reason, 'err');
        return;
      }
      return orig.apply(this, arguments);
    };
    global.openPos.__learner = true;
  }

  function patchRender() {
    if (typeof global.render === 'function' && !global.render.__learner) {
      var orig = global.render;
      global.render = function () {
        var r = orig.apply(this, arguments);
        try { checkHardStop(); render(); maybeAPlusAlert(); } catch (e) {}
        return r;
      };
      global.render.__learner = true;
    }
  }

  function boot() {
    injectCss();
    patchOpen();
    patchRender();
    try { render(); } catch (e) {}
    setInterval(function () {
      try { patchOpen(); patchRender(); checkHardStop(); render(); maybeAPlusAlert(); } catch (e) {}
    }, 5000);
  }

  global.BTX_LEARN = { render: render, modeGet: modeGet, checkHardStop: checkHardStop, isAPlus: isAPlus, applyCostToR: applyCostToR };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
