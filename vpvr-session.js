/**
 * BTX VPVR sesji — uproszczone strefy ceny/wolumenu
 * POC + Value Area (~70%), klasyfikacja ceny, wpływ na siłę sygnału + Coach
 */
(function (global) {
  var BINS = 24;
  var VA_PCT = 0.70;
  var cache = {};

  function barsOf(sym) {
    var ST = global.ST;
    if (!ST || !ST.series || !ST.series[sym]) return [];
    return ST.series[sym] || [];
  }

  /** Preferuj dzisiejszą sesję (po UTC date), inaczej ostatnie ~78 świec (~6.5h @5m) */
  function sessionBars(sym) {
    var bars = barsOf(sym);
    if (!bars.length) return [];
    var now = new Date();
    var dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var today = [];
    for (var i = 0; i < bars.length; i++) {
      var t = bars[i].t || 0;
      if (t >= dayStart) today.push(bars[i]);
    }
    if (today.length >= 12) return today;
    return bars.slice(-78);
  }

  function buildProfile(sym) {
    var bars = sessionBars(sym);
    if (bars.length < 8) return null;

    var lo = Infinity, hi = -Infinity, i, b;
    var totalVol = 0;
    for (i = 0; i < bars.length; i++) {
      b = bars[i];
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
      totalVol += Math.max(0, +b.v || 0);
    }
    if (!(hi > lo) || !isFinite(lo) || !isFinite(hi)) return null;

    // FX często ma volume=0 — użyj proxy z zakresu świecy
    var useProxy = totalVol <= 0;
    var bins = [];
    for (i = 0; i < BINS; i++) bins.push(0);
    var width = (hi - lo) / BINS || 1e-9;

    for (i = 0; i < bars.length; i++) {
      b = bars[i];
      var mid = (b.h + b.l + b.c) / 3;
      var idx = Math.floor((mid - lo) / width);
      if (idx < 0) idx = 0;
      if (idx >= BINS) idx = BINS - 1;
      var w = useProxy ? Math.max(1e-9, (b.h - b.l)) : Math.max(0, +b.v || 0);
      if (w <= 0) w = 1e-9;
      bins[idx] += w;
    }

    var sum = 0, pocIdx = 0, pocVal = -1;
    for (i = 0; i < BINS; i++) {
      sum += bins[i];
      if (bins[i] > pocVal) { pocVal = bins[i]; pocIdx = i; }
    }
    if (sum <= 0) return null;

    // Value Area: rozszerzaj od POC aż ~70% wolumenu
    var left = pocIdx, right = pocIdx, acc = bins[pocIdx];
    var target = sum * VA_PCT;
    while (acc < target && (left > 0 || right < BINS - 1)) {
      var addL = left > 0 ? bins[left - 1] : -1;
      var addR = right < BINS - 1 ? bins[right + 1] : -1;
      if (addR >= addL) {
        if (right < BINS - 1) { right++; acc += bins[right]; }
        else if (left > 0) { left--; acc += bins[left]; }
        else break;
      } else {
        if (left > 0) { left--; acc += bins[left]; }
        else if (right < BINS - 1) { right++; acc += bins[right]; }
        else break;
      }
    }

    var poc = lo + (pocIdx + 0.5) * width;
    var val = lo + left * width;
    var vah = lo + (right + 1) * width;

    return {
      sym: sym,
      lo: lo,
      hi: hi,
      poc: poc,
      val: val,
      vah: vah,
      bins: bins,
      width: width,
      bars: bars.length,
      proxy: useProxy,
      total: sum
    };
  }

  function classify(price, prof) {
    if (!prof || price == null || !isFinite(price)) {
      return { zone: 'unknown', label: 'brak profilu', boost: 0, tip: 'Za mało świec do VPVR.' };
    }
    var poc = prof.poc, val = prof.val, vah = prof.vah;
    var band = Math.max((vah - val) * 0.08, (prof.hi - prof.lo) * 0.01);
    var nearPoc = Math.abs(price - poc) <= band * 1.2;

    if (nearPoc) {
      return {
        zone: 'poc',
        label: 'przy POC (największy obrót)',
        boost: 1,
        tip: 'POC to cena sesji z największym wolumenem — częsty magnet / punkt równowagi. Wejście tu ma sens z kierunkiem trendu, nie przeciwko niemu.'
      };
    }
    if (price >= val && price <= vah) {
      return {
        zone: 'value',
        label: 'w Value Area (~70% obrotu)',
        boost: 0,
        tip: 'Cena jest w głównym obszarze handlu sesji. Setupy mean-reversion i kontynuacji są OK, ale unikaj gonienia wybicia bez potwierdzenia.'
      };
    }
    if (price > vah) {
      var nearEdge = price - vah <= band * 2;
      return {
        zone: nearEdge ? 'above_va' : 'high',
        label: nearEdge ? 'tuż nad Value Area' : 'powyżej Value Area (drogo wzgl. sesji)',
        boost: nearEdge ? 0 : -1,
        tip: nearEdge
          ? 'Cena wyszła górą z VA — możliwe wybicie albo pułapka. Long tylko z silnym trendem; short tylko jako powrót do VA przy słabości.'
          : 'Daleko powyżej VA — więcej ryzyka FOMO na longach. Szukaj pullbacku do VA/POC zamiast gonić.'
      };
    }
    // below VAL
    var nearLow = val - price <= band * 2;
    return {
      zone: nearLow ? 'below_va' : 'low',
      label: nearLow ? 'tuż pod Value Area' : 'poniżej Value Area (tanio wzgl. sesji)',
      boost: nearLow ? 0 : -1,
      tip: nearLow
        ? 'Cena pod VA — test popytu albo kontynuacja spadku. Long od strefy tylko z trendem UP; short zgodny z DN.'
        : 'Daleko poniżej VA — ostrożnie z shortami „w próżnię”. Lepiej planować przy retestcie VA/POC.'
    };
  }

  function getProfile(sym) {
    var bars = barsOf(sym);
    var key = sym + ':' + bars.length + ':' + (bars.length ? bars[bars.length - 1].c : 0);
    if (cache[sym] && cache[sym].key === key) return cache[sym].prof;
    var prof = buildProfile(sym);
    cache[sym] = { key: key, prof: prof };
    return prof;
  }

  function annotateSignal(g) {
    if (!g || !g.sym) return g;
    var prof = getProfile(g.sym);
    var price = g.price != null ? g.price : (g.c != null ? g.c : null);
    if (price == null && global.ST && global.ST.series && global.ST.series[g.sym]) {
      var a = global.ST.series[g.sym];
      if (a.length) price = a[a.length - 1].c;
    }
    var cls = classify(price, prof);
    g.vpvr = {
      poc: prof ? +prof.poc : null,
      val: prof ? +prof.val : null,
      vah: prof ? +prof.vah : null,
      zone: cls.zone,
      label: cls.label,
      tip: cls.tip,
      proxy: prof ? !!prof.proxy : false,
      bars: prof ? prof.bars : 0
    };

    // lekka korekta siły (nie psuje progu 4/5)
    var side = g.side;
    var boost = cls.boost || 0;
    if (side === 'LONG') {
      if (cls.zone === 'poc' || cls.zone === 'below_va') boost += 0; // OK lokalizacja
      if (cls.zone === 'high') boost -= 1;
      if (cls.zone === 'above_va') boost -= 0;
    }
    if (side === 'SHORT') {
      if (cls.zone === 'high' || cls.zone === 'above_va') boost += 0;
      if (cls.zone === 'low') boost -= 1;
    }
    if (side === 'LONG' || side === 'SHORT') {
      if (boost <= -1 && (g.strength || 0) >= 2) {
        g.strength = Math.max(1, (g.strength || 0) - 1);
        g.why = (g.why || '') + ' | VPVR: ' + cls.label + ' (−1 siła)';
      } else if (cls.zone === 'poc') {
        g.why = (g.why || '') + ' | VPVR: przy POC';
      } else {
        g.why = (g.why || '') + ' | VPVR: ' + cls.label;
      }
    }
    return g;
  }

  function annotateAll() {
    var ST = global.ST;
    if (!ST || !ST.sig || !ST.sig.length) return;
    for (var i = 0; i < ST.sig.length; i++) annotateSignal(ST.sig[i]);
  }

  function fmt(x) {
    if (x == null || !isFinite(x)) return '—';
    if (Math.abs(x) >= 100) return x.toFixed(2);
    if (Math.abs(x) >= 1) return x.toFixed(4);
    return x.toFixed(5);
  }

  function coachHtml(g) {
    if (!g || !g.vpvr) return '';
    var v = g.vpvr;
    var lines = [];
    lines.push('<div class="vpvr-box">');
    lines.push('<div class="vpvr-title">Strefy ceny / wolumenu (sesja)</div>');
    if (v.poc != null) {
      lines.push('<div class="vpvr-levels">POC <b>' + fmt(v.poc) + '</b> · VA <b>' + fmt(v.val) + '</b>–<b>' + fmt(v.vah) + '</b>' +
        (v.proxy ? ' <span class="mut">(proxy wolumenu)</span>' : '') + '</div>');
    }
    lines.push('<div class="vpvr-zone">Lokalizacja: <b>' + (v.label || v.zone) + '</b></div>');
    lines.push('<div class="vpvr-tip">' + (v.tip || '') + '</div>');
    lines.push('</div>');
    return lines.join('');
  }

  function injectCss() {
    if (document.getElementById('btx-vpvr-css')) return;
    var s = document.createElement('style');
    s.id = 'btx-vpvr-css';
    s.textContent = [
      '.vpvr-box{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(245,179,1,.28);background:rgba(245,179,1,.07);font-size:12.5px;line-height:1.45}',
      '.vpvr-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#f5b301);font-weight:700;margin-bottom:6px}',
      '.vpvr-levels{color:var(--tx2);margin-bottom:4px}',
      '.vpvr-zone{margin:4px 0}',
      '.vpvr-tip{color:var(--tx3);font-size:12px}'
    ].join('');
    document.head.appendChild(s);
  }

  function patchCoach() {
    // dopisz VPVR do kart coach jeśli są kontenery sygnałów
    var nodes = document.querySelectorAll('[data-sym], .coach-card, .sig-card, #coach-root .card');
    // bezpieczniej: wzbogacaj ST.sig i polegaj na coach-ui; dodatkowo panel pod tbl-sig
    var host = document.getElementById('vpvr-coach-host');
    if (!host) {
      var pane = document.getElementById('pane-sig') || document.getElementById('pane-desk');
      if (pane) {
        host = document.createElement('div');
        host.id = 'vpvr-coach-host';
        host.style.margin = '12px 0';
        pane.appendChild(host);
      }
    }
    if (!host) return;
    var ST = global.ST;
    if (!ST || !ST.sig) { host.innerHTML = ''; return; }
    var active = ST.sig.filter(function (g) { return g.side === 'LONG' || g.side === 'SHORT'; })
      .sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); })
      .slice(0, 3);
    if (!active.length) {
      host.innerHTML = '<div class="mut" style="font-size:12px">VPVR: brak aktywnych LONG/SHORT — strefy liczą się po sygnale.</div>';
      return;
    }
    var html = '<div style="display:grid;gap:10px">';
    active.forEach(function (g) {
      annotateSignal(g);
      html += '<div class="vpvr-box"><b>' + g.sym + ' ' + g.side + '</b> · siła ' + (g.strength || 0) + '/5';
      html += coachHtml(g).replace('vpvr-box', 'vpvr-inner').replace(/<div class="vpvr-inner">| <\/div>$/g, '');
      // simpler:
      html = html; // noop
      html += '<div class="vpvr-levels">POC ' + fmt(g.vpvr.poc) + ' · VA ' + fmt(g.vpvr.val) + '–' + fmt(g.vpvr.vah) + '</div>';
      html += '<div class="vpvr-zone">' + g.vpvr.label + '</div>';
      html += '<div class="vpvr-tip">' + g.vpvr.tip + '</div></div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function patchRender() {
    if (typeof global.render === 'function' && !global.render.__vpvr) {
      var orig = global.render;
      global.render = function () {
        try { annotateAll(); } catch (e) {}
        var r = orig.apply(this, arguments);
        try { injectCss(); patchCoach(); } catch (e2) {}
        return r;
      };
      global.render.__vpvr = true;
    }
    if (typeof global.cycle === 'function' && !global.cycle.__vpvr) {
      var c = global.cycle;
      global.cycle = function () {
        var r = c.apply(this, arguments);
        try { annotateAll(); injectCss(); patchCoach(); } catch (e) {}
        return r;
      };
      global.cycle.__vpvr = true;
    }
  }

  function boot() {
    injectCss();
    patchRender();
    try { annotateAll(); patchCoach(); } catch (e) {}
    setInterval(function () {
      try {
        patchRender();
        annotateAll();
        patchCoach();
      } catch (e) {}
    }, 4000);
  }

  global.BTX_VPVR = {
    getProfile: getProfile,
    classify: classify,
    annotateSignal: annotateSignal,
    annotateAll: annotateAll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
