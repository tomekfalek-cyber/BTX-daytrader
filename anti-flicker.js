/**
 * Anti-flicker (laduje sie PIERWSZY).
 * Wiele modulow co 1-8 s robi el.innerHTML = <ten sam HTML>, co przebudowuje DOM
 * i powoduje drganie okien/paneli. Ten modul pomija zapis, gdy:
 *  - przypisywany HTML jest taki sam jak ostatnio przypisany, oraz
 *  - zawartosc elementu nie zmienila sie w miedzyczasie (inny kod nie dotykal DOM).
 * Dodatkowo: stala szerokosc licznika skanu (cyfry tabelaryczne), zeby nie "chodzil" co sekunde.
 */
(function (global) {
  'use strict';
  if (global.__BTX_ANTI_FLICKER__) return;
  global.__BTX_ANTI_FLICKER__ = true;

  var proto = global.Element && global.Element.prototype;
  var desc = proto && Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  if (desc && desc.get && desc.set) {
    var last = new WeakMap(); // el -> { html: przypisany string, ser: serializacja po zapisie }
    Object.defineProperty(proto, 'innerHTML', {
      configurable: true,
      enumerable: desc.enumerable,
      get: function () { return desc.get.call(this); },
      set: function (value) {
        var html = String(value);
        var rec = last.get(this);
        if (rec && rec.html === html && desc.get.call(this) === rec.ser) return; // bez zmian -> nie ruszaj DOM
        desc.set.call(this, html);
        last.set(this, { html: html, ser: desc.get.call(this) });
      }
    });
    global.BTX_ANTI_FLICKER = { guarded: true };
  }

  function addCss() {
    if (document.getElementById('btx-anti-flicker-css')) return;
    var st = document.createElement('style');
    st.id = 'btx-anti-flicker-css';
    st.textContent =
      '#scan-countdown{font-variant-numeric:tabular-nums;display:inline-block;min-width:78px;text-align:center}' +
      'td,th,.v,.val,.badge{font-variant-numeric:tabular-nums}';
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addCss);
  else addCss();
})(typeof window !== 'undefined' ? window : globalThis);
