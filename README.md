# BTX daytrader

Paper / sygnalowy asystent daytradingu (akcje, ETF, FX) pod reczne XTB. Dziala z GitHub Pages.

## Szybki start
1. Otworz GitHub Pages projektu
2. Ustawienia \u2192 klucz **Twelve Data** \u2192 Test dostawcy (LIVE)
3. Pulpit \u2192 autonomia paper ON
4. Sesja US ok. **15:30\u201322:00 PL** (pn\u2013pt)
5. Karta handlu na gorze: LONG/SHORT, SL, TP \u2192 kopiuj do XTB

## Co jest w srodku
- Signal Desk (sila, score Active DT \u226563)
- Risk PRO (0.5%, max 2 pos, max 4/dzien)
- Engine Hardening (LIVE bez synth, weekend OFF, reset dnia, flat koniec US)
- Pro Edge + Pakiet DT (pullback, open 15m, tech XOR QQQ, spread)
- Edukacja, journal, plan 7 dni
- Box **Dlaczego 0 trade** + zwijane panele na Pulpicie

## Limity
- Free Twelve: trzymaj **8 instrumentow**
- To nie gwarancja zysku; paper \u2260 real XTB
- Auto-zlecenia XTB tylko przy xAPI ONLINE + swiadomy ARM (DEMO)

## Dev / CI
- Moduly JS wstrzykiwane przy deploy (`.github/workflows/pages.yml`)
- `node --check` na modulach przed publikacja
- autonomy-pro / pro-edge zawsze przywracane z dobrych wersji w CI (ochrona przed PLACEHOLDER)
- Testy: `tests/engine-core.test.mjs`

## Bezpieczenstwo
- Klucze w localStorage przegladarki \u2014 nie wspoldziel urzadzenia
- Docelowo: Worker proxy (`worker-proxy.js`) dla kluczy API
