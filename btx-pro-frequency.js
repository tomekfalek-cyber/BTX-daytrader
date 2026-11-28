/**
 * PRO Frequency Director — cel: ok. 2 transakcje / sesje dzienna.
 * Nie obniza risk management. Pilnuje by filtry nie zabily calkowicie aktywnosci.
 */
(function (global) {
  'use strict';
  if (global.__BTX_PRO_FREQ__) return;
  global.__BTX_PRO_FREQ__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  function dayKeyPL() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function tradesToday() {
    var ST = global.ST || {};
    return ST.dayTrades || 0;
  }

  function inSessionRough() {
    try {
      var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
      var map = {};
      fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
      if (/Sat|Sun/i.test(map.weekday || '')) return false;
      var m = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
      // EU morning + US afternoon PL
      if (m >= 9 * 60 && m <= 17 * 60 + 30) return true;
      if (m >= 15 * 60 + 30 && m <= 22 * 60) return true;
      return false;
    } catch (e) { return true; }
  }

  function pickBest() {
    var ST = global.ST;
    if (!ST || !ST.sig) return null;
    var list = (ST.sig || []).filter(function (g) {
      return g && (g.side === 'LONG' || g.side === 'SHORT') && (g.strength || 0) >= 3;
    });
    list.sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    for (var i = 0; i < list.length; i++) {
      var g = list[i];
      if (ST.pos && ST.pos[g.sym]) continue;
      if (ST.cool && ST.cool[g.sym] > 0) continue;
      // optional elite/edge soft check
      var ok = true, why = '';
      try {
        if (global.BTX_EDGE && global.BTX_EDGE.gate) {
          var e = global.BTX_EDGE.gate(g);
          if (!e.ok) { ok = false; why = e.why; }
        }
      } catch (err) {}
      if (!ok) continue;
      try {
        if (global.BTX_ELITE && global.BTX_ELITE.canAutoOpen) {
          var c = global.BTX_ELITE.canAutoOpen(g);
          if (!c.ok) { ok = false; why = c.why; }
        }
      } catch (err2) {}
      if (ok) return g;
    }
    return null;
  }

  function tryFillQuota() {
    var ST = global.ST, CFG = global.CFG || {};
    if (!ST || ST.blocked) return;
    if (!inSessionRough()) return;
    var maxPos = CFG.maxPos || 2;
    var openN = ST.pos ? Object.keys(ST.pos).length : 0;
    if (openN >= maxPos) return;
    var maxDay = CFG.maxTrades || 6;
    var td = tradesToday();
    // cel: przynajmniej 2/dzien jesli sa setupy — nie forsuj 3+ bez jakosci
    if (td >= 2) return; // quota soft target reached; dalsze tylko naturalnie przez cycle
    if (td >= maxDay) return;

    var g = pickBest();
    if (!g) {
      if (!tryFillQuota._logged) {
        log('FREQ: brak setupu sila>=3 pod cel 2/dzien — czekam na skan', 'i');
        tryFillQuota._logged = true;
        setTimeout(function () { tryFillQuota._logged = false; }, 120000);
      }
      return;
    }
    if (typeof global.openPos === 'function') {
      log('FREQ: proba OPEN pod cel 2/dzien → ' + g.sym + ' ' + g.side + ' s' + (g.strength || 0), 'g');
      global.openPos(g);
    }
  }

  function panel() {
    var desk = document.getElementById('pane-desk');
    if (!desk) return;
    var el = document.getElementById('btx-freq-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-freq-panel';
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);background:rgba(6,40,30,.45);font-size:12.5px;color:#a7f3d0;line-height:1.45';
      var host = document.getElementById('btx-edge-panel') || document.getElementById('btx-elite-panel');
      if (host && host.parentNode) host.after(el); else desk.appendChild(el);
    }
    var td = tradesToday();
    var openN = (global.ST && global.ST.pos) ? Object.keys(global.ST.pos).length : 0;
    el.innerHTML = '<b style="color:#ecfdf5">CEL DAYTRADE</b> · transakcje dziś: <b>' + td + '</b> / cel min. 2 · otwarte: ' + openN +
      ' · sesja: ' + (inSessionRough() ? 'AKTYWNA' : 'poza') +
      '<br><span style="color:#6ee7b7">Kalibracja: sila≥3, B@3+, RVOL≥0.65, CHOP tylko przy sile≥4. Risk 0.35% bez zmian.</span>';
  }

  function boot() {
    try {
      if (global.CFG) {
        global.CFG.maxPos = global.CFG.maxPos || 2;
        global.CFG.maxTrades = Math.max(global.CFG.maxTrades || 0, 6);
        global.CFG.minHold = Math.min(global.CFG.minHold || 8, 6);
      }
    } catch (e) {}
    panel();
    setInterval(function () {
      panel();
      tryFillQuota();
    }, 45000); // co 45s — nie spam
    // po cyklu tez
    if (typeof global.cycle === 'function' && !global.cycle.__freq) {
      var o = global.cycle;
      global.cycle = function () {
        var r = o.apply(this, arguments);
        setTimeout(tryFillQuota, 500);
        return r;
      };
      global.cycle.__freq = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 3200); });
  else setTimeout(boot, 3200);
})(typeof window !== 'undefined' ? window : globalThis);
