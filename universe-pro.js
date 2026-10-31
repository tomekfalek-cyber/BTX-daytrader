/**
 * BTX Universe PRO — 8 instrumentów (backup + UI)
 * Główne źródło prawdy: Pages workflow nadpisuje SYMBOLS w index.html
 */
(function (global) {
  var UNI = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500' },
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
    var uni = document.getElementById('uni');
    if (uni) {
      uni.innerHTML = UNI.map(function (m) {
        return '<span class="tag">' + m.s + '</span> ' + m.n + ' · XTB ' + m.xtb;
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
    if (note) note.innerHTML = '<b>Uniwersum: 8</b> NVDA TSLA META AAPL QQQ SPY EURUSD XAU/USD (Auto 180s)';
  }

  function patch() {
    apply();
    if (typeof global.renderMkt === 'function' && !global.renderMkt.__u8) {
      var rm = global.renderMkt;
      global.renderMkt = function () { apply(); return rm.apply(this, arguments); };
      global.renderMkt.__u8 = true;
    }
    if (typeof global.render === 'function' && !global.render.__u8) {
      var r = global.render;
      global.render = function () { apply(); var out = r.apply(this, arguments); return out; };
      global.render.__u8 = true;
    }
    if (typeof global.cycle === 'function' && !global.cycle.__u8) {
      var c = global.cycle;
      global.cycle = function () { apply(); return c.apply(this, arguments); };
      global.cycle.__u8 = true;
    }
  }

  function boot() {
    patch();
    setTimeout(patch, 200);
    setTimeout(patch, 800);
    setTimeout(patch, 2000);
    setInterval(patch, 5000);
  }

  global.BTX_UNIVERSE = { list: UNI, apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
