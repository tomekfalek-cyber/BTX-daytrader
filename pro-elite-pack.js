/**
 * PRO Elite Pack — 4 filary daytradera:
 * 1) Autonomiczne OPEN tylko grade A / A+ (B = tylko alert)
 * 2) Partial 50% @ +1R + trail reszty
 * 3) Bias sesji + filtr pierwszych minut po otwarciu sesji
 * 4) Tygodniowy kill-switch slabych setupow
 */
(function (global) {
  'use strict';
  if (global.__BTX_PRO_ELITE__) return;
  global.__BTX_PRO_ELITE__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  // ---------- 3) sesja PL + pierwsze minuty ----------
  function warsawParts() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit',
      hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || '')
    };
  }

  /** Okno "pierwszych minut" po otwarciu sesji — wiecej szumu */
  function inOpenNoiseWindow() {
    var w = warsawParts();
    if (w.weekend) return true;
    var m = w.min;
    // EU cash ~9:00–9:15, US 15:30–15:45
    if (m >= 9 * 60 && m < 9 * 60 + 15) return true;
    if (m >= 15 * 60 + 30 && m < 15 * 60 + 45) return true;
    return false;
  }

  /** Prosty bias dnia z dominujacych sygnalow / pozycji */
  function sessionBias() {
    var ST = global.ST || {};
    var longN = 0, shortN = 0;
    (ST.sig || []).forEach(function (g) {
      if (!g) return;
      if (g.side === 'LONG') longN += (g.strength || 1);
      if (g.side === 'SHORT') shortN += (g.strength || 1);
    });
    if (longN > shortN * 1.35) return 'BULL';
    if (shortN > longN * 1.35) return 'BEAR';
    return 'RANGE';
  }

  function biasAllows(side) {
    var b = sessionBias();
    if (b === 'RANGE') return true; // range: obie strony OK, ale grade i tak tnie
    if (b === 'BULL' && side === 'SHORT') return false;
    if (b === 'BEAR' && side === 'LONG') return false;
    return true;
  }

  // ---------- 4) weekly kill-switch ----------
  var LS_KEY = 'BTX_SETUP_STATS_V1';
  var LS_KILL = 'BTX_SETUP_KILLED_V1';

  function loadJSON(k, def) {
    try {
      var r = localStorage.getItem(k);
      return r ? JSON.parse(r) : def;
    } catch (e) { return def; }
  }
  function saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function setupKey(g) {
    var why = String((g && g.why) || '');
    if (/ORB/i.test(why)) return 'ORB';
    if (/RSI\(2\)|RSI2/i.test(why)) return 'RSI2_PB';
    if (/VWAP/i.test(why)) return 'VWAP';
    if (/HTF/i.test(why)) return 'HTF';
    if (/VPVR|POC/i.test(why)) return 'VPVR';
    return 'CORE';
  }

  function killedSet() {
    return loadJSON(LS_KILL, {});
  }

  function recordTradeClose(sym, pnl) {
    var ST = global.ST;
    if (!ST || !ST.closed || !ST.closed.length) return;
    var last = ST.closed[0];
    if (!last) return;
    var key = last.setupKey || 'CORE';
    var stats = loadJSON(LS_KEY, {});
    if (!stats[key]) stats[key] = { n: 0, wins: 0, pnl: 0 };
    stats[key].n += 1;
    if ((last.pnl != null ? last.pnl : pnl) > 0) stats[key].wins += 1;
    stats[key].pnl += (last.pnl != null ? last.pnl : (pnl || 0));
    saveJSON(LS_KEY, stats);
    // kill jesli >=8 tradeow i WR < 35% oraz pnl < 0
    var s = stats[key];
    if (s.n >= 8 && (s.wins / s.n) < 0.35 && s.pnl < 0) {
      var k = killedSet();
      k[key] = { since: Date.now(), wr: s.wins / s.n, pnl: s.pnl, n: s.n };
      saveJSON(LS_KILL, k);
      log('KILL-SWITCH setup ' + key + ' (WR ' + Math.round(100 * s.wins / s.n) + '%, n=' + s.n + ') — tylko alert, bez auto-OPEN', 'r');
    }
  }

  function isKilled(g) {
    var k = killedSet()[setupKey(g)];
    return !!k;
  }

  // ---------- 1) grade A/A+ only for open ----------
  function gradeOf(g) {
    if (g && g.desk && g.desk.grade) return String(g.desk.grade).toUpperCase();
    if (global.BTX_AUTONOMY && typeof global.BTX_AUTONOMY.gradeSetup === 'function') {
      try {
        var gr = global.BTX_AUTONOMY.gradeSetup(g);
        if (gr && gr.grade) return String(gr.grade).toUpperCase();
      } catch (e) {}
    }
    // fallback z sily
    var s = (g && g.strength) || 0;
    if (s >= 5) return 'A+';
    if (s >= 4) return 'A';
    if (s >= 3) return 'B';
    if (s >= 2) return 'C';
    return 'REJECT';
  }

  function isAGrade(g) {
    var gr = gradeOf(g);
    return gr === 'A' || gr === 'A+' || gr === 'A-';
  }

  /** Daytrade: A/A+ zawsze; B tylko przy sile >= 3 (cel ~2 trade/dzien, nie raz/tydzien) */
  function isTradeGrade(g) {
    var gr = gradeOf(g);
    if (gr === 'A' || gr === 'A+' || gr === 'A-') return true;
    if (gr === 'B' && (g.strength || 0) >= 3) return true;
    return false;
  }

  function canAutoOpen(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return { ok: false, why: 'brak kierunku' };
    if (inOpenNoiseWindow()) return { ok: false, why: 'pierwsze minuty sesji (szum) — tylko obserwacja' };
    // bias: RANGE obie strony; BULL/BEAR tylko lekki filtr (nie twardy blok przy sile>=4)
    if (!biasAllows(g.side) && (g.strength || 0) < 4) return { ok: false, why: 'przeciw biasowi sesji (' + sessionBias() + ')' };
    if (isKilled(g)) return { ok: false, why: 'setup ' + setupKey(g) + ' w kill-switch (slaby tydzien)' };
    if (!isTradeGrade(g)) return { ok: false, why: 'grade ' + gradeOf(g) + ' sila ' + (g.strength||0) + ' — za slabo na auto' };
    return { ok: true, why: 'grade ' + gradeOf(g) + ' OK' };
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function' || global.openPos.__elite) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      // pozwol na reczne/systemowe bez grade tylko gdy flaga
      var gate = canAutoOpen(g);
      if (!gate.ok) {
        log('SKIP OPEN ' + (g && g.sym) + ' — ' + gate.why, 'i');
        return null;
      }
      if (g) g.setupKey = setupKey(g);
      var ST = global.ST;
      var r = prev.apply(this, arguments);
      try {
        if (ST && g && ST.pos && ST.pos[g.sym]) {
          ST.pos[g.sym].setupKey = setupKey(g);
          ST.pos[g.sym].grade = gradeOf(g);
          // partial targets
          var risk = ST.pos[g.sym].risk0 || Math.abs(ST.pos[g.sym].entry - ST.pos[g.sym].stop) || 0;
          if (risk > 0 && !ST.pos[g.sym].partial) {
            var e = ST.pos[g.sym].entry;
            ST.pos[g.sym].partial = ST.pos[g.sym].side === 'LONG' ? e + risk : e - risk;
            ST.pos[g.sym].partialFrac = 0.5;
          }
        }
      } catch (e) {}
      return r;
    };
    global.openPos.__elite = true;
  }

  function patchClosePos() {
    if (typeof global.closePos !== 'function' || global.closePos.__eliteStats) return;
    var prev = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      var setup = p && p.setupKey;
      var r = prev.apply(this, arguments);
      try {
        if (ST && ST.closed && ST.closed[0] && setup) {
          ST.closed[0].setupKey = setup;
        }
        recordTradeClose(sym, 0);
      } catch (e) {}
      return r;
    };
    global.closePos.__eliteStats = true;
  }

  // ---------- 2) partial + trail ----------
  function managePartialTrail() {
    var ST = global.ST;
    if (!ST || !ST.pos) return;
    Object.keys(ST.pos).forEach(function (sym) {
      var p = ST.pos[sym];
      if (!p) return;
      var bar = null;
      try {
        if (typeof global.last === 'function') bar = global.last(sym);
      } catch (e) {}
      if (!bar || bar.c == null) return;
      var risk = p.risk0 || Math.abs(p.entry - p.stop) || 0;
      if (!(risk > 0)) return;
      var mv = p.side === 'LONG' ? (bar.c - p.entry) : (p.entry - bar.c);
      var rNow = mv / risk;

      // partial 50% @ +1R
      if (!p.partialDone && rNow >= 1.0 && p.qty >= 2) {
        var cut = Math.max(1, Math.floor(p.qty * (p.partialFrac != null ? p.partialFrac : 0.5)));
        if (cut >= p.qty) cut = Math.floor(p.qty / 2) || 1;
        var leave = p.qty - cut;
        if (leave >= 1 && cut >= 1) {
          // paper: realizuj czesc PnL, zostaw reszte
          var pnlPart = p.side === 'LONG' ? (bar.c - p.entry) * cut * (p.rate || 1) : (p.entry - bar.c) * cut * (p.rate || 1);
          ST.cash = (ST.cash || 0) + cut * bar.c * (p.rate || 1);
          ST.equity = (ST.equity || 0) + pnlPart;
          p.qty = leave;
          p.partialDone = true;
          p.stop = p.entry; // BE po partial
          p.be = true;
          log('PARTIAL 50% ' + sym + ' @ +1R, BE na reszcie | czesc PnL ' + (pnlPart || 0).toFixed(2), 'g');
        }
      }

      // trail: po +1.5R stop na +0.5R, po +2R stop na +1R
      if (p.partialDone || rNow >= 1.5) {
        var lock = 0;
        if (rNow >= 2.0) lock = 1.0;
        else if (rNow >= 1.5) lock = 0.5;
        if (lock > 0) {
          var newStop = p.side === 'LONG' ? p.entry + lock * risk : p.entry - lock * risk;
          if (p.side === 'LONG' && newStop > p.stop) {
            p.stop = newStop;
            log('TRAIL ' + sym + ' stop → +' + lock + 'R', 'g');
          }
          if (p.side === 'SHORT' && newStop < p.stop) {
            p.stop = newStop;
            log('TRAIL ' + sym + ' stop → +' + lock + 'R', 'g');
          }
        }
      }
    });
  }

  // ---------- UI status ----------
  function renderPanel() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var el = document.getElementById('btx-elite-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-elite-panel';
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);background:rgba(6,60,40,.35);font-size:12.5px;color:#a7f3d0;line-height:1.45';
      var host = document.getElementById('btx-hold-warn') || document.getElementById('btx-skip-panel');
      if (host && host.parentNode) host.after(el);
      else pane.appendChild(el);
    }
    var kills = killedSet();
    var killTxt = Object.keys(kills).length
      ? Object.keys(kills).map(function (k) { return k; }).join(', ')
      : 'brak';
    el.innerHTML =
      '<b style="color:#ecfdf5">PRO Elite</b> · bias <b>' + sessionBias() + '</b>' +
      (inOpenNoiseWindow() ? ' · <span style="color:#fcd34d">strefa otwarcia — bez auto-OPEN</span>' : ' · auto A/B+') +
      '<br>Kill-switch setupów: <b>' + killTxt + '</b>' +
      '<br><span style="color:#6ee7b7">Partial 50%@1R + trail · grade A/A+ lub B@sila≥3 · filtr 15 min po otwarciu sesji</span>';
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__elite) return;
    var orig = global.cycle;
    global.cycle = function () {
      var r = orig.apply(this, arguments);
      try {
        managePartialTrail();
        renderPanel();
      } catch (e) {}
      return r;
    };
    global.cycle.__elite = true;
  }

  function boot() {
    // partial w PRO
    try {
      if (global.BTX_STRATEGY_PRO) {
        global.BTX_STRATEGY_PRO.partialR = 1.0;
        global.BTX_STRATEGY_PRO.partialFrac = 0.5;
      }
      if (global.CFG) {
        global.CFG.partialR = 1.0;
      }
    } catch (e) {}
    patchOpenPos();
    patchClosePos();
    patchCycle();
    managePartialTrail();
    renderPanel();
    setInterval(function () {
      patchOpenPos();
      patchClosePos();
      patchCycle();
      managePartialTrail();
      renderPanel();
    }, 5000);
  }

  global.BTX_ELITE = {
    canAutoOpen: canAutoOpen,
    sessionBias: sessionBias,
    gradeOf: gradeOf,
    killedSet: killedSet
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})(typeof window !== 'undefined' ? window : globalThis);
