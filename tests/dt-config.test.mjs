import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sb = {};
vm.createContext(sb);
for (const f of ['pro-report.js', 'strategy-pro.js', 'dt-config.js']) {
  vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), sb, { filename: f });
}
const PRO = sb.BTX_STRATEGY_PRO, DT = sb.BTX_DT;

test('DT applyTo ustawia kanon daytrade (risk 0.35, max 2 poz., 6 trades)', () => {
  const CFG = {};
  assert.ok(DT && typeof DT.applyTo === 'function');
  DT.applyTo(PRO, CFG, true);
  assert.equal(PRO.riskPct, 0.35);
  assert.equal(PRO.maxPos, 2);
  assert.equal(PRO.maxDayTrades, 6);
  assert.equal(PRO.dailyLossPct, 1.25);
  assert.equal(CFG.maxTrades, 6);
  assert.equal(CFG.ccy, 'USD');
  assert.ok(CFG.scan.US && CFG.scan.FX);
  assert.ok(PRO.timeStopBars >= 24);
  assert.ok(PRO.minStrengthOpen >= 2);
});

test('DT applyTo: fees FX/US istnieja', () => {
  const CFG = {};
  DT.applyTo(PRO, CFG, true);
  assert.ok(CFG.fees && CFG.fees.FX);
  assert.ok(CFG.fees.US);
  assert.equal(CFG.fees.FX.conv, 0);
});

test('stopAtr FX >= 1.5', () => {
  const CFG = {};
  DT.applyTo(PRO, CFG, true);
  assert.ok(PRO.stopAtr && PRO.stopAtr.FX[0] >= 1.5);
});
