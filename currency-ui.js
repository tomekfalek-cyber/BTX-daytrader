/**
 * Pokazuje walutę notowania przy instrumentach we wszystkich panelach.
 * Format: NVDA \u00b7 USD
 */
(function (global) {
  'use strict';
  if (global.__BTX_CCY_UI__) return;
  global.__BTX_CCY_UI__ = true;

  function ccyOf(sym) {
    if (global.BTX_CCY) return global.BTX_CCY(sym);
    if (global.BTX_CANON && global.BTX_CANON.ccyOf) return global.BTX_CANON.ccyOf(sym);
    if (/ASML|SAP|SIE|\.DE|\.NL/.test(sym || '')) return 'EUR';
    return 'USD';
  }

  function withCcy(sym) {
    if (!sym) return sym;
    var s = String(sym).trim();
    if (/(USD|EUR|GBP|CHF|PLN|JPY)/.test(s) && /\(/.test(s)) return s;
    if (/\u00b7\s*(USD|EUR|GBP|CHF|PLN)\b/.test(s)) return s;
    if (/\u00b7\s*(USD|EUR)\b/.test(s)) return s;
    var base = s.split(/[\u2014\u00b7|]/)[0].trim().split(/\s+/)[0];
    var c = ccyOf(base);
    if (!c || c === '\u2014') return s;
    if (s.indexOf(c) >= 0) return s;
    return s + ' \u00b7 ' + c;
  }

  function decorateCell(td) {
    if (!td || td.nodeType !== 1) return;
    if (td.getAttribute('data-ccy') === '1') return;
    var text = (td.textContent || '').trim();
    if (!text || text.length > 48) return;
    if (!/^[A-Z0-9][A-Z0-9.\/_-]{0,14}/.test(text) && !/NVDA|TSLA|META|AAPL|QQQ|SPY|ASML|SAP|SIE|EUR|XAU|GOLD/.test(text)) {
      return;
    }
    if (/^(Symbol|Nazwa|Typ|Cena|Sygna\u0142|Strona|Si\u0142a)$/i.test(text)) return;
    var next = withCcy(text);
    if (next !== text) {
      td.textContent = next;
      td.setAttribute('data-ccy', '1');
    }
  }

  function decorateTable(id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.querySelectorAll('tr').forEach(function (tr) {
      var td = tr.querySelector('td, th');
      if (!td || td.tagName === 'TH') return;
      decorateCell(td);
    });
    root.querySelectorAll('.tag, option, [data-sym]').forEach(function (el) {
      if (el.tagName === 'OPTION') {
        var v = el.value || '';
        var t = el.textContent || '';
        if (v && t.indexOf('USD') < 0 && t.indexOf('EUR') < 0) {
          el.textContent = withCcy(t.indexOf(v) === 0 ? t : (v + ' \u2014 ' + t));
        }
        return;
      }
      if (el.getAttribute('data-ccy') === '1') return;
      var tx = (el.textContent || '').trim();
      var nx = withCcy(tx);
      if (nx !== tx) {
        el.textContent = nx;
        el.setAttribute('data-ccy', '1');
      }
    });
  }

  function decorateAll() {
    [
      'tbl-mkt', 'tbl-sig', 'tbl-pos', 'desk-mkt', 'desk-sig', 'desk-pos',
      'pane-mkt', 'pane-sig', 'pane-pos', 'pane-desk', 'pane-chart',
      'btx-auto-panel', 'btx-ops', 'btx-why-zero', 'log'
    ].forEach(decorateTable);

    document.querySelectorAll('select').forEach(function (sel) {
      Array.prototype.forEach.call(sel.options, function (opt) {
        var v = opt.value || '';
        if (!v || v.length > 20) return;
        if (!/[A-Z]/.test(v)) return;
        var t = opt.textContent || '';
        if (/\b(USD|EUR)\b/.test(t)) return;
        opt.textContent = withCcy(t || v);
      });
    });

    document.querySelectorAll('[data-sym]').forEach(function (el) {
      var sym = el.getAttribute('data-sym');
      if (!sym) return;
      var c = ccyOf(sym);
      if (el.getAttribute('data-ccy') === '1') return;
      if ((el.textContent || '').indexOf(c) < 0) {
        el.textContent = (el.textContent || sym).trim() + ' \u00b7 ' + c;
        el.setAttribute('data-ccy', '1');
      }
    });
  }

  function patchRender() {
    if (typeof global.render === 'function' && !global.render.__ccy) {
      var orig = global.render;
      global.render = function () {
        var r = orig.apply(this, arguments);
        try { setTimeout(decorateAll, 30); } catch (e) {}
        return r;
      };
      global.render.__ccy = true;
    }
    ['renderMkt', 'renderSig', 'renderPos', 'renderDesk'].forEach(function (name) {
      if (typeof global[name] === 'function' && !global[name].__ccy) {
        var o = global[name];
        global[name] = function () {
          var r = o.apply(this, arguments);
          try { setTimeout(decorateAll, 30); } catch (e) {}
          return r;
        };
        global[name].__ccy = true;
      }
    });
  }

  function boot() {
    if (global.BTX_CANON && global.BTX_CANON.apply) global.BTX_CANON.apply();
    decorateAll();
    patchRender();
    setInterval(function () {
      patchRender();
      decorateAll();
    }, 4000);
  }

  global.BTX_CCY_UI = { decorate: decorateAll, withCcy: withCcy, ccyOf: ccyOf };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
