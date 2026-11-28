/**
 * Raporty + powiadomienia Telegram (daytrading pro).
 *  - zapisuje przy zamknieciu transakcji: czas (t) i wielokrotnosc ryzyka (R)
 *  - statystyki: win rate, profit factor, expectancy, avg R, max drawdown, koszty, podzial po symbolu/godzinie
 *  - alert Telegram po kazdym zamknieciu, podsumowanie dnia (22:05 PL), raport tygodniowy (pt 22:10 PL)
 *  - alert o braku swiezych cen LIVE w trakcie sesji US
 *  - przycisk "Raport" (prawy dolny rog): dzien / tydzien / poprzedni tydzien / wszystko, kopiuj, CSV, Telegram
 * UWAGA: wysylka automatyczna dziala tylko gdy karta z botem jest otwarta.
 */
(function (global) {
  'use strict';
  var TZ = 'Europe/Warsaw';

  // ================= STATYSTYKI (czyste funkcje, testowane w tests/) =================
  function num(x) { x = Number(x); return isFinite(x) ? x : 0; }
  function r2(x) { return Math.round(num(x) * 100) / 100; }

  function warsawParts(ts) {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
    var m = {};
    f.formatToParts(new Date(ts)).forEach(function (p) { m[p.type] = p.value; });
    var hour = parseInt(m.hour, 10) % 24;
    var y = +m.year, mo = +m.month, d = +m.day;
    var dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=nd
    return { y: y, mo: mo, d: d, hour: hour, min: parseInt(m.minute, 10), dow: dow };
  }

  function dayKey(ts) {
    var p = warsawParts(ts);
    return p.y + '-' + (p.mo < 10 ? '0' : '') + p.mo + '-' + (p.d < 10 ? '0' : '') + p.d;
  }

  function weekKey(ts) { // ISO tydzien w czasie warszawskim, np. 2026-W45
    var p = warsawParts(ts);
    var dt = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    var dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    var yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
    var wk = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
    return dt.getUTCFullYear() + '-W' + (wk < 10 ? '0' : '') + wk;
  }

  function computeStats(trades) {
    var list = (trades || []).filter(function (t) { return t && isFinite(Number(t.pnl)); });
    // kolejnosc chronologiczna: z czasem po t, bez czasu - odwrocona (ST.closed ma najnowsze pierwsze)
    var withT = list.filter(function (t) { return t.t; }).sort(function (a, b) { return a.t - b.t; });
    var noT = list.filter(function (t) { return !t.t; }).reverse();
    var ordered = noT.concat(withT);
    var s = {
      n: ordered.length, wins: 0, losses: 0, net: 0, grossWin: 0, grossLoss: 0, fees: 0,
      winRate: 0, profitFactor: null, avgWin: 0, avgLoss: 0, expectancy: 0, avgR: null, rCount: 0,
      maxDrawdown: 0, maxConsecLoss: 0, best: null, worst: null, bySym: {}, bySide: {}, byHour: {}
    };
    var cur = 0, peak = 0, streak = 0, rSum = 0;
    ordered.forEach(function (t) {
      var pnl = num(t.pnl);
      s.net += pnl;
      s.fees += num(t.fees);
      if (pnl > 0) { s.wins++; s.grossWin += pnl; streak = 0; }
      else if (pnl < 0) { s.losses++; s.grossLoss += pnl; streak++; if (streak > s.maxConsecLoss) s.maxConsecLoss = streak; }
      else streak = 0;
      cur += pnl; if (cur > peak) peak = cur; if (peak - cur > s.maxDrawdown) s.maxDrawdown = peak - cur;
      if (t.R != null && isFinite(Number(t.R))) { rSum += Number(t.R); s.rCount++; }
      if (!s.best || pnl > s.best.pnl) s.best = { sym: t.sym, pnl: pnl };
      if (!s.worst || pnl < s.worst.pnl) s.worst = { sym: t.sym, pnl: pnl };
      var bs = s.bySym[t.sym] || (s.bySym[t.sym] = { n: 0, net: 0 }); bs.n++; bs.net += pnl;
      var sd = s.bySide[t.side] || (s.bySide[t.side] = { n: 0, net: 0 }); sd.n++; sd.net += pnl;
      if (t.t) {
        var h = warsawParts(t.t).hour;
        var bh = s.byHour[h] || (s.byHour[h] = { n: 0, net: 0 }); bh.n++; bh.net += pnl;
      }
    });
    if (s.n) {
      s.winRate = s.wins / s.n;
      s.expectancy = s.net / s.n;
      s.avgWin = s.wins ? s.grossWin / s.wins : 0;
      s.avgLoss = s.losses ? s.grossLoss / s.losses : 0;
      s.profitFactor = s.grossLoss < 0 ? s.grossWin / Math.abs(s.grossLoss) : null;
    }
    if (s.rCount) s.avgR = rSum / s.rCount;
    return s;
  }

  function filterTrades(trades, mode, now) {
    now = now || Date.now();
    if (mode === 'all') return trades || [];
    var key = mode === 'day' ? dayKey(now) : (mode === 'week' ? weekKey(now) : weekKey(now - 7 * 86400000));
    return (trades || []).filter(function (t) {
      if (!t || !t.t) return false;
      return (mode === 'day' ? dayKey(t.t) : weekKey(t.t)) === key;
    });
  }

  function sgn(x) { return (x >= 0 ? '+' : '') + r2(x).toFixed(2); }

  function formatReport(s, title, equity) {
    if (!s.n) return title + '\nBrak zamknietych transakcji w tym okresie.';
    var L = [title];
    L.push('Transakcje: ' + s.n + ' (W ' + s.wins + ' / L ' + s.losses + ')  Win rate: ' + (s.winRate * 100).toFixed(0) + '%');
    L.push('Wynik netto: ' + sgn(s.net) + (equity ? '  (kapital ' + r2(equity).toFixed(2) + ')' : ''));
    L.push('Profit factor: ' + (s.profitFactor == null ? (s.grossWin > 0 ? 'brak strat' : '—') : s.profitFactor.toFixed(2)) +
      '   Expectancy/trade: ' + sgn(s.expectancy));
    L.push('Sr. zysk: ' + sgn(s.avgWin) + '   Sr. strata: ' + sgn(s.avgLoss) + (s.avgR != null ? '   Sr. R: ' + sgn(s.avgR) + 'R (' + s.rCount + ')' : ''));
    L.push('Max drawdown: -' + r2(s.maxDrawdown).toFixed(2) + '   Max seria strat: ' + s.maxConsecLoss + '   Koszty: ' + r2(s.fees).toFixed(2));
    if (s.best) L.push('Najlepsza: ' + s.best.sym + ' ' + sgn(s.best.pnl) + '   Najgorsza: ' + s.worst.sym + ' ' + sgn(s.worst.pnl));
    var syms = Object.keys(s.bySym).sort(function (a, b) { return s.bySym[b].net - s.bySym[a].net; });
    L.push('Wg symbolu: ' + syms.map(function (k) { return k + ' ' + sgn(s.bySym[k].net) + ' (' + s.bySym[k].n + ')'; }).join(' | '));
    var sides = Object.keys(s.bySide);
    if (sides.length) L.push('Wg kierunku: ' + sides.map(function (k) { return k + ' ' + sgn(s.bySide[k].net) + ' (' + s.bySide[k].n + ')'; }).join(' | '));
    var hrs = Object.keys(s.byHour).sort(function (a, b) { return a - b; });
    if (hrs.length) L.push('Wg godziny PL: ' + hrs.map(function (h) { return h + ':00 ' + sgn(s.byHour[h].net) + ' (' + s.byHour[h].n + ')'; }).join(' | '));
    if (s.n < 30) L.push('Uwaga: ' + s.n + ' transakcji to za mala proba, zeby ufac statystykom (cel: 30+).');
    return L.join('\n');
  }

  function tradesToCsv(trades) {
    var cols = ['t', 'sym', 'side', 'qty', 'entry', 'exit', 'pnl', 'fees', 'R', 'why', 'entryWhy', 'bars'];
    var rows = [cols.join(',')];
    (trades || []).slice().reverse().forEach(function (t) {
      rows.push(cols.map(function (c) {
        var v = t[c];
        if (c === 't') v = t.t ? new Date(t.t).toISOString() : '';
        if (v == null) v = '';
        v = String(v).replace(/"/g, '""');
        return /[",\n]/.test(v) ? '"' + v + '"' : v;
      }).join(','));
    });
    return rows.join('\n');
  }

  global.BTX_STATS = {
    computeStats: computeStats, filterTrades: filterTrades, formatReport: formatReport,
    tradesToCsv: tradesToCsv, weekKey: weekKey, dayKey: dayKey, warsawParts: warsawParts
  };

  if (typeof document === 'undefined') return; // testy w Node: tylko czyste funkcje

  // ================= TELEGRAM =================
  function tgCfg() {
    try {
      if (global.BTX_REAL7 && global.BTX_REAL7.cfg) return global.BTX_REAL7.cfg() || {};
      return JSON.parse(localStorage.getItem('BTX_REAL7_CFG') || '{}');
    } catch (e) { return {}; }
  }

  function notify(text) {
    var c = tgCfg();
    if (!c.tgToken || !c.tgChat) return false;
    text = String(text).slice(0, 3900);
    var direct = function () {
      return fetch('https://api.telegram.org/bot' + c.tgToken + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: c.tgChat, text: text, disable_web_page_preview: true })
      });
    };
    if (c.workerUrl) {
      fetch(c.workerUrl.replace(/\/$/, '') + '/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: c.tgToken, chat_id: c.tgChat, text: text })
      }).then(function (r) { if (!r.ok) return direct(); }).catch(function () { return direct().catch(function () {}); });
    } else {
      direct().catch(function () {});
    }
    return true;
  }

  // ================= ZAMKNIECIA: czas + R + alert =================
  var wraps = 0;
  function copyFlags(from, to) { Object.keys(from).forEach(function (k) { try { to[k] = from[k]; } catch (e) {} }); }

  function installClosePos() {
    if (typeof global.closePos !== 'function' || global.closePos.__btxReport) return;
    var orig = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST, p = ST && ST.pos && ST.pos[sym];
      var snap = p ? { risk0: p.risk0, qty: p.qty, side: p.side, entry: p.entry } : null;
      var before = ST && ST.closed ? ST.closed.length : 0;
      var ret = orig.apply(this, arguments);
      try {
        var c = ST && ST.closed && ST.closed.length > before ? ST.closed[0] : null;
        if (c && c.sym === sym && !c.t) {
          c.t = Date.now();
          if (snap && snap.risk0 > 0 && snap.qty > 0) {
            var R = c.pnl / (snap.risk0 * snap.qty);
            if (isFinite(R)) c.R = Math.round(R * 100) / 100;
          }
          notify('BTX ZAMKNIECIE ' + c.side + ' ' + sym + '\nWynik: ' + sgn(c.pnl) + (c.R != null ? ' (' + sgn(c.R) + 'R)' : '') +
            '\nWejscie ' + r2(c.entry) + ' -> wyjscie ' + r2(c.exit) + '\nPowod: ' + String(why || c.why || '').slice(0, 120));
          if (typeof global.save === 'function') global.save();
        }
      } catch (e) {}
      return ret;
    };
    copyFlags(orig, global.closePos);
    global.closePos.__btxReport = true;
    wraps++;
  }

  // ================= HARMONOGRAM RAPORTOW =================
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function closedList() { return (global.ST && global.ST.closed) || []; }
  function equity() { return global.ST && global.ST.equity; }

  function buildReport(mode) {
    var titles = { day: 'BTX RAPORT DNIA ', week: 'BTX RAPORT TYGODNIA ', prev: 'BTX RAPORT POPRZEDNIEGO TYGODNIA ', all: 'BTX RAPORT — CALA HISTORIA' };
    var now = Date.now();
    var suffix = mode === 'day' ? dayKey(now) : (mode === 'week' ? weekKey(now) : (mode === 'prev' ? weekKey(now - 7 * 86400000) : ''));
    return formatReport(computeStats(filterTrades(closedList(), mode, now)), titles[mode] + suffix, equity());
  }

  var lastHealthAlert = 0, noLiveSince = 0;
  function schedule() {
    var now = Date.now(), p = warsawParts(now), wk = weekKey(now), dk = dayKey(now);
    var weekday = p.dow >= 1 && p.dow <= 5;
    var min = p.hour * 60 + p.min;
    // podsumowanie dnia
    if (weekday && min >= 22 * 60 + 5 && lsGet('btx_rep_daily') !== dk) {
      lsSet('btx_rep_daily', dk);
      if (filterTrades(closedList(), 'day', now).length) notify(buildReport('day'));
    }
    // raport tygodniowy: piatek po 22:10, a gdy ominiety - w weekend/poniedzialek za poprzedni tydzien
    if (lsGet('btx_rep_weekly') !== wk && ((p.dow === 5 && min >= 22 * 60 + 10) || p.dow === 6 || p.dow === 0)) {
      lsSet('btx_rep_weekly', wk);
      notify(buildReport('week'));
    } else if (p.dow === 1 && lsGet('btx_rep_weekly') !== weekKey(now - 7 * 86400000) && lsGet('btx_rep_weekly') !== wk) {
      lsSet('btx_rep_weekly', weekKey(now - 7 * 86400000));
      notify(buildReport('prev'));
    }
    // alert o danych: sesja US, brak swiezych cen
    if (weekday && min >= 15 * 60 + 45 && min <= 21 * 60 + 45 && global.BTX_LIVE && global.SYMBOLS) {
      var us = global.SYMBOLS.filter(function (m) { return m.mkt === 'US'; });
      var anyFresh = us.some(function (m) { return global.BTX_LIVE.isFresh(m.s); });
      if (anyFresh) noLiveSince = 0;
      else {
        if (!noLiveSince) noLiveSince = now;
        if (now - noLiveSince > 10 * 60000 && now - lastHealthAlert > 60 * 60000) {
          lastHealthAlert = now;
          notify('BTX UWAGA: brak swiezych cen LIVE dla akcji US od ' + Math.round((now - noLiveSince) / 60000) + ' min. Bot nie otwiera pozycji. Sprawdz klucz/limit Twelve Data.');
        }
      }
    }
  }

  // ================= UI =================
  var overlay, mode = 'week';
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function refreshOverlay() {
    overlay.querySelector('pre').textContent = buildReport(mode);
    Array.prototype.forEach.call(overlay.querySelectorAll('[data-m]'), function (b) {
      b.style.background = b.getAttribute('data-m') === mode ? '#2563eb' : '#334155';
    });
  }

  function openOverlay() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'btx-report-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';
      overlay.innerHTML = '<div style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:14px;width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;gap:10px;font:13px ui-monospace,Menlo,Consolas,monospace">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button data-m="day">Dzisiaj</button><button data-m="week">Ten tydzien</button><button data-m="prev">Poprzedni tydzien</button><button data-m="all">Wszystko</button>' +
        '<span style="flex:1"></span><button id="btx-rep-close">Zamknij</button></div>' +
        '<pre style="margin:0;white-space:pre-wrap;overflow:auto;flex:1;line-height:1.5"></pre>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button id="btx-rep-copy">Kopiuj</button><button id="btx-rep-csv">Pobierz CSV transakcji</button><button id="btx-rep-tg">Wyslij na Telegram</button><span id="btx-rep-msg" style="align-self:center;color:#94a3b8"></span></div></div>';
      document.body.appendChild(overlay);
      Array.prototype.forEach.call(overlay.querySelectorAll('button'), function (b) {
        b.style.cssText = 'cursor:pointer;padding:6px 10px;border:0;border-radius:8px;color:#fff;background:#334155;font:inherit';
      });
      overlay.addEventListener('click', function (e) {
        var t = e.target, m = t.getAttribute && t.getAttribute('data-m'), msg = overlay.querySelector('#btx-rep-msg');
        if (t === overlay || t.id === 'btx-rep-close') overlay.style.display = 'none';
        else if (m) { mode = m; refreshOverlay(); }
        else if (t.id === 'btx-rep-copy') { try { navigator.clipboard.writeText(buildReport(mode)); msg.textContent = 'Skopiowano'; } catch (x) { msg.textContent = 'Nie udalo sie'; } }
        else if (t.id === 'btx-rep-csv') download('btx-transakcje.csv', tradesToCsv(closedList()));
        else if (t.id === 'btx-rep-tg') msg.textContent = notify(buildReport(mode)) ? 'Wyslano' : 'Brak tokenu/chat ID (Ustawienia)';
      });
    }
    overlay.style.display = 'flex';
    refreshOverlay();
  }

  function ensureButton() {
    if (document.getElementById('btx-report-btn')) return;
    var b = document.createElement('button');
    b.id = 'btx-report-btn';
    b.textContent = 'Raport';
    b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9999;padding:6px 12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font:600 12px ui-monospace,Menlo,Consolas,monospace;cursor:pointer';
    b.addEventListener('click', openOverlay);
    document.body.appendChild(b);
  }

  function boot() {
    ensureButton();
    setTimeout(installClosePos, 3000);
    setInterval(function () { if (wraps < 4) installClosePos(); }, 7000);
    setInterval(schedule, 60000);
    setTimeout(schedule, 8000);
  }

  global.BTX_REPORT = { build: buildReport, notify: notify };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
