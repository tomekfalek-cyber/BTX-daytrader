/**
 * BTX Unblock Trading — rozstrzyga sprzeczne filtry
 *
 * Główny problem: pro-edge uznawał całe PRE-US (przed 15:30) za
 * "brak nowych wejść" także dla ASML/SAP/SIE.DE i blokował EU rano.
 * Drugi: LIVE gate bez markLive = totalny WAIT.
 */
(function (global) {
  var ROOT = 'btx-unblock';

  function warsawMin() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function mktOf(sym) {
    var list = global.SYMBOLS || [];
    for (var i = 0; i < list.length; i++) if (list[i].s === sym) return list[i].mkt || 'US';
    if (/ASML|SAP|SIE/.test(sym || '')) return 'EU';
    if (/EUR|XAU|GOLD/.test(sym || '')) return 'FX';
    return 'US';
  }

  function isEuOrFx(sym) {
    var m = mktOf(sym);
    return m === 'EU' || m === 'FX' || m === 'PL';
  }

  /** 1) Sesja: EU i FX mogą handlować 9–17:30 nawet gdy US = PRE */
  function patchEdge() {
    if (!global.BTX_EDGE || !global.BTX_EDGE.edgeGrade || global.BTX_EDGE.edgeGrade.__unblock) return;
    var orig = global.BTX_EDGE.edgeGrade;
    global.BTX_EDGE.edgeGrade = function (g) {
      var r = orig.apply(this, arguments);
      if (!g || !r) return r;
      var w = warsawMin();
      if (w.weekend) return r;

      // Usuń fałszywe blokady fazy PRE US dla EU/FX
      if (r.reasons && r.reasons.length) {
        r.reasons = r.reasons.filter(function (x) {
          if (/Faza:\s*Pre-market/i.test(x) && isEuOrFx(g.sym)) return false;
          if (/Faza:\s*PRE/i.test(x) && isEuOrFx(g.sym)) return false;
          return true;
        });
      }

      // EU w godzinach Xetra: wymuś możliwość PASS fazy
      var euOpen = !w.weekend && w.min >= 9 * 60 && w.min < 17 * 60 + 30;
      if (euOpen && isEuOrFx(g.sym)) {
        // odblokuj size x0 z PRE jeśli to było tylko US-pre
        if (r.size && r.size.mult === 0 && r.phase && r.phase.phase === 'PRE') {
          r.size.mult = 1;
        }
      }

      // Przelicz pass
      r.pass = !(r.reasons && r.reasons.length);
      return r;
    };
    global.BTX_EDGE.edgeGrade.__unblock = true;

    if (global.BTX_EDGE.sessionPhase && !global.BTX_EDGE.sessionPhase.__unblock) {
      var sp = global.BTX_EDGE.sessionPhase;
      global.BTX_EDGE.sessionPhase = function () {
        var p = sp.apply(this, arguments);
        var w = warsawMin();
        // Gdy PRE US, ale Europa pracuje — nie zeruj całego rynku
        if (p && p.phase === 'PRE' && !w.weekend && w.min >= 9 * 60 && w.min < 15 * 60 + 30) {
          p = Object.assign({}, p, {
            newEntries: true,
            sizeMult: 1,
            label: 'Sesja EU/FX aktywna (US jeszcze PRE)',
            phase: 'EU_DAY'
          });
        }
        return p;
      };
      global.BTX_EDGE.sessionPhase.__unblock = true;
    }
  }

  /** 2) LIVE gate: nie zabijaj całości — daj 25 min + ozn mark po udanym fetch */
  function patchLiveGate() {
    if (global.BTX_LIVE_GATE && global.BTX_LIVE_GATE.isSymLive && !global.BTX_LIVE_GATE.isSymLive.__unblock) {
      var orig = global.BTX_LIVE_GATE.isSymLive;
      global.BTX_LIVE_GATE.isSymLive = function (sym) {
        if (orig(sym)) return true;
        var ST = global.ST;
        if (ST && ST.liveSource && ST.liveSource[sym] && Date.now() - ST.liveSource[sym] < 25 * 60 * 1000) return true;
        // jeśli jest jakikolwiek globalny LIVE w ostatnich 10 min i seria istnieje — pozwól (mniej ślepo)
        if (global.__BTX_LAST_LIVE_TS && Date.now() - global.__BTX_LAST_LIVE_TS < 10 * 60 * 1000) {
          if (ST && ST.series && ST.series[sym] && ST.series[sym].length > 30) return true;
        }
        return false;
      };
      global.BTX_LIVE_GATE.isSymLive.__unblock = true;
    }

    // evaluate: zamiast twardy WAIT na zawsze — tylko gdy naprawdę zero LIVE w systemie
    if (typeof global.evaluate === 'function' && global.evaluate.__liveGate && !global.evaluate.__unblockLive) {
      // nie rusamy podwójnie; live-hard-gate już patchuje. Dopinamy mark z hardening.
      global.evaluate.__unblockLive = true;
    }
  }

  /** 3) Autonomia: jeśli OFF, cycle hardening i tak może otwierać — OK.
      Ale gradeSetup nie może zabijać EU z powodu fazy PRE. */
  function patchAutonomy() {
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.gradeSetup || global.BTX_AUTONOMY.gradeSetup.__unblock) return;
    var orig = global.BTX_AUTONOMY.gradeSetup;
    global.BTX_AUTONOMY.gradeSetup = function (g) {
      var r = orig.apply(this, arguments);
      if (!g || !r) return r;
      if (r.reasons && r.reasons.length) {
        r.reasons = r.reasons.filter(function (x) {
          if (/Faza:\s*Pre-market/i.test(String(x)) && isEuOrFx(g.sym)) return false;
          if (/score po filtrach/i.test(String(x)) && (r.score || 0) >= 60 && (g.strength || 0) >= 4) return false;
          return true;
        });
      }
      // Active DT: sila>=4 i score>=60 wystarczy gdy nie ma twardych powodów
      if ((g.strength || 0) >= 4 && (r.score || 0) >= 60 && (!r.reasons || !r.reasons.length)) {
        r.pass = true;
        if (r.grade === 'REJECT') r.grade = (r.score >= 85 ? 'A+' : 'A');
      }
      if (r.reasons && r.reasons.length) {
        r.pass = false;
        r.grade = 'REJECT';
      }
      return r;
    };
    global.BTX_AUTONOMY.gradeSetup.__unblock = true;
  }

  /** 4) Panel: dlaczego realnie 0 trade */
  function diagnose() {
    var w = warsawMin();
    var reasons = [];
    if (w.weekend) reasons.push('Weekend — rynek equity/FX daytrading OFF');
    var ST = global.ST || {};
    if (ST.blocked) reasons.push('Blokada dnia (limit strat / seria strat / max trade)');
    if (!global.BTX_AUTONOMY || !global.BTX_AUTONOMY.isOn || !global.BTX_AUTONOMY.isOn()) {
      reasons.push('Autonomia paper OFF — włącz na Pulpicie (albo ręczne sygnały)');
    }
    var liveN = 0;
    (global.SYMBOLS || []).forEach(function (m) {
      if (global.BTX_LIVE_GATE && global.BTX_LIVE_GATE.isSymLive && global.BTX_LIVE_GATE.isSymLive(m.s)) liveN++;
      else if (ST.liveSource && ST.liveSource[m.s] && Date.now() - ST.liveSource[m.s] < 25 * 60 * 1000) liveN++;
    });
    if (liveN === 0) reasons.push('Brak LIVE na symbolach — ustaw klucz Twelve i uruchom skan');
    var sig = (ST.sig || []).filter(function (x) { return x && (x.side === 'LONG' || x.side === 'SHORT'); });
    if (!sig.length) reasons.push('Strategia nie daje LONG/SHORT (konfluencja / HTF / sesja)');
    else {
      var pass = 0;
      sig.forEach(function (g) {
        if (global.BTX_AUTONOMY && global.BTX_AUTONOMY.gradeSetup) {
          var gr = global.BTX_AUTONOMY.gradeSetup(g);
          if (gr && gr.pass) pass++;
        }
      });
      if (!pass) reasons.push('Są sygnały (' + sig.length + '), ale żaden nie ma PASS na Signal Desk');
    }
    if (w.min < 15 * 60 + 30 && w.min >= 9 * 60) {
      reasons.push('INFO: teraz okno EU/FX — US stock dopiero od ~15:30 (to OK, nie blokada buga)');
    }
    if (w.min < 9 * 60) reasons.push('Przed 9:00 PL — EU jeszcze zamknięte');
    return reasons;
  }

  function render() {
    var el = document.getElementById(ROOT);
    if (!el) {
      var pane = document.getElementById('pane-desk');
      if (!pane) return;
      el = document.createElement('div');
      el.id = ROOT;
      el.style.cssText = 'margin:10px 0;padding:14px 16px;border-radius:12px;border:2px solid #f59e0b;background:rgba(245,158,11,.12);font-size:13px;color:#fde68a;line-height:1.5;z-index:40;position:relative';
      if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var rs = diagnose();
    el.innerHTML =
      '<b style="color:#fbbf24">Diagnoza handlu (odblokowania aktywne)</b><br>' +
      '<span style="font-size:12px;color:#fcd34d">Naprawione: EU nie jest już blokowane przez "PRE-market US". LIVE gate łagodniejszy (25 min).</span><ul style="margin:8px 0 0 18px">' +
      rs.map(function (x) { return '<li>' + x + '</li>'; }).join('') +
      '</ul>' +
      '<div style="margin-top:8px;font-size:12px;opacity:.9">Żeby bot SAM otwierał paper: Autonomia ON + LIVE Twelve + profil RANO (teraz) lub US po 15:30.</div>';
  }

  function boot() {
    patchEdge();
    patchLiveGate();
    patchAutonomy();
    render();
    setInterval(function () {
      patchEdge();
      patchLiveGate();
      patchAutonomy();
      render();
    }, 3000);
  }

  global.BTX_UNBLOCK = { diagnose: diagnose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
