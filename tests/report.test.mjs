import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sandbox = {};
vm.runInNewContext(readFileSync(new URL('../pro-report.js', import.meta.url), 'utf8'), sandbox);
const S = sandbox.BTX_STATS;
const T = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h, 0);

test('computeStats: win rate, profit factor, expectancy, drawdown', () => {
  const tr = [
    { sym: 'A', side: 'LONG', pnl: 10, t: T(2026, 11, 2) },
    { sym: 'A', side: 'LONG', pnl: -5, t: T(2026, 11, 3) },
    { sym: 'B', side: 'SHORT', pnl: 20, t: T(2026, 11, 4) },
    { sym: 'B', side: 'SHORT', pnl: -10, t: T(2026, 11, 5) },
  ];
  const s = S.computeStats(tr);
  assert.equal(s.n, 4); assert.equal(s.wins, 2); assert.equal(s.losses, 2);
  assert.equal(s.net, 15); assert.equal(s.winRate, 0.5);
  assert.equal(s.profitFactor, 2); assert.equal(s.expectancy, 3.75);
  assert.equal(s.maxDrawdown, 10); // szczyt 25 -> 15
  assert.equal(s.bySym.B.net, 10);
});

test('computeStats: seria strat i brak strat => profitFactor null', () => {
  const s = S.computeStats([{ sym: 'A', pnl: -1, t: 1 }, { sym: 'A', pnl: -2, t: 2 }, { sym: 'A', pnl: 3, t: 3 }]);
  assert.equal(s.maxConsecLoss, 2);
  assert.equal(S.computeStats([{ sym: 'A', pnl: 5, t: 1 }]).profitFactor, null);
});

test('computeStats: puste dane', () => {
  const s = S.computeStats([]);
  assert.equal(s.n, 0); assert.equal(s.winRate, 0);
});

test('avgR liczone tylko z transakcji z R', () => {
  const s = S.computeStats([{ sym: 'A', pnl: 1, R: 2, t: 1 }, { sym: 'A', pnl: -1, R: -1, t: 2 }, { sym: 'A', pnl: 1, t: 3 }]);
  assert.equal(s.rCount, 2); assert.equal(s.avgR, 0.5);
});

test('weekKey: ISO tydzien w czasie warszawskim', () => {
  assert.equal(S.weekKey(T(2026, 11, 6)), '2026-W45');
  assert.equal(S.weekKey(T(2026, 11, 8)), '2026-W45'); // niedziela
  assert.equal(S.weekKey(T(2026, 11, 9)), '2026-W46'); // poniedzialek
});

test('filterTrades: day / week / prev / all', () => {
  const now = T(2026, 11, 6);
  const tr = [
    { pnl: 1, t: T(2026, 11, 6, 9) }, { pnl: 1, t: T(2026, 11, 4) },
    { pnl: 1, t: T(2026, 10, 30) }, { pnl: 1 },
  ];
  assert.equal(S.filterTrades(tr, 'day', now).length, 1);
  assert.equal(S.filterTrades(tr, 'week', now).length, 2);
  assert.equal(S.filterTrades(tr, 'prev', now).length, 1);
  assert.equal(S.filterTrades(tr, 'all', now).length, 4);
});

test('formatReport i CSV', () => {
  const tr = [{ sym: 'A', side: 'LONG', pnl: 10, t: T(2026, 11, 2), why: 'a, b' }, { sym: 'A', side: 'LONG', pnl: -5, t: T(2026, 11, 3) }];
  const txt = S.formatReport(S.computeStats(tr), 'TEST');
  assert.match(txt, /Win rate: 50%/);
  assert.match(txt, /za mala proba/);
  const csv = S.tradesToCsv(tr);
  assert.match(csv.split('\n')[0], /^t,sym,side/);
  assert.ok(csv.includes('"a, b"'));
  assert.match(S.formatReport(S.computeStats([]), 'X'), /Brak zamknietych/);
});