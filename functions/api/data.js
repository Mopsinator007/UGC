// Cloudflare Pages Function: speichert deinen kompletten Stand als ein JSON in Workers KV.
// Nur erreichbar, wenn Cloudflare Access davor sitzt (setzt den E-Mail-Header).
const ok=(r,env)=>{const e=r.headers.get('Cf-Access-Authenticated-User-Email');return !!e&&(!env.OWNER_EMAIL||e.toLowerCase()===env.OWNER_EMAIL.toLowerCase())};
const no=()=>new Response('Unauthorized',{status:401});
export async function onRequestGet({env,request}){
  if(!ok(request,env))return no();
  return new Response(await env.KV.get('hq')||'{}',{headers:{'content-type':'application/json','cache-control':'no-store'}});
}
export async function onRequestPut({env,request}){
  if(!ok(request,env))return no();
  const b=await request.text();
  if(b.length>2e6)return new Response('Zu gross',{status:413});
  try{JSON.parse(b)}catch(e){return new Response('Kein JSON',{status:400})}
  await env.KV.put('hq',b);
  return new Response('ok');
}
