/**
 * Fokus poranny EU (9:00-16:00 PL) — instrumenty europejskie + FX aktywne do testow.
 */
(function (global) {
  'use strict';
  if (global.__BTX_EU_MORNING__) return;
  global.__BTX_EU_MORNING__ = true;

  function warsaw() {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    });
    var map = {};
    fmt.formatToParts(new Date()).forEach(function (p) { map[p.type] = p.value; });
    return {
      min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
      weekend: /Sat|Sun/i.test(map.weekday || ''),
      label: (map.weekday || '') + ' ' + map.hour + ':' + map.minute
    };
  }

  function isEuMorning() {
    var w = warsaw();
    if (w.weekend) return false;
    return w.min >= 9 * 60 && w.min < 16 * 60 + 30;
  }

  function ensureScan() {
    var CFG = global.CFG;
    if (!CFG) return;
    CFG.scan = CFG.scan || {};
    // EU zawsze wlaczone do testow porannych; US tez (ALL po 15:30)
    CFG.scan.EU = true;
    CFG.scan.FX = true;
    if (CFG.scan.US == null) CFG.scan.US = true;
  }

  function ensureSessions() {
    var P = global.BTX_STRATEGY_PRO || global.BTX_PRO;
    if (!P || !P.sessions) return;
    // EU cash equity hours ~9:00-17:30 PL (Frankfurt/Amsterdam)
    P.sessions.EU = {
      open: 9 * 60,
      close: 17 * 60 + 30,
      prime: [[9 * 60 + 5, 11 * 60 + 30], [14 * 60, 16 * 60 + 30]]
    };
    P.sessions.FX = {
      open: 8 * 60,
      close: 21 * 60,
      prime: [[8 * 60 + 30, 11 * 60], [14 * 60, 17 * 60]]
    };
  }

  function prioritizeLive() {
    if (!isEuMorning()) return;
    // Preferuj odswiezanie EU/FX gdy BTX_LIVE ma kolejke
    try {
      if (global.BTX_LIVE && global.BTX_LIVE.prioritySyms) {
        global.BTX_LIVE.prioritySyms(['ASML', 'SAP', 'SIE.DE', 'EURUSD', 'XAUUSD']);
      }
    } catch (e) {}
  }

  function banner() {
    var el = document.getElementById('btx-eu-morning');
    var pane = document.getElementById('pane-desk');
    if (!pane) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'btx-eu-morning';
      el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid rgba(52,211,153,.35);background:rgba(6,95,70,.25);font-size:12.5px;color:#a7f3d0';
      var host = document.getElementById('btx-pro-monday') || document.getElementById('btx-kernel-banner');
      if (host && host.parentNode === pane) host.after(el);
      else if (pane.firstChild) pane.insertBefore(el, pane.firstChild);
      else pane.appendChild(el);
    }
    var w = warsaw();
    if (isEuMorning()) {
      el.style.display = 'block';
      el.innerHTML = '<b>Sesja EU / poranek PL</b> · ' + w.label +
        ' · aktywne: <b>ASML, SAP, SIE.DE</b> + <b>EURUSD / XAUUSD</b> · profil <b>RANO</b> (EU+FX). ' +
        'US dolacza mocniej od 15:30. Testuj 9:00–16:00 — bot ma handlowac europejskimi, nie tylko czekać na USA.';
    } else if (!w.weekend && w.min >= 15 * 60 + 30 && w.min < 22 * 60) {
      el.style.display = 'block';
      el.innerHTML = '<b>Sesja US + EU/FX</b> · ' + w.label + ' · profil ALL · EU nadal w uniwersum, główna płynność US.';
    } else {
      el.style.display = 'none';
    }
  }

  function boot() {
    ensureScan();
    ensureSessions();
    prioritizeLive();
    banner();
    // auto profil RANO w oknie testow
    try {
      if (isEuMorning()) {
        localStorage.setItem('BTX_SESSION_PROFILE', 'RANO');
        localStorage.setItem('BTX_SESSION_AUTO', '1');
      }
    } catch (e2) {}
    setInterval(function () {
      ensureScan();
      ensureSessions();
      prioritizeLive();
      banner();
      try {
        if (isEuMorning() && localStorage.getItem('BTX_SESSION_AUTO') !== '0') {
          localStorage.setItem('BTX_SESSION_PROFILE', 'RANO');
        }
      } catch (e3) {}
    }, 5000);
  }

  global.BTX_EU_MORNING = { isEuMorning: isEuMorning };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
})(typeof window !== 'undefined' ? window : globalThis);
