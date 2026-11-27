// Smoke test CAŁEJ aplikacji (index.html + ~70 skryptów) w jsdom, ze sztucznym zegarem.
// Odpowiada na pytanie "czy bot w ogóle handluje?" i pilnuje regresji:
//  - brak nieobsłużonych błędów JS w skryptach aplikacji,
//  - transakcje powstają (min. 3 w 3 dni),
//  - wejścia tylko w oknach sesji (Warszawa), brak pozycji na noc,
//  - BTX_COST.applySlip jest zdefiniowane (błąd `global is not defined` w xtb-costs-units.js).
// Uruchom:  npm i --no-save jsdom && node --test tests/app-smoke.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import('jsdom')); } catch { /* brak jsdom */ }
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

function serve() {
  const srv = http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const f = join(ROOT, path === '/' ? 'index.html' : path);
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

test('aplikacja: handluje, w oknach sesji, bez pozycji na noc, bez błędów JS', { skip: !JSDOM && 'brak jsdom (npm i --no-save jsdom)', timeout: 240000 }, async () => {
  const srv = await serve();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const m = (e.detail && e.detail.message) || e.message || '';
    if (!/getContext|googleapis|canvas|dynamic import|ERR_VM_DYNAMIC/i.test(m)) errors.push(m);
  });
  const dom = await JSDOM.fromURL(`http://127.0.0.1:${srv.address().port}/index.html`, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy(function () {}, { get: () => () => ({ addColorStop() {} }), set: () => true });
    }
  });
  const w = dom.window;
  await new Promise(r => setTimeout(r, 9000)); // moduły startują po timerach (np. singleton po 4 s)

  const Real = w.Date; let T = 0;
  w.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } };
  const wf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const minOfDay = t => { const o = {}; wf.formatToParts(new Real(t)).forEach(p => o[p.type] = p.value); return +o.hour * 60 + +o.minute; };
  const mkt = {}; w.SYMBOLS.forEach(m => { mkt[m.s] = m.mkt; });
  const WIN = { US: [930, 1320], EU: [540, 1050], FX: [480, 1260], PL: [540, 1020] }; // minuty czasu warszawskiego

  const seen = new Set(), opens = [], overnight = [];
  for (let d = 0; d < 3; d++) {                // pon–śr 30.11–2.12.2026
    T = Date.UTC(2026, 10, 30 + d, 5, 0);
    for (let i = 0; i < 216; i++) {            // 05:00–23:00 UTC
      T += 5 * 60000;
      w.cycle();
      for (const x of w.ST.log.slice(0, 40)) {
        const k = x.t + '|' + x.m; if (seen.has(k)) continue; seen.add(k);
        const m = x.m.match(/^OTWARCIE (LONG|SHORT) (\S+)/);
        if (m) opens.push({ sym: m[2], min: minOfDay(T), mkt: mkt[m[2]] });
      }
    }
    overnight.push(Object.keys(w.ST.pos));
  }
  w.close();
  srv.close();

  assert.deepEqual(errors, [], 'nieobsłużone błędy JS: ' + errors.join(' || '));
  assert.ok(w.BTX_COST && typeof w.BTX_COST.applySlip === 'function', 'BTX_COST.applySlip niezdefiniowane');
  assert.equal(w.BTX_CANON.minStrengthOpen, 3, 'BTX_CANON nadpisany (kolizja nazwy z symbols-canon)');
  assert.ok(Array.isArray(w.BTX_SYMBOLS && w.BTX_SYMBOLS.list), 'BTX_SYMBOLS.list brak');
  assert.ok(opens.length >= 3, `bot prawie nie handluje: ${opens.length} wejść w 3 dni`);
  const bad = opens.filter(o => WIN[o.mkt] && (o.min < WIN[o.mkt][0] || o.min >= WIN[o.mkt][1]));
  assert.deepEqual(bad, [], 'wejścia poza oknem sesji: ' + JSON.stringify(bad.slice(0, 3)));
  assert.deepEqual(overnight.flat(), [], 'pozycje otwarte na noc: ' + JSON.stringify(overnight));
  console.log(`# smoke: ${opens.length} wejść w 3 dni (${(opens.length / 3).toFixed(1)}/dzień)`);
});
