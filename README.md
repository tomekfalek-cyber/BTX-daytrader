# BTX DayTrader
https://tomekfalek-cyber.github.io/BTX-daytrader/

**Professional paper day-trading agent** for stocks, ETFs and FX.  
Signals only — you execute manually on XTB (xStation).

Dashboard: open `index.html` locally or via GitHub Pages after push.

---

## What this is

A complete intraday desk agent (not a toy skeleton):

- **38 instruments**: US stocks & ETFs, Polish GPW large-caps, FX (USD / EUR / JPY / NZD focus)
- **Multi-TF stack**: Context 1H → Setup 15m → Trigger 5m
- **Smart Money Concepts**: Order Blocks, Fair Value Gaps, Liquidity Sweeps, BoS / CHoCH, Premium/Discount
- **Classic confluence**: RSI, EMA 20/50, MACD, Bollinger, ATR
- **Institutional-style risk**: 0.75% risk/trade, max 4 positions, 2% daily loss circuit-breaker, session filters, correlation groups, min R:R after costs
- **Pure paper engine**: virtual positions, P&L, journal — **never** connects to XTB
- **Dashboard**: live signals, open paper positions, risk gauges, session clock, trade journal

You watch the dashboard and place real orders yourself on xStation.

---

## Important: worker.js status (Oct 2026)

The **dashboard on GitHub Pages works without Cloudflare Worker** (demo / client-side engine in `index.html`).

Current `worker.js` on `main` is a **minimal valid** Worker (health endpoint).  
To restore the **full** previous Worker (SMC + paper engine on the edge):

1. Open: https://github.com/tomekfalek-cyber/BTX-daytrader/blob/0e5ae31a330f6d65b52eb938f476af36defdedc3/worker.js  
2. Click **Raw** → Select all → Copy  
3. Edit `worker.js` on `main` → paste → Commit  

Planned next (AI ensemble + journal CSV export) will be applied to the client dashboard and/or full worker once restored.

---

## Instrument universe

### US Equity & ETFs
`SPY QQQ IWM DIA XLK XLF XLE SMH TLT GLD`  
`AAPL MSFT NVDA TSLA AMZN GOOGL META AMD AVGO JPM`

### Polish GPW
`PKN PKO PEO KGH CDR ALE PZU JSW LPP DNP`

### FX
`EURUSD USDJPY NZDUSD EURJPY EURNZD NZDJPY GBPUSD AUDUSD`

---

## Day-trading rules (defaults)

| Rule | Value |
|------|-------|
| Risk per trade | 0.75% of equity |
| Max concurrent positions | 4 |
| Daily loss limit | 2.0% → stop trading for the day |
| Max holding | end of session or 4 hours |
| No new entries | last 45 minutes of session |
| Stop loss | 1.5 × ATR(14) |
| Take profit | 2.0–2.5 R (or structure) |
| Min R:R after costs | 1.8 |
| Correlation | max 2 from same group (Tech / Banks / Energy / FX-USD / PL-Banks) |

Sessions: US RTH for US names, GPW hours for Polish, London+NY overlap preferred for FX.

---

## How to run

### Option A — Static dashboard (GitHub Pages / local) — recommended now

1. Open https://tomekfalek-cyber.github.io/BTX-daytrader/ or open `index.html` in a browser.
2. Paper state is stored in `localStorage`.
3. Without a Worker / API key the engine runs in **demo mode** (synthetic but realistic OHLC + full signal pipeline).

### Option B — Cloudflare Worker (live data)

1. Restore full `worker.js` from commit `0e5ae31` (see above).
2. Create a Worker, paste `worker.js`.
3. Bind a KV namespace as `BTX_KV`.
4. Set secrets: `AUTH_SECRET` (optional), `TWELVE_DATA_KEY` or `FINNHUB_KEY`.
5. Point the dashboard `WORKER_URL` to your worker endpoint.
6. Cron trigger every 1–5 minutes during market hours.

---

## Architecture

```
BTX-daytrader/
├── README.md
├── worker.js          # optional edge engine (minimal restore on main; full = commit 0e5ae31)
├── index.html         # main trading desk UI + paper engine
└── dashboard/
    └── index.html     # same dashboard (GitHub Pages path)
```

---

## Disclaimer

Educational / research software only.  
Past paper results do not predict future performance.  
Day trading involves substantial risk of loss.  
You alone are responsible for any real trades on XTB or any other broker.
