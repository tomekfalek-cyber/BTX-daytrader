/**
 * Stabilizacja UI + wyłączenie STOP FOR DAY
 * - innerHTML tylko gdy treść się zmienia (brak drgania)
 * - ST.blocked / STOP FOR DAY nie blokuje handlu
 */
(function (global) {
  var hashes = {};

  /** Ustaw innerHTML tylko gdy HTML się zmienił */
  function setHTML(el, html) {
    if (!el) return false;
    var key = el.id || el.getAttribute('data-btx-key') || '';
    var h = String(html.length) + ':' + String(html).slice(0, 120) + ':' + String(html).slice(-80);
    if (hashes[key] === h && el.getAttribute('data-btx-stable') === '1') return false;
    if (el.innerHTML === html) {
      hashes[key] = h;
      el.setAttribute('data-btx-stable', '1');
      return false;
    }
    el.innerHTML = html;
    hashes[key] = h;
    el.setAttribute('data-btx-stable', '1');
    return true;
  }

  function clearStopForDay() {
    var ST = global.ST;
    if (!ST) return;
    // nigdy nie trzymaj blokady dnia
    if (ST.blocked) ST.blocked = false;
    if (ST.stopForDay) ST.stopForDay = false;
    if (ST.stopped) ST.stopped = false;
    // pro-assistant state
    try {
      if (global.BTX_ASSIST && global.BTX_ASSIST.state) {
        global.BTX_ASSIST.state.stopped = false;
        global.BTX_ASSIST.state.reason = '';
      }
    } catch (e) {}
    // localStorage flagi
    try {
      localStorage.removeItem('BTX_STOP_FOR_DAY');
      localStorage.removeItem('BTX_STOPPED');
    } catch (e2) {}
  }

  function patchCheckLimits() {
    // hardening / core: nie ustawiaj blocked
    if (typeof global.checkLimits === 'function' && !global.checkLimits.__noStop) {
      var prev = global.checkLimits;
      global.checkLimits = function () {
        try { prev.apply(this, arguments); } catch (e) {}
        clearStopForDay();
        var b = document.getElementById('limit-badge');
        if (b) {
          b.textContent = 'limit OFF (STOP FOR DAY wyłączony)';
          b.style.color = 'var(--green,#12c48b)';
        }
      };
      global.checkLimits.__noStop = true;
    }
  }

  function patchOpenPos() {
    // nie odrzucaj przez ST.blocked
    if (typeof global.openPos !== 'function' || global.openPos.__noStop) return;
    var orig = global.openPos;
    global.openPos = function (g) {
      clearStopForDay();
      return orig.apply(this, arguments);
    };
    global.openPos.__noStop = true;
  }

  function patchAssistant() {
    // pro-assistant często ustawia stopped
    if (!global.BTX_ASSIST) return;
    try {
      if (typeof global.BTX_ASSIST.stopDay === 'function') {
        global.BTX_ASSIST.stopDay = function () { /* disabled */ };
      }
      if (global.BTX_ASSIST.state) {
        global.BTX_ASSIST.state.stopped = false;
        global.BTX_ASSIST.state.reason = '';
      }
    } catch (e) {}
  }

  function patchInnerHTMLSetters() {
    // trade-hero / positions-fix używają setHTML jeśli podpięte
    global.BTX_SET_HTML = setHTML;
  }

  function boot() {
    clearStopForDay();
    patchCheckLimits();
    patchOpenPos();
    patchAssistant();
    patchInnerHTMLSetters();
    setInterval(function () {
      clearStopForDay();
      patchCheckLimits();
      patchOpenPos();
      patchAssistant();
    }, 5000);
  }

  global.BTX_UI_STABLE = { setHTML: setHTML, clearStopForDay: clearStopForDay };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
