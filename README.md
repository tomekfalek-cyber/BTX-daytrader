# BTX DayTrader

**Paper-trading desk dla akcji, ETF i FX.** Sygnały i zarządzanie pozycją w przeglądarce;
zlecenia składasz ręcznie na XTB (xStation). Bez backendu — działa z GitHub Pages.

## Live
https://tomekfalek-cyber.github.io/BTX-daytrader/

## Co faktycznie działa

- **34 instrumenty**: ETF US (SPY, QQQ, IWM, DIA, XLK, XLF, XLE, SMH, TLT, GLD),
  akcje US (AAPL, MSFT, NVDA, AMZN, GOOGL, META, JPM, XOM), GPW (PKN, PKO, PEO, KGH, CDR),
  FX (EURUSD, GBPUSD, USDJPY, AUDUSD, NZDUSD, EURJPY).
- **Multi-TF**: kontekst 1H + trigger 5m (wymagana zgodność trendu).
- **SMC**: Order Blocks, FVG, Liquidity Sweep, BoS, Premium/Discount + konfluencja.
- **Ryzyko**: 1% kapitału na transakcję, stop 1,5×ATR, target 3R, max 4 pozycje.
- **Ochrona pozycji**: min. trzymanie 6 świec, breakeven po 1R, time-stop 60 świec.
- **Limity dzienne**: 3% straty, 10 transakcji, 3 straty z rzędu → blokada.
- **Sesje**: US 15:30–22:00, GPW 9:00–17:00, FX 24/5 (wejścia poza sesją pomijane).
- **Analiza AI**: uzasadnienie decyzji (kontekst, setup, ryzyko, za/przeciw, pewność 0–100).
- **Wykres**: świece 5m, wsparcia/opory z pivotów, VWAP, SMA20/50, linie SL/TP.
- **Dane**: demo (bez kluczy), **Twelve Data** (US/GPW/FX), **Alpaca** (US, IEX), **Stooq** (GPW, EOD).
- **Backtest** na tych samych regułach co live.

## Czego NIE ma
- Brak integracji z brokerem — **żadnych realnych zleceń**.
- Brak własnego backendu; klucze API są w `localStorage` przeglądarki.
- Brak testów jednostkowych w UI (patrz `tests/` dla funkcji silnika).

## Uruchomienie
1. Otwórz stronę GitHub Pages (albo `index.html` lokalnie).
2. Ustawienia → dostawca danych → klucz (jeśli używasz Twelve Data/Alpaca).
3. Wykres → wybierz instrument → **Pobierz realne dane**.
4. Pulpit → **Wykonaj cykl** (lub Auto).

## Struktura
```
index.html          # dashboard (single-file, inline engine)
dashboard/index.html# kopia dla /dashboard/
styles.css          # arkusz stylów
engine-core.mjs     # czyste funkcje wskaźników/SMC (testowalne)
tests/              # testy node:test
worker-proxy.js     # opcjonalny proxy Cloudflare (klucze + cache)
.github/workflows/  # deploy na Pages
```

## Roadmap
- [ ] rozbić inline engine na moduły ES
- [ ] realny backtest z importem CSV
- [ ] proxy Workera jako domyślna ścieżka danych
- [ ] testy E2E (Playwright)

## Zastrzeżenie
To narzędzie edukacyjne. Nie jest rekomendacją inwestycyjną ani licencjonowanym doradcą.