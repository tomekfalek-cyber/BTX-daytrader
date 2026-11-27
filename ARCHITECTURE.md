# BTX Architecture

## Stan faktyczny ścieżki otwarcia pozycji
Wiele plików nadpisuje `window.openPos` (`grep -n "global.openPos *=" *.js`). Efektywna funkcja po starcie
pochodzi z `strategy-pro.js` (`gateCheck`: sesja/news, siła i scoring sygnału, limity pozycji/transakcji/serii strat,
cooldown, grupa korelacji, koszty R:R). `btx-engine-singleton.js` próbuje "zamrozić" `openPos`, ale `openPos` jest
zwykłą deklaracją globalną (nie da się jej zamrozić), więc późniejsze nakładki ją nadpisują.
Nie zakładaj, że singleton jest jedyną ścieżką — sprawdź `String(window.openPos)` w konsoli.

## Nazwy globalne
- `BTX_CANON` — parametry (ryzyko, limity, time-stop) z `btx-canon.js`.
- `BTX_SYMBOLS` — lista instrumentów i mapowanie XTB z `symbols-canon.js` (wcześniej kolidowało z `BTX_CANON`).

## Testy
- `npm test` — jednostkowe (`btx-core.mjs`, `engine-core.mjs`, raport, konfiguracja, zgodność kopii rdzenia).
- `npm run test:app` — smoke całej aplikacji w jsdom (wymaga `npm i`).

## btx-core.mjs / btx-core-esm.js
`btx-core.mjs` to rdzeń CLI/backtestu. `btx-core-esm.js` jest jego kopią (fallback dla GitHub Pages);
`tests/core-sync.test.mjs` pilnuje zgodności. Przeglądarka używa równoległych implementacji w `index.html` / `strategy-pro.js`.

## Zasada
Nowe zachowanie dodawaj w `strategy-pro.js` (`gateCheck`) albo w CANON, a nie kolejną nakładką `openPos = function...`.
