# Worker proxy (opcjonalny)

Trzyma klucze poza przeglądarką i cache'uje odpowiedzi (5 min).

## Wdrożenie
1. `npm i -g wrangler` → `wrangler login`
2. `wrangler init btx-proxy --type=javascript` (albo użyj tego pliku jako `src/index.js`)
3. Sekrety:
```
wrangler secret put TWELVE_DATA_KEY
wrangler secret put ALPACA_KEY_ID
wrangler secret put ALPACA_SECRET
```
4. `wrangler deploy`

## Endpoint
`GET /bars?symbol=SPY&tf=5min&provider=twelve` → `{ symbol, tf, bars:[{t,o,h,l,c,v}] }`
`GET /health` → `{ ok: true }`

## Dashboard
Ustawienia → Worker URL: `https://btx-proxy.<subdomena>.workers.dev` → Test połączenia.