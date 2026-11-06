import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sb = {};
vm.createContext(sb);
for (const f of ['pro-report.js', 'strategy-pro.js', 'backtest-real.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), sb, { filename: f });
}
const TIME = sb.BTX_TIME, CORE = sb.BTX_STRATEGY_CORE, BT = sb.BTX_BT;
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);

test('DST: przejscia czasu letniego UE', () => {
  assert.equal(TIME.warsawOffsetMin(U(2026, 3, 29, 0, 59)), 60);
  assert.equal(TIME.warsawOffsetMin(U(2026, 3, 29, 1, 0)), 120);
  assert.equal(TIME.warsawOffsetMin(U(2026, 7, 1, 12)), 120);
  assert.equal(TIME.warsawOffsetMin(U(2026, 10, 25, 0, 59)), 120);
  assert.equal(TIME.warsawOffsetMin(U(2026, 10, 25, 1, 0)), 60);
  assert.equal(TIME.warsawOffsetMin(U(2026, 11, 6, 12)), 60);
});

test('sesja US = 15:30-22:00 czasu polskiego zima i latem', () => {
  // zima (CET): 14:30 UTC = 15:30 PL
  assert.equal(CORE.inSession('US', U(2026, 11, 6, 14, 29)), false);
  assert.equal(CORE.inSession('US', U(2026, 11, 6, 14, 30)), true);
  assert.equal(CORE.inSession('US', U(2026, 11, 6, 20, 59)), true);
  assert.equal(CORE.inSession('US', U(2026, 11, 6, 21, 0)), false);
  // lato (CEST): 13:30 UTC = 15:30 PL
  assert.equal(CORE.inSession('US', U(2026, 7, 1, 13, 29)), false);
  assert.equal(CORE.inSession('US', U(2026, 7, 1, 13, 30)), true);
  assert.equal(CORE.inSession('US', U(2026, 7, 1, 19, 59)), true);
  assert.equal(CORE.inSession('US', U(2026, 7, 1, 20, 0)), false);
  // weekend
  assert.equal(CORE.inSession('US', U(2026, 11, 7, 16, 0)), false);
});

test('okna newsow tego samego dnia czasu polskiego zima i latem (14:30 PL)', () => {
  assert.equal(CORE.newsBlocked(U(2026, 11, 6, 13, 30)).blocked, true);  // zima
  assert.equal(CORE.newsBlocked(U(2026, 7, 1, 12, 30)).blocked, true);   // lato
  assert.equal(CORE.newsBlocked(U(2026, 11, 6, 15, 30)).blocked, false); // 16:30 PL
  assert.equal(CORE.newsBlocked(U(2026, 7, 1, 13, 30)).blocked, false);  // 15:30 PL = otwarcie, bez blackoutu
});

test('aggregate: 5m -> 15m, niepelna swieca odrzucona', () => {
  const bars = [];
  for (let i = 0; i < 7; i++) bars.push({ t: U(2026, 11, 6, 10, 0) + i * 300000, o: 1, h: 2 + i, l: 0, c: i });
  const a = CORE.aggregate(bars, 900000);
  assert.equal(a.length, 2);          // 7 swiec = 2 pelne 15m + 1 niepelna (odrzucona)
  assert.equal(a[0].h, 4); assert.equal(a[0].c, 2);
});

test('ATR nie liczy luki overnight', () => {
  const bars = [];
  for (let i = 0; i < 10; i++) bars.push({ t: U(2026, 11, 5, 20, 10) + i * 300000, o: 100, h: 100.5, l: 99.5, c: 100 });
  for (let i = 0; i < 10; i++) bars.push({ t: U(2026, 11, 6, 14, 30) + i * 300000, o: 150, h: 150.5, l: 149.5, c: 150 }); // luka +50
  const atr = CORE.atrCalc(bars, 14, 'US');
  assert.ok(atr < 1.5, 'ATR=' + atr + ' nie powinno zawierac luki 50');
});

