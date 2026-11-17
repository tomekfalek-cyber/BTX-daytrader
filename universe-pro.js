/**
 * BTX Universe PRO — daytrading 500 PLN: 4 pary FX (jedno zrodlo prawdy w runtime)
 */
(function (global) {
  var UNI = [
    // Profil DAYTRADING 500 PLN: pary FX (CFD) — koszt = tylko spread, dzwignia 1:30, pozycja od 0.01 lota (1000 szt.)
    // Akcje US/EU i ETF usuniete z aktywnego skanu: przewalutowanie ~1% rundy + 1 akcja NVDA/META/ASML > 500 PLN; zloto: min. 1 oz > kapital.
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', xtb: 'GBPUSD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', xtb: 'USDJPY' },
    { s: 'AUDUSD', n: 'AUD/USD', t: 'FX', b: 0.65, v: 0.0004, mkt: 'FX', xtb: 'AUDUSD' }
  ];

  function apply() {
    global.SYMBOLS = UNI.slice();
    if (global.ST && global.ST.series && typeof global.initSeries === 'function') {
      UNI.forEach(function (m) {
        if (!global.ST.series[m.s]) {
          try { global.ST.series[m.s] = global.initSeries(m, 150); } catch (e) {}
        }
      });
    }
    var sel = document.getElementById('chart-sym');
    if (sel) {
      var cur = sel.value;
      sel.innerHTML = UNI.map(function (m) {
        return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + '</option>';
      }).join('');
      if (UNI.some(function (m) { return m.s === cur; })) sel.value = cur;
    }
    var uni = document.getElementById('uni');
    if (uni) {
      uni.innerHTML = UNI.map(function (m) {
        return '<span class="tag">' + m.s + '</span> ' + m.n + ' · XTB ' + (m.xtb || m.s) + ' · ' + m.mkt;
      }).join('<br>');
    }
    var note = document.getElementById('universe-note');
    if (!note) {
      var host = document.getElementById('pane-mkt');
      if (host) {
        note = document.createElement('div');
        note.id = 'universe-note';
        note.style.cssText = 'font-size:12px;margin:0 0 12px;padding:10px 12px;border-left:3px solid var(--red);background:rgba(228,0,43,.08);border-radius:0 10px 10px 0';
        var card = host.querySelector('.card');
        if (card) {
          var h2 = card.querySelector('h2');
          if (h2) card.insertBefore(note, h2.nextSibling);
          else card.insertBefore(note, card.firstChild);
        }
      }
    }
    if (note) {
      note.innerHTML = '<b>Uniwersum daytrading (500 PLN): 4 pary FX</b> · EURUSD GBPUSD USDJPY AUDUSD · sesja 08:00-21:00 PL';
    }
  }

  function patch() {
    apply();
    if (typeof global.render === 'function' && !global.render.__u11) {
      var r = global.render;
      global.render = function () { apply(); return r.apply(this, arguments); };
      global.render.__u11 = true;
    }
    if (typeof global.cycle === 'function' && !global.cycle.__u11) {
      var c = global.cycle;
      global.cycle = function () { apply(); return c.apply(this, arguments); };
      global.cycle.__u11 = true;
    }
  }

  function boot() {
    patch();
    setTimeout(patch, 150);
    setTimeout(patch, 600);
    setTimeout(patch, 1500);
  }

  global.BTX_UNI = { list: UNI, apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
