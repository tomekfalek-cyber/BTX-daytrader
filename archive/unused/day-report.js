/**
 * Raport dnia: skany, PASS/REJECT, top powody
 */
(function (global) {
  var LS = 'BTX_DAY_STATS';
  var ROOT = 'btx-day-report';

  function dayKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  }

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(LS) || '{}');
      if (o.day !== dayKey()) {
        return { day: dayKey(), scans: 0, pass: 0, reject: 0, opens: 0, reasons: {} };
      }
      return o;
    } catch (e) {
      return { day: dayKey(), scans: 0, pass: 0, reject: 0, opens: 0, reasons: {} };
    }
  }

  function save(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {}
  }

  function addReason(o, why) {
    o.reasons = o.reasons || {};
    var k = String(why || 'inne').slice(0, 80);
    o.reasons[k] = (o.reasons[k] || 0) + 1;
  }

  function noteScan() {
    var o = load();
    o.scans = (o.scans || 0) + 1;
    var ranked = [];
    try {
      if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.rankSignals) ranked = global.BTX_AUTONOMY.rankSignals() || [];
    } catch (e) {}
    ranked.forEach(function (r) {
      if (r.gr && r.gr.pass) o.pass = (o.pass || 0) + 1;
      else {
        o.reject = (o.reject || 0) + 1;
        var rs = (r.gr && r.gr.reasons) || ['reject'];
        rs.forEach(function (x) { addReason(o, x); });
      }
    });
    save(o);
  }

  function noteOpen() {
    var o = load();
    o.opens = (o.opens || 0) + 1;
    save(o);
  }

  function patch() {
    if (typeof global.cycle === 'function' && !global.cycle.__dayRep) {
      var c = global.cycle;
      global.cycle = function () {
        var out = c.apply(this, arguments);
        try { noteScan(); } catch (e) {}
        return out;
      };
      global.cycle.__dayRep = true;
    }
    if (typeof global.openPos === 'function' && !global.openPos.__dayRep) {
      var o = global.openPos;
      global.openPos = function () {
        var before = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
        var ret = o.apply(this, arguments);
        var after = global.ST && global.ST.pos ? Object.keys(global.ST.pos).length : 0;
        if (after > before) noteOpen();
        return ret;
      };
      global.openPos.__dayRep = true;
    }
  }

  function topReasons(o, n) {
    n = n || 5;
    var pairs = Object.keys(o.reasons || {}).map(function (k) { return [k, o.reasons[k]]; });
    pairs.sort(function (a, b) { return b[1] - a[1]; });
    return pairs.slice(0, n);
  }

  function render() {
    var el = document.getElementById(ROOT);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(167,139,250,.35);background:rgba(124,58,237,.08);font-size:12.5px;color:#e9d5ff;line-height:1.5';
      pane.appendChild(el);
    }
    var o = load();
    var tops = topReasons(o, 5);
    var html = '<b>Raport dnia</b> (' + o.day + ')<br>';
    html += 'Skany: <b>' + (o.scans || 0) + '</b> · PASS: <b>' + (o.pass || 0) + '</b> · REJECT: <b>' + (o.reject || 0) + '</b> · Otwarcia paper: <b>' + (o.opens || 0) + '</b>';
    if (tops.length) {
      html += '<br><b>Top powody odrzutu:</b><ul style="margin:6px 0 0 16px">';
      tops.forEach(function (p) {
        html += '<li>' + p[0] + ' · ' + p[1] + 'x</li>';
      });
      html += '</ul>';
    } else {
      html += '<br><span style="opacity:.8">Brak zebranych odrzutów — włącz skan / autonomię.</span>';
    }
    el.innerHTML = html;
  }

  function boot() {
    patch();
    render();
    setInterval(function () { patch(); render(); }, 5000);
  }

  global.BTX_DAY_REPORT = { load: load, noteScan: noteScan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
