/**
 * BTX — prawdziwszy kalendarz makro (HIGH)
 * Źródła (kolejno): showmytrades public API, fallback FF JSON, potem szablon lokalny
 */
(function (global) {
  var CACHE_K = 'BTX_MACRO_CACHE_V1';
  var ROOT = 'btx-macro-cal';
  var PAD_MIN = 30;

  function injectCss() {
    if (document.getElementById('btx-macro-css')) return;
    var s = document.createElement('style');
    s.id = 'btx-macro-css';
    s.textContent = '#' + ROOT + '{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(245,179,1,.35);background:rgba(245,179,1,.07)}'
      + '#' + ROOT + ' h3{margin:0 0 6px;font-size:13px}'
      + '#' + ROOT + ' .why{font-size:12px;color:var(--tx2);margin:0 0 10px;line-height:1.45}'
      + '#' + ROOT + ' table{width:100%;border-collapse:collapse;font-size:12px}'
      + '#' + ROOT + ' th,#' + ROOT + ' td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left}'
      + '#' + ROOT + ' .hi{color:#f87171;font-weight:700}'
      + '#' + ROOT + ' .soon{color:#f5b301}';
    document.head.appendChild(s);
  }

  function saveCache(events, source) {
    try { localStorage.setItem(CACHE_K, JSON.stringify({ t: Date.now(), source: source, events: events })); } catch (e) {}
  }
  function loadCache() {
    try {
      var o = JSON.parse(localStorage.getItem(CACHE_K) || 'null');
      if (!o || !o.events) return null;
      if (Date.now() - o.t > 6 * 3600 * 1000) return null;
      return o;
    } catch (e) { return null; }
  }

  async function fetchShowMyTrades() {
    var url = 'https://showmytrades.com/api/public/calendar/v1?currency=USD,EUR&impact=high&days=5';
    var r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var j = await r.json();
    var ev = (j.events || []).map(function (e) {
      return {
        title: e.title || e.name || 'Event',
        currency: e.currency || '',
        impact: (e.impact || 'high').toLowerCase(),
        time: e.time || (e.ts ? new Date(e.ts * 1000).toISOString() : null),
        forecast: e.forecast || '',
        previous: e.previous || '',
        actual: e.actual || ''
      };
    });
    return ev;
  }

  async function fetchFF() {
    var urls = [
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json'
    ];
    var lastErr;
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i]);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var j = await r.json();
        var ev = (Array.isArray(j) ? j : []).filter(function (e) {
          return /high/i.test(e.impact || '') && /USD|EUR/i.test(e.country || e.currency || '');
        }).map(function (e) {
          return {
            title: e.title,
            currency: e.country || e.currency || '',
            impact: 'high',
            time: e.date,
            forecast: e.forecast || '',
            previous: e.previous || '',
            actual: e.actual || ''
          };
        });
        return ev;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('FF fail');
  }

  function templateFallback() {
    // tylko gdy sieć/CORS nie działa
    var day = new Date();
    day.setUTCHours(12, 30, 0, 0);
    return [{
      title: 'Szablon: blok danych US (nie żywy feed)',
      currency: 'USD',
      impact: 'high',
      time: day.toISOString(),
      forecast: '',
      previous: '',
      actual: ''
    }];
  }

  async function loadEvents() {
    var cached = loadCache();
    if (cached) return cached;
    try {
      var ev = await fetchShowMyTrades();
      saveCache(ev, 'showmytrades');
      return { source: 'showmytrades', events: ev, t: Date.now() };
    } catch (e1) {
      try {
        var ev2 = await fetchFF();
        saveCache(ev2, 'forexfactory-json');
        return { source: 'forexfactory-json', events: ev2, t: Date.now() };
      } catch (e2) {
        var ev3 = templateFallback();
        return { source: 'szablon-lokalny', events: ev3, t: Date.now(), error: String(e2.message || e2) };
      }
    }
  }

  function fmtWhen(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var pl = d.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var utc = d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    return pl + ' · ' + utc;
  }

  function ensureRoot() {
    injectCss();
    var el = document.getElementById(ROOT);
    if (el) return el;
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    el = document.createElement('div');
    el.id = ROOT;
    pane.appendChild(el);
    return el;
  }

  function isBlockedNow(events) {
    var now = Date.now();
    for (var i = 0; i < events.length; i++) {
      var t = new Date(events[i].time).getTime();
      if (!isFinite(t)) continue;
      if (Math.abs(t - now) <= PAD_MIN * 60 * 1000) return events[i];
    }
    return null;
  }

  async function render() {
    var el = ensureRoot();
    if (!el) return;
    el.innerHTML = '<div class="why">Ładuję kalendarz makro…</div>';
    var pack = await loadEvents();
    var events = (pack.events || []).slice().sort(function (a, b) {
      return new Date(a.time) - new Date(b.time);
    });
    // tylko przyszłe + dzisiejsze minione HIGH z buforem 2h wstecz
    var now = Date.now();
    events = events.filter(function (e) {
      var t = new Date(e.time).getTime();
      return isFinite(t) && t > now - 2 * 3600 * 1000;
    }).slice(0, 12);

    var block = isBlockedNow(pack.events || []);
    global.__BTX_MACRO_BLOCK = block;

    var html = '<h3>Kalendarz makro (HIGH)</h3>';
    html += '<p class="why"><b>Po co:</b> prawdziwsze godziny publikacji (CPI, NFP, banki centralne), nie tylko szablon. W oknie ±' + PAD_MIN + ' min lepiej nie otwierać nowych pozycji.</p>';
    html += '<div class="why">Źródło: <b>' + (pack.source || '?') + '</b>' + (pack.error ? (' · fallback (' + pack.error + ')') : '') + '</div>';
    if (block) {
      html += '<div class="hi">BLACKOUT TERAZ: ' + block.title + ' (' + (block.currency || '') + ')</div>';
    }
    if (!events.length) {
      html += '<div class="why">Brak HIGH USD/EUR w pobliżu — i tak sprawdzaj broker/kalendarz przed sesją.</div>';
    } else {
      html += '<table><thead><tr><th>Kiedy (PL)</th><th>Waluta</th><th>Wydarzenie</th><th>Prognoza</th></tr></thead><tbody>';
      events.forEach(function (e) {
        var t = new Date(e.time).getTime();
        var cls = (Math.abs(t - now) <= PAD_MIN * 60 * 1000) ? 'hi' : (t - now < 3 * 3600 * 1000 ? 'soon' : '');
        html += '<tr class="' + cls + '"><td>' + fmtWhen(e.time) + '</td><td>' + (e.currency || '') + '</td><td>' + (e.title || '') + '</td><td>' + (e.forecast || '—') + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div class="why" style="margin-top:8px">To nie rekomendacja inwestycyjna. Feed publiczny może się spóźniać — przy wątpliwości nie wchodź.</div>';
    html += '<button type="button" class="btn ghost" id="btx-macro-refresh" style="margin-top:8px">Odśwież kalendarz</button>';
    el.innerHTML = html;
    var b = document.getElementById('btx-macro-refresh');
    if (b) b.onclick = function () {
      try { localStorage.removeItem(CACHE_K); } catch (e) {}
      render();
    };
  }

  // blokada openPos przy żywym HIGH
  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__macro) return;
    var orig = global.openPos;
    global.openPos = function () {
      if (global.__BTX_MACRO_BLOCK) {
        if (global.toast) global.toast('Kalendarz HIGH: ' + global.__BTX_MACRO_BLOCK.title + ' — poczekaj', 'info');
        return;
      }
      return orig.apply(this, arguments);
    };
    global.openPos.__macro = true;
  }

  function boot() {
    patchOpen();
    render();
    setInterval(function () { patchOpen(); render(); }, 10 * 60 * 1000);
  }

  global.BTX_MACRO = { render: render, loadEvents: loadEvents };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
