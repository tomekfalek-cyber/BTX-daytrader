/**
 * 3) Priorytet Twelve: otwarte pozycje -> sygnaly A+/A -> EU morning -> reszta.
 */
(function (global) {
  'use strict';
  if (global.__BTX_LIVE_PRIO__) return;
  global.__BTX_LIVE_PRIO__ = true;

  function gradeOf(g) {
    if (g.desk && g.desk.grade) return g.desk.grade;
    var s = g.strength || 0;
    if (s >= 4) return 'A+';
    if (s >= 3) return 'A';
    if (s >= 2) return 'B';
    return 'C';
  }

  function buildOrder() {
    var order = [];
    var seen = {};
    function add(sym) {
      if (!sym || seen[sym]) return;
      seen[sym] = 1;
      order.push(sym);
    }
    var ST = global.ST || {};
    // 1) open positions
    Object.keys(ST.pos || {}).forEach(add);
    // 2) strong signals
    (ST.sig || []).forEach(function (g) {
      if (!g || (g.side !== 'LONG' && g.side !== 'SHORT')) return;
      var gr = gradeOf(g);
      if (gr === 'A+' || gr === 'A') add(g.sym);
    });
    // 3) EU core
    ['ASML', 'SAP', 'SIE.DE', 'EURUSD', 'XAUUSD'].forEach(add);
    // 4) rest of signals
    (ST.sig || []).forEach(function (g) { if (g && g.sym) add(g.sym); });
    // 5) universe
    (global.SYMBOLS || []).forEach(function (m) { if (m && m.s) add(m.s); });
    return order;
  }

  function apply() {
    var order = buildOrder();
    global.__BTX_LIVE_ORDER = order;
    try {
      if (global.BTX_LIVE) {
        global.BTX_LIVE.prioritySyms = function () { return order.slice(); };
        if (typeof global.BTX_LIVE.setPriority === 'function') global.BTX_LIVE.setPriority(order);
      }
    } catch (e) {}
  }

  function boot() {
    apply();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(apply, 'live-priority');
    else setInterval(apply, 5000);
  }
  global.BTX_LIVE_PRIO = { order: buildOrder, apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})(typeof window !== 'undefined' ? window : globalThis);
