/**
 * BTX DayTrader — Cloudflare Worker (minimal restore)
 * Full engine lives in index.html (GitHub Pages / local).
 * This worker is optional — for live market data + KV state.
 *
 * To restore the previous full worker.js:
 * Open: https://github.com/tomekfalek-cyber/BTX-daytrader/blob/0e5ae31a330f6d65b52eb938f476af36defdedc3/worker.js
 * Click Raw → Select all → Copy → paste into worker.js on main.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        ok: true,
        service: 'BTX DayTrader',
        mode: 'minimal-restore',
        hint: 'Use GitHub Pages dashboard. Full worker: restore from commit 0e5ae31',
        dashboard: 'https://tomekfalek-cyber.github.io/BTX-daytrader/',
      }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Not found', restore: 'commit 0e5ae31 worker.js' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  },
};
