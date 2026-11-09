// Service worker GymTrack AI : coquille de l'app en cache + lectures API en « réseau d'abord, cache sinon »
const VERSION = 'gymtrack-v3';
// Chemins relatifs au service worker : marche à la racine (serveur) comme dans un sous-dossier (GitHub Pages)
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(SHELL);
    try { const list = await (await fetch('./precache.json', { cache: 'no-store' })).json(); await c.addAll(list); } catch { /* pas de manifeste */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'gymtrack-api').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/data/')) return;
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open('gymtrack-api').then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.open('gymtrack-api').then((c) => c.match(req, { ignoreVary: true })).then((r) => r || new Response(JSON.stringify({ error: 'Hors ligne' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/icons/'))) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
