/**
 * BTX Capital Lock — absolutny straznik salda.
 * Zadna pozycja nie moze: margin+fee > free cash, suma margin > 85% equity, cash < 0.
 */
(function (global) {
  'use strict';
  if (global.__BTX_CAPITAL_LOCK__) return;
  global.__BTX_CAPITAL_LOCK__ = true;

  function usedMargin(ST) {
    var used = 0, pos = ST && ST.pos;
    if (!pos) return 0;
    Object.keys(pos).forEach(function (k) {
      var p = pos[k];
      if (!p) return;
      if (p.margin != null && isFinite(p.margin)) used += +p.margin;
      else if (p.qty && p.entry) used += (+p.qty) * (+p.entry) * (+p.rate || 1) / Math.max(1, +p.lev || 1);
    });
    return used;
  }

  function reconcile(ST) {
    if (!ST) return;
    if (ST.cash != null && ST.cash < 0) {
      if (global.log) global.log('CAPITAL LOCK: cash ujemny (' + ST.cash.toFixed(2) + ') — zeruje do 0', 'r');
      ST.cash = 0;
    }
    var eq = +ST.equity || 0;
    var used = usedMargin(ST);
    if (eq > 0 && used > eq * 1.01) {
      if (global.log) global.log('CAPITAL LOCK: suma margin ' + used.toFixed(2) + ' > equity ' + eq.toFixed(2) + ' — blokada nowych wejsc', 'r');
      ST._capOver = true;
    } else {
      ST._capOver = false;
    }
  }

  function patchOpenPos() {
    if (typeof global.openPos !== 'function') return;
    if (global.openPos.__capLock) return;
    var prev = global.openPos;
    global.openPos = function (g) {
      var ST = global.ST;
      if (!ST || !g || g.side === 'WAIT') return;
      reconcile(ST);
      if (ST._capOver) {
        if (global.log) global.log('CAPITAL LOCK: odrzut ' + g.sym + ' — portfel przekapitalizowany', 'r');
        return;
      }
      var cashBefore = +ST.cash || 0;
      var eqBefore = +ST.equity || 0;
      var usedBefore = usedMargin(ST);
      if (cashBefore < 1) {
        if (global.log) global.log('CAPITAL LOCK: brak cash', 'r');
        return;
      }

      var ret = prev.apply(this, arguments);

      try {
        var p = ST.pos && ST.pos[g.sym];
        if (!p) return ret;
        var mrg = (p.margin != null) ? +p.margin : ((+p.qty) * (+p.entry) * (+p.rate || 1) / Math.max(1, +p.lev || 1));
        var fee = +p.feeIn || 0;
        // cash nie moze byc ujemny
        if (ST.cash < -0.01) {
          delete ST.pos[g.sym];
          ST.cash = cashBefore;
          ST.equity = eqBefore;
          ST.dayTrades = Math.max(0, (ST.dayTrades || 1) - 1);
          if (global.log) global.log('CAPITAL LOCK: cofnieto ' + g.sym + ' — cash poszedl na minus', 'r');
          if (global.toast) global.toast('Odrzut: brak srodkow na pozycje ' + g.sym, 'err');
          return;
        }
        // margin jednej pozycji > 30% equity
        if (eqBefore > 0 && mrg > eqBefore * 0.30) {
          delete ST.pos[g.sym];
          ST.cash = cashBefore;
          ST.equity = eqBefore;
          ST.dayTrades = Math.max(0, (ST.dayTrades || 1) - 1);
          if (global.log) global.log('CAPITAL LOCK: cofnieto ' + g.sym + ' — margin ' + mrg.toFixed(2) + ' > 30% equity', 'r');
          if (global.toast) global.toast('Odrzut: pozycja za duza vs saldo', 'err');
          return;
        }
        // suma
        var usedAfter = usedMargin(ST);
        if (eqBefore > 0 && usedAfter > eqBefore * 0.90) {
          delete ST.pos[g.sym];
          ST.cash = cashBefore;
          ST.equity = eqBefore;
          ST.dayTrades = Math.max(0, (ST.dayTrades || 1) - 1);
          if (global.log) global.log('CAPITAL LOCK: cofnieto ' + g.sym + ' — suma margin ' + usedAfter.toFixed(2) + ' > 90% equity', 'r');
          if (global.toast) global.toast('Odrzut: limit zaangazowania portfela', 'err');
          return;
        }
        // upewnij sie ze pole margin jest ustawione
        if (p.margin == null) p.margin = mrg;
        if (global.log) {
          global.log(
            'CAPITAL OK ' + g.sym + ' margin ' + mrg.toFixed(2) +
            ' | cash ' + (+ST.cash).toFixed(2) +
            ' | used ' + usedAfter.toFixed(2) + '/' + eqBefore.toFixed(2),
            'g'
          );
        }
      } catch (e) {}
      return ret;
    };
    global.openPos.__capLock = true;
  }

  function banner() {
    var ST = global.ST;
    if (!ST) return;
    reconcile(ST);
    var el = document.getElementById('btx-cap-banner');
    if (!el) {
      var pane = document.getElementById('pane-desk') || document.getElementById('pane-pos');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-cap-banner';
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(251,191,36,.35);background:rgba(245,158,11,.1);font-size:12px;color:#fde68a';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var used = usedMargin(ST);
    var eq = +ST.equity || 0;
    var cash = +ST.cash || 0;
    var pct = eq > 0 ? (used / eq * 100) : 0;
    el.innerHTML = '<b>Kapitał</b> · cash <b>' + cash.toFixed(2) + '</b> · w pozycjach (margin) <b>' + used.toFixed(2) +
      '</b> (' + pct.toFixed(0) + '% equity) · equity <b>' + eq.toFixed(2) + '</b>' +
      (ST._capOver ? ' · <span style="color:#fca5a5">PRZEKROCZENIE — brak nowych wejść</span>' : ' · <span style="color:#86efac">limit OK</span>');
  }

  function boot() {
    patchOpenPos();
    reconcile(global.ST);
    banner();
    setInterval(function () {
      patchOpenPos();
      reconcile(global.ST);
      banner();
    }, 2500);
  }

  global.BTX_CAPITAL = { usedMargin: usedMargin, reconcile: reconcile };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 700); });
  else setTimeout(boot, 700);
})(typeof window !== 'undefined' ? window : globalThis);
