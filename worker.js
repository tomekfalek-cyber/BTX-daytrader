/**
 * BTX DayTrader — Professional Paper Day-Trading Engine
 * Cloudflare Worker · stocks / ETFs / FX · NEVER connects to XTB
 *
 * Multi-TF (1H context → 15m setup → 5m trigger)
 * SMC: Order Blocks, FVG, Liquidity Sweep, BoS/CHoCH, Premium/Discount
 * Risk: 0.75%/trade, max 4 pos, 2% daily loss, session filters, correlation
 * Paper only — virtual fills, journal, P&L
 */

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUMENT UNIVERSE
// ═══════════════════════════════════════════════════════════════════════════

const INSTRUMENTS = {
  // US ETFs
  SPY:  { type: 'etf',   market: 'US', session: 'US', group: 'INDEX',  minScore: 62 },
  QQQ:  { type: 'etf',   market: 'US', session: 'US', group: 'TECH',   minScore: 62 },
  IWM:  { type: 'etf',   market: 'US', session: 'US', group: 'INDEX',  minScore: 64 },
  DIA:  { type: 'etf',   market: 'US', session: 'US', group: 'INDEX',  minScore: 62 },
  XLK:  { type: 'etf',   market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  XLF:  { type: 'etf',   market: 'US', session: 'US', group: 'BANKS',  minScore: 64 },
  XLE:  { type: 'etf',   market: 'US', session: 'US', group: 'ENERGY', minScore: 64 },
  SMH:  { type: 'etf',   market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  TLT:  { type: 'etf',   market: 'US', session: 'US', group: 'RATES',  minScore: 66 },
  GLD:  { type: 'etf',   market: 'US', session: 'US', group: 'METALS', minScore: 64 },
  // US stocks
  AAPL: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  MSFT: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  NVDA: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 66 },
  TSLA: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 68 },
  AMZN: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  GOOGL:{ type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  META: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  AMD:  { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 66 },
  AVGO: { type: 'stock', market: 'US', session: 'US', group: 'TECH',   minScore: 64 },
  JPM:  { type: 'stock', market: 'US', session: 'US', group: 'BANKS',  minScore: 64 },
  // Poland GPW
  PKN:  { type: 'stock', market: 'PL', session: 'PL', group: 'ENERGY',   minScore: 66 },
  PKO:  { type: 'stock', market: 'PL', session: 'PL', group: 'PL_BANKS', minScore: 66 },
  PEO:  { type: 'stock', market: 'PL', session: 'PL', group: 'PL_BANKS', minScore: 66 },
  KGH:  { type: 'stock', market: 'PL', session: 'PL', group: 'METALS',   minScore: 66 },
  CDR:  { type: 'stock', market: 'PL', session: 'PL', group: 'TECH',     minScore: 68 },
  ALE:  { type: 'stock', market: 'PL', session: 'PL', group: 'TECH',     minScore: 68 },
  PZU:  { type: 'stock', market: 'PL', session: 'PL', group: 'PL_BANKS', minScore: 66 },
  JSW:  { type: 'stock', market: 'PL', session: 'PL', group: 'ENERGY',   minScore: 68 },
  LPP:  { type: 'stock', market: 'PL', session: 'PL', group: 'CONSUMER', minScore: 68 },
  DNP:  { type: 'stock', market: 'PL', session: 'PL', group: 'CONSUMER', minScore: 68 },
  // FX
  EURUSD: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_EUR', minScore: 60 },
  USDJPY: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_JPY', minScore: 60 },
  NZDUSD: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_NZD', minScore: 62 },
  EURJPY: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_EUR', minScore: 62 },
  EURNZD: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_EUR', minScore: 64 },
  NZDJPY: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_NZD', minScore: 64 },
  GBPUSD: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_GBP', minScore: 60 },
  AUDUSD: { type: 'fx', market: 'FX', session: 'FX', group: 'FX_AUD', minScore: 62 },
};

const SYMBOLS = Object.keys(INSTRUMENTS);

// ═══════════════════════════════════════════════════════════════════════════
// RISK & COST MODEL (licensed day-trader style)
// ═══════════════════════════════════════════════════════════════════════════

const RISK = {
  riskPerTradePct: 0.0075,       // 0.75% equity
  maxPositions: 4,
  dailyLossLimitPct: 0.02,       // 2% → circuit breaker
  maxHoldingMs: 4 * 3600 * 1000, // 4 hours
  noEntryLastMs: 45 * 60 * 1000, // last 45 min of session
  atrSlMult: 1.5,
  tpRMin: 2.0,
  tpRMax: 2.5,
  minRRAfterCost: 1.8,
  maxSameGroup: 2,
  startingEquity: 100000,        // paper default
  // approximate round-trip costs (spread + commission model for paper)
  costBps: {
    etf: 4,    // 0.04%
    stock: 6,  // 0.06%
    fx: 8,     // 0.08% typical retail spread proxy
  },
};

// Sessions in minutes from midnight UTC (approximate; DST handled simply)
const SESSIONS = {
  US: { open: 14 * 60 + 30, close: 21 * 60 },      // 14:30–21:00 UTC ≈ RTH
  PL: { open: 8 * 60, close: 16 * 60 + 50 },       // 08:00–16:50 UTC
  FX: { open: 0, close: 24 * 60 - 1 },             // nearly 24/5; filtered later
};

// ═══════════════════════════════════════════════════════════════════════════
// INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

function sma(arr, n) {
  if (arr.length < n) return null;
  let s = 0;
  for (let i = arr.length - n; i < arr.length; i++) s += arr[i];
  return s / n;
}

function ema(arr, n) {
  if (arr.length < n) return null;
  const k = 2 / (n + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

function emaSeries(arr, n) {
  if (arr.length < n) return [];
  const k = 2 / (n + 1);
  const out = new Array(arr.length);
  out[0] = arr[0];
  for (let i = 1; i < arr.length; i++) out[i] = arr[i] * k + out[i - 1] * (1 - k);
  return out;
}

function rsi(closes, n = 14) {
  if (closes.length < n + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(h, l, c, n = 14) {
  if (h.length < n + 1) return (h[h.length - 1] - l[l.length - 1]) || 0;
  const trs = [];
  for (let i = 1; i < h.length; i++) {
    trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  }
  return sma(trs, n) || trs[trs.length - 1];
}

function macdFull(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return { line: 0, signal: 0, hist: 0 };
  const ef = emaSeries(closes, fast);
  const es = emaSeries(closes, slow);
  const macdLine = ef.map((v, i) => v - es[i]);
  const sig = emaSeries(macdLine.slice(slow - 1), signal);
  const line = macdLine[macdLine.length - 1];
  const sigV = sig[sig.length - 1] || 0;
  return { line, signal: sigV, hist: line - sigV };
}

function bollinger(closes, n = 20, k = 2) {
  if (closes.length < n) return { mid: closes[closes.length - 1], upper: 0, lower: 0, pos: 0.5 };
  const slice = closes.slice(-n);
  const mid = sma(slice, n);
  let v = 0;
  for (const x of slice) v += (x - mid) ** 2;
  const std = Math.sqrt(v / n);
  const upper = mid + k * std;
  const lower = mid - k * std;
  const price = closes[closes.length - 1];
  const pos = upper === lower ? 0.5 : (price - lower) / (upper - lower);
  return { mid, upper, lower, pos: Math.max(0, Math.min(1, pos)) };
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART MONEY CONCEPTS
// ═══════════════════════════════════════════════════════════════════════════

function detectOrderBlocks(o, h, l, c, atrVal, lookback = 30) {
  const blocks = [];
  const n = c.length;
  const start = Math.max(3, n - lookback);
  for (let i = start; i < n - 1; i++) {
    const body = Math.abs(c[i] - o[i]);
    const range = h[i] - l[i];
    if (range < atrVal * 0.3) continue;
    // bullish OB: strong down candle followed by displacement up
    if (c[i] < o[i] && c[i + 1] > o[i + 1] && (c[i + 1] - o[i + 1]) > atrVal * 0.5) {
      blocks.push({ type: 'bull', top: o[i], bottom: l[i], idx: i });
    }
    // bearish OB
    if (c[i] > o[i] && c[i + 1] < o[i + 1] && (o[i + 1] - c[i + 1]) > atrVal * 0.5) {
      blocks.push({ type: 'bear', top: h[i], bottom: o[i], idx: i });
    }
  }
  return blocks.slice(-5);
}

function detectFVG(h, l, c, lookback = 40) {
  const gaps = [];
  const n = c.length;
  const start = Math.max(2, n - lookback);
  for (let i = start; i < n; i++) {
    // bullish FVG: candle i-2 high < candle i low
    if (h[i - 2] < l[i]) {
      gaps.push({ type: 'bull', top: l[i], bottom: h[i - 2], idx: i });
    }
    // bearish FVG
    if (l[i - 2] > h[i]) {
      gaps.push({ type: 'bear', top: l[i - 2], bottom: h[i], idx: i });
    }
  }
  return gaps.slice(-6);
}

function detectLiquiditySweep(h, l, c, lookback = 20) {
  const n = c.length;
  if (n < lookback + 2) return null;
  const sliceH = h.slice(-lookback - 1, -1);
  const sliceL = l.slice(-lookback - 1, -1);
  const maxH = Math.max(...sliceH);
  const minL = Math.min(...sliceL);
  const last = n - 1;
  // sweep highs then close back below
  if (h[last] > maxH && c[last] < maxH) return { type: 'sell_side', level: maxH };
  // sweep lows then close back above
  if (l[last] < minL && c[last] > minL) return { type: 'buy_side', level: minL };
  return null;
}

function structureShift(h, l, c, lookback = 25) {
  const n = c.length;
  if (n < lookback) return { trend: 'range', event: null };
  let lastHigh = { v: -Infinity, i: -1 };
  let lastLow = { v: Infinity, i: -1 };
  for (let i = n - lookback; i < n - 1; i++) {
    if (h[i] > lastHigh.v) lastHigh = { v: h[i], i };
    if (l[i] < lastLow.v) lastLow = { v: l[i], i };
  }
  const price = c[n - 1];
  let trend = 'range';
  if (lastHigh.i > lastLow.i && price > lastLow.v) trend = 'up';
  if (lastLow.i > lastHigh.i && price < lastHigh.v) trend = 'down';
  let event = null;
  if (trend === 'up' && price < lastLow.v) event = 'CHoCH_down';
  if (trend === 'down' && price > lastHigh.v) event = 'CHoCH_up';
  if (trend === 'up' && price > lastHigh.v) event = 'BoS_up';
  if (trend === 'down' && price < lastLow.v) event = 'BoS_down';
  return { trend, event, lastHigh, lastLow };
}

function premiumDiscountZone(h, l, c, lookback = 30) {
  const n = c.length;
  if (n < lookback) return { zone: 'mid', pos: 0.5 };
  const sliceH = h.slice(-lookback);
  const sliceL = l.slice(-lookback);
  const hi = Math.max(...sliceH);
  const lo = Math.min(...sliceL);
  const mid = (hi + lo) / 2;
  const price = c[n - 1];
  const pos = hi === lo ? 0.5 : (price - lo) / (hi - lo);
  let zone = 'mid';
  if (pos >= 0.7) zone = 'premium';
  if (pos <= 0.3) zone = 'discount';
  return { zone, pos, hi, lo, mid };
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION & TIME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function utcMinutesNow(d = new Date()) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isWeekday(d = new Date()) {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function inSession(sessionKey, d = new Date()) {
  if (!isWeekday(d)) return false;
  const s = SESSIONS[sessionKey];
  if (!s) return true;
  const m = utcMinutesNow(d);
  if (sessionKey === 'FX') {
    // FX: prefer London (07–16 UTC) + NY (13–21 UTC); allow all weekdays but flag quality
    return true;
  }
  return m >= s.open && m < s.close;
}

function nearSessionClose(sessionKey, d = new Date()) {
  const s = SESSIONS[sessionKey];
  if (!s || sessionKey === 'FX') return false;
  const m = utcMinutesNow(d);
  return m >= s.close - 45 && m < s.close;
}

function fxSessionQuality(d = new Date()) {
  const m = utcMinutesNow(d);
  // London–NY overlap ~13:00–16:00 UTC — highest quality
  if (m >= 13 * 60 && m < 16 * 60) return 'high';
  if ((m >= 7 * 60 && m < 16 * 60) || (m >= 13 * 60 && m < 21 * 60)) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TF GATES
// ═══════════════════════════════════════════════════════════════════════════

function trendFromEma(closes) {
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  if (e20 == null || e50 == null) return 0;
  const price = closes[closes.length - 1];
  if (price > e20 && e20 > e50) return 2;
  if (price > e50) return 1;
  if (price < e20 && e20 < e50) return -2;
  if (price < e50) return -1;
  return 0;
}

function gateContext1H(closes, dir) {
  const t = trendFromEma(closes);
  if (dir === 'LONG' && t >= 1) return { pass: true, trend: t };
  if (dir === 'SHORT' && t <= -1) return { pass: true, trend: t };
  return { pass: false, trend: t, reason: '1H: no clear trend for ' + dir };
}

function gateSetup15m(o, h, l, c, dir) {
  const e20 = ema(c, 20);
  if (e20 == null) return { pass: false, reason: '15m: insufficient data' };
  const price = c[c.length - 1];
  const rsiV = rsi(c, 14);
  const nearEma = Math.abs(price - e20) / e20 < 0.004; // within 0.4%
  if (dir === 'LONG') {
    const pullback = price <= e20 * 1.002 && rsiV < 55;
    const stacked = price > e20 && rsiV > 45 && rsiV < 65;
    if (pullback || (nearEma && rsiV < 50)) return { pass: true, rsi: rsiV };
    return { pass: false, reason: '15m LONG: no pullback/EMA setup (RSI ' + rsiV.toFixed(0) + ')' };
  }
  // SHORT
  const bounce = price >= e20 * 0.998 && rsiV > 45;
  if (bounce || (nearEma && rsiV > 50)) return { pass: true, rsi: rsiV };
  return { pass: false, reason: '15m SHORT: no bounce/EMA setup (RSI ' + rsiV.toFixed(0) + ')' };
}

function gateTrigger5m(o, h, l, c, vol, dir) {
  const n = c.length;
  if (n < 5) return { pass: false, reason: '5m: insufficient data' };
  const body = c[n - 1] - o[n - 1];
  const range = h[n - 1] - l[n - 1] || 1e-9;
  const upperWick = h[n - 1] - Math.max(o[n - 1], c[n - 1]);
  const lowerWick = Math.min(o[n - 1], c[n - 1]) - l[n - 1];
  const avgVol = sma(vol.slice(0, -1), Math.min(20, vol.length - 1)) || 1;
  const volXR = vol[n - 1] / (avgVol || 1);
  const rsiV = rsi(c, 14);
  const goodVol = volXR >= 1.1;

  if (dir === 'LONG') {
    const bullish = body > 0;
    const momentum = rsiV > 40 && rsiV < 70;
    const noReject = upperWick / range < 0.45;
    if (bullish && goodVol && momentum && noReject) return { pass: true, volXR, rsi: rsiV };
    return {
      pass: false,
      reason: !bullish ? '5m: bearish candle' : !goodVol ? '5m: low volume' : !momentum ? '5m: RSI ' + rsiV.toFixed(0) : '5m: upper wick rejection',
    };
  }
  const bearish = body < 0;
  const momentum = rsiV < 60 && rsiV > 30;
  const noReject = lowerWick / range < 0.45;
  if (bearish && goodVol && momentum && noReject) return { pass: true, volXR, rsi: rsiV };
  return {
    pass: false,
    reason: !bearish ? '5m: bullish candle' : !goodVol ? '5m: low volume' : !momentum ? '5m: RSI ' + rsiV.toFixed(0) : '5m: lower wick rejection',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function scoreSetup(bars1h, bars15, bars5, meta) {
  const c1 = bars1h.c, h1 = bars1h.h, l1 = bars1h.l, o1 = bars1h.o;
  const c15 = bars15.c, h15 = bars15.h, l15 = bars15.l, o15 = bars15.o;
  const c5 = bars5.c, h5 = bars5.h, l5 = bars5.l, o5 = bars5.o, v5 = bars5.v;

  const atr1h = atr(h1, l1, c1, 14);
  const atr5 = atr(h5, l5, c5, 14);
  const price = c5[c5.length - 1];

  const rsi1h = rsi(c1, 14);
  const rsi15 = rsi(c15, 14);
  const macd1h = macdFull(c1);
  const bb1h = bollinger(c1, 20);
  const trend1h = trendFromEma(c1);
  const struct = structureShift(h1, l1, c1);
  const pd = premiumDiscountZone(h1, l1, c1);
  const obs = detectOrderBlocks(o1, h1, l1, c1, atr1h);
  const fvgs = detectFVG(h1, l1, c1);
  const liq = detectLiquiditySweep(h1, l1, c1);

  const why = [];
  let scoreLong = 50;
  let scoreShort = 50;

  // RSI
  if (rsi1h <= 30) { scoreLong += 18; why.push('RSI-1H oversold'); }
  else if (rsi1h <= 40) { scoreLong += 10; }
  else if (rsi1h >= 70) { scoreShort += 18; why.push('RSI-1H overbought'); }
  else if (rsi1h >= 60) { scoreShort += 10; }

  // MACD
  if (macd1h.hist > 0 && macd1h.line < 0) { scoreLong += 14; why.push('MACD cross up'); }
  else if (macd1h.hist > 0) scoreLong += 8;
  if (macd1h.hist < 0 && macd1h.line > 0) { scoreShort += 14; why.push('MACD cross down'); }
  else if (macd1h.hist < 0) scoreShort += 8;

  // Bollinger
  if (bb1h.pos < 0.15) { scoreLong += 12; why.push('BB lower zone'); }
  if (bb1h.pos > 0.85) { scoreShort += 12; why.push('BB upper zone'); }

  // Trend / structure
  if (trend1h >= 1) { scoreLong += 10; scoreShort -= 8; }
  if (trend1h <= -1) { scoreShort += 10; scoreLong -= 8; }
  if (struct.event === 'BoS_up' || struct.event === 'CHoCH_up') { scoreLong += 12; why.push(struct.event); }
  if (struct.event === 'BoS_down' || struct.event === 'CHoCH_down') { scoreShort += 12; why.push(struct.event); }

  // Premium / Discount
  if (pd.zone === 'discount') { scoreLong += 10; why.push('Discount zone'); }
  if (pd.zone === 'premium') { scoreShort += 10; why.push('Premium zone'); }

  // Order blocks proximity
  for (const b of obs) {
    if (b.type === 'bull' && price >= b.bottom && price <= b.top * 1.002) {
      scoreLong += 10; why.push('At bull OB');
    }
    if (b.type === 'bear' && price <= b.top && price >= b.bottom * 0.998) {
      scoreShort += 10; why.push('At bear OB');
    }
  }

  // FVG
  for (const g of fvgs.slice(-3)) {
    if (g.type === 'bull' && price >= g.bottom && price <= g.top) {
      scoreLong += 6; why.push('In bull FVG');
    }
    if (g.type === 'bear' && price <= g.top && price >= g.bottom) {
      scoreShort += 6; why.push('In bear FVG');
    }
  }

  // Liquidity sweep
  if (liq) {
    if (liq.type === 'buy_side') { scoreLong += 14; why.push('Buy-side liquidity sweep'); }
    if (liq.type === 'sell_side') { scoreShort += 14; why.push('Sell-side liquidity sweep'); }
  }

  scoreLong = Math.max(0, Math.min(100, scoreLong));
  scoreShort = Math.max(0, Math.min(100, scoreShort));

  // Decide preferred direction
  let dir = null;
  let score = 0;
  if (scoreLong >= scoreShort && scoreLong >= (meta.minScore || 62)) {
    dir = 'LONG'; score = scoreLong;
  } else if (scoreShort > scoreLong && scoreShort >= (meta.minScore || 62)) {
    dir = 'SHORT'; score = scoreShort;
  }

  if (!dir) {
    return {
      ok: false, score: Math.max(scoreLong, scoreShort), dir: null,
      why, rsi1h, rsi15, trend1h, struct, pd, atr5, price,
      gates: {},
    };
  }

  // Hard gates
  const g1 = gateContext1H(c1, dir);
  const g15 = gateSetup15m(o15, h15, l15, c15, dir);
  const g5 = gateTrigger5m(o5, h5, l5, c5, v5, dir);

  const gatesPass = g1.pass && g15.pass && g5.pass;
  if (!gatesPass) {
    const reason = !g1.pass ? g1.reason : !g15.pass ? g15.reason : g5.reason;
    why.push('GATE FAIL: ' + reason);
  }

  // SL / TP from ATR
  const slDist = atr5 * RISK.atrSlMult;
  const costBps = RISK.costBps[meta.type] || 6;
  const costPct = costBps / 10000;
  let sl, tp, rr;
  if (dir === 'LONG') {
    sl = price - slDist;
    tp = price + slDist * RISK.tpRMin;
    rr = (tp - price) / (price - sl);
  } else {
    sl = price + slDist;
    tp = price - slDist * RISK.tpRMin;
    rr = (price - tp) / (sl - price);
  }
  // net RR after costs
  const rrNet = rr - costPct / ((dir === 'LONG' ? price - sl : sl - price) / price);

  if (rrNet < RISK.minRRAfterCost) {
    why.push('R:R after cost ' + rrNet.toFixed(2) + ' < ' + RISK.minRRAfterCost);
  }

  return {
    ok: gatesPass && rrNet >= RISK.minRRAfterCost,
    dir, score, why,
    price, sl, tp, rr, rrNet, atr5, slDist,
    rsi1h, rsi15, trend1h, struct, pd,
    obs: obs.slice(-3), fvgs: fvgs.slice(-3), liq,
    gates: { context1h: g1, setup15m: g15, trigger5m: g5 },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAPER PORTFOLIO
// ═══════════════════════════════════════════════════════════════════════════

function defaultState() {
  return {
    equity: RISK.startingEquity,
    cash: RISK.startingEquity,
    peakEquity: RISK.startingEquity,
    dailyPnl: 0,
    dailyStartEquity: RISK.startingEquity,
    dayKey: new Date().toISOString().slice(0, 10),
    positions: [],
    trades: [],
    journal: [],
    lastSigs: [],
    log: [],
    iter: 0,
    circuitBreaker: false,
    lastCycle: null,
  };
}

function defaultConfig() {
  return {
    active: false,
    mode: 'paper',
    riskPerTradePct: RISK.riskPerTradePct,
    maxPositions: RISK.maxPositions,
    symbols: SYMBOLS,
    startedAt: null,
  };
}

function addLog(state, msg, level = 'info') {
  state.log = state.log || [];
  state.log.unshift({ t: Date.now(), msg, level });
  if (state.log.length > 200) state.log.length = 200;
}

function addJournal(state, entry) {
  state.journal = state.journal || [];
  state.journal.unshift({ ...entry, t: Date.now() });
  if (state.journal.length > 300) state.journal.length = 300;
}

function positionSize(equity, price, sl, riskPct) {
  const riskAmt = equity * riskPct;
  const riskPerUnit = Math.abs(price - sl);
  if (riskPerUnit <= 0) return 0;
  const units = riskAmt / riskPerUnit;
  // notional cap 25% equity
  const maxUnits = (equity * 0.25) / price;
  return Math.min(units, maxUnits);
}

function openPaper(state, cfg, sig, sym) {
  if (state.circuitBreaker) return { ok: false, reason: 'circuit breaker' };
  if (state.positions.length >= (cfg.maxPositions || RISK.maxPositions)) {
    return { ok: false, reason: 'max positions' };
  }
  // correlation
  const group = INSTRUMENTS[sym].group;
  const same = state.positions.filter(p => INSTRUMENTS[p.sym]?.group === group).length;
  if (same >= RISK.maxSameGroup) return { ok: false, reason: 'correlation group ' + group };

  // already in symbol
  if (state.positions.some(p => p.sym === sym)) return { ok: false, reason: 'already in ' + sym };

  const qty = positionSize(state.equity, sig.price, sig.sl, cfg.riskPerTradePct || RISK.riskPerTradePct);
  if (qty <= 0) return { ok: false, reason: 'size zero' };

  const notional = qty * sig.price;
  if (notional > state.cash) return { ok: false, reason: 'insufficient cash' };

  const pos = {
    id: 'P' + Date.now() + Math.random().toString(36).slice(2, 6),
    sym,
    dir: sig.dir,
    qty,
    entry: sig.price,
    sl: sig.sl,
    tp: sig.tp,
    openedAt: Date.now(),
    score: sig.score,
    why: sig.why.slice(0, 6),
    atr: sig.atr5,
  };
  state.positions.push(pos);
  state.cash -= notional;
  addLog(state, `OPEN ${sig.dir} ${sym} @ ${sig.price.toFixed(4)} qty=${qty.toFixed(4)} SL=${sig.sl.toFixed(4)} TP=${sig.tp.toFixed(4)} score=${sig.score}`, 'trade');
  addJournal(state, {
    type: 'OPEN', sym, dir: sig.dir, price: sig.price, qty, sl: sig.sl, tp: sig.tp, score: sig.score, why: sig.why.slice(0, 8),
  });
  return { ok: true, pos };
}

function closePaper(state, pos, price, reason) {
  const pnl = pos.dir === 'LONG'
    ? (price - pos.entry) * pos.qty
    : (pos.entry - price) * pos.qty;
  const notional = pos.qty * pos.entry;
  state.cash += notional + pnl;
  state.equity = state.cash + state.positions.filter(p => p.id !== pos.id).reduce((s, p) => s + p.qty * p.entry, 0);
  // mark-to-market approximation after close
  state.equity = state.cash; // flat remaining will be revalued next cycle
  state.dailyPnl += pnl;
  state.positions = state.positions.filter(p => p.id !== pos.id);
  const trade = {
    id: pos.id, sym: pos.sym, dir: pos.dir, entry: pos.entry, exit: price,
    qty: pos.qty, pnl, reason, openedAt: pos.openedAt, closedAt: Date.now(), score: pos.score,
  };
  state.trades.unshift(trade);
  if (state.trades.length > 500) state.trades.length = 500;
  addLog(state, `CLOSE ${pos.dir} ${pos.sym} @ ${price.toFixed(4)} PnL=${pnl.toFixed(2)} (${reason})`, pnl >= 0 ? 'win' : 'loss');
  addJournal(state, { type: 'CLOSE', ...trade });
  return trade;
}

function managePositions(state, prices) {
  const now = Date.now();
  const toClose = [];
  for (const pos of state.positions) {
    const px = prices[pos.sym];
    if (px == null) continue;
    // SL / TP
    if (pos.dir === 'LONG') {
      if (px <= pos.sl) toClose.push({ pos, price: pos.sl, reason: 'SL' });
      else if (px >= pos.tp) toClose.push({ pos, price: pos.tp, reason: 'TP' });
    } else {
      if (px >= pos.sl) toClose.push({ pos, price: pos.sl, reason: 'SL' });
      else if (px <= pos.tp) toClose.push({ pos, price: pos.tp, reason: 'TP' });
    }
    // time stop
    if (now - pos.openedAt > RISK.maxHoldingMs) {
      toClose.push({ pos, price: px, reason: 'TIME' });
    }
    // session end for non-FX
    const meta = INSTRUMENTS[pos.sym];
    if (meta && meta.session !== 'FX' && nearSessionClose(meta.session)) {
      toClose.push({ pos, price: px, reason: 'SESSION_END' });
    }
  }
  // unique by id
  const seen = new Set();
  for (const x of toClose) {
    if (seen.has(x.pos.id)) continue;
    seen.add(x.pos.id);
    closePaper(state, x.pos, x.price, x.reason);
  }
  // mark equity
  let mtm = state.cash;
  for (const pos of state.positions) {
    const px = prices[pos.sym] ?? pos.entry;
    mtm += pos.dir === 'LONG' ? pos.qty * px : pos.qty * (2 * pos.entry - px);
  }
  state.equity = mtm;
  if (state.equity > state.peakEquity) state.peakEquity = state.equity;
}

function rollDay(state) {
  const key = new Date().toISOString().slice(0, 10);
  if (state.dayKey !== key) {
    state.dayKey = key;
    state.dailyPnl = 0;
    state.dailyStartEquity = state.equity;
    state.circuitBreaker = false;
    addLog(state, 'New trading day ' + key, 'info');
  }
  const dd = (state.dailyStartEquity - state.equity) / state.dailyStartEquity;
  if (dd >= RISK.dailyLossLimitPct) {
    state.circuitBreaker = true;
    addLog(state, 'CIRCUIT BREAKER: daily loss limit hit', 'warn');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET DATA (Twelve Data / Finnhub / Demo)
// ═══════════════════════════════════════════════════════════════════════════

function mapSymbolForProvider(sym, provider) {
  const meta = INSTRUMENTS[sym];
  if (!meta) return sym;
  if (meta.market === 'PL') {
    if (provider === 'twelvedata') return sym + ':WSE';
    if (provider === 'finnhub') return sym + '.WA';
    return sym + '.WA';
  }
  if (meta.type === 'fx') {
    if (provider === 'twelvedata') return sym;
    if (provider === 'finnhub') return 'OANDA:' + sym.slice(0, 3) + '_' + sym.slice(3);
    return sym;
  }
  return sym;
}

/** Deterministic demo OHLC so UI works offline */
function demoBars(sym, tfMinutes, count, seed = 1) {
  const meta = INSTRUMENTS[sym] || { type: 'stock' };
  let base = meta.type === 'fx' ? (sym.includes('JPY') ? 150 : 1.1) : (meta.market === 'PL' ? 80 : 180);
  if (sym === 'SPY') base = 520;
  if (sym === 'QQQ') base = 450;
  if (sym === 'NVDA') base = 140;
  if (sym === 'BTC' ) base = 60000;
  const o = [], h = [], l = [], c = [], v = [], t = [];
  let price = base * (0.98 + (hashStr(sym + seed) % 100) / 2500);
  const now = Date.now();
  const step = tfMinutes * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const drift = Math.sin((i + seed) / 9) * 0.0015 + (hashStr(sym + i) % 21 - 10) / 10000;
    const open = price;
    const close = open * (1 + drift);
    const high = Math.max(open, close) * (1 + (hashStr('h' + i + sym) % 15) / 10000);
    const low = Math.min(open, close) * (1 - (hashStr('l' + i + sym) % 15) / 10000);
    const vol = 1e6 * (0.5 + (hashStr('v' + i + sym) % 100) / 100);
    o.push(open); h.push(high); l.push(low); c.push(close); v.push(vol);
    t.push(now - (count - i) * step);
    price = close;
  }
  return { o, h, l, c, v, t };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

async function fetchBarsTwelve(sym, interval, outputsize, apiKey) {
  const mapped = mapSymbolForProvider(sym, 'twelvedata');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(mapped)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;
  const r = await fetch(url, { cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('TwelveData HTTP ' + r.status);
  const j = await r.json();
  if (j.status === 'error' || !j.values) throw new Error(j.message || 'TwelveData error');
  const values = j.values.slice().reverse();
  return {
    o: values.map(x => +x.open),
    h: values.map(x => +x.high),
    l: values.map(x => +x.low),
    c: values.map(x => +x.close),
    v: values.map(x => +(x.volume || 0)),
    t: values.map(x => Date.parse(x.datetime)),
  };
}

async function getBars(sym, tf, count, env) {
  const key = env?.TWELVE_DATA_KEY;
  const intervalMap = { '1h': '1h', '15m': '15min', '5m': '5min' };
  try {
    if (key) return await fetchBarsTwelve(sym, intervalMap[tf] || tf, count, key);
  } catch (e) {
    // fall through to demo
  }
  const mins = tf === '1h' ? 60 : tf === '15m' ? 15 : 5;
  return demoBars(sym, mins, count, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CYCLE
// ═══════════════════════════════════════════════════════════════════════════

async function runBotCycle(env) {
  const cfg = await getConfig(env);
  const state = await getState(env);
  if (!cfg.active) {
    state.lastCycle = { t: Date.now(), status: 'idle' };
    await saveState(env, state);
    return state;
  }

  rollDay(state);
  state.iter = (state.iter || 0) + 1;
  const prices = {};
  const signals = [];
  const now = new Date();

  for (const sym of (cfg.symbols || SYMBOLS)) {
    const meta = INSTRUMENTS[sym];
    if (!meta) continue;
    if (!inSession(meta.session, now)) continue;
    if (nearSessionClose(meta.session, now)) continue;
    if (meta.session === 'FX' && fxSessionQuality(now) === 'low') continue;

    try {
      const [b1h, b15, b5] = await Promise.all([
        getBars(sym, '1h', 80, env),
        getBars(sym, '15m', 80, env),
        getBars(sym, '5m', 80, env),
      ]);
      prices[sym] = b5.c[b5.c.length - 1];
      const sig = scoreSetup(b1h, b15, b5, meta);
      sig.sym = sym;
      sig.meta = meta;
      if (sig.ok) signals.push(sig);
      else if (sig.score >= (meta.minScore || 62) - 5) {
        // near-miss logged lightly
      }
    } catch (e) {
      addLog(state, `Data error ${sym}: ${e.message}`, 'warn');
    }
  }

  // manage open positions first
  managePositions(state, prices);

  // rank signals by score, open best that pass risk
  signals.sort((a, b) => b.score - a.score);
  state.lastSigs = signals.slice(0, 15).map(s => ({
    sym: s.sym, dir: s.dir, score: s.score, price: s.price, sl: s.sl, tp: s.tp,
    rr: s.rr, why: s.why.slice(0, 5), ok: s.ok, t: Date.now(),
  }));

  if (!state.circuitBreaker) {
    for (const sig of signals) {
      if (state.positions.length >= (cfg.maxPositions || RISK.maxPositions)) break;
      openPaper(state, cfg, sig, sig.sym);
    }
  }

  state.lastCycle = { t: Date.now(), status: 'ok', scanned: Object.keys(prices).length, signals: signals.length };
  addLog(state, `Cycle #${state.iter}: scanned ${Object.keys(prices).length}, signals ${signals.length}, pos ${state.positions.length}`, 'info');
  await saveState(env, state);
  await saveConfig(env, cfg);
  return state;
}

// ═══════════════════════════════════════════════════════════════════════════
// KV HELPERS + HTTP
// ═══════════════════════════════════════════════════════════════════════════

async function getConfig(env) {
  try {
    const raw = await env.BTX_KV.get('config');
    return raw ? { ...defaultConfig(), ...JSON.parse(raw) } : defaultConfig();
  } catch { return defaultConfig(); }
}

async function getState(env) {
  try {
    const raw = await env.BTX_KV.get('state');
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch { return defaultState(); }
}

async function saveState(env, state) {
  if (env?.BTX_KV) await env.BTX_KV.put('state', JSON.stringify(state));
}

async function saveConfig(env, cfg) {
  if (env?.BTX_KV) await env.BTX_KV.put('config', JSON.stringify(cfg));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBotCycle(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const AUTH = env.AUTH_SECRET || null;
    const authHeader = request.headers.get('Authorization') || '';
    const authParam = url.searchParams.get('auth') || '';
    const isAuth = !AUTH || authHeader === 'Bearer ' + AUTH || authParam === AUTH;
    const publicPaths = ['/', '/state-public', '/health', '/instruments'];
    if (!isAuth && !publicPaths.includes(url.pathname)) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
    }

    if (url.pathname === '/health') {
      return jsonResp({ ok: true, service: 'BTX-DayTrader', ts: Date.now() });
    }

    if (url.pathname === '/instruments') {
      return jsonResp({ symbols: SYMBOLS, instruments: INSTRUMENTS });
    }

    if (url.pathname === '/state-public') {
      const cfg = await getConfig(env);
      const state = await getState(env);
      return jsonResp({
        active: cfg.active,
        mode: 'paper',
        equity: state.equity,
        cash: state.cash,
        dailyPnl: state.dailyPnl,
        peakEquity: state.peakEquity,
        circuitBreaker: state.circuitBreaker,
        positions: state.positions,
        trades: (state.trades || []).slice(0, 40),
        lastSigs: state.lastSigs || [],
        lastCycle: state.lastCycle,
        iter: state.iter,
        log: (state.log || []).slice(0, 40),
        journal: (state.journal || []).slice(0, 30),
        instrumentCount: SYMBOLS.length,
      });
    }

    if (url.pathname === '/start-paper' && request.method === 'POST') {
      const cfg = defaultConfig();
      cfg.active = true;
      cfg.mode = 'paper';
      cfg.startedAt = Date.now();
      const state = defaultState();
      await saveConfig(env, cfg);
      await saveState(env, state);
      addLog(state, 'Paper trading STARTED', 'info');
      await saveState(env, state);
      return jsonResp({ ok: true, mode: 'paper' });
    }

    if (url.pathname === '/stop' && request.method === 'POST') {
      const cfg = await getConfig(env);
      cfg.active = false;
      await saveConfig(env, cfg);
      return jsonResp({ ok: true, active: false });
    }

    if (url.pathname === '/run-cycle' && request.method === 'POST') {
      const state = await runBotCycle(env);
      return jsonResp({ ok: true, iter: state.iter, lastCycle: state.lastCycle, signals: state.lastSigs?.length || 0 });
    }

    if (url.pathname === '/analyze' && request.method === 'GET') {
      const sym = url.searchParams.get('sym');
      if (!sym || !INSTRUMENTS[sym]) return jsonResp({ ok: false, error: 'unknown symbol' }, 400);
      const meta = INSTRUMENTS[sym];
      const [b1h, b15, b5] = await Promise.all([
        getBars(sym, '1h', 80, env),
        getBars(sym, '15m', 80, env),
        getBars(sym, '5m', 80, env),
      ]);
      const sig = scoreSetup(b1h, b15, b5, meta);
      return jsonResp({ ok: true, sym, ...sig });
    }

    if (url.pathname === '/') {
      return new Response(
        '<meta http-equiv="refresh" content="0;url=https://tomekfalek-cyber.github.io/BTX-daytrader/">',
        { headers: { 'Content-Type': 'text/html', ...corsHeaders() } }
      );
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};
