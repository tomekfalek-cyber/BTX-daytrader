# BTX Architecture

## Single open/close path
1. User/Auto calls `openPos(signal)`
2. `btx-engine-singleton.js` freezes `window.openPos` after load
3. Gate: correlation → PRO Elite A/A+ → underlying open (sizePlan + capital-lock already in chain before freeze)
4. `closePos`: hold-discipline may delay soft exits; SL immediate

## Do not add
New files that do `openPos = function...` after singleton — they are ignored.

## engine-core.mjs
Indicator math for Node tests only. Browser uses parallel implementations in `index.html` / `strategy-pro.js` until full port.
