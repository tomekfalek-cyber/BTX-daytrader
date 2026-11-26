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

## Start sesji (PRO)

1. Otwórz GitHub Pages z `?v=mon1` i hard refresh (Ctrl+Shift+R).
2. Ustawienia → klucz Twelve Data → Zapisz → Test.
3. Reset paper na początku tygodnia / po zmianach sizingu.
4. Auto ON, sesja ALL lub US od 15:30 PL.
5. Na pulpicie: **PRO DAYTRADER** checklist + **Kopiuj plan XTB**.
6. Ręcznie wprowadzaj na XTB tylko plany A+/A gdy się uczysz.
7. Przed końcem sesji US (~21:45 PL) bez nowych wejść; flat paper.

Kanon: risk 0.35%, max 2 poz., TP 2R, time-stop 24, confirm 1, capital-lock ON.

## Stan kanoniczny (zgodny z kodem)

| Parametr | Wartość |
|----------|---------|
| Risk / trade | **0.35%** |
| Max pozycji | **2** |
| Max trades / dzień | **6** (CFG) |
| TP | **~2R** |
| Time-stop | **24 świece** (przy cyklu≠5m to nie jest 24×5min ściśle) |
| Min hold | **8 świec** + **10 min zegarowych** (hold-discipline) |
| Auto-OPEN | tylko grade **A/A+** (pro-elite-pack) |
| Paper | asystent pod **ręczne XTB** — brak auto-egzekucji u brokera |

### Architektura (po porządkach)
- Wskaźniki testowane: `engine-core.mjs` (Node testy).
- UI/paper: `index.html` + moduły `.js`.
- **Jedna ścieżka open/close:** `btx-engine-singleton.js` (na końcu ładownia) — dalsze nakładki `openPos` są ignorowane.
- Usunięte z runtime m.in. `pro-upgrade-6`, `signal-lock`, `code-hygiene`, `engine-hardening-patch`, `openpos-pipeline` (nadmiar wrapperów).

### Czego NIE ma
- Oficjalnego API XTB / auto-orderów
- Dowodu przewagi na realnych danych 5m (demo ≠ rynek)
- Gwarancji zysku

### Backtest
Przycisk backtest na demo generuje wynik na **świecach syntetycznych/demo**, nie na 250 sesjach dziennych. Traktuj jako test silnika, nie dowód edge.


### Backtest PRO
Przycisk **Backtest** (prawy dolny róg) + zakładka Backtest:
- dane **5m z Twelve Data** (wymaga klucza)
- koszty + poślizg
- porównanie **RANDOM baseline**
- bez klucza / na demo = **brak dowodu edge**

### Częstotliwość (daytrade)
Cel operacyjny: **ok. 2 transakcje / dzień sesyjny** przy sile≥3, grade A/B+, RVOL≥0.65. Nie forsujemy ilości kosztem risk 0.35%.

## BTX PRO (kanon)

| Parametr | Wartość |
|----------|---------|
| Risk | 0.35% |
| Max pozycji | 2 |
| Max trades/dzień | 6 |
| Cel operacyjny | ~2/dzień |
| Min siła | 3 |
| Min hold | 4 świece / 6 min |
| Time-stop | 24 świece |
| Gate | `btx-engine-singleton` v2 + CANON |

Nie jest to autobroker XTB. Paper + ręczne kopiowanie.
