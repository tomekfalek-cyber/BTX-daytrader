# BTX daytrader

https://tomekfalek-cyber.github.io/BTX-daytrader/

Paper / sygnałowy asystent daytradingu (akcje, ETF, FX) pod ręczne XTB. Działa z GitHub Pages.

## Szybki start
1. Otwórz GitHub Pages projektu
2. Ustawienia → klucz **Twelve Data** → Test dostawcy (LIVE)
3. Pulpit → autonomia paper ON
4. Sesja US ok. **15:30–22:00 PL** (pn–pt)
5. Karta handlu na górze: LONG/SHORT, SL, TP → kopiuj do XTB

## Co jest w środku
- Signal Desk (siła, score Active DT ≥63)
- Risk PRO (0.5%, max 2 pozycje, max 6 transakcji dziennie)
- Engine Hardening (LIVE bez synth, weekend OFF, reset dnia, flat koniec US)
- Pro Edge + Pakiet DT (pullback, open 15m, tech XOR QQQ, spread)
- Edukacja, journal, plan 7 dni
- Box **Dlaczego 0 trade** + zwijane panele na Pulpicie

## Instrumenty i limity
- 11 symboli (US, EU, FX) — lista jest wpisana na stałe w `index.html` (`SYMBOLS`)
- Free Twelve Data ma limit zapytań — przy 11 symbolach i skanie co 120 s pilnuj budżetu API (moduł `api-budget.js`)
- To nie gwarancja zysku; paper ≠ real XTB
- Auto-zlecenia XTB tylko przy xAPI ONLINE + świadomy ARM (DEMO)

## Parametry strategii
Docelowe wartości są wpisane bezpośrednio w `strategy-pro.js` (np. `minStrengthOpen: 3`, `tpR: 1.6`, `maxDayTrades: 6`). CI niczego już nie nadpisuje.

## Dev / CI
- Moduły JS są dopisane jako `<script src>` na końcu `index.html` (kolejność = kolejność ładowania; `anti-flicker.js` pierwszy)
- Workflow `.github/workflows/pages.yml`: guard rozmiaru krytycznych plików → `node --check` → sprawdzenie, że wszystkie skrypty istnieją → `npm test` → dopiero deploy (tylko z `main`)
- Testy: `tests/engine-core.test.mjs`
- `dashboard/index.html` to tylko przekierowanie do strony głównej

## Bezpieczeństwo
- Klucze w localStorage przeglądarki — nie współdziel urządzenia
- Docelowo: Worker proxy (`worker-proxy.js`, opis w `worker-proxy.md`) dla kluczy API