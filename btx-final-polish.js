/**
 * Final polish:
 * - twarde koszty XTB przy open/close paper
 * - SKIP reason na liscie Sygnaly
 * - limit 1 pozycji na rodzine korelacji
 * - throttle UI (telefon)
 * - prostszy gate open (elite+hold juz sa)
 */
(function (global) {
  'use strict';
  if (global.__BTX_FINAL_POLISH__) return;
  global.__BTX_FINAL_POLISH__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
  }

  // --- koszty ---
  function costPct(sym) {
    var mkt = 'US';
    try {
      var list = global.SYMBOLS || [];
      for (var i = 0; i < list.length; i++) if (list[i].s === sym) { mkt = list[i].mkt || 'US'; break; }
    } catch (e) {}
    var map = {
      US: 0.0007, EU: 0.0011, PL: 0.0015, FX: 0.0002
    };
    return map[mkt] != null ? map[mkt] : 0.0008;
  }

  function applyOpenCost(p, sym) {
    if (!p || p.costApplied) return;
    var notional = Math.abs((p.entry || 0) * (p.qty || 0) * (p.rate || 1));
    var c = notional * costPct(sym);
    p.openCost = c;
    p.costApplied = true;
    var ST = global.ST;
    if (ST) {
      ST.cash = (ST.cash || 0) - c;
      ST.equity = (ST.equity || 0) - c;
    }
    log('Koszt wejscia XTB~ ' + sym + ' -' + c.toFixed(2), 'i');
  }

  function applyCloseCost(sym, p, pnl) {
    if (!p) return pnl;
    var notional = Math.abs((p.entry || 0) * (p.qty || 0) * (p.rate || 1));
    var c = notional * costPct(sym);
    return (pnl || 0) - c - (p.openCost || 0);
  }

  // --- korelacja: max 1 na rodzine ---
  function family(sym) {
    if (/EURUSD|GBPUSD|USDJPY|XAU|GOLD|AUDUSD|USDCHF/.test(sym)) return 'FX_MAJOR';
    if (/AAPL|MSFT|GOOGL|AMZN|META|NVDA|TSLA|AMD|NFLX|ANTHROPIC|ANT/.test(sym)) return 'US_TECH';
    if (/ASML|SAP|SIE|MC\.|OR\.|AIR\.|BP\.|SHELL/.test(sym)) return 'EU_BLUE';
    if (/SPY|QQQ|IWM|DIA|EWZ|EWG/.test(sym)) return 'ETF_IDX';
    return 'OTHER_' + sym;
  }

  function corrBlocked(sym) {
    var ST = global.ST;
    if (!ST || !ST.pos) return false;
    var fam = family(sym);
    for (var s in ST.pos) {
      if (s === sym) continue;
      if (family(s) === fam) return true;
    }
    return false;
  }

  // --- openPos gate ---
  function patchOpen() {
    if (typeof global.openPos !== 'function' || global.openPos.__polish) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      if (g && g.sym && corrBlocked(g.sym)) {
        log('SKIP OPEN ' + g.sym + ' — limit korelacji (1 na rodzine)', 'i');
        return null;
      }
      var ST = global.ST;
      var before = ST && ST.pos ? Object.keys(ST.pos).slice() : [];
      var r = prev.apply(this, arguments);
      try {
        if (ST && g && ST.pos && ST.pos[g.sym] && before.indexOf(g.sym) < 0) {
          applyOpenCost(ST.pos[g.sym], g.sym);
        }
      } catch (e) {}
      return r;
    };
    global.openPos.__polish = true;
  }

  function patchClose() {
    if (typeof global.closePos !== 'function' || global.closePos.__polishCost) return;
    var prev = global.closePos;
    global.closePos = function (sym, why, px) {
      var ST = global.ST;
      var p = ST && ST.pos && ST.pos[sym];
      // wstrzyknij koszt do logiki: zmniejsz equity po zamknieciu
      var r = prev.apply(this, arguments);
      try {
        if (p && ST && ST.closed && ST.closed[0] && ST.closed[0].sym === sym) {
          var extra = (p.openCost || 0) + Math.abs((p.entry || 0) * (p.qty || 0) * (p.rate || 1)) * costPct(sym);
          ST.closed[0].pnl = (ST.closed[0].pnl || 0) - (p.openCost ? 0 : extra * 0.5);
          ST.closed[0].costEst = extra;
        }
      } catch (e) {}
      return r;
    };
    global.closePos.__polishCost = true;
  }

  // --- SKIP na liscie sygnalow ---
  function patchSignalsTable() {
    var host = document.getElementById('tbl-sig') || document.getElementById('desk-sig');
    if (!host) return;
    if (host.dataset.polishSkip === '1') return;
    // MutationObserver: dopisz powod SKIP do wierszy
    var obs = new MutationObserver(function () {
      try {
        var ST = global.ST;
        if (!ST || !ST.sig) return;
        var rows = host.querySelectorAll('tr, .sig-row, [data-sym]');
        // prostsza metoda: dolacz box
        var box = document.getElementById('btx-sig-skip-box');
        if (!box) {
          box = document.createElement('div');
          box.id = 'btx-sig-skip-box';
          box.style.cssText = 'margin:8px 0;padding:10px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.5);font-size:12px;color:#cbd5e1;line-height:1.45';
          host.parentNode && host.parentNode.insertBefore(box, host);
        }
        var lines = [];
        (ST.sig || []).filter(function (g) { return g && (g.side === 'LONG' || g.side === 'SHORT'); })
          .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })
          .slice(0, 8)
          .forEach(function (g) {
            var why = '';
            try {
              if (global.BTX_ENTRY && global.BTX_ENTRY.skipReason) why = global.BTX_ENTRY.skipReason(g) || '';
              if (!why && global.BTX_ELITE && global.BTX_ELITE.canAutoOpen) {
                var c = global.BTX_ELITE.canAutoOpen(g);
                if (!c.ok) why = c.why;
              }
              if (!why && corrBlocked(g.sym)) why = 'korelacja (1 na rodzine)';
            } catch (e) {}
            lines.push('<div><b style="color:#fff">' + g.sym + '</b> ' + g.side + ' s' + (g.strength || 0) +
              (why ? (' — <span style="color:#f87171">SKIP: ' + why + '</span>') : ' — <span style="color:#4ade80">może OPEN</span>') +
              '</div>');
          });
        box.innerHTML = '<b style="color:#e2e8f0">Sygnały → filtr OPEN</b>' + (lines.join('') || '<div>Brak sygnałów</div>');
      } catch (e2) {}
    });
    obs.observe(host, { childList: true, subtree: true });
    host.dataset.polishSkip = '1';
  }

  // --- UI throttle ---
  var lastHeavy = 0;
  function throttleUI() {
    var now = Date.now();
    if (now - lastHeavy < 2500) return false;
    lastHeavy = now;
    return true;
  }
  global.BTX_UI_OK = throttleUI;

  function boot() {
    patchOpen();
    patchClose();
    patchSignalsTable();
    setInterval(function () {
      patchOpen();
      patchClose();
      patchSignalsTable();
    }, 6000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1000); });
  else setTimeout(boot, 1000);
})(typeof window !== 'undefined' ? window : globalThis);
