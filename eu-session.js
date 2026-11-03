/**
 * Sesja EU: ASML / SAP / SIE.DE handlowalne ~9:00–17:30 PL
 */
(function (global) {
  function patchSession() {
    if (typeof global.sessionOpen !== 'function' || global.sessionOpen.__eu) return;
    var orig = global.sessionOpen;
    global.sessionOpen = function (mkt) {
      if (mkt === 'EU' || mkt === 'PL') {
        var fmt = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Warsaw',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          weekday: 'short'
        });
        var map = {};
        fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
        var min = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
        var weekend = /Sat|Sun/i.test(map.weekday || '');
        if (weekend) return false;
        // Xetra / EU equity ok. 9:00–17:30 PL
        return min >= 9 * 60 && min < 17 * 60 + 30;
      }
      return orig.apply(this, arguments);
    };
    global.sessionOpen.__eu = true;

    if (global.BTX_HARDENING && global.BTX_HARDENING.sessionOpenFixed && !global.BTX_HARDENING.sessionOpenFixed.__eu) {
      var oh = global.BTX_HARDENING.sessionOpenFixed;
      global.BTX_HARDENING.sessionOpenFixed = function (mkt) {
        if (mkt === 'EU' || mkt === 'PL') return global.sessionOpen(mkt);
        return oh.apply(this, arguments);
      };
      global.BTX_HARDENING.sessionOpenFixed.__eu = true;
    }
  }

  // mapowanie Twelve / XTB dla EU
  function patchFetch() {
    if (typeof global.fetchReal !== 'function' || global.fetchReal.__euMap) return;
    var orig = global.fetchReal;
    global.fetchReal = async function (sym) {
      var map = {
        'SIE.DE': 'SIE.DE',
        ASML: 'ASML',
        SAP: 'SAP',
        EURUSD: 'EUR/USD'
      };
      var req = map[sym] || sym;
      return orig.call(this, req);
    };
    global.fetchReal.__euMap = true;
  }

  function boot() {
    patchSession();
    patchFetch();
    setInterval(function () { patchSession(); patchFetch(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
