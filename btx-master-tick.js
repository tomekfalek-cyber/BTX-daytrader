/**
 * 1) Wspolny tick 4s — centralny rytm (moduly powinny uzywac BTX_TICK.on zamiast setInterval) zamiast chaosu timerow (subskrypcje).
 */
(function (global) {
  'use strict';
  if (global.__BTX_MASTER_TICK__) return;
  global.__BTX_MASTER_TICK__ = true;

  var subs = [];
  var last = 0;

  function onTick(fn, label) {
    if (typeof fn !== 'function') return function () {};
    var item = { fn: fn, label: label || 'anon' };
    subs.push(item);
    return function () {
      subs = subs.filter(function (x) { return x !== item; });
    };
  }

  function pulse() {
    var now = Date.now();
    if (now - last < 3500) return;
    last = now;
    for (var i = 0; i < subs.length; i++) {
      try { subs[i].fn(now); } catch (e) {}
    }
    try {
      global.dispatchEvent(new CustomEvent('btx-tick', { detail: { t: now } }));
    } catch (e2) {}
  }

  global.BTX_TICK = { on: onTick, pulse: pulse, list: function () { return subs.map(function (s) { return s.label; }); } };
  setInterval(pulse, 4000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(pulse, 500); });
  else setTimeout(pulse, 500);
})(typeof window !== 'undefined' ? window : globalThis);
