/**
 * Prawdziwe ceny LIVE (Twelve Data) — jedno zrodlo prawdy o swiezosci danych.
 *
 * Problemy, ktore naprawia:
 *  1) fetchTwelve zwracal undefined przy bledzie, a hardening/live-hard-gate i tak oznaczaly
 *     symbol jako LIVE -> bot handlowal na symulowanych cenach (bazowe ceny z SYMBOLS sa stare).
 *     Teraz blad = wyjatek, wiec nic nie jest oznaczane jako LIVE.
 *  2) Odswiezanie round-robin: 1 symbol na cykl (180 s) => kazdy symbol ~33 min po czasie.
 *     Teraz: harmonogram odswieza kazdy symbol co ~5 min (z limitem 8 zapytan/min i budzetem dziennym).
 *  3) Czas swiec: Twelve zwraca czas gieldy bez strefy, a przegladarka czytala go jako lokalny
 *     (przesuniecie o godziny). Teraz timezone=UTC.
 *  4) Brama LIVE przepuszczala WSZYSTKIE symbole, gdy jakikolwiek byl LIVE. Teraz kazdy symbol
 *     musi miec wlasna swieza cene, inaczej sygnal = WAIT.
 *  5) Widoczny znacznik swiezosci cen (lewy dolny rog) + szczegoly po kliknieciu.
 */
(function (global) {
  'use strict';
  if (global.BTX_LIVE) return;

  var FRESH_MS = 15 * 60 * 1000;        // max wiek pobrania, by cene uznac za LIVE
  var BAR_MAX_AGE_MS = 30 * 60 * 1000;  // max wiek ostatniej swiecy, gdy sesja otwarta
  var MIN_GAP_MS = 8600;                // >= 8.6 s miedzy zapytaniami (limit 8/min)
  var PER_MIN = 7;
  var DAY_LIMIT = 780;                  // Twelve Basic: 800/dzien
  var BUDGET_LS = 'btx_live_budget';
  var KEY_LS = 'btx_twelve_key';

  // symbol w aplikacji -> parametry Twelve Data
  var TD_MAP = {
    'SIE.DE': { symbol: 'SIE', exchange: 'XETR' },
    'SAP': { symbol: 'SAP', exchange: 'XETR' },
    'ASML': { symbol: 'ASML', exchange: 'Euronext' }
  };
  var REFRESH_MIN = { US: 5, EU: 5, FX: 10 };

  var info = {};          // sym -> { ok, price, barT, fetchedAt, err, errAt, permanent }
  var reqTimes = [];      // czasy ostatnich zapytan
  var cooldownUntil = 0;
  var lastReq = 0;
  var busy = false;

  // ---------- pomocnicze ----------
  function now() { return Date.now(); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function budget() {
    var b = { day: today(), n: 0 };
    try {
      var r = JSON.parse(localStorage.getItem(BUDGET_LS) || 'null');
      if (r && r.day === b.day) b = r;
    } catch (e) {}
    return b;
  }
  function bumpBudget() {
    var b = budget();
    b.n++;
    try { localStorage.setItem(BUDGET_LS, JSON.stringify(b)); } catch (e) {}
  }

  function getKey() {
    var el = document.getElementById('btx-tdkey-main');
    if (el && String(el.value || '').trim()) return String(el.value).trim();
    el = document.getElementById('set-tdkey');
    if (el && String(el.value || '').trim()) return String(el.value).trim();
    try {
      var k = localStorage.getItem(KEY_LS);
      if (k && k.trim()) return k.trim();
    } catch (e) {}
    var C = global.CFG || {};
    var c = C.tdKey || C.twelveKey || C.apiKey;
    if (c && String(c).trim()) return String(c).trim();
    try {
      var o = JSON.parse(localStorage.getItem('btx_v4') || 'null');
      var ck = o && o.CFG && (o.CFG.tdKey || o.CFG.twelveKey || o.CFG.apiKey);
      if (ck) return String(ck).trim();
    } catch (e2) {}
    return '';
  }

  function symMeta(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i];
    return null;
  }

  function sessionOpen(mkt) {
    try { if (typeof global.sessionOpen === 'function') return !!global.sessionOpen(mkt); } catch (e) {}
    return true;
  }

  function slog(msg, cls) { try { if (typeof global.log === 'function') global.log(msg, cls || 'i'); } catch (e) {} }

  function parseUtc(dt) {
    var s = String(dt || '').trim();
    if (!s) return NaN;
    if (s.length <= 10) s += ' 00:00:00';
    return Date.parse(s.replace(' ', 'T') + 'Z');
  }

  // ---------- pobieranie ----------
  function checkLimits() {
    var t = now();
    reqTimes = reqTimes.filter(function (x) { return t - x < 60000; });
    if (t < cooldownUntil) throw new Error('limit zapytan Twelve — pauza ' + Math.ceil((cooldownUntil - t) / 1000) + ' s');
    if (reqTimes.length >= PER_MIN) throw new Error('limit 8 zapytan/min — odczekaj chwile');
    if (budget().n >= DAY_LIMIT) throw new Error('wyczerpany dzienny limit Twelve (' + DAY_LIMIT + ')');
  }

  async function fetchTwelve(sym) {
    var key = getKey();
    if (!key) {
      info[sym] = Object.assign(info[sym] || {}, { ok: false, err: 'brak klucza Twelve', errAt: now() });
      throw new Error('Brak klucza Twelve Data (Ustawienia)');
    }
    // dedupe: nie marnuj limitu na symbol swiezo pobrany lub z zamknietego rynku (np. round-robin z pro-assistant)
    var cur = info[sym];
    if (cur && cur.ok && cur.fetchedAt) {
      var m0 = symMeta(sym);
      if (now() - cur.fetchedAt < 150000 || (m0 && !sessionOpen(m0.mkt))) return (global.ST && global.ST.series && global.ST.series[sym]) || [];
    }
    checkLimits();
    var p = TD_MAP[sym] || { symbol: sym };
    var url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(p.symbol) +
      (p.exchange ? '&exchange=' + encodeURIComponent(p.exchange) : '') +
      '&interval=5min&outputsize=400&timezone=UTC&apikey=' + encodeURIComponent(key);
    reqTimes.push(now());
    lastReq = now();
    bumpBudget();
    var j;
    try {
      var r = await fetch(url);
      j = await r.json();
    } catch (e) {
      info[sym] = Object.assign(info[sym] || {}, { ok: false, err: 'siec: ' + (e.message || e), errAt: now() });
      throw e;
    }
    if (!j || j.status === 'error' || !j.values || !j.values.length) {
      var msg = (j && j.message) || 'brak danych';
      var code = j && j.code;
      if (code === 429 || /run out of API credits|per minute/i.test(msg)) cooldownUntil = now() + 65000;
      var permanent = code === 400 || code === 401 || code === 403 || code === 404 || /plan|symbol|not found|exchange/i.test(msg);
      info[sym] = Object.assign(info[sym] || {}, { ok: false, err: msg, errAt: now(), permanent: permanent && code !== 429 });
      slog('Twelve [' + sym + ']: ' + msg, 'r');
      throw new Error('Twelve [' + sym + ']: ' + msg);
    }
    var bars = [];
    for (var i = j.values.length - 1; i >= 0; i--) {
      var v = j.values[i];
      var b = { t: parseUtc(v.datetime), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) };
      if (isFinite(b.t) && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0) bars.push(b);
    }
    if (bars.length < 20) {
      info[sym] = Object.assign(info[sym] || {}, { ok: false, err: 'za malo swiec (' + bars.length + ')', errAt: now() });
      throw new Error('Twelve [' + sym + ']: za malo swiec');
    }
    var ST = global.ST;
    if (ST) {
      ST.series = ST.series || {};
      ST.series[sym] = bars;
      ST.liveSource = ST.liveSource || {};
      ST.liveSource[sym] = now();
    }
    var last = bars[bars.length - 1];
    info[sym] = { ok: true, price: last.c, barT: last.t, fetchedAt: now(), err: '' };
    return bars;
  }

  // Dluga historia do backtestu (nie rusza ST.series). Liczy sie do limitow/budzetu jak kazde zapytanie.
  async function fetchHistory(sym, size) {
    var key = getKey();
    if (!key) throw new Error('Brak klucza Twelve Data (Ustawienia)');
    checkLimits();
    var p = TD_MAP[sym] || { symbol: sym };
    var url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(p.symbol) +
      (p.exchange ? '&exchange=' + encodeURIComponent(p.exchange) : '') +
      '&interval=5min&outputsize=' + (size || 5000) + '&timezone=UTC&apikey=' + encodeURIComponent(key);
    reqTimes.push(now()); lastReq = now(); bumpBudget();
    var j = await (await fetch(url)).json();
    if (!j || j.status === 'error' || !j.values || !j.values.length) {
      if (j && (j.code === 429 || /per minute|credits/i.test(j.message || ''))) cooldownUntil = now() + 65000;
      throw new Error('Twelve [' + sym + ']: ' + ((j && j.message) || 'brak danych'));
    }
    var bars = [];
    for (var i = j.values.length - 1; i >= 0; i--) {
      var v = j.values[i];
      var b = { t: parseUtc(v.datetime), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) };
      if (isFinite(b.t) && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0) bars.push(b);
    }
    return bars;
  }
  // ---------- harmonogram ----------
  function providerIsTwelve() {
    var p = String((global.CFG && global.CFG.provider) || 'twelve');
    return p === 'twelve';
  }

  function refreshMs(m) {
    var base = (REFRESH_MIN[m.mkt] || 5) * 60000;
    var used = budget().n / DAY_LIMIT;
    if (used > 0.85) return base * 4;
    if (used > 0.6) return base * 2;
    return base;
  }

  function pickNext() {
    var list = global.SYMBOLS || [];
    var t = now();
    var best = null, bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var m = list[i], inf = info[m.s];
      if (inf && inf.permanent && t - inf.errAt < 6 * 3600000) continue;     // symbol niedostepny w planie
      if (inf && !inf.ok && inf.errAt && t - inf.errAt < 60000) continue;    // krotki backoff po bledzie
      if (!sessionOpen(m.mkt) && inf && inf.ok) continue;                    // rynek zamkniety, mamy ostatnie ceny
      var age = inf && inf.fetchedAt ? t - inf.fetchedAt : Infinity;
      if (age < refreshMs(m)) continue;
      var score = age === Infinity ? 1e12 : age;
      if (score > bestScore) { best = m; bestScore = score; }
    }
    return best;
  }

  async function tick() {
    if (busy || document.hidden || !providerIsTwelve() || !getKey()) return;
    var t = now();
    if (t < cooldownUntil || t - lastReq < MIN_GAP_MS) return;
    if (budget().n >= DAY_LIMIT) return;
    var m = pickNext();
    if (!m) return;
    busy = true;
    try {
      if (typeof global.fetchReal === 'function') await global.fetchReal(m.s);
      else await fetchTwelve(m.s);
    } catch (e) { /* stan bledu jest w info[] */ }
    busy = false;
    try { if (typeof global.render === 'function') global.render(); } catch (e2) {}
  }

  // ---------- swiezosc / brama ----------
  function status(m) {
    var inf = info[m.s], t = now();
    if (!getKey()) return { ok: false, why: 'brak klucza Twelve' };
    if (!inf || !inf.fetchedAt) return { ok: false, why: inf && inf.err ? inf.err : 'jeszcze nie pobrano' };
    if (t - inf.fetchedAt > FRESH_MS) return { ok: false, why: 'dane sprzed ' + Math.round((t - inf.fetchedAt) / 60000) + ' min' + (inf.err ? ' (' + inf.err + ')' : '') };
    if (sessionOpen(m.mkt) && t - inf.barT > BAR_MAX_AGE_MS) return { ok: false, why: 'ostatnia swieca sprzed ' + Math.round((t - inf.barT) / 60000) + ' min' };
    return { ok: true, why: '' };
  }

  function copyFlags(from, to) {
    Object.keys(from).forEach(function (k) { try { to[k] = from[k]; } catch (e) {} });
  }

  var wraps = 0;
  function installGuards() {
    if (typeof global.evaluate === 'function' && !global.evaluate.__btxTruth) {
      var oe = global.evaluate;
      global.evaluate = function (m) {
        var sym = m && (m.s || m.sym);
        var meta = (sym && symMeta(sym)) || m;
        if (sym && meta) {
          var s = status(meta);
          if (!s.ok) {
            var inf = info[sym];
            return { sym: sym, name: meta.n || sym, side: 'WAIT', strength: 0, price: inf && inf.price ? inf.price : 0,
              why: 'Brak swiezej ceny LIVE: ' + s.why, liveBlocked: true };
          }
        }
        return oe.apply(this, arguments);
      };
      copyFlags(oe, global.evaluate);
      global.evaluate.__btxTruth = true;
      wraps++;
    }
    if (typeof global.nextBar === 'function' && !global.nextBar.__btxTruth) {
      var on = global.nextBar;
      global.nextBar = function (m, last) {
        var sym = m && (m.s || m.sym);
        if (sym && info[sym] && info[sym].ok) return last; // nigdy nie doklejaj losowej swiecy do prawdziwych danych
        return on.apply(this, arguments);
      };
      copyFlags(on, global.nextBar);
      global.nextBar.__btxTruth = true;
      wraps++;
    }
  }

  function setFetch() {
    global.fetchTwelve = fetchTwelve;
  }

  // ---------- UI ----------
  var badge, panel;
  function ensureUi() {
    if (badge && document.body.contains(badge)) return;
    badge = document.createElement('div');
    badge.id = 'btx-live-badge';
    badge.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;padding:6px 10px;border-radius:10px;' +
      'font:600 12px ui-monospace,Menlo,Consolas,monospace;cursor:pointer;background:#1e293b;color:#e2e8f0;' +
      'border:1px solid #334155;font-variant-numeric:tabular-nums;max-width:92vw';
    badge.title = 'Kliknij: szczegoly cen LIVE';
    panel = document.createElement('div');
    panel.id = 'btx-live-panel';
    panel.style.cssText = 'position:fixed;left:10px;bottom:46px;z-index:9999;display:none;padding:10px 12px;border-radius:10px;' +
      'font:12px ui-monospace,Menlo,Consolas,monospace;background:#0f172a;color:#e2e8f0;border:1px solid #334155;max-height:60vh;overflow:auto';
    badge.addEventListener('click', function () { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; renderUi(); });
    document.body.appendChild(panel);
    document.body.appendChild(badge);
  }

  function ago(ts) {
    if (!ts) return '—';
    var m = Math.round((now() - ts) / 60000);
    return m < 1 ? '<1 min' : m + ' min';
  }

  function renderUi() {
    ensureUi();
    var list = global.SYMBOLS || [];
    var okN = 0, oldest = 0, rows = '';
    list.forEach(function (m) {
      var s = status(m), inf = info[m.s] || {};
      if (s.ok) { okN++; oldest = Math.max(oldest, now() - inf.fetchedAt); }
      var open = sessionOpen(m.mkt);
      rows += '<tr><td style="padding:1px 8px 1px 0">' + m.s + '</td><td style="padding:1px 8px;text-align:right">' +
        (inf.price ? inf.price.toFixed(inf.price < 10 ? 4 : 2) : '—') + '</td><td style="padding:1px 8px">' + ago(inf.fetchedAt) +
        '</td><td style="padding:1px 0;color:' + (s.ok ? '#34d399' : (open ? '#f87171' : '#94a3b8')) + '">' +
        (s.ok ? 'LIVE' : (open ? 'BRAK: ' : 'rynek zamkniety — ') + s.why) + '</td></tr>';
    });
    var b = budget();
    var hasKey = !!getKey();
    var color = !hasKey ? '#7f1d1d' : (okN === 0 ? '#7f1d1d' : (okN < list.length ? '#78350f' : '#064e3b'));
    badge.style.background = color;
    badge.textContent = !hasKey ? 'CENY: BRAK KLUCZA — symulacja' :
      'CENY LIVE ' + okN + '/' + list.length + (okN ? ' · najstarsza ' + Math.round(oldest / 60000) + ' min' : '') + ' · API ' + b.n + '/' + DAY_LIMIT;
    if (panel.style.display !== 'none') {
      panel.innerHTML = '<table style="border-collapse:collapse">' + rows + '</table>' +
        '<div style="margin-top:6px;color:#94a3b8">Symbol bez swiezej ceny = sygnal WAIT (bot nie handluje na symulacji).</div>';
    }
  }

  function boot() {
    setFetch();
    ensureUi();
    renderUi();
    setTimeout(function () { setFetch(); installGuards(); }, 3000);
    setInterval(function () { if (wraps < 4) installGuards(); setFetch(); }, 7000);
    setInterval(tick, 3000);
    setInterval(renderUi, 5000);
  }

  global.BTX_LIVE = {
    info: info, status: status, fetchTwelve: fetchTwelve, fetchHistory: fetchHistory, getKey: getKey, budget: budget,
    isFresh: function (sym) { var m = symMeta(sym); return m ? status(m).ok : false; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
