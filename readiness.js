/**
 * Gotowość edge: min. 50 transakcji paper + shadow shorts decyzja.
 */
(function (global) {
  var ROOT = 'btx-readiness';
  var MIN_TRADES = 50;
  var MIN_SHADOW = 30;

  function closedCount() {
    var n = 0;
    try {
      var ST = global.ST;
      if (ST && ST.closed) n = ST.closed.length;
    } catch (e) {}
    try {
      var j = JSON.parse(localStorage.getItem('BTX_TRADE_JOURNAL_V1') || '[]');
      n = Math.max(n, j.length);
    } catch (e2) {}
    try {
      var t = JSON.parse(localStorage.getItem('BTX_TRADE_LOG_V1') || '[]');
      n = Math.max(n, t.length);
    } catch (e3) {}
    return n;
  }

  function shadowSummary() {
    try {
      if (global.BTX_SHADOW_CORE && global.BTX_SHADOW_CORE.summary) {
        var raw = JSON.parse(localStorage.getItem('btx_shadow_v1') || 'null');
        if (raw && raw.done) return global.BTX_SHADOW_CORE.summary(raw.done);
      }
    } catch (e) {}
    return null;
  }

  function ensure() {
    var pane = document.getElementById('pane-desk');
    if (!pane) return null;
    var el = document.getElementById(ROOT);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(167,139,250,.4);background:rgba(91,33,182,.12);font-size:12.5px;color:#e9d5ff;line-height:1.5';
      var sess = document.getElementById('btx-session-profile');
      if (sess && sess.parentNode === pane) sess.after(el);
      else pane.appendChild(el);
    }
    return el;
  }

  function render() {
    var el = ensure();
    if (!el) return;
    var n = closedCount();
    var ready = n >= MIN_TRADES;
    var sh = shadowSummary();
    var html = '<b style="color:#c4b5fd">Gotowość do oceny przewagi</b><br>';
    html += 'Zamknięte transakcje paper: <b>' + n + '</b> / ' + MIN_TRADES + (ready ? ' \u2713 mo\u017cesz ocenia\u0107 edge' : ' \u2014 zbieraj dalej dziennik') + '<br>';
    if (ready) {
      html += '<span style="color:#a7f3d0">Masz pr\u00f3b\u0119 \u2265' + MIN_TRADES + '. U\u017cyj Backtest + \u201eTest vs losowe\u201d zanim zmienisz regu\u0142y.</span><br>';
    } else {
      html += '<span style="color:#fde68a">Za ma\u0142o danych \u2014 nie zmieniaj scoreMin / RVOL na podstawie 2\u20133 dni.</span><br>';
    }
    if (sh && sh.n != null) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1)">';
      html += '<b>Shadow shorts:</b> ' + sh.n + ' rozliczonych';
      if (sh.n >= MIN_SHADOW) {
        html += ' \u00b7 WR ' + (sh.winRate * 100).toFixed(0) + '% \u00b7 E[R] ' + (sh.expectancy != null ? sh.expectancy.toFixed(2) : '\u2014');
        html += '<br><b style="color:#fde68a">Werdykt:</b> ' + (sh.verdict || '\u2014');
        html += '<div style="margin-top:6px"><button type="button" id="btx-sh-apply" style="cursor:pointer;padding:6px 10px;border:0;border-radius:8px;background:#7c3aed;color:#fff;font-weight:700">Zastosuj werdykt (allowShort)</button></div>';
      } else {
        html += ' (min. ' + MIN_SHADOW + ' do decyzji)';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    var b = document.getElementById('btx-sh-apply');
    if (b && sh) {
      b.onclick = function () {
        var on = /przewaga|rozwa\u017cy\u0107 short|rozwazyc short/i.test(String(sh.verdict || ''));
        try {
          if (global.CFG) global.CFG.allowShort = !!on;
          if (global.BTX_STRATEGY_PRO) global.BTX_STRATEGY_PRO.allowShort = !!on;
          if (typeof global.save === 'function') global.save();
        } catch (e) {}
        if (global.toast) global.toast(on ? 'Shorty ON (z shadow)' : 'Shorty OFF (brak przewagi shadow)', 'ok');
      };
    }
  }

  function boot() {
    render();
    setInterval(render, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
