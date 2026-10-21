const enc = new TextEncoder();

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function token(pw) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode('ugc-hq-session')));
}

function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function authed(request, PW) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)hq_auth=([a-f0-9]{64})/);
  return !!m && safeEq(m[1], await token(PW));
}

const cookie = (v, age) => `hq_auth=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

const loginPage = err => new Response(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>UGC HQ</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0c;color:#f3efe7;font:14px Inter,system-ui,sans-serif}
form{width:min(340px,88vw);background:#141417;border:1px solid #2a2a30;border-radius:18px;padding:28px}
h1{font:400 44px/1 'Instrument Serif',Georgia,serif;margin:0 0 4px}h1 i{color:#d8b45a}
p{color:#8d877c;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 20px}
input{width:100%;background:#1c1c21;color:inherit;border:1px solid transparent;border-radius:10px;padding:12px;font:inherit;font-size:16px}
input:focus{outline:0;border-color:#d8b45a}
button{width:100%;margin-top:12px;background:#d8b45a;color:#14120f;border:0;border-radius:10px;padding:12px;font:600 14px Inter,sans-serif;cursor:pointer}
.e{color:#ef6b5e;margin-top:10px;font-size:13px}
</style></head><body>
<form method="POST" action="/login">
<h1>UGC <i>HQ</i></h1><p>Privat · @itsmadebymo</p>
<input type="password" name="pw" placeholder="Passwort" autocomplete="current-password" autofocus required>
${err ? '<div class="e">Falsches Passwort</div>' : ''}
<button type="submit">Entsperren</button>
</form></body></html>`, {
  status: err ? 401 : 200,
  headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const PW = env.PASSWORD || (await env.KV.get('pw'));
    if (!PW) return new Response('Kein Passwort gesetzt (KV-Key "pw" fehlt)', { status: 500 });
    const url = new URL(request.url);

    if (url.pathname === '/login' && request.method === 'POST') {
      const pw = String((await request.formData()).get('pw') || '');
      if (safeEq(await sha(pw), await sha(PW))) {
        return new Response(null, {
          status: 303,
          headers: { Location: '/', 'Set-Cookie': cookie(await token(PW), 2592000) }
        });
      }
      await new Promise(r => setTimeout(r, 1000));
      return loginPage(true);
    }

    if (url.pathname === '/logout') {
      return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie('', 0) } });
    }

    if (!(await authed(request, PW))) {
      if (url.pathname.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
      return loginPage(false);
    }

    if (url.pathname === '/api/data') {
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

    return env.ASSETS.fetch(request);
  }
};
