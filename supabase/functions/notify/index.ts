// Envoi des notifications push de la ligue (appelé par la base via pg_net, jamais par l'appli)
import webpush from 'npm:web-push@3.6.7';

const PUB = Deno.env.get('VAPID_PUBLIC') ?? '';
const PRIV = Deno.env.get('VAPID_PRIVATE') ?? '';
const SECRET = Deno.env.get('NOTIFY_SECRET') ?? '';
webpush.setVapidDetails('https://yaogao1221-ai.github.io/Gymtrack/', PUB, PRIV);

Deno.serve(async (req) => {
  if (req.method !== 'POST' || req.headers.get('x-notify-secret') !== SECRET) return new Response('interdit', { status: 401 });
  const { subs = [], title, body, url, tag } = await req.json();
  const payload = JSON.stringify({ title, body, url: url || './#/ligue', tag: tag || 'ligue' });
  const gone: string[] = []; let sent = 0; const errors: string[] = [];
  await Promise.all(subs.slice(0, 20).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' }); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) gone.push(s.endpoint); else errors.push(String(code ?? (e as Error).message)); }
  }));
  if (gone.length) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/ligue_push_gone`, { method: 'POST', headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: SECRET, p_endpoints: gone }) }).catch(() => {});
  }
  return Response.json({ sent, gone: gone.length, errors });
});
