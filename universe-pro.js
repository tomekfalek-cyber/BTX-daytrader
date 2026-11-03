/**
 * BTX Universe PRO — 8 US/FX + 3 płynne EU (XTB)
 * Główne źródło: Pages workflow też nadpisuje SYMBOLS w index.html
 */
(function (global) {
  var UNI = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500' },
    { s: 'ASML', n: 'ASML Holding (EU)', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', xtb: 'ASML.NL' },
    { s: 'SAP', n: 'SAP SE (EU)', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', xtb: 'SAP.DE' },
    { s: 'SIE.DE', n: 'Siemens (EU)', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', xtb: 'SIE.DE' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD' },
    { s: 'XAU/USD', n: 'Zloto (Gold)', t: 'FX', b: 2650, v: 0.0008, mkt: 'FX', xtb: 'GOLD' }
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
      note.innerHTML = '<b>Uniwersum: 11</b> · US tech/ETF + <b>EU płynne: ASML, SAP, SIE.DE</b> (XTB) + FX/Gold. ' +
        'EU sesja ~9:00–17:30 PL · US od ~15:30. Free Twelve: obserwuj limit API.';
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
    setTimeout(patch, 200);
    setTimeout(patch, 800);
  }

  global.BTX_UNI = { list: UNI, apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
