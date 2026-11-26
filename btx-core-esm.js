// btx-core.mjs — jedno źródło prawdy dla BTX DayTrader (czyste funkcje, bez DOM).
// Zasady: sygnał na ZAMKNIĘCIU świecy i, wejście na OTWARCIU i+1 (brak look-ahead),
// SL/TP aktywne od pierwszej świecy, koszt każdej strony (spread, poślizg, prowizja, przewalutowanie),
// przymusowe zamknięcie przed końcem sesji, limity dnia resetowane po kluczu daty giełdy.

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmts = {};
function fmt(tz) {
  return (fmts[tz] ||= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }));
}
export function localParts(ts, tz) {
  const o = {};
  for (const p of fmt(tz).formatToParts(new Date(ts))) o[p.type] = p.value;
  return { day: DOW[o.weekday], min: +o.hour * 60 + +o.minute, key: `${o.year}-${o.month}-${o.day}` };
}

export const SESSIONS = {
  US: { tz: 'America/New_York', from: 570, to: 960 },
  PL: { tz: 'Europe/Warsaw', from: 540, to: 1020 },
  EU: { tz: 'Europe/Warsaw', from: 540, to: 1020 },
  FX: { tz: 'Europe/Warsaw', from: 480, to: 1260 }
};
export function sessionInfo(ts, mkt) {
  const s = SESSIONS[mkt] || SESSIONS.US;
  const t = localParts(ts, s.tz);
  const open = t.day >= 1 && t.day <= 5 && t.min >= s.from && t.min < s.to;
  return { open, left: open ? s.to - t.min : 0, since: open ? t.min - s.from : 0, key: t.key };
}

export const DEFAULT_COSTS = {
  PL: { comm: 0, conv: 0, spread: 0.0008, slip: 0.0003 },
  US: { comm: 0, conv: 0.005, spread: 0.0003, slip: 0.0003 },
  EU: { comm: 0, conv: 0.005, spread: 0.0005, slip: 0.0003 },
  FX: { comm: 0, conv: 0, spread: 0.0001, slip: 0.00003 }
};

export const DEFAULTS = {
  barMin: 5, riskPct: 0.35, slAtr: 1.5, tpR: 2, minNetRR: 1.5, beBuffer: 1,
  timeStopBars: 36, flatMin: 15, noEntryMin: 30, openSkip: 15, cooldown: 3,
  maxTradesDay: 6, dayLossR: 3, sweepN: 20, warmup: 60, allowShort: true
};

export function atrWilder(b, n = 14) {
  const out = new Array(b.length).fill(NaN);
  let prev = 0, sum = 0;
  for (let i = 1; i < b.length; i++) {
    const tr = Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c));
    if (i <= n) { sum += tr; if (i === n) { prev = sum / n; out[i] = prev; } }
    else { prev = (prev * (n - 1) + tr) / n; out[i] = prev; }
  }
  return out;
}
export function rsiWilder(c, n = 2) {
  const out = new Array(c.length).fill(NaN);
  let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1], up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  }
  return out;
}

export function prepare(bars, mkt, cfg = DEFAULTS) {
  const n = bars.length;
  const sess = bars.map(x => sessionInfo(x.t, mkt));
  const atr = atrWilder(bars, 14);
  const rsi2 = rsiWilder(bars.map(x => x.c), 2);
  const vwap = new Array(n), sHi = new Array(n), sLo = new Array(n), htf = new Array(n);
  let key = null, pv = 0, vv = 0, hi = -Infinity, lo = Infinity;
  for (let i = 0; i < n; i++) {
    if (sess[i].key !== key) { key = sess[i].key; pv = 0; vv = 0; hi = -Infinity; lo = Infinity; }
    const v = bars[i].v || 1;
    pv += ((bars[i].h + bars[i].l + bars[i].c) / 3) * v; vv += v;
    hi = Math.max(hi, bars[i].h); lo = Math.min(lo, bars[i].l);
    vwap[i] = pv / vv; sHi[i] = hi; sLo[i] = lo;
  }
  const hc = []; let hk = null, hLast = null;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(bars[i].t / 3600000);
    if (hk !== null && k !== hk) hc.push(hLast);
    hk = k; hLast = bars[i].c;
    let tr = 'FLAT';
    if (hc.length >= 16) {
      const m = (e) => { let s = 0; for (let j = e - 10; j < e; j++) s += hc[j]; return s / 10; };
      const s1 = m(hc.length), s0 = m(hc.length - 5), last = hc[hc.length - 1];
      if (last > s1 && s1 > s0) tr = 'UP'; else if (last < s1 && s1 < s0) tr = 'DN';
    }
    htf[i] = tr;
  }
  return { bars, mkt, sess, atr, rsi2, vwap, sHi, sLo, htf };
}

