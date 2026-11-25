/**
 * BTX Engine Singleton — jedna sciezka open/close.
 * Ladowac NA KONCU. Zamraza window.openPos / closePos:
 * dalsze nakladki sa ignorowane (log raz).
 * Kolejnosc bramek: korelacja -> elite A/A+ -> capital (w srodku raw) -> koszt.
 * Hold-discipline owija close PRZED tym plikiem; tutaj zachowujemy aktualny close.
 */
(function (global) {
  'use strict';
  if (global.__BTX_ENGINE_SINGLETON__) return;
  global.__BTX_ENGINE_SINGLETON__ = true;

  var logOnce = {};
  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }
  function log1(key, msg, c) {
    if (logOnce[key]) return;
    logOnce[key] = true;
    log(msg, c);
  }

  function family(sym) {
    if (/EURUSD|GBPUSD|USDJPY|XAU|GOLD|AUDUSD|USDCHF/.test(sym)) return 'FX_MAJOR';
    if (/AAPL|MSFT|GOOGL|AMZN|META|NVDA|TSLA|AMD|NFLX|ANT/.test(sym)) return 'US_TECH';
    if (/ASML|SAP|SIE/.test(sym)) return 'EU_BLUE';
    if (/SPY|QQQ|IWM|DIA/.test(sym)) return 'ETF_IDX';
    return 'OTHER_' + sym;
  }

  function corrBlocked(sym) {
    var ST = global.ST;
    if (!ST || !ST.pos) return false;
    var fam = family(sym);
    for (var s in ST.pos) {
      if (s !== sym && family(s) === fam) return true;
    }
    return false;
  }

  function canOpen(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return { ok: false, why: 'brak kierunku' };
    if (corrBlocked(g.sym)) return { ok: false, why: 'korelacja (1 na rodzine)' };
    if (global.BTX_ELITE && global.BTX_ELITE.canAutoOpen) {
      try {
        var e = global.BTX_ELITE.canAutoOpen(g);
        if (!e.ok) return e;
      } catch (err) {}
    }
    return { ok: true, why: 'OK' };
  }

  function freeze(name, impl) {
    try {
      Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        get: function () { return impl; },
        set: function () {
          log1('freeze-' + name, 'Ignoruje nakladke ' + name + ' — singleton jest jedynym zrodlem', 'i');
        }
      });
    } catch (e) {
      global[name] = impl;
    }
  }

  function boot() {
    var rawOpen = typeof global.openPos === 'function' ? global.openPos : null;
    var rawClose = typeof global.closePos === 'function' ? global.closePos : null;
    if (!rawOpen) {
      log('Singleton: brak openPos — sprobuję pozniej', 'r');
      setTimeout(boot, 1500);
      return;
    }

    function openPosUnified(g) {
      var gate = canOpen(g);
      if (!gate.ok) {
        log('SKIP OPEN ' + (g && g.sym) + ' — ' + gate.why, 'i');
        return null;
      }
      return rawOpen.apply(global, arguments);
    }

    function closePosUnified(sym, why, px) {
      if (!rawClose) return null;
      return rawClose.apply(global, arguments);
    }

    freeze('openPos', openPosUnified);
    freeze('closePos', closePosUnified);

    global.BTX_ENGINE = {
      version: 'singleton-1',
      canOpen: canOpen,
      rawOpen: rawOpen,
      rawClose: rawClose
    };
    log('Engine singleton aktywny — jedna sciezka open/close', 'g');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 2500); });
  } else {
    setTimeout(boot, 2500);
  }
})(typeof window !== 'undefined' ? window : globalThis);
