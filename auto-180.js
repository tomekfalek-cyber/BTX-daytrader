/** BTX — wymuś Auto = 180 s (bezpiecznie przy 8 symbolach / Twelve Basic) */
(function (global) {
  var SEC = 180;

  function apply() {
    try {
      if (global.CFG) global.CFG.autoSec = SEC;
      var el = document.getElementById('set-autosec');
      if (el) el.value = String(SEC);
      // jeśli Auto już leci — przebuduj interval
      if (global.AUTO) {
        clearInterval(global.AUTO);
        global.AUTO = setInterval(function () {
          if (typeof global.cycle === 'function') global.cycle();
        }, SEC * 1000);
      }
      if (typeof global.save === 'function') global.save();
    } catch (e) {}
  }

  function boot() {
    apply();
    setTimeout(apply, 400);
    setTimeout(apply, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
