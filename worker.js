export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/data') return new Response('Not found', { status: 404 });

    if (request.method === 'GET') {
      return new Response(await env.KV.get('hq') || '{}', {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
      });
    }

    if (request.method === 'PUT') {
      const b = await request.text();
      if (b.length > 2e6) return new Response('Zu gross', { status: 413 });
      try { JSON.parse(b); } catch (e) { return new Response('Kein JSON', { status: 400 }); }
      await env.KV.put('hq', b);
      return new Response('ok');
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
