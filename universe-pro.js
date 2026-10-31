/**
 * BTX Universe PRO — 8 instrumentów pod daytrading na XTB (Twelve Data)
 * Kryteria: płynność, zmienność, ciasny spread, sesja US / FX major, CFD na XTB.
 */
(function (global) {
  /**
   * Mapowanie XTB (ręczne):
   * NVDA, TSLA, META, AAPL → CFD akcji US na XTB
   * QQQ → US100 / NAS100 / QQQ.US
   * SPY → US500 / SPX500 / SPY.US
   * EURUSD → EURUSD
   * XAU/USD → GOLD
   */
  var UNI = [
    { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', b: 140, v: 0.0022, mkt: 'US', xtb: 'NVDA.US', why: 'Najwyższa zmienność wśród mega-tech, idealna pod intraday' },
    { s: 'TSLA', n: 'Tesla', t: 'Akcja', b: 250, v: 0.0024, mkt: 'US', xtb: 'TSLA.US', why: 'Duże ruchy dzienne, lubiana przez daytraderów' },
    { s: 'META', n: 'Meta Platforms', t: 'Akcja', b: 580, v: 0.0018, mkt: 'US', xtb: 'META.US', why: 'Płynna, mocne reakcje na momentum tech' },
    { s: 'AAPL', n: 'Apple', t: 'Akcja', b: 230, v: 0.0014, mkt: 'US', xtb: 'AAPL.US', why: 'Najpłynniejsza akcja US — ciasny spread' },
    { s: 'QQQ', n: 'Nasdaq 100 ETF', t: 'ETF', b: 480, v: 0.0012, mkt: 'US', xtb: 'US100', why: 'Proxy Nasdaq — klasyka daytradingu indeksowego' },
    { s: 'SPY', n: 'S&P 500 ETF', t: 'ETF', b: 560, v: 0.0009, mkt: 'US', xtb: 'US500', why: 'Benchmark rynku, stabilna płynność' },
    { s: 'EURUSD', n: 'EUR/USD', t: 'FX', b: 1.08, v: 0.00035, mkt: 'FX', xtb: 'EURUSD', why: 'Najpłynniejsza para FX — handel prawie całą sesję' },
    { s: 'XAU/USD', n: 'Złoto (Gold)', t: 'FX', b: 2650, v: 0.0008, mkt: 'FX', xtb: 'GOLD', why: 'Wysoka aktywność daytradingowa na XTB jako GOLD' }
  ];

  function applyUniverse() {
    global.SYMBOLS = UNI.slice();
    // odśwież serie demo jeśli brak
    if (global.ST && global.ST.series) {
      UNI.forEach(function (m) {
        if (!global.ST.series[m.s] && typeof global.initSeries === 'function') {
          try { global.ST.series[m.s] = global.initSeries(m, 150); } catch (e) {}
        }
      });
      // usuń serie spoza uniwersum (opcjonalnie — zostawiamy stare, nie szkodzą)
    }
    refreshUi();
  }

  function refreshUi() {
    try {
      var sel = document.getElementById('chart-sym');
      if (sel) {
        var cur = sel.value;
        sel.innerHTML = UNI.map(function (m) {
          return '<option value="' + m.s + '">' + m.s + ' — ' + m.n + ' (XTB: ' + m.xtb + ')</option>';
        }).join('');
        if (UNI.some(function (m) { return m.s === cur; })) sel.value = cur;
      }
      var uni = document.getElementById('uni');
      if (uni) {
        uni.innerHTML = UNI.map(function (m) {
          return '<span class="tag">' + m.s + '</span> ' + m.n + ' · XTB <b>' + m.xtb + '</b> · <span class="mut">' + m.why + '</span>';
        }).join('<br>');
      }
      // mała notka na rynku / ustawieniach
      var note = document.getElementById('universe-note');
      if (!note) {
        var host = document.getElementById('pane-mkt') || document.getElementById('pane-cfg');
        if (host) {
          note = document.createElement('div');
          note.id = 'universe-note';
          note.className = 'mut';
          note.style.cssText = 'font-size:12px;line-height:1.5;margin:10px 12px 0;padding:10px 12px;border-left:3px solid var(--red);background:rgba(228,0,43,.06);border-radius:0 10px 10px 0';
          var card = host.querySelector('.card');
          if (card) card.appendChild(note);
          else host.appendChild(note);
        }
      }
      if (note) {
        note.innerHTML = '<b>Uniwersum PRO (8)</b> pod daytrading + limit Twelve Basic. '
          + 'Mapowanie XTB: NVDA/TSLA/META/AAPL → CFD akcji · QQQ→US100 · SPY→US500 · EURUSD · XAU/USD→GOLD. '
          + 'Auto: najlepiej 120–180 s przy 8 symbolach.';
      }
    } catch (e) {}
  }

  function boot() {
    applyUniverse();
    // ponów po załadowaniu reszty UI
    setTimeout(applyUniverse, 500);
    setTimeout(applyUniverse, 1500);
  }

  global.BTX_UNIVERSE = { list: UNI, apply: applyUniverse };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
