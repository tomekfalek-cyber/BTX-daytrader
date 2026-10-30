// Cloudflare Worker: proxy danych + cache (klucze po stronie serwera).
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true }), { headers: cors });
    if (url.pathname !== '/bars') return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors });
    const symbol = (url.searchParams.get('symbol') || 'SPY').toUpperCase();
    const tf = url.searchParams.get('tf') || '5min';
    const provider = (url.searchParams.get('provider') || 'twelve').toLowerCase();
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    let out;
    if (provider === 'twelve') {
      const key = env.TWELVE_DATA_KEY;
      if (!key) return new Response(JSON.stringify({ error: 'brak TWELVE_DATA_KEY' }), { status: 500, headers: cors });
      const u = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(tf) + '&outputsize=120&apikey=' + encodeURIComponent(key);
      const r = await fetch(u); const j = await r.json();
      out = (j.values || []).slice().reverse().map(v => ({ t: new Date(v.datetime).getTime(), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) }));
    } else if (provider === 'alpaca') {
      const u = 'https://data.alpaca.markets/v2/stocks/' + encodeURIComponent(symbol) + '/bars?timeframe=5Min&limit=120&feed=iex&adjustment=raw';
      const r = await fetch(u, { headers: { 'APCA-API-KEY-ID': env.ALPACA_KEY_ID, 'APCA-API-SECRET-KEY': env.ALPACA_SECRET } });
      const j = await r.json();
      out = (j.bars || []).map(b => ({ t: new Date(b.t).getTime(), o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +(b.v || 0) }));
    } else {
      return new Response(JSON.stringify({ error: 'provider?' }), { status: 400, headers: cors });
    }
    const res = new Response(JSON.stringify({ symbol, tf, bars: out }), { headers: Object.assign({ 'Cache-Control': 'public, max-age=300' }, cors) });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  }
};