/**
 * BTX Universe PRO — daytrading XTB: akcje/ETF US+EU + FX (+ ANT IPO)
 */
(function (global) {
  var UNI = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', ccy: 'USD' },
    { s: 'ANT', n: 'Anthropic', t: 'Akcja', b: 83, v: 0.0035, mkt: 'US', xtb: 'ANT.US', ccy: 'USD' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', ccy: 'USD' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', ccy: 'USD' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', ccy: 'USD' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', ccy: 'USD' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', ccy: 'USD' },
    { s: 'ASML', n: 'ASML Holding', t: 'Akcja', b: 700, v: 0.0018, mkt: 'EU', xtb: 'ASML.NL', ccy: 'EUR' },
    { s: 'SAP', n: 'SAP SE', t: 'Akcja', b: 220, v: 0.0015, mkt: 'EU', xtb: 'SAP.DE', ccy: 'EUR' },
    { s: 'SIE.DE', n: 'Siemens', t: 'Akcja', b: 180, v: 0.0014, mkt: 'EU', xtb: 'SIE.DE', ccy: 'EUR' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', ccy: 'USD' },
    { s: 'GBPUSD', n: 'GBP/USD', t: 'FX', b: 1.27, v: 0.0004, mkt: 'FX', xtb: 'GBPUSD', ccy: 'USD' },
    { s: 'USDJPY', n: 'USD/JPY', t: 'FX', b: 150, v: 0.0004, mkt: 'FX', xtb: 'USDJPY', ccy: 'JPY' }
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
        return '<option value="' + m.s + '">' + m.s + ' \u2014 ' + m.n + ' (' + (m.ccy || '') + ')</option>';
      }).join('');
      if (UNI.some(function (m) { return m.s === cur; })) sel.value = cur;
    }
    var uni = document.getElementById('uni');
    if (uni) {
      uni.innerHTML = UNI.map(function (m) {
        return '<span class="tag">' + m.s + '</span> ' + m.n + ' \u00b7 ' + (m.ccy || '') + ' \u00b7 XTB ' + (m.xtb || m.s) + ' \u00b7 ' + m.mkt;
      }).join('<br>');
    }
    var note = document.getElementById('universe-note');
    if (!note) {
      var host = document.getElementById('pane-mkt');
      if (host) {
        note = document.createElement('div');
        note.id = 'universe-note';
        note.style.cssText = 'font-size:12px;margin:0 0 12px;padding:10px 12px;border-left:3px solid var(--green,#12c48b);background:rgba(18,196,139,.08);border-radius:0 10px 10px 0';
        var card = host.querySelector('.card');
        if (card) {
          var h2 = card.querySelector('h2');
          if (h2) card.insertBefore(note, h2.nextSibling);
          else card.insertBefore(note, card.firstChild);
        }
      }
    }
    if (note) {
      note.innerHTML = '<b>Uniwersum daytrading XTB</b> \u00b7 US: NVDA <b>ANT</b> TSLA META AAPL QQQ SPY \u00b7 EU: ASML SAP SIE \u00b7 FX: EURUSD GBPUSD USDJPY';
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
