// Backtest na PUBLICZNYM kluczu "demo" Twelve Data (tylko AAPL i EUR/USD) — wynik w logu CI. Dowod pogladowy, nie pelny test.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sb = {}; vm.createContext(sb);
for (const f of ['pro-report.js', 'strategy-pro.js', 'backtest-real.js']) vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), sb, { filename: f });
const BT = sb.BTX_BT;

async function hist(sym, size) {
  for (const sz of [size, 2000, 1000]) {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=5min&outputsize=${sz}&timezone=UTC&apikey=demo`;
    const j = await (await fetch(url)).json();
    if (j && j.values && j.values.length) {
      const bars = [];
      for (let i = j.values.length - 1; i >= 0; i--) {
        const v = j.values[i];
        const b = { t: Date.parse(v.datetime.replace(' ', 'T') + 'Z'), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) };
        if (isFinite(b.t) && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0) bars.push(b);
      }
      return bars;
    }
    console.log(`[${sym}] outputsize=${sz}: ${j && j.message}`);
    await new Promise((r) => setTimeout(r, 9000));
  }
  return null;
}

const sets = [];
for (const [api, meta, rt, spr] of [
  ['AAPL', { s: 'AAPL', n: 'Apple', t: 'Akcja', mkt: 'US', b: 230 }, 2 * 0.005 + 0.0003, 0.0003],
  ['EUR/USD', { s: 'EURUSD', n: 'EUR/USD', t: 'FX', mkt: 'FX', b: 1.1 }, 0.0001, 0.0001]]) {
  const bars = await hist(api, 5000);
  if (!bars) { console.log('BRAK DANYCH', api); continue; }
  console.log(`${api}: ${bars.length} swiec, ${new Date(bars[0].t).toISOString()} .. ${new Date(bars[bars.length - 1].t).toISOString()}`);
  sets.push({ meta, bars, roundTripPct: rt, spreadPct: spr, commPct: 0 });
  await new Promise((r) => setTimeout(r, 9000));
}
if (!sets.length) process.exit(0);
const o = { slipPct: 0.0002, allowShort: false };
const res = BT.compare(sets, o);
console.log(BT.format(res, { coverage: 'Dane: demo-key (AAPL, EUR/USD), filtr SPY pominiety', scen: BT.scenarios(sets, o), sides: BT.sides(sets, o) }));