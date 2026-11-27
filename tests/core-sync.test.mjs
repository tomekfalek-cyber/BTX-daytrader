// btx-core-esm.js jest kopią btx-core.mjs (fallback dla GitHub Pages) — nie wolno im się rozjechać.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('btx-core-esm.js === btx-core.mjs', () => {
  const a = readFileSync(new URL('../btx-core.mjs', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../btx-core-esm.js', import.meta.url), 'utf8');
  assert.equal(a, b, 'zsynchronizuj: cp btx-core.mjs btx-core-esm.js');
});
