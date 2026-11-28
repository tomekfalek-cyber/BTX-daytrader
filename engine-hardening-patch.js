/** Patch: FX 8-21 PL + blokada slepego openPos z engine.cycle */
(function (global) {
  'use strict';
  if (global.__BTX_ENG_PATCH__) return;
  global.__BTX_ENG_PATCH__ = true;
  function warsawParts() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
    var wd = map.weekday || '';
    return { min: min, weekend: /Sat|Sun/i.test(wd), label: wd + ' ' + map.hour + ':' + map.minute };
  }
  function sessionOpenFixed(mkt) {
    var w = warsawParts();
    if (w.weekend) return false;
    var h = w.min / 60;
    if (mkt === 'US') return h >= 15.5 && h < 22;
    if (mkt === 'PL' || mkt === 'EU') return h >= 9 && h < 17.5;
    return h >= 8 && h < 21;
  }
  function install() {
    global.sessionOpen = sessionOpenFixed;
    if (global.BTX_HARDENING) global.BTX_HARDENING.sessionOpenFixed = sessionOpenFixed;
    if (typeof global.cycle === 'function' && !global.cycle.__noBlindOpen) {
      var orig = global.cycle;
      global.cycle = function () {
        var bak = global.openPos;
        var held = false;
        try {
          if (typeof bak === 'function') {
            global.openPos = function () { /* no blind open from engine cycle */ };
            held = true;
          }
          return orig.apply(this, arguments);
        } finally {
          if (held) global.openPos = bak;
        }
      };
      global.cycle.__noBlindOpen = true;
    }
  }
  install();
  setInterval(install, 3000);
})(typeof window !== 'undefined' ? window : globalThis);
