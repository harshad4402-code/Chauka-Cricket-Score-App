/* Gully Live service worker: the app opens and works with no internet.
   - App shell + fonts + icons are cached on first visit (precache).
   - Pages: network first (so updates arrive), 4s timeout, then the cached copy.
   - Static files: cached copy instantly, refreshed in the background.
   - /api is never cached here; the app keeps its own offline copy of the matches and syncs later. */
const V = 'gl-v10';
const SHELL = ['/', '/styles.css?v=10', '/app.js?v=10', '/logo.svg', '/favicon.svg', '/favicon.ico', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest',
  '/fonts/figtree-latin-400-normal.woff2', '/fonts/figtree-latin-600-normal.woff2', '/fonts/figtree-latin-700-normal.woff2',
  '/fonts/bricolage-grotesque-latin-500-normal.woff2', '/fonts/bricolage-grotesque-latin-700-normal.woff2', '/fonts/bricolage-grotesque-latin-800-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r) })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v) }, e => { clearTimeout(t); no(e) }) });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try { const n = await timeout(fetch(r), 4000); if (n.ok) c.put('/', n.clone()); return n }
      catch (err) { return (await c.match('/')) || new Response('<!doctype html><meta name=viewport content="width=device-width"><body style="font:16px system-ui;padding:40px;text-align:center"><b>You are offline</b><p>Open Gully Live once with internet and it will work offline after that.</p>', { status: 503, headers: { 'Content-Type': 'text/html' } }) }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(V), hit = (await c.match(r)) || (await c.match(r, { ignoreSearch: true }));
    const net = fetch(r).then(n => { if (n.ok) c.put(r, n.clone()); return n }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit }
    return (await net) || new Response('', { status: 504 });
  })());
});