export function signalAt(ctx, i, cfg) {
  const { bars: b, sess, atr } = ctx, c = b[i];
  if (!sess[i].open || !(atr[i] > 0) || sess[i].since < cfg.openSkip) return null;
  if (sess[i].left - cfg.barMin <= cfg.noEntryMin) return null;
  let lo = Infinity, hi = -Infinity;
  for (let j = i - cfg.sweepN; j < i; j++) { lo = Math.min(lo, b[j].l); hi = Math.max(hi, b[j].h); }
  const range = c.h - c.l || 1e-12, eq = (ctx.sHi[i] + ctx.sLo[i]) / 2;
  let side = null, why = null;
  if (c.l < lo && c.c > lo && c.c > c.o && (Math.min(c.o, c.c) - c.l) / range >= 0.4 && c.c <= eq && ctx.htf[i] !== 'DN') { side = 'LONG'; why = 'sweep'; }
  else if (c.h > hi && c.c < hi && c.c < c.o && (c.h - Math.max(c.o, c.c)) / range >= 0.4 && c.c >= eq && ctx.htf[i] !== 'UP') { side = 'SHORT'; why = 'sweep'; }
  else if (ctx.htf[i] === 'UP' && b[i - 1].c < ctx.vwap[i - 1] && c.c > ctx.vwap[i] && c.c > c.o) { side = 'LONG'; why = 'vwap'; }
  else if (ctx.htf[i] === 'DN' && b[i - 1].c > ctx.vwap[i - 1] && c.c < ctx.vwap[i] && c.c < c.o) { side = 'SHORT'; why = 'vwap'; }
  if (!side || (side === 'SHORT' && !cfg.allowShort)) return null;
  return { i, side, why, atr: atr[i] };
}

export function simulateTrade(ctx, sig, cfg) {
  const b = ctx.bars, e = sig.i + 1;
  if (e >= b.length) return null;
  const c = cfg.costs, dir = sig.side === 'LONG' ? 1 : -1, half = c.spread / 2 + c.slip;
  const sE = ctx.sess[e];
  if (!sE.open || sE.left - cfg.barMin <= cfg.noEntryMin) return { skip: 'session' };
  const entry = b[e].o * (1 + dir * half);
  const stopDist = cfg.slAtr * sig.atr;
  const rt = entry * (c.spread + 2 * (c.slip + c.comm + c.conv));
  if ((cfg.tpR * stopDist - rt) / (stopDist + rt) < cfg.minNetRR) return { skip: 'RR' };
  let stop = entry - dir * stopDist;
  const target = entry + dir * cfg.tpR * stopDist;
  let be = false, exitPx = null, why = null, j = e;
  for (; j < b.length; j++) {
    const bar = b[j];
    if (j > e && dir * (stop - bar.o) >= 0) { exitPx = bar.o; why = be ? 'BE' : 'stop'; break; }
    if (dir === 1 ? bar.l <= stop : bar.h >= stop) { exitPx = stop; why = be ? 'BE' : 'stop'; break; }
    if (dir === 1 ? bar.h >= target : bar.l <= target) { exitPx = target; why = 'target'; break; }
    if (!be && dir * (bar.c - entry) >= stopDist) { be = true; stop = entry + dir * rt * cfg.beBuffer; }
    const s = ctx.sess[j];
    if (!s.open || s.left - cfg.barMin <= cfg.flatMin) { exitPx = bar.c; why = 'eod'; break; }
    if (j - e + 1 >= cfg.timeStopBars) { exitPx = bar.c; why = 'time'; break; }
  }
  if (exitPx === null) { j = b.length - 1; exitPx = b[j].c; why = 'end'; }
  const exitHalf = why === 'target' ? c.spread / 2 : half;
  const exitFill = exitPx * (1 - dir * exitHalf);
  const fee = (entry + exitFill) * (c.comm + c.conv);
  return {
    entryIdx: e, exitIdx: j, side: sig.side, setup: sig.why, exit: why, bars: j - e + 1,
    day: ctx.sess[e].key, netR: ((exitFill - entry) * dir - fee) / stopDist, costR: rt / stopDist,
    entry, stop, target, stopDist
  };
}

export function backtest(bars, mkt, over = {}) {
  const cfg = { ...DEFAULTS, ...over, costs: { ...DEFAULT_COSTS[mkt] || DEFAULT_COSTS.US, ...(over.costs || {}) } };
  if (mkt === 'PL' && over.allowShort === undefined) cfg.allowShort = false;
  const ctx = prepare(bars, mkt, cfg);
  const trades = [], skipped = { RR: 0, session: 0, cost: 0, limit: 0 };
  const dayN = {}, dayR = {};
  let free = 0;
  for (let i = cfg.warmup; i < bars.length - 1; i++) {
    if (i < free) continue;
    const sig = signalAt(ctx, i, cfg);
    if (!sig) continue;
    const key = ctx.sess[i].key;
    if ((dayN[key] || 0) >= cfg.maxTradesDay || (dayR[key] || 0) <= -cfg.dayLossR) { skipped.limit++; continue; }
    const tr = simulateTrade(ctx, sig, cfg);
    if (!tr) continue;
    if (tr.skip) { skipped[tr.skip] = (skipped[tr.skip] || 0) + 1; continue; }
    trades.push(tr);
    dayN[tr.day] = (dayN[tr.day] || 0) + 1; dayR[tr.day] = (dayR[tr.day] || 0) + tr.netR;
    free = tr.exitIdx + 1 + cfg.cooldown;
  }
  return { trades, skipped, ctx, cfg };
}

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomBaseline(res, runs = 300, seed = 7) {
  const { ctx, cfg, trades } = res, rng = mulberry32(seed), n = trades.length, out = [];
  if (!n) return out;
  const elig = [];
  for (let i = cfg.warmup; i < ctx.bars.length - 1; i++) {
    const s = ctx.sess[i];
    if (s.open && s.since >= cfg.openSkip && s.left - cfg.barMin > cfg.noEntryMin && ctx.atr[i] > 0) elig.push(i);
  }
  for (let r = 0; r < runs; r++) {
    const picks = new Set();
    while (picks.size < Math.min(n, elig.length)) picks.add(elig[Math.floor(rng() * elig.length)]);
    let free = 0, sum = 0;
    for (const i of [...picks].sort((a, b) => a - b)) {
      if (i < free) continue;
      const side = cfg.allowShort && rng() < 0.5 ? 'SHORT' : 'LONG';
      const tr = simulateTrade(ctx, { i, side, why: 'rand', atr: ctx.atr[i] }, cfg);
      if (!tr || tr.skip) continue;
      sum += tr.netR; free = tr.exitIdx + 1 + cfg.cooldown;
    }
    out.push(sum);
  }
  return out;
}

export function summarize(trades, riskPct = 0.35) {
  const n = trades.length;
  const wins = trades.filter(t => t.netR > 0), losses = trades.filter(t => t.netR <= 0);
  const sumR = trades.reduce((s, t) => s + t.netR, 0);
  const gw = wins.reduce((s, t) => s + t.netR, 0), gl = -losses.reduce((s, t) => s + t.netR, 0);
  let eq = 1, peak = 1, dd = 0;
  for (const t of trades) { eq *= 1 + (riskPct / 100) * t.netR; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const days = new Set(trades.map(t => t.day)).size;
  const exits = {};
  for (const t of trades) exits[t.exit] = (exits[t.exit] || 0) + 1;
  return {
    transakcje: n, dniZTransakcja: days, naDzien: days ? +(n / days).toFixed(2) : 0,
    winrate: n ? +(100 * wins.length / n).toFixed(1) : 0,
    sredniaR: n ? +(sumR / n).toFixed(3) : 0, sumaR: +sumR.toFixed(2),
    profitFactor: gl ? +(gw / gl).toFixed(2) : null,
    kosztSrR: n ? +(trades.reduce((s, t) => s + t.costR, 0) / n).toFixed(3) : 0,
    zwrotPct: +((eq - 1) * 100).toFixed(2), maxDDpct: +(dd * 100).toFixed(2), wyjscia: exits
  };
}
export function percentileOf(value, arr) {
  if (!arr.length) return null;
  return +(100 * arr.filter(x => x < value).length / arr.length).toFixed(1);
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].toLowerCase().split(/[;,]/).map(s => s.trim());
  const ix = (...names) => head.findIndex(h => names.includes(h));
  const it = ix('datetime', 'time', 'date', 'timestamp'), io = ix('open', 'o'), ih = ix('high', 'h'),
    il = ix('low', 'l'), ic = ix('close', 'c'), iv = ix('volume', 'v', 'vol');
  if ([it, io, ih, il, ic].some(x => x < 0)) throw new Error('CSV: wymagane kolumny datetime,open,high,low,close[,volume]');
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const p = lines[r].split(/[;,]/);
    let t = /^\d+$/.test(p[it]) ? +p[it] : Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(p[it]) ? p[it] : p[it].replace(' ', 'T') + 'Z');
    if (t < 1e11) t *= 1000;
    const bar = { t, o: +p[io], h: +p[ih], l: +p[il], c: +p[ic], v: iv >= 0 ? +p[iv] || 0 : 0 };
    if (Number.isFinite(bar.t) && bar.h >= bar.l && bar.c > 0) out.push(bar);
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Bilet XTB z sygnału + ostatniej świecy (do ręcznej egzekucji). */
export function xtbTicket(sig, bars, cfg = DEFAULTS, costs = null) {
  if (!sig || !bars || !bars.length) return null;
  const i = sig.i, next = bars[i + 1] || bars[i];
  const px = next.o || bars[i].c;
  const c = costs || DEFAULT_COSTS.US;
  const dir = sig.side === 'LONG' ? 1 : -1;
  const half = c.spread / 2 + c.slip;
  const entry = px * (1 + dir * half);
  const stopDist = cfg.slAtr * sig.atr;
  const stop = entry - dir * stopDist;
  const target = entry + dir * cfg.tpR * stopDist;
  return {
    side: sig.side,
    setup: sig.why,
    entryApprox: entry,
    sl: stop,
    tp: target,
    atr: sig.atr,
    validBars: 2,
    text: null
  };
}
