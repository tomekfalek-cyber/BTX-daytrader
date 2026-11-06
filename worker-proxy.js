/**
 * Cloudflare Worker — proxy Twelve Data + Telegram
 *
 * Ustaw sekrety w Workerze:
 *   TWELVE_KEY = twój klucz Twelve Data
 *
 * Deploy: wrangler secret put TWELVE_KEY
 * Endpointy:
 *   GET  /bars?symbol=EURUSD
 *   POST /telegram  { token, chat_id, text }  — albo token z env TG_BOT_TOKEN
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (url.pathname === '/bars' && request.method === 'GET') {
        const symbol = url.searchParams.get('symbol') || 'EURUSD';
        const key = env.TWELVE_KEY;
        if (!key) {
          return json({ error: 'Brak TWELVE_KEY w Workerze' }, 500, cors);
        }
        let sym = symbol;
        if (sym === 'EURUSD') sym = 'EUR/USD';
        if (sym === 'XAUUSD' || sym === 'XAU/USD') sym = 'XAU/USD';
        const api = 'https://api.twelvedata.com/time_series?symbol=' +
          encodeURIComponent(sym) + '&interval=5min&outputsize=120&apikey=' + encodeURIComponent(key);
        const r = await fetch(api);
        const data = await r.json();
        if (!data || !data.values) {
          return json({ error: data && data.message ? data.message : 'Twelve error', raw: data }, 502, cors);
        }
        const bars = data.values.slice().reverse().map(function (v) {
          return {
            t: Date.parse(v.datetime),
            o: +v.open,
            h: +v.high,
            l: +v.low,
            c: +v.close,
            v: +(v.volume || 0)
          };
        });
        return json({ symbol: symbol, bars: bars }, 200, cors);
      }

      if (url.pathname === '/telegram' && request.method === 'POST') {
        const body = await request.json();
        const token = body.token || env.TG_BOT_TOKEN;
        const chat = body.chat_id || env.TG_CHAT_ID;
        const text = body.text || '';
        if (!token || !chat) return json({ error: 'token/chat_id required' }, 400, cors);
        const tg = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: text, disable_web_page_preview: true })
        });
        const out = await tg.json();
        return json(out, tg.ok ? 200 : 502, cors);
      }

      return json({
        ok: true,
        service: 'BTX worker-proxy',
        endpoints: ['GET /bars?symbol=', 'POST /telegram']
      }, 200, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors || {})
  });
}
