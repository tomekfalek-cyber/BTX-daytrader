import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionInfo, simulateTrade, prepare, DEFAULTS, DEFAULT_COSTS, atrWilder, parseCsv, signalAt, backtest } from '../btx-core.mjs';

const cfg = { ...DEFAULTS, costs: { ...DEFAULT_COSTS.PL }, openSkip: 0, noEntryMin: 0, flatMin: 15, timeStopBars: 99, minNetRR: 0 };
const T0 = Date.UTC(2026, 10, 10, 8, 0);
function mk(n, f) { const b = []; for (let i = 0; i < n; i++) { const x = f(i); b.push({ t: T0 + i * 3e5, v: 1000, ...x }); } return b; }

test('sesja GPW: otwarta 9:00–17:00 czasu warszawskiego, zamknięta w weekend', () => {
  assert.equal(sessionInfo(Date.UTC(2026, 10, 10, 8, 0), 'PL').open, true);
  assert.equal(sessionInfo(Date.UTC(2026, 10, 10, 16, 0), 'PL').open, false);
  assert.equal(sessionInfo(Date.UTC(2026, 10, 14, 10, 0), 'PL').open, false);
});
test('sesja US 9:30 ET', () => {
  assert.equal(sessionInfo(Date.UTC(2026, 10, 10, 14, 30), 'US').open, true);
  assert.equal(sessionInfo(Date.UTC(2026, 10, 10, 14, 29), 'US').open, false);
});
test('FX nie handluje w weekend', () => {
  assert.equal(sessionInfo(Date.UTC(2026, 10, 15, 12, 0), 'FX').open, false);
});
test('wejście na otwarciu następnej świecy', () => {
  const b = mk(20, () => ({ o: 100, h: 100.2, l: 99.9, c: 100 })); b[6].o = 101;
  const ctx = prepare(b, 'PL', cfg);
  const tr = simulateTrade(ctx, { i: 5, side: 'LONG', why: 't', atr: 0.5 }, cfg);
  assert.ok(tr.entryIdx === 6);
});
test('stop z luką wypełnia się po cenie otwarcia', () => {
  const b = mk(20, () => ({ o: 100, h: 100.1, l: 99.95, c: 100 })); b[8] = { ...b[8], o: 97, h: 97.2, l: 96.8, c: 97 };
  const ctx = prepare(b, 'PL', cfg);
  const tr = simulateTrade(ctx, { i: 5, side: 'LONG', why: 't', atr: 0.5 }, cfg);
  assert.equal(tr.exit, 'stop'); assert.ok(tr.netR < -1);
});
test('SL i TP w tej samej świecy: liczony stop', () => {
  const b = mk(20, () => ({ o: 100, h: 100.1, l: 99.95, c: 100 })); b[7] = { ...b[7], h: 105, l: 95 };
  const ctx = prepare(b, 'PL', cfg);
  const tr = simulateTrade(ctx, { i: 5, side: 'LONG', why: 't', atr: 0.5 }, cfg);
  assert.equal(tr.exit, 'stop');
});
test('przymusowe zamknięcie przed końcem sesji', () => {
  const b = []; for (let i = 0; i < 40; i++) b.push({ t: Date.UTC(2026, 10, 10, 14, 30) + i * 3e5, o: 100, h: 100.05, l: 99.97, c: 100, v: 1 });
  const ctx = prepare(b, 'PL', cfg);
  const tr = simulateTrade(ctx, { i: 1, side: 'LONG', why: 't', atr: 1 }, cfg);
  assert.equal(tr.exit, 'eod');
  const last = b[tr.exitIdx]; assert.ok(sessionInfo(last.t, 'PL').left - 5 <= 15);
});
test('ATR Wilder', () => {
  const b = mk(40, () => ({ o: 100, h: 101, l: 99, c: 100 }));
  const a = atrWilder(b, 14); assert.ok(Math.abs(a[39] - 2) < 1e-9);
});
test('CSV: UTC ISO i epoch', () => {
  const r = parseCsv('datetime,open,high,low,close,volume\n2026-11-10T08:00:00Z,1,2,0.5,1.5,10\n1794643500,1,2,0.5,1.5,10');
  assert.equal(r.length, 2); assert.equal(r[0].t, Date.UTC(2026, 10, 10, 8, 0));
});
test('backtest demo nie rzuca', () => {
  const b = mk(200, (i) => {
    const o = 100 + Math.sin(i / 5);
    return { o, h: o + 0.5, l: o - 0.5, c: o + 0.1 };
  });
  const res = backtest(b, 'PL', { warmup: 30, openSkip: 0, noEntryMin: 0 });
  assert.ok(res.trades.length >= 0);
  assert.ok(res.cfg.costs);
});
