/**
 * BTX DayTrader — countdown do następnego skanu (Auto)
 * Pokazuje MM:SS obok przycisków; resetuje się po każdym cycle().
 */
(function (global) {
  var el = null;
  var lastScan = 0;
  var nextAt = 0;
  var timer = null;

  function autoSec() {
    var c = global.CFG || {};
    var s = Number(c.autoSec);
    if (!s || s < 5) s = 60;
    return s;
  }

  function isAutoOn() {
    return !!global.AUTO;
  }

  function fmt(ms) {
    if (ms < 0) ms = 0;
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function ensureEl() {
    if (el && document.body.contains(el)) return el;
    el = document.getElementById('scan-countdown');
    if (el) return el;
    el = document.createElement('span');
    el.id = 'scan-countdown';
    el.className = 'badge';
    el.style.cssText = [
      'background:rgba(59,130,246,.14)',
      'color:#93c5fd',
      'font-family:"JetBrains Mono",ui-monospace,monospace',
      'font-size:11px',
      'letter-spacing:.04em',
      'min-width:92px',
      'justify-content:center'
    ].join(';');
    el.title = 'Czas do następnego automatycznego skanu';
    el.textContent = 'Auto: off';
    var badge = document.getElementById('limit-badge');
    var btn = document.getElementById('btn-auto');
    var host = (badge && badge.parentNode) || (btn && btn.parentNode);
    if (host) {
      if (badge && badge.nextSibling) host.insertBefore(el, badge.nextSibling);
      else host.appendChild(el);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  function markScan() {
    lastScan = Date.now();
    if (isAutoOn()) nextAt = lastScan + autoSec() * 1000;
  }

  function render() {
    var node = ensureEl();
    if (!node) return;
    if (!isAutoOn()) {
      node.textContent = 'Skan: off';
      node.style.background = 'rgba(100,116,139,.18)';
      node.style.color = '#94a3b8';
      node.title = 'Auto wyłączone — włącz ⟳ Auto';
      return;
    }
    if (!nextAt) nextAt = Date.now() + autoSec() * 1000;
    var left = nextAt - Date.now();
    if (left <= 0) {
      node.textContent = 'Skan…';
      node.style.background = 'rgba(228,0,43,.18)';
      node.style.color = '#fca5a5';
      node.title = 'Trwa skan / zaraz cycle';
      return;
    }
    node.textContent = 'Skan ' + fmt(left);
    node.style.background = 'rgba(59,130,246,.14)';
    node.style.color = '#93c5fd';
    node.title = 'Następny skan za ' + fmt(left) + ' (co ' + autoSec() + ' s)';
  }

  function patchCycle() {
    if (typeof global.cycle !== 'function' || global.cycle.__scanCd) return;
    var orig = global.cycle;
    global.cycle = function () {
      markScan();
      var r = orig.apply(this, arguments);
      if (isAutoOn()) nextAt = Date.now() + autoSec() * 1000;
      render();
      return r;
    };
    global.cycle.__scanCd = true;
  }

  function patchAutoBtn() {
    var btn = document.getElementById('btn-auto');
    if (!btn || btn.__scanCd) return;
    btn.addEventListener('click', function () {
      setTimeout(function () {
        if (isAutoOn()) {
          nextAt = Date.now() + autoSec() * 1000;
        } else {
          nextAt = 0;
        }
        render();
      }, 0);
    }, true);
    btn.__scanCd = true;
  }

  function boot() {
    ensureEl();
    patchCycle();
    patchAutoBtn();
    render();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      patchCycle();
      patchAutoBtn();
      render();
    }, 250);
  }

  global.BTX_SCAN_CD = { markScan: markScan, render: render };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
