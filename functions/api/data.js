export async function onRequestGet({env}) {
  return new Response(await env.KV.get('hq') || '{}', {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export async function onRequestPut({env, request}) {
  const b = await request.text();
  if (b.length > 2e6) return new Response('Zu gross', { status: 413 });
  try { 
    JSON.parse(b); 
  } catch(e) { 
    return new Response('Kein JSON', { status: 400 }); 
  }
  await env.KV.put('hq', b);
  return new Response('ok');
}
