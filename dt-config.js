/**
 * BTX DT-CONFIG — JEDYNE zrodlo parametrow daytradingu (profil: konto 500 PLN, pary FX, swiece 5 min).
 *
 * Dlaczego ten plik istnieje: parametry byly rozsiane po ~8 modulach (btx-master-fix, paper-open-engine, trade-path-boot,
 * fix-learner-gate, status-fix, stop-day-control, session-profiles...), z ktorych kazdy co 4-15 s nadpisywal progi
 * i flagi starymi wartosciami (np. BTX_ALLOW_STOP_DAY na przemian 0 i 1, maxDayTrades 4, risk 0.35%).
 * Teraz: progi ustawia TYLKO ten plik (raz przy starcie + co 60 s, bo UI/inne moduly moga je ruszyc).
 *
 * Reczne korekty bez edycji kodu: localStorage 'BTX_DT_OVERRIDES' = {"pro":{"riskPct":0.4},"cfg":{"maxTrades":6}}
 */
(function (global) {
  'use strict';
  var VERSION = 'dt500-2026-11-17';
  var LS_VER = 'BTX_DT_PROFILE_VERSION';
  var LS_OVR = 'BTX_DT_OVERRIDES';

  var PROFILE = {
    capital: 500,
    pro: {
      // --- ryzyko ---
      riskPct: 0.5,          // % kapitalu na transakcje (min. lot 0.01 = 1000 szt. i tak daje realnie ~0.6-0.8%)
      maxPos: 2,             // 2 pary naraz (margines 1:30 ~133 PLN / pozycja przy 500 PLN)
      maxDayTrades: 8,       // intraday: do 8 wejsc dziennie (bylo 4 -> 1-2 transakcje tygodniowo po filtrach)
      dailyLossPct: 2.0,     // twardy limit dnia (liczony w gateCheck od ST.dayStart): ~3 pelne stopy
      maxConsecLoss: 3,
      // --- wejscie ---
      scoreMin: 4,           // rdzen: score >= 4 (strength >= 3 wymaga w praktyce score >= 5)
      primeExtra: 0,
      minStrengthOpen: 3,
      minNetRR: 1.1,         // przy tpR 1.5 odrzuca tylko stopy < ~5 pipsow (koszt spreadu > 25% stopu)
      strictCore: true,
      requireTrend: false,
      allowShort: true,      // FX: kierunek dowolny (short = to samo co long na parze odwrotnej)
      // --- zarzadzanie ---
      tpR: 1.5,              // cel blizej (intraday): 1.5R zamiast 3R z engine-hardening
      beR: 1.0,              // BE dopiero po +1R (0.8R wybijal pozycje szumem)
      partialR: 99,          // wyjscie czesciowe OFF: pozycja 1000 szt. nie dzieli sie na pol (XTB min. 0.01 lota)
      partialFrac: 0,
      coolBars: 3,           // przerwa na symbolu po zamknieciu (swiece)
      minHoldBars: 2,
      timeStopBars: 36,      // 36 swiec x 5 min = max 3 h w pozycji (flat przed zamknieciem i tak wczesniej)
      // stop szerszy niz domyslne 0.9-1.6 ATR: przy ATR(5m) EURUSD ~3 pipsy spread 1.3 pipsa zjadal ~0.5R/transakcje (backtest 12 dni: NET -0.38R przy
      // tpR 2); przy 1.5-2.5 ATR koszt spada do ~0.25R, a sygnalow jest ~2.6/dzien/pare zamiast ~0.8 (reszte odrzucal filtr kosztow)
      stopMinAtr: 1.5,
      stopMaxAtr: 2.5,
      // --- czas ---
      newsPadMin: 7,
      closeBufferMin: 30,    // brak nowych wejsc w ostatnich 30 min sesji
      flatBeforeCloseMin: 10
    },
    // statyczne okna newsow: tylko dane USA 14:30 i 16:00 PL (czas "zimowy UTC" jak w strategy-pro).
    // ECB 14:15/14:45 i FOMC 20:00 PL usuniete — to NIE sa wydarzenia codzienne, a blokowaly ~45 min w oknie London/NY co dzien.
    newsWindows: [
      { label: 'US dane 14:30 PL', min: 13 * 60 + 30 },
      { label: 'US dane 16:00 PL', min: 15 * 60 }
    ],
    fxSession: { open: 7 * 60, close: 20 * 60, prime: [[7 * 60, 11 * 60], [13 * 60 + 30, 17 * 60]] }, // 08:00-21:00 PL; prime: Londyn 08-12, NY overlap 14:30-18:00
    cfg: {
      risk: 0.5, maxPos: 2, maxTrades: 8, dailyLoss: 2, maxConsec: 3,
      minHold: 2, timeStop: 36, autoSec: 300, allowShort: true,
      fxLev: 30,             // ESMA: majors 1:30
      slip: 0.003,           // % ceny na strone (~0.3 pipsa EURUSD). Bylo 0.03 => ~3 pipsy/strone = wiecej niz caly stop
      scan: { US: false, EU: false, PL: false, FX: true },
      rates: { USD: 3.7, JPY: 0.0245 }
    },
    fxFees: { comm: 0, conv: 0, spread: 0.012, slip: 0.003 } // % nominalu; XTB: spread 0.7-1.3 pipsa, bez prowizji i przewalutowania (CFD)
  };

  function merge(dst, src) { Object.keys(src || {}).forEach(function (k) { dst[k] = src[k]; }); return dst; }

  function overrides() {
    try { return JSON.parse(global.localStorage.getItem(LS_OVR) || 'null') || {}; } catch (e) { return {}; }
  }

  // czysta funkcja (testowalna w Node): ustawia progi na obiektach PRO / CFG.
  // force=true (tylko migracja) nadpisuje tez koszty i kursy, ktore uzytkownik moze zmieniac w Ustawieniach.
  function applyTo(PRO, CFG, force) {
    var o = overrides();
    if (PRO) {
      merge(PRO, PROFILE.pro);
      PRO.newsWindows = PROFILE.newsWindows.slice();
      if (PRO.sessions) PRO.sessions.FX = merge({}, PROFILE.fxSession);
      merge(PRO, o.pro);
    }
    if (CFG) {
      var c = PROFILE.cfg;
      ['risk', 'maxPos', 'maxTrades', 'dailyLoss', 'maxConsec', 'minHold', 'timeStop', 'autoSec', 'allowShort', 'fxLev'].forEach(function (k) { CFG[k] = c[k]; });
      CFG.scan = merge({}, c.scan);
      if (force || CFG.slip == null || CFG.slip > 0.01) CFG.slip = c.slip;
      if (force || !CFG.rates) CFG.rates = merge({}, c.rates);
      CFG.fees = CFG.fees || {};
      if (force || !CFG.fees.FX) CFG.fees.FX = merge({}, PROFILE.fxFees);
      merge(CFG, o.cfg);
    }
    return { PRO: PRO, CFG: CFG };
  }
  function apply() {
    applyTo(global.BTX_STRATEGY_PRO || global.BTX_PRO, global.CFG);
  }

  // znacznik czasu na zamknietych transakcjach (potrzebny do limitow DZISIEJSZYCH, np. learner-pack / raporty)
  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__dtStamp) return;
    var orig = global.closePos;
    global.closePos = function () {
      var ST = global.ST, n0 = ST && ST.closed ? ST.closed.length : 0;
      var r = orig.apply(this, arguments);
      try {
        var c = global.ST && global.ST.closed;
        if (c && c.length > n0 && c[0] && !c[0].t) c[0].t = Date.now();
      } catch (e) {}
      return r;
    };
    Object.keys(orig).forEach(function (k) { try { global.closePos[k] = orig[k]; } catch (e) {} });
    global.closePos.__dtStamp = true;
  }

  // jednorazowy reset konta do 500 PLN + czyszczenie starych blokad (raz na przegladarke / wersje profilu)
  function migrate() {
    var ls = global.localStorage;
    if (ls.getItem(LS_VER) === VERSION) return false;
    ['BTX_STOP_DAY', 'BTX_STOP_FOR_DAY', 'BTX_STOPPED', 'BTX_BLACKLIST_DAY'].forEach(function (k) { try { ls.removeItem(k); } catch (e) {} });
    ls.setItem('BTX_TRADE_MODE', 'trade');
    ls.setItem('BTX_ALLOW_STOP_DAY', '0');
    ls.setItem('BTX_AUTONOMY_ON', '1');
    applyTo(global.BTX_STRATEGY_PRO || global.BTX_PRO, global.CFG, true);
    global.CFG.capital = PROFILE.capital;
    if (typeof global.reset === 'function') global.reset();   // nowy ST: equity = cash = 500, dayStart, puste pozycje i historia
    if (global.ST) {
      global.ST.feesTot = 0; global.ST.dayTrades = 0; global.ST.consecLoss = 0; global.ST.blocked = false;
      global.ST.dayStart = global.ST.equity;
    }
    try { if (typeof global.save === 'function') global.save(); } catch (e2) {}
    try { if (typeof global.log === 'function') global.log('Profil DAYTRADING ' + VERSION + ': konto zresetowane do ' + PROFILE.capital + ' PLN', 'g'); } catch (e3) {}
    try { if (typeof global.render === 'function') global.render(); } catch (e4) {}
    ls.setItem(LS_VER, VERSION);
    return true;
  }

  global.BTX_DT = { VERSION: VERSION, PROFILE: PROFILE, applyTo: applyTo, apply: apply, migrate: migrate };

  if (typeof document === 'undefined') return; // testy w Node: tylko czyste funkcje

  function boot() {
    apply();
    patchClose();
    // migracja po tym, jak inne moduly (universe-pro, hardening, live-prices) zrobia swoj boot
    setTimeout(function () { try { migrate(); } catch (e) { if (global.console) console.error('[BTX_DT] migrate', e); } apply(); }, 2500);
    setInterval(function () { apply(); patchClose(); }, 60000);
    setInterval(patchClose, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
