/**
 * Desk compact: zwijane sekcje + jeden box "dlaczego 0 trade"
 */
(function (global) {
  var STYLE = 'btx-desk-compact-css';
  function injectCss() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement('style');
    s.id = STYLE;
    s.textContent = [
      '.btx-acc{margin:8px 0;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(0,0,0,.18);overflow:hidden}',
      '.btx-acc>summary{cursor:pointer;padding:10px 12px;font-weight:700;font-size:13px;color:#e8eef6;list-style:none}',
      '.btx-acc>summary::-webkit-details-marker{display:none}',
      '.btx-acc[open]>summary{border-bottom:1px solid rgba(255,255,255,.06)}',
      '.btx-acc .btx-acc-body{padding:10px 12px}',
      '#btx-why0{margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(245,179,1,.35);background:rgba(245,179,1,.08);font-size:12.5px;line-height:1.5;color:#fde68a}',
      '#btx-why0 b{color:#fff}'
    ].join('');
    document.head.appendChild(s);
  }

  function whyZero() {
    var reasons = [];
    var ST = global.ST || {};
    try {
      if (global.BTX_HARDENING && global.BTX_HARDENING.sessionOpenFixed) {
        if (!global.BTX_HARDENING.sessionOpenFixed('US')) {
          reasons.push('Sesja US zamknieta (stock/ETF tylko ~15:30\u201322:00 PL, pn\u2013pt)');
        }
      }
    } catch (e) {}
    try {
      if (global.BTX_PRO6 && global.BTX_PRO6.dataGate && !global.BTX_PRO6.dataGate().ok) {
        reasons.push('Dane nie-LIVE: ' + (global.BTX_PRO6.dataGate().label || 'DEMO/brak klucza'));
      }
    } catch (e2) {}
    if (ST.blocked) reasons.push('Blokada dnia (limit strat / max trade / serie strat)');
    try {
      if (global.BTX_QCAP && global.BTX_QCAP.killed && global.BTX_QCAP.killed()) reasons.push('Kill switch ON');
    } catch (e3) {}
    var auto = false;
    try { auto = localStorage.getItem('BTX_AUTONOMY_ON') === '1'; } catch (e4) {}
    if (!auto) reasons.push('Autonomia paper OFF \u2014 bot nie otworzy sam pozycji paper');
    var sig = (ST.sig || []).filter(function (x) { return x.side === 'LONG' || x.side === 'SHORT'; });
    if (!sig.length) reasons.push('Brak surowych sygnalow LONG/SHORT z evaluate()');
    else {
      var pass = 0;
      if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) {
        try {
          pass = global.BTX_AUTONOMY.rankSignals().filter(function (r) { return r.gr && r.gr.pass; }).length;
        } catch (e5) {}
      }
      if (!pass) reasons.push('Sa sygnaly, ale wszystkie odrzucone przez desk/filtry (score/RS/pullback/spread/sesja)');
    }
    if (!Object.keys(ST.pos || {}).length && !reasons.length) {
      reasons.push('Brak pozycji \u2014 czekam na setup A/A+ (to moze byc OK w slabym rynku)');
    }
    return reasons;
  }

  function renderWhy() {
    injectCss();
    var el = document.getElementById('btx-why0');
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = 'btx-why0';
      var hero = document.getElementById('btx-trade-hero');
      if (hero && hero.parentNode === pane) hero.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild.nextSibling);
      else pane.appendChild(el);
    }
    var rs = whyZero();
    var open = Object.keys((global.ST && global.ST.pos) || {}).length;
    if (open) {
      el.innerHTML = '<b>Pozycje paper:</b> ' + open + ' otwarta(e). Patrz karta handlu na gorze.';
      el.style.borderColor = 'rgba(18,196,139,.4)';
      el.style.background = 'rgba(18,196,139,.08)';
      el.style.color = '#a7f3d0';
      return;
    }
    el.style.borderColor = 'rgba(245,179,1,.35)';
    el.style.background = 'rgba(245,179,1,.08)';
    el.style.color = '#fde68a';
    el.innerHTML = '<b>Dlaczego teraz 0 trade / brak A+?</b><ul style="margin:6px 0 0 16px">' +
      rs.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }

  function wrapPanels() {
    injectCss();
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    var ids = [
      ['btx-ops', 'Asystent operacyjny'],
      ['btx-qcap', 'Quality Cap'],
      ['btx-edge', 'Pro Edge'],
      ['btx-dt-final', 'Pakiet DT'],
      ['btx-auto-panel', 'Autonomia / Signal Desk'],
      ['btx-pro6', 'Pro Desk'],
      ['btx-learn', 'Nauka / Playbook'],
      ['btx-macro-cal', 'Kalendarz makro'],
      ['btx-guide7', 'Plan 7 dni'],
      ['btx-engine-hard', 'Engine Hardening'],
      ['btx-active-dt-banner', 'Active DT'],
      ['btx-plain-legend', 'Slowniczek']
    ];
    ids.forEach(function (pair) {
      var id = pair[0], title = pair[1];
      var el = document.getElementById(id);
      if (!el || el.closest('.btx-acc')) return;
      var det = document.createElement('details');
      det.className = 'btx-acc';
      if (id === 'btx-ops' || id === 'btx-auto-panel') det.open = true;
      var sum = document.createElement('summary');
      sum.textContent = title;
      var body = document.createElement('div');
      body.className = 'btx-acc-body';
      el.parentNode.insertBefore(det, el);
      body.appendChild(el);
      det.appendChild(sum);
      det.appendChild(body);
    });
  }

  function boot() {
    injectCss();
    renderWhy();
    setTimeout(wrapPanels, 800);
    setInterval(renderWhy, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