test('evalCore: poza sesja => WAIT, w sesji zwraca sygnal z polami', () => {
  const end = U(2026, 11, 6, 16, 0), bars = [];
  for (let i = 0; i < 300; i++) {
    const c = 100 + i * 0.05 + Math.sin(i / 3) * 0.3;
    bars.push({ t: end - (299 - i) * 300000, o: c - 0.05, h: c + 0.3, l: c - 0.3, c, v: 1000 });
  }
  const m = { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', mkt: 'US', b: 100 };
  const g = CORE.evalCore(m, bars, end + 300000, {});
  assert.ok(['LONG', 'SHORT', 'WAIT'].includes(g.side));
  assert.ok(g._pro && g._pro.sessionBars > 0 && typeof g.atr === 'number');
  const off = CORE.evalCore(m, bars, U(2026, 11, 7, 16, 0), {}); // sobota
  assert.equal(off.side, 'WAIT'); assert.equal(off._pro.scoreL, 0);
});

test('straznik korelacji: grupy', () => {
  assert.equal(CORE.corrGroup({ s: 'NVDA', mkt: 'US' }), CORE.corrGroup({ s: 'SPY', mkt: 'US' }));
  assert.notEqual(CORE.corrGroup({ s: 'EURUSD', mkt: 'FX' }), CORE.corrGroup({ s: 'XAU/USD', mkt: 'FX' }));
});

function flatBars(startIdxTime, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: startIdxTime + i * 300000, o: 100, h: 100.5, l: 99.5, c: 100, v: 1000 });
  return out;
}
const META = { s: 'NVDA', n: 'NVIDIA', t: 'Akcja', mkt: 'US', b: 100 };
const SIG = (at) => (i) => (i === at ? { side: 'LONG', strength: 5, atr: 1, why: 'test' } : null);
const T100 = U(2026, 11, 6, 16, 0) - 100 * 300000; // swieca nr 100 = 16:00 UTC (17:00 PL)

test('backtest: czesciowe + cel w jednej swiecy => 1.3R (bez kosztow)', () => {
  const bars = flatBars(T100, 140);
  bars[102] = { ...bars[102], h: 102.5, l: 99.9 };
  const r = BT.run(bars, META, { signalFn: SIG(100), roundTripPct: 0, slipPct: 0 });
  assert.equal(r.trades.length, 1);
  assert.ok(Math.abs(r.trades[0].R - 1.3) < 1e-9, 'R=' + r.trades[0].R);
  assert.equal(r.trades[0].why, 'cel');
});

test('backtest: stop => -1R, a z kosztami -1.1R', () => {
  const bars = flatBars(T100, 140);
  bars[102] = { ...bars[102], l: 98.0 };
  const r0 = BT.run(bars, META, { signalFn: SIG(100), roundTripPct: 0, slipPct: 0 });
  assert.ok(Math.abs(r0.trades[0].R + 1) < 1e-9, 'R=' + r0.trades[0].R);
  const r1 = BT.run(bars, META, { signalFn: SIG(100), roundTripPct: 0.0012, slipPct: 0 });
  assert.ok(Math.abs(r1.trades[0].R + 1.1) < 1e-9, 'R=' + r1.trades[0].R);
});

test('backtest: koszty zjadajace przewage odrzucaja wejscie', () => {
  const bars = flatBars(T100, 140);
  const r = BT.run(bars, META, { signalFn: SIG(100), roundTripPct: 0.05, slipPct: 0 });
  assert.equal(r.trades.length, 0); assert.equal(r.skippedCost, 1);
});

test('backtest: BE po 0.8R, potem powrot => ~0R', () => {
  const bars = flatBars(T100, 140);
  // swieca 102 zamyka sie przy +0.9R (101.08) bez dotkniecia celu/partiala (h<101.2)
  bars[102] = { ...bars[102], h: 101.1, l: 99.9, c: 101.08 };
  bars[103] = { ...bars[103], l: 99.0 };    // powrot do wejscia -> stop na BE
  const r = BT.run(bars, META, { signalFn: SIG(100), roundTripPct: 0, slipPct: 0 });
  assert.equal(r.trades.length, 1);
  assert.ok(Math.abs(r.trades[0].R) < 1e-9, 'R=' + r.trades[0].R);
});

test('backtest na losowych danych nie wyrzuca bledow, wyniki skonczone', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bars = []; let c = 100; const t0 = U(2026, 10, 5, 0, 0);
  for (let i = 0; i < 3000; i++) {
    const o = c; c = o * (1 + (rnd() - 0.5) * 0.004);
    bars.push({ t: t0 + i * 300000, o, h: Math.max(o, c) * 1.001, l: Math.min(o, c) * 0.999, c, v: 500 + rnd() * 500 });
  }
  const res = BT.compare([{ meta: META, bars, roundTripPct: 0.0008 }], { slipPct: 0.0002 });
  assert.equal(res.length, BT.VARIANTS.length);
  res.forEach((r) => r.trades.forEach((t) => { assert.ok(Number.isFinite(t.R)); }));
  assert.match(BT.format(res, {}), /WNIOSEK/);
});