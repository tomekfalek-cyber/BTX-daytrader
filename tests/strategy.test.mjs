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
test('FX: okno handlu 08:00-21:00 PL', () => {
  assert.equal(CORE.inSession('FX', U(2026, 11, 6, 6, 59)), false);
  assert.equal(CORE.inSession('FX', U(2026, 11, 6, 7, 0)), true);
  assert.equal(CORE.inSession('FX', U(2026, 11, 6, 19, 59)), true);
  assert.equal(CORE.inSession('FX', U(2026, 11, 6, 20, 0)), false);
  assert.equal(CORE.sessionQuality('FX', U(2026, 11, 6, 19, 30)), 0); // ostatnie 45 min: bez nowych wejsc
});

test('stop strukturalny: w widelkach ATR', () => {
  const mk = (low) => { const b = []; for (let i = 0; i < 10; i++) b.push({ t: i, o: 100, h: 100.5, l: low, c: 100 }); return b; };
  assert.equal(CORE.swingStopDist(mk(98.0), 'LONG', 1), 1.6);   // za daleko -> ucina do 1.6 ATR
  assert.equal(CORE.swingStopDist(mk(99.9), 'LONG', 1), 0.9);   // za blisko -> min 0.9 ATR
  assert.ok(Math.abs(CORE.swingStopDist(mk(98.9), 'LONG', 1) - 1.2) < 1e-9);
});

test('RVOL: stosunek ostatnich 3 swiec do 20 poprzednich; brak wolumenu = null', () => {
  const b = []; for (let i = 0; i < 30; i++) b.push({ v: i >= 27 ? 200 : 100 });
  assert.equal(CORE.rvolOf(b), 2);
  assert.equal(CORE.rvolOf(b.map(() => ({ v: 0 }))), null);
});

const TS_IN = U(2026, 11, 6, 16, 0);
const mkG = (o = {}) => ({ sym: 'NVDA', side: 'LONG', strength: 4, price: 100, atr: 1, sd: 1.2,
  _pro: { scoreL: 5, scoreS: 0, need: 4, veto: '' }, ...o });
const mkST = (o = {}) => ({ equity: 10000, cash: 10000, pos: {}, cool: {}, dayTrades: 0, consecLoss: 0, ...o });
sb.SYMBOLS = [{ s: 'NVDA', mkt: 'US' }, { s: 'TSLA', mkt: 'US' }, { s: 'EURUSD', mkt: 'FX' }];

test('bramka: wszystko OK => otwarcie z planem pozycji', () => {
  const r = CORE.gateCheck(mkG(), sb.SYMBOLS[0], mkST(), TS_IN);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.sp.qty, 41); // 0.5% z 10000 = 50 / 1.2
});

test('bramka: poza sesja, news, limity, seria strat, cooldown', () => {
  const m = sb.SYMBOLS[0];
  assert.match(CORE.gateCheck(mkG(), m, mkST(), U(2026, 11, 7, 16, 0)).reason, /sesja|news/);
  assert.match(CORE.gateCheck(mkG(), m, mkST(), U(2026, 11, 6, 13, 30)).reason, /news|sesja/);
  assert.match(CORE.gateCheck(mkG(), m, mkST({ dayTrades: 6 }), TS_IN).reason, /limit transakcji/);
  assert.match(CORE.gateCheck(mkG(), m, mkST({ consecLoss: 3 }), TS_IN).reason, /seria/);
  assert.match(CORE.gateCheck(mkG(), m, mkST({ cool: { NVDA: 2 } }), TS_IN).reason, /cooldown/);
  assert.match(CORE.gateCheck(mkG(), m, mkST({ pos: { A: {}, B: {} } }), TS_IN).reason, /limit pozycji/);
});

test('bramka: rdzen (nakladki nie obnizaja progu) i veto', () => {
  const m = sb.SYMBOLS[0];
  assert.match(CORE.gateCheck(mkG({ _pro: { scoreL: 3, need: 4 } }), m, mkST(), TS_IN).reason, /rdzen/);
  assert.match(CORE.gateCheck(mkG({ _pro: { scoreL: 6, need: 4, veto: 'niski wolumen' } }), m, mkST(), TS_IN).reason, /veto/);
  assert.match(CORE.gateCheck(mkG({ _pro: undefined }), m, mkST(), TS_IN).reason, /scoringu/);
});

test('bramka: korelacja — druga pozycja LONG w grupie US odrzucona, FX osobno', () => {
  const st = mkST({ pos: { TSLA: { side: 'LONG' } } });
  assert.match(CORE.gateCheck(mkG(), sb.SYMBOLS[0], st, TS_IN).reason, /korelacja/);
  const st2 = mkST({ pos: { TSLA: { side: 'SHORT' } } });
  assert.equal(CORE.gateCheck(mkG(), sb.SYMBOLS[0], st2, TS_IN).ok, true); // przeciwny kierunek = hedge
});

test('koszty zjadajace przewage blokuja wejscie (R:R netto)', () => {
  sb.feeOf = () => ({ comm: 0.001, conv: 0, spr: 0.002 });
  sb.rateOf = () => 1;
  const r = CORE.gateCheck(mkG(), sb.SYMBOLS[0], mkST(), TS_IN);
  delete sb.feeOf; delete sb.rateOf;
  assert.equal(r.ok, false); assert.match(r.reason, /koszty/);
});
test('panel Plan: build() dziala na przykladowym stanie (bez bledow)', () => {
  const noop = () => {};
  const el = () => ({ style: {}, addEventListener: noop, appendChild: noop });
  const sb2 = { document: { readyState: 'complete', getElementById: () => null, createElement: el, body: { appendChild: noop }, addEventListener: noop } };
  vm.createContext(sb2);
  vm.runInContext(readFileSync(new URL('../daytrade-panel.js', import.meta.url), 'utf8'), sb2, { filename: 'daytrade-panel.js' });
  Object.assign(sb2, { BTX_STRATEGY_CORE: CORE, BTX_STRATEGY_PRO: sb.BTX_STRATEGY_PRO, BTX_TIME: TIME,
    BTX_LIVE: { isFresh: () => true, status: () => ({ ok: true }), budget: () => ({ n: 5 }) } });
  const end = Date.now(), bars = [];
  for (let i = 0; i < 300; i++) { const c = 100 + Math.sin(i / 7) * 2; bars.push({ t: end - (299 - i) * 300000, o: c, h: c + 0.4, l: c - 0.4, c, v: 1000 }); }
  sb2.SYMBOLS = [{ s: 'NVDA', n: 'NVIDIA', t: 'Akcja', mkt: 'US', b: 100 }, { s: 'SPY', n: 'SPY', t: 'ETF', mkt: 'US', b: 100 }, { s: 'EURUSD', n: 'EUR', t: 'FX', mkt: 'FX', b: 1.1 }];
  sb2.ST = { equity: 10000, cash: 9000, series: { NVDA: bars, SPY: bars, EURUSD: bars }, cool: {}, dayTrades: 1, consecLoss: 0, closed: [],
    pos: { NVDA: { sym: 'NVDA', side: 'LONG', qty: 10, entry: 100, stop: 98.8, target: 101.9, partial: 101.2, risk0: 1.2, bars: 3, rate: 1 } } };
  const out = sb2.BTX_PLAN.build();
  assert.match(out, /BTX PLAN/); assert.match(out, /OTWARTE POZYCJE/); assert.match(out, /NVDA LONG x10/);
  assert.match(out, /SETUPY/); assert.match(out, /BEZ WEJSCIA/);
});
test('scenariusze kosztowe: model aplikacji vs CFD vs brutto', () => {
  const bars = flatBars(T100, 140);
  bars[102] = { ...bars[102], l: 98.0 };
  const rs = [{ meta: META, bars, roundTripPct: 0.0012, spreadPct: 0, commPct: 0 }];
  const sc = BT.scenarios(rs, { signalFn: SIG(100) });
  assert.equal(sc.length, 3);
  assert.ok(Math.abs(sc[0].st.expectancy + 1.1) < 1e-9);
  assert.ok(Math.abs(sc[2].st.expectancy + 1) < 1e-9);
  const txt = BT.format(BT.compare(rs, { signalFn: SIG(100) }), { scen: sc });
  assert.match(txt, /SCENARIUSZE KOSZTOWE/);
});

test('backtest: koszt 1% (konwersja walut) przy stopie ~0.3% odrzuca wszystkie wejscia', () => {
  const bars = flatBars(T100, 140);
  const r = BT.run(bars, META, { signalFn: (i) => (i === 100 ? { side: 'LONG', strength: 5, atr: 0.3, why: 't' } : null), roundTripPct: 0.0103, slipPct: 0 });
  assert.equal(r.trades.length, 0); assert.equal(r.skippedCost, 1);
  assert.ok(r.costToStop > 2);
});