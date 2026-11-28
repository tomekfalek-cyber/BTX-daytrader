/**
 * Most przeglądarkowy: ładuje btx-core.mjs i buduje sygnały / bilet XTB z serii ST.
 * Nie nadpisuje agresywnie całej aplikacji — wystawia BTX_CORE + skan + kartę KOPIUJ NA XTB.
 */
(function (global) {
  'use strict';
  if (global.__BTX_CORE_BRIDGE__) return;
  global.__BTX_CORE_BRIDGE__ = true;

  function log(msg, c) {
    if (global.log) global.log(msg, c || 'i');
    else console.log('[BTX_CORE]', msg);
  }

  function seriesToBars(sym) {
    var a = global.ST && global.ST.series && global.ST.series[sym];
    if (!a || !a.length) return null;
    // upewnij się że mają t (timestamp)
    return a.map(function (b, i) {
      return {
        t: b.t != null ? b.t : (Date.now() - (a.length - i) * 300000),
        o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +b.v || 1
      };
    }).filter(function (b) { return b.c > 0 && b.h >= b.l; });
  }

  function mktOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].mkt || 'US';
    if (/EUR|USD|GBP|JPY|XAU|GOLD/.test(sym)) return 'FX';
    return 'US';
  }

  function boot(mod) {
    global.BTX_CORE = mod;
    log('btx-core.mjs załadowany — jednolita logika sygnału/kosztów/sesji', 'g');

    function scanSymbol(sym) {
      var bars = seriesToBars(sym);
      if (!bars || bars.length < 80) return null;
      var mkt = mktOf(sym);
      var cfg = Object.assign({}, mod.DEFAULTS);
      if (global.BTX_CANON) {
        cfg.riskPct = global.BTX_CANON.riskPct || cfg.riskPct;
        cfg.tpR = global.BTX_CANON.tpR || cfg.tpR;
        cfg.timeStopBars = global.BTX_CANON.timeStopBars || cfg.timeStopBars;
        cfg.allowShort = global.BTX_CANON.allowShort !== false;
      }
      var ctx = mod.prepare(bars, mkt, cfg);
      var i = bars.length - 1;
      var sig = mod.signalAt(ctx, i, cfg);
      if (!sig) return null;
      var costs = mod.DEFAULT_COSTS[mkt] || mod.DEFAULT_COSTS.US;
      var ticket = mod.xtbTicket(sig, bars, cfg, costs);
      if (ticket) {
        ticket.sym = sym;
        ticket.mkt = mkt;
        ticket.text =
          'XTB BILET (core)\n' +
          sym + ' ' + ticket.side + ' setup=' + ticket.setup + '\n' +
          'Wejście≈ ' + ticket.entryApprox.toFixed(5) + '\n' +
          'SL ' + ticket.sl.toFixed(5) + ' | TP ' + ticket.tp.toFixed(5) + '\n' +
          'Ważność: ' + ticket.validBars + ' świece (sygnał na zamknięciu, wejście nast. otwarcie)\n' +
          'Risk kanon ' + (cfg.riskPct || 0.35) + '% — size ustaw ręcznie na XTB';
      }
      return { sym: sym, mkt: mkt, sig: sig, ticket: ticket, ctx: ctx };
    }

    function scanAll() {
      var list = global.SYMBOLS || [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        try {
          var r = scanSymbol(list[i].s);
          if (r && r.ticket) out.push(r);
        } catch (e) {}
      }
      out.sort(function (a, b) {
        var wa = a.sig.why === 'sweep' ? 2 : 1;
        var wb = b.sig.why === 'sweep' ? 2 : 1;
        return wb - wa;
      });
      global.BTX_CORE_LAST = out;
      renderTicket(out[0] || null);
      return out;
    }

    function renderTicket(best) {
      var desk = document.getElementById('pane-desk');
      if (!desk) return;
      var el = document.getElementById('btx-xtb-ticket');
      if (!el) {
        el = document.createElement('div');
        el.id = 'btx-xtb-ticket';
        el.style.cssText = 'margin:10px 0;padding:16px;border-radius:14px;border:2px solid #fbbf24;background:linear-gradient(135deg,#1c1917,#0f172a);color:#fef3c7;font-size:13px;line-height:1.5';
        var host = document.getElementById('btx-pro-status');
        if (host && host.parentNode) host.after(el);
        else desk.insertBefore(el, desk.firstChild);
      }
      if (!best || !best.ticket) {
        el.textContent = '';
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      var t = best.ticket;
      while (el.firstChild) el.removeChild(el.firstChild);
      var title = document.createElement('div');
      title.innerHTML = ''; // text only path
      var h = document.createElement('b');
      h.style.color = '#fff';
      h.style.fontSize = '15px';
      h.textContent = 'KOPIUJ NA XTB · ' + best.sym + ' · ' + t.side;
      el.appendChild(h);
      var pre = document.createElement('pre');
      pre.style.cssText = 'margin:10px 0;white-space:pre-wrap;font:12px ui-monospace,Menlo,Consolas,monospace;color:#fde68a';
      pre.textContent = t.text;
      el.appendChild(pre);
      var btn = document.createElement('button');
      btn.textContent = 'Kopiuj bilet do schowka';
      btn.style.cssText = 'cursor:pointer;padding:8px 14px;border:0;border-radius:8px;background:#f59e0b;color:#111;font-weight:700';
      btn.onclick = function () {
        try {
          navigator.clipboard.writeText(t.text);
          log('Bilet XTB skopiowany: ' + best.sym, 'g');
          btn.textContent = 'Skopiowano ✓';
          setTimeout(function () { btn.textContent = 'Kopiuj bilet do schowka'; }, 2000);
        } catch (e) {
          log('Nie udało się skopiować — zaznacz tekst ręcznie', 'r');
        }
      };
      el.appendChild(btn);
      var note = document.createElement('div');
      note.style.cssText = 'margin-top:8px;font-size:11px;color:#94a3b8';
      note.textContent = 'Core: sygnał na zamknięciu świecy, wejście na nast. otwarciu · SL/TP z ATR · bez look-ahead';
      el.appendChild(note);
    }

    global.BTX_CORE_SCAN = scanAll;
    setInterval(function () {
      try { scanAll(); } catch (e) {}
    }, 20000);
    setTimeout(function () { try { scanAll(); } catch (e) {} }, 3000);
  }

  // dynamic import — działa na GitHub Pages (ten sam origin)
  import('./btx-core.mjs?v=core1').catch(function(){return import('./btx-core-esm.js?v=core1');})
    .then(boot)
    .catch(function (err) {
      log('Nie załadowano btx-core.mjs: ' + (err && err.message), 'r');
      console.error(err);
    });
})(typeof window !== 'undefined' ? window : globalThis);
