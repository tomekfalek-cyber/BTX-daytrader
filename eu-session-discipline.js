/**
 * Dyscyplina EU: 9:00-16:30 nowe wejscia EU; po 16:30 EU tylko zarzadzanie (bez nowych EU).
 * FX moze dzialac dluzej; US od 15:30.
 */
(function (global) {
  'use strict';
  if (global.__BTX_EU_DISC__) return;
  global.__BTX_EU_DISC__ = true;

  function warsawMin() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || '')
    };
  }
  function mktOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].mkt || 'US';
    if (/ASML|SAP|SIE/.test(sym || '')) return 'EU';
    if (/EUR|XAU|GOLD|USDJPY/.test(sym || '')) return 'FX';
    return 'US';
  }
  function euEntryAllowed() {
    var w = warsawMin();
    if (w.weekend) return false;
    return w.min >= 9 * 60 && w.min < 16 * 60 + 30;
  }
  function install() {
    if (typeof global.openPos !== 'function' || global.openPos.__euDisc) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      if (g && g.sym && mktOf(g.sym) === 'EU' && !euEntryAllowed()) {
        if (global.log) global.log('EU dyscyplina: brak nowych wejść EU po 16:30 — ' + g.sym, 'i');
        return;
      }
      return prev.apply(this, arguments);
    };
    global.openPos.__euDisc = true;
  }
  function boot() {
    install();
    if (global.BTX_TICK && global.BTX_TICK.on) global.BTX_TICK.on(install, 'eu-disc');
    else setInterval(install, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
