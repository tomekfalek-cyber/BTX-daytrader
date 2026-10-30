# BTX DayTrader
https://tomekfalek-cyber.github.io/BTX-daytrader/

**Professional paper day-trading agent** for stocks, ETFs and FX.  
Signals only — you execute manually on XTB (xStation).

Dashboard: open `index.html` locally or via GitHub Pages after push.

---

## What this is

A complete intraday desk agent (not a toy skeleton):

- **38 instruments**: US stocks & ETFs, Polish GPW large-caps, FX
- **Multi-TF stack**: Context 1H → Setup 15m → Trigger 5m
- **Smart Money Concepts**: Order Blocks, FVG, Liquidity Sweeps, BoS / CHoCH, Premium/Discount
- **Classic confluence**: RSI, EMA 20/50, MACD, Bollinger, ATR
- **AI ensemble** (SwingRAI-style): Naive Bayes + GBM + adaptive Q-threshold (score 40% / NB 30% / GBM 30%)
- **CSV export**: journal + closed trades from the dashboard
- **Institutional-style risk**: 0.75% risk/trade, max 4 positions, 2% daily loss circuit-breaker, session filters, correlation groups
- **Pure paper engine**: virtual positions, P&L, journal — **never** connects to XTB

You watch the dashboard and place real orders yourself on xStation.

---

## New modules (client)

| File | Role |
|------|------|
| `ai-ensemble.js` | Naive Bayes + GBM + adaptive threshold; hooks into `evaluate`, learns from closed paper trades (`localStorage`) |
| `export-csv.js` | Buttons **Dziennik CSV** / **Transakcje CSV** in the top bar |

GitHub Pages workflow injects both scripts into `index.html` on every deploy.

Locally, add before `</body>`:
```html
<script src="ai-ensemble.js"></script>
<script src="export-csv.js"></script>
```

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
| Take profit | 2.0–2.5 R |
| Min R:R after costs | 1.8 |
| Correlation | max 2 from same group |

---

## How to run

### Option A — GitHub Pages / local (recommended)

1. Open https://tomekfalek-cyber.github.io/BTX-daytrader/
2. Paper state in `localStorage`
3. Demo mode without API keys (full signal pipeline)

### Option B — Cloudflare Worker (live data)

1. Paste full `worker.js` into a Worker
2. Bind KV as `BTX_KV`
3. Secrets: `TWELVE_DATA_KEY` or `FINNHUB_KEY`
4. Point dashboard `WORKER_URL` to the worker

---

## Architecture

```
BTX-daytrader/
├── index.html           # trading desk UI + paper engine
├── ai-ensemble.js       # NB + GBM + adaptive threshold
├── export-csv.js        # journal / trades CSV export
├── worker.js            # optional edge engine (live data)
└── .github/workflows/pages.yml
```

---

## Disclaimer

Educational / research software only.  
Past paper results do not predict future performance.  
Day trading involves substantial risk of loss.  
You alone are responsible for any real trades on XTB or any other broker.
