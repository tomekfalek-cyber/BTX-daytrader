import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sb = {};
vm.createContext(sb);
for (const f of ['pro-report.js', 'strategy-pro.js', 'dt-config.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), sb, { filename: f });
}
const CORE = sb.BTX_STRATEGY_CORE, PRO = sb.BTX_STRATEGY_PRO, DT = sb.BTX_DT;
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
const TS_FX = U(2026, 11, 10, 10, 0); // wtorek 11:00 PL — London, poza oknami newsow

test('profil DT: progi daytradingu ustawiane w jednym miejscu', () => {
  const CFG = {};
  DT.applyTo(PRO, CFG, true);
  assert.equal(PRO.riskPct, 0.5);
  assert.equal(PRO.maxDayTrades, 8);
  assert.equal(PRO.dailyLossPct, 2);
  assert.equal(PRO.maxConsecLoss, 3);
  assert.equal(PRO.partialFrac, 0);
  assert.equal(PRO.newsWindows.length, 2);
  assert.equal(PRO.sessions.FX.close, 20 * 60);
  assert.equal(CFG.maxTrades, 8);
  assert.equal(CFG.dailyLoss, 2);
  assert.ok(CFG.slip <= 0.01, 'poslizg w % na strone: ' + CFG.slip);
  assert.equal(JSON.stringify(CFG.scan), JSON.stringify({ US: false, EU: false, PL: false, FX: true }));
  assert.equal(CFG.fees.FX.conv, 0);
});

test('profil DT: 500 PLN, EURUSD przechodzi bramke (pozycja 0.01 lota, ryzyko < limit)', () => {
  DT.applyTo(PRO, {}, true);
  sb.feeOf = () => ({ comm: 0, conv: 0, spr: 0.00012 });
  sb.rateOf = () => 3.7;
  sb.SYMBOLS = [{ s: 'EURUSD', mkt: 'FX' }, { s: 'GBPUSD', mkt: 'FX' }];
  const g = { sym: 'EURUSD', side: 'LONG', strength: 4, price: 1.08, atr: 0.0006, sd: 0.0012, _pro: { scoreL: 6, scoreS: 0, need: 4, veto: '' } };
  const st = { equity: 500, cash: 500, pos: {}, cool: {}, dayTrades: 0, consecLoss: 0, dayStart: 500 };
  const r = CORE.gateCheck(g, sb.SYMBOLS[0], st, TS_FX);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.sp.qty, 1000);
  assert.ok(r.sp.margin < 150 && r.sp.margin > 100, 'margines 1:30: ' + r.sp.margin);
  assert.ok(r.sp.riskAmt <= 500 * 0.005 * 2.5, 'ryzyko ' + r.sp.riskAmt);
  delete sb.feeOf; delete sb.rateOf;
});

test('profil DT: dwie pary FX naraz dozwolone, trzecia nie; limit 8 transakcji', () => {
  DT.applyTo(PRO, {}, true);
  sb.feeOf = () => ({ comm: 0, conv: 0, spr: 0.00012 });
  sb.rateOf = () => 3.7;
  sb.SYMBOLS = [{ s: 'EURUSD', mkt: 'FX' }, { s: 'GBPUSD', mkt: 'FX' }, { s: 'USDJPY', mkt: 'FX' }];
  const g = { sym: 'GBPUSD', side: 'LONG', strength: 4, price: 1.27, atr: 0.0007, sd: 0.0014, _pro: { scoreL: 6, scoreS: 0, need: 4, veto: '' } };
  const base = { equity: 500, cash: 360, cool: {}, dayTrades: 3, consecLoss: 0, dayStart: 500 };
  assert.equal(CORE.gateCheck(g, sb.SYMBOLS[1], { ...base, pos: { EURUSD: { side: 'LONG' } } }, TS_FX).ok, true);
  assert.match(CORE.gateCheck(g, sb.SYMBOLS[1], { ...base, pos: { EURUSD: { side: 'LONG' }, USDJPY: { side: 'SHORT' } } }, TS_FX).reason, /limit pozycji/);
  assert.equal(CORE.gateCheck(g, sb.SYMBOLS[1], { ...base, pos: {}, dayTrades: 7 }, TS_FX).ok, true);
  assert.match(CORE.gateCheck(g, sb.SYMBOLS[1], { ...base, pos: {}, dayTrades: 8 }, TS_FX).reason, /limit transakcji/);
  delete sb.feeOf; delete sb.rateOf;
});

test('limit straty dnia liczony w bramce (nie zalezy od flagi ST.blocked)', () => {
  DT.applyTo(PRO, {}, true);
  sb.feeOf = () => ({ comm: 0, conv: 0, spr: 0.00012 });
  sb.rateOf = () => 3.7;
  sb.SYMBOLS = [{ s: 'EURUSD', mkt: 'FX' }];
  const g = { sym: 'EURUSD', side: 'LONG', strength: 4, price: 1.08, atr: 0.0006, sd: 0.0012, _pro: { scoreL: 6, scoreS: 0, need: 4, veto: '' } };
  const mk = (eq) => ({ equity: eq, cash: eq, pos: {}, cool: {}, dayTrades: 0, consecLoss: 0, dayStart: 500, blocked: false });
  assert.equal(CORE.gateCheck(g, sb.SYMBOLS[0], mk(495), TS_FX).ok, true);          // -1% < limit 2%
  assert.match(CORE.gateCheck(g, sb.SYMBOLS[0], mk(489), TS_FX).reason, /limit straty dnia/); // -2.2%
  delete sb.feeOf; delete sb.rateOf;
});

test('news: tylko okna danych USA, ECB/FOMC nie blokuja co dzien', () => {
  DT.applyTo(PRO, {}, true);
  assert.equal(CORE.newsBlocked(U(2026, 11, 10, 13, 30)).blocked, true);   // 14:30 PL dane USA
  assert.equal(CORE.newsBlocked(U(2026, 11, 10, 13, 15)).blocked, false);  // ECB 14:15 PL — juz nie
  assert.equal(CORE.newsBlocked(U(2026, 11, 10, 19, 0)).blocked, false);   // FOMC 20:00 PL — juz nie
  assert.equal(CORE.newsBlocked(U(2026, 11, 10, 13, 40)).blocked, false);  // poza +-7 min
});