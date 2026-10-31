/**
 * BTX Universe PRO — wymusza dokładnie 8 instrumentów wszędzie (Rynek, chart, cykl)
 */
(function (global) {
  var UNI = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', why: 'Najwyższa zmienność mega-tech' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', why: 'Duże ruchy intraday' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', why: 'Płynny momentum tech' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', why: 'Najpłynniejsza akcja US' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', why: 'Proxy Nasdaq / US100 na XTB' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', why: 'Benchmark S&P / US500' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', why: 'Najpłynniejsza para FX' },
    { s: 'XAU/USD', n: 'Złoto (Gold)', t: 'FX', b: 2650, v: 0.0008, mkt: 'FX', xtb: 'GOLD', why: 'GOLD na XTB — mocny daytrading' }
  ];
  var ALLOW = {};
  UNI.forEach(function (m) { ALLOW[m.s] = true; });

  function setSymbols() {
    global.SYMBOLS = UNI.slice();
    // nie pozwól późniejszemu kodowi wrócić do długiej listy
    try {
      Object.defineProperty(global, 'SYMBOLS', {
        configurable: true,
        enumerable: true,
        get: function () { return UNI.slice(); },
        set: function (v) {
          /* ignoruj próby nadpisania długą listą — trzymaj UNI */
          if (v && v.length === UNI.length) {
            /* allow same-size updates of prices etc via replace contents */
            for (var i = 0; i < UNI.length; i++) {
              if (v[i] && v[i].s === UNI[i].s) {
                if (v[i].b != null) UNI[i].b = v[i].b;
              }
            }
          }
        }
      });
    } catch (e) {
      global.SYMBOLS = UNI.slice();
    }
  }

  function ensureSeries() {
    if (!global.ST) return;
    if (!global.ST.series) global.ST.series = {};
    UNI.forEach(function (m) {
      if (!global.ST.series[m.s] && typeof global.initSeries === 'function') {
        try { global.ST.series[m.s] = global.initSeries(m, 150); } catch (e) {}
      }
    });
  }

  function refreshSelects() {
    var sel = document.getElementById('chart-sym');
    if (sel) {
      var cur = sel.value;
      var html = UNI.map(function (m) {
        return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + ' (XTB: ' + m.xtb + ')</option>';
      }).join('');
      if (sel.innerHTML !== html) {
        sel.innerHTML = html;
        if (ALLOW[cur]) sel.value = cur;
        else sel.value = UNI[0].s;
      }
    }
    var uni = document.getElementById('uni');
    if (uni) {
      uni.innerHTML = UNI.map(function (m) {
        return '<span class="tag">' + m.s + '</span> ' + m.n + ' · XTB <b>' + m.xtb + '</b>';
      }).join('<br>');
    }
  }

  function forceMktTable() {
    var el = document.getElementById('tbl-mkt');
    if (!el) return;
    // jeśli tabela ma więcej niż 8 wierszy danych — przerysuj z UNI
    var rows = el.querySelectorAll('tbody tr, tr');
    // prościej: zawsze wołaj renderMkt po naszym SYMBOLS
    if (typeof global.renderMkt === 'function') {
      try { global.renderMkt(); } catch (e) {}
    }
  }

  function patchRenderMkt() {
    if (typeof global.renderMkt !== 'function') return;
    if (global.renderMkt.__uni8) return;
    var orig = global.renderMkt;
    global.renderMkt = function () {
      setSymbols();
      ensureSeries();
      return orig.apply(this, arguments);
    };
    global.renderMkt.__uni8 = true;
  }

  function patchRender() {
    if (typeof global.render !== 'function' || global.render.__uni8) return;
    var orig = global.render;
    global.render = function () {
      setSymbols();
      ensureSeries();
      var r = orig.apply(this, arguments);
      refreshSelects();
      return r;
    };
    global.render.__uni8 = true;
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__uni8) return;
    var orig = global.cycle;
    global.cycle = function () {
      setSymbols();
      ensureSeries();
      return orig.apply(this, arguments);
    };
    global.cycle.__uni8 = true;
  }

  function banner() {
    var host = document.getElementById('pane-mkt');
    if (!host) return;
    var note = document.getElementById('universe-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'universe-note';
      note.style.cssText = 'font-size:12px;line-height:1.5;margin:0 0 12px;padding:10px 12px;border-left:3px solid var(--red);background:rgba(228,0,43,.08);border-radius:0 10px 10px 0;color:var(--tx2)';
      var card = host.querySelector('.card');
      if (card) {
        var h2 = card.querySelector('h2');
        if (h2 && h2.nextSibling) card.insertBefore(note, h2.nextSibling);
        else if (card) card.insertBefore(note, card.firstChild);
      } else host.insertBefore(note, host.firstChild);
    }
    note.innerHTML = '<b>Uniwersum PRO: 8 instrumentów</b> — NVDA, TSLA, META, AAPL, QQQ (XTB: US100), SPY (US500), EURUSD, XAU/USD (GOLD). Auto 180 s.';
  }

  function tick() {
    setSymbols();
    ensureSeries();
    patchRenderMkt();
    patchRender();
    patchCycle();
    refreshSelects();
    banner();
    forceMktTable();
  }

  function boot() {
    tick();
    setTimeout(tick, 300);
    setTimeout(tick, 1000);
    setTimeout(tick, 2500);
    setInterval(tick, 4000);
  }

  global.BTX_UNIVERSE = { list: UNI, apply: tick };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
