/**
 * BTX Professional Engine Gate (singleton).
 * Jedyna sciezka openPos po starcie. Kolejnosc:
 * sesja/noise -> korelacja -> sila/canon -> edge soft -> elite soft -> raw open.
 */
(function (global) {
  'use strict';
  if (global.__BTX_ENGINE_SINGLETON_V2__) return;
  global.__BTX_ENGINE_SINGLETON_V2__ = true;

  var logOnce = {};
  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }
  function log1(k, msg, c) {
    if (logOnce[k]) return;
    logOnce[k] = 1;
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
    for (var s in ST.pos) if (s !== sym && family(s) === fam) return true;
    return false;
  }

  function canonMinStr() {
    return (global.BTX_CANON && global.BTX_CANON.minStrengthOpen) || 3;
  }

  function unifiedGate(g) {
    if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return { ok: false, why: 'brak kierunku' };
    if ((g.strength || 0) < canonMinStr()) return { ok: false, why: 'sila < ' + canonMinStr() };
    if (corrBlocked(g.sym)) return { ok: false, why: 'korelacja (1 na rodzine)' };
    // edge
    try {
      if (global.BTX_EDGE && global.BTX_EDGE.gate) {
        var e = global.BTX_EDGE.gate(g);
        if (!e.ok) return e;
      }
    } catch (err) {}
    // elite
    try {
      if (global.BTX_ELITE && global.BTX_ELITE.canAutoOpen) {
        var c = global.BTX_ELITE.canAutoOpen(g);
        if (!c.ok) return c;
      }
    } catch (err2) {}
    return { ok: true, why: 'PRO gate OK' };
  }

  function freeze(name, impl) {
    try {
      Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        get: function () { return impl; },
        set: function () { log1('ign-' + name, 'PRO gate: ignoruje kolejna nakladke ' + name, 'i'); }
      });
    } catch (e) {
      global[name] = impl;
    }
  }

  function boot() {
    var rawOpen = null;
    try {
      if (global.BTX_ENGINE && global.BTX_ENGINE.rawOpen) rawOpen = global.BTX_ENGINE.rawOpen;
    } catch (e) {}
    if (typeof global.openPos === 'function') {
      // capture underlying if not already frozen badly
      var cur = global.openPos;
      if (cur && !cur.__proGate) rawOpen = cur;
    }
    if (!rawOpen && global.BTX_ENGINE && global.BTX_ENGINE.rawOpen) rawOpen = global.BTX_ENGINE.rawOpen;
    if (!rawOpen) {
      setTimeout(boot, 1200);
      return;
    }

    var rawClose = typeof global.closePos === 'function' ? global.closePos : function () {};

    function openPosPro(g) {
      var gate = unifiedGate(g);
      if (!gate.ok) {
        log('PRO SKIP ' + (g && g.sym) + ' — ' + gate.why, 'i');
        return null;
      }
      log('PRO OPEN ' + g.sym + ' ' + g.side + ' s' + (g.strength || 0), 'g');
      return rawOpen.apply(global, arguments);
    }
    openPosPro.__proGate = true;

    function closePosPro(sym, why, px) {
      return rawClose.apply(global, arguments);
    }
    closePosPro.__proGate = true;

    freeze('openPos', openPosPro);
    freeze('closePos', closePosPro);

    global.BTX_ENGINE = {
      version: 'pro-gate-v2',
      gate: unifiedGate,
      rawOpen: rawOpen,
      rawClose: rawClose
    };
    log('PRO Engine Gate v2 aktywny — jedna sciezka decyzji', 'g');
  }

  // pozno — po edge/elite/freq
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 4000); });
  } else {
    setTimeout(boot, 4000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
