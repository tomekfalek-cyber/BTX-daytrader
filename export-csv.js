/**
 * BTX DayTrader — eksport dziennika i transakcji do CSV
 */
(function (global) {
  function toCSV(rows) {
    if (!rows || !rows.length) return '';
    var keys = Object.keys(rows[0]);
    function esc(v) {
      if (v == null) return '';
      var s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    }
    return [keys.join(',')].concat(rows.map(function (r) {
      return keys.map(function (k) { return esc(r[k]); }).join(',');
    })).join('\n');
  }

  function downloadCSV(filename, csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    if (typeof global.toast === 'function') global.toast(msg);
    else console.log(msg);
  }

  function exportJournal() {
    var src = (global.ST && global.ST.journal) || [];
    if (!src.length && global.ST && global.ST.closed) {
      src = global.ST.closed.map(function (t) {
        return {
          t: t.closedAt || t.t || Date.now(),
          type: 'CLOSE',
          sym: t.sym || t.symbol,
          dir: t.dir,
          price: t.entry,
          exit: t.exit || t.price,
          qty: t.qty,
          pnl: t.pnl,
          score: t.score,
          reason: t.reason || t.why || ''
        };
      });
    }
    if (!src.length) { toast('Brak wpisów w dzienniku'); return; }
    var rows = src.map(function (j) {
      return {
        time: new Date(j.t || j.time || Date.now()).toISOString(),
        type: j.type || '',
        symbol: j.sym || j.symbol || '',
        dir: j.dir || '',
        price: j.price != null ? j.price : (j.entry != null ? j.entry : ''),
        exit: j.exit != null ? j.exit : '',
        qty: j.qty != null ? j.qty : '',
        pnl: j.pnl != null ? j.pnl : '',
        score: j.score != null ? j.score : '',
        reason: j.reason || (Array.isArray(j.why) ? j.why.join(' | ') : (j.why || ''))
      };
    });
    downloadCSV('BTX_dziennik_' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(rows));
    toast('Wyeksportowano dziennik (' + rows.length + ' wpisów)');
  }

  function exportTrades() {
    var src = (global.ST && global.ST.closed) || (global.ST && global.ST.trades) || [];
    if (!src.length) { toast('Brak zamkniętych transakcji'); return; }
    var rows = src.map(function (t) {
      var entry = t.entry, qty = t.qty || 0, pnl = t.pnl || 0;
      return {
        opened: new Date(t.openedAt || t.t || Date.now()).toISOString(),
        closed: new Date(t.closedAt || Date.now()).toISOString(),
        symbol: t.sym || t.symbol || '',
        dir: t.dir || '',
        entry: entry,
        exit: t.exit != null ? t.exit : (t.price != null ? t.price : ''),
        qty: qty,
        pnl: pnl,
        pnl_pct: entry && qty ? ((pnl / (entry * qty)) * 100).toFixed(3) : '',
        reason: t.reason || t.why || '',
        score: t.score != null ? t.score : ''
      };
    });
    downloadCSV('BTX_transakcje_' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(rows));
    toast('Wyeksportowano transakcje (' + rows.length + ')');
  }

  function injectButtons() {
    if (document.getElementById('btn-export-journal')) return;
    var host = document.querySelector('.controls') || document.querySelector('.topbar') || document.body;
    var wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.style.gap = '8px';
    wrap.innerHTML =
      '<button class="btn ghost" type="button" id="btn-export-journal">⬇ Dziennik CSV</button>' +
      '<button class="btn ghost" type="button" id="btn-export-trades">⬇ Transakcje CSV</button>';
    host.appendChild(wrap);
    document.getElementById('btn-export-journal').onclick = exportJournal;
    document.getElementById('btn-export-trades').onclick = exportTrades;
  }

  global.exportJournal = exportJournal;
  global.exportTrades = exportTrades;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButtons);
  } else {
    injectButtons();
  }
  setTimeout(injectButtons, 1500);
  setTimeout(injectButtons, 4000);
})(typeof window !== 'undefined' ? window : globalThis);

(function(){
  function add(){
    var pos=document.getElementById('pane-pos');
    if(pos && !document.getElementById('csv-trades')){
      var c=pos.querySelector('.card')||pos;
      var b=document.createElement('button'); b.className='btn ghost'; b.id='csv-trades'; b.textContent='Eksport transakcji (CSV)'; b.style.marginBottom='10px';
      b.onclick=function(){ if(window.exportTrades) window.exportTrades(); };
      c.insertBefore(b, c.firstChild);
    }
    var lg=document.getElementById('pane-log');
    if(lg && !document.getElementById('csv-journal')){
      var c2=lg.querySelector('.card')||lg;
      var b2=document.createElement('button'); b2.className='btn ghost'; b2.id='csv-journal'; b2.textContent='Eksport dziennika (CSV)'; b2.style.marginBottom='10px';
      b2.onclick=function(){ if(window.exportJournal) window.exportJournal(); };
      c2.insertBefore(b2, c2.firstChild);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', add); else add();
})();