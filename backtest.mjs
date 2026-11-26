#!/usr/bin/env node
// node backtest.mjs --market FX --demo
// node backtest.mjs --market US dane.csv
import { readFileSync } from 'node:fs';
import { backtest, randomBaseline, summarize, percentileOf, parseCsv, sessionInfo } from './btx-core.mjs';

const args = process.argv.slice(2);
const opt = { market: 'FX', runs: 300 }; const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--market') opt.market = args[++i];
  else if (a === '--sl') opt.slAtr = +args[++i];
  else if (a === '--tp') opt.tpR = +args[++i];
  else if (a === '--ts') opt.timeStopBars = +args[++i];
  else if (a === '--risk') opt.riskPct = +args[++i];
  else if (a === '--runs') opt.runs = +args[++i];
  else if (a === '--short') opt.allowShort = true;
  else if (a === '--noshort') opt.allowShort = false;
  else if (a === '--demo') opt.demo = true;
  else files.push(a);
}

function demoBars(mkt, days = 120, seed = 11) {
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const out = []; let p = 100; const start = Date.UTC(2026, 0, 5);
  for (let t = start; t < start + days * 864e5; t += 3e5) {
    const si = sessionInfo(t, mkt); if (!si.open) continue;
    const u = 1 + 0.8 * Math.exp(-si.since / 30) + 0.5 * Math.exp(-si.left / 30);
    const ret = gauss() * 0.0012 * u, o = p; p = o * Math.exp(ret);
    out.push({ t, o, h: Math.max(o, p) * (1 + Math.abs(gauss()) * 0.0004), l: Math.min(o, p) * (1 - Math.abs(gauss()) * 0.0004), c: p, v: 1000 });
  }
  return out;
}

const sets = opt.demo ? [{ name: `DEMO-${opt.market}`, bars: demoBars(opt.market) }]
  : files.map(f => ({ name: f.split('/').pop(), bars: parseCsv(readFileSync(f, 'utf8')) }));
if (!sets.length) { console.error('Podaj pliki CSV albo --demo'); process.exit(1); }

const all = [];
for (const s of sets) {
  const res = backtest(s.bars, opt.market, opt);
  const bl = randomBaseline(res, opt.runs);
  const sum = summarize(res.trades, res.cfg.riskPct);
  console.log(`\n== ${s.name}: ${s.bars.length} świec, ${res.trades.length} transakcji, odrzucone:`, JSON.stringify(res.skipped));
  console.table([sum]);
  if (bl.length) {
    const med = [...bl].sort((a, b) => a - b)[Math.floor(bl.length / 2)];
    console.log(`Test losowego wejścia: strategia ${sum.sumaR}R vs mediana losowych ${med.toFixed(2)}R — strategia lepsza niż ${percentileOf(sum.sumaR, bl)}% losowych prób`);
  }
  all.push(...res.trades);
}
if (sets.length > 1) { console.log('\n== RAZEM'); console.table([summarize(all)]); }
console.log('\nUwaga: wynik wiarygodny dopiero na prawdziwych danych. To nie jest rekomendacja inwestycyjna.');
