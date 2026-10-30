import test from 'node:test';
import assert from 'node:assert/strict';
import { sma, rsi, atr, vwap, pivots, smcBOS, smcFVG, smcSweep, pdZone, ema } from '../engine-core.mjs';

const bar=(o,h,l,c,v=100)=>({o,h,l,c,v});

test('sma liczy srednia z ostatnich n', () => { assert.equal(sma([1,2,3,4],2), 3.5); assert.equal(sma([1],3), null); });
test('ema reaguje na serie', () => { const e=ema([1,2,3,4,5],3); assert.ok(e>4 && e<5); });
test('rsi=100 dla serii rosnacej', () => { assert.equal(rsi([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],14), 100); });
test('rsi=0 dla serii spadkowej', () => { assert.equal(rsi([15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],14), 0); });
test('atr rowny stalemu zakresowi', () => { const b=[bar(10,11,9,10),bar(10,11,9,10),bar(10,11,9,10),bar(10,11,9,10)]; assert.equal(atr(b,3), 2); });
test('vwap dla stalych cen', () => { const b=[bar(10,10,10,10),bar(10,10,10,10)]; assert.equal(vwap(b), 10); });
test('pivots wykrywa szczyt', () => { const b=[bar(1,1,1,1),bar(1,2,1,1),bar(1,3,1,1),bar(1,2,1,1),bar(1,1,1,1)]; const p=pivots(b,1); assert.ok(p.hi.includes(3)); });
test('smcBOS UP po wybiciu szczytu', () => { const b=[]; for(let i=0;i<6;i++) b.push(bar(10,10.5,9.5,10)); b.push(bar(10,12,9.8,11)); b.push(bar(11,11.5,10.5,11)); b.push(bar(11,11.5,10.5,11)); b.push(bar(11,11.5,10.5,11)); b.push(bar(11,13,11,12.8)); assert.equal(smcBOS(b), 'UP'); });
test('smcFVG LONG wykrywa luke', () => { const b=[bar(10,10.5,9.5,10), bar(10,12,10,11.5), bar(12.5,13,12.2,12.8)]; const f=smcFVG(b,'LONG'); assert.ok(f && f.bottom>0); });
test('smcSweep SHORT po knocie nad szczytem', () => { const b=[]; for(let i=0;i<20;i++) b.push(bar(10,10.5,9.5,10)); b.push(bar(10,11.5,9.9,10.2)); assert.equal(smcSweep(b), 'SHORT'); });
test('pdZone premium powyzej rownowagi', () => { const b=[bar(1,2,1,1),bar(1,3,1,3)]; assert.equal(pdZone(b).zone, 'premium'); });