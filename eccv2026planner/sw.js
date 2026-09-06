/* Build placeholders are replaced by build/pwa.ts. No cross-origin responses are cached. */
const VERSION = "c511fe7f744712ff";
const FILES = ["assets/index-BaD8m839.js","assets/index-CKG5ny0B.css","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
const SCOPE = self.registration.scope;
const PREFIX = 'eccv-planner-' + new URL(SCOPE).pathname + '-';
const CACHE = PREFIX + VERSION;
const SHELL = new URL('index.html', SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(file => new Request(new URL(file, SCOPE), { cache: 'reload' })));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  const isShell = request.mode === 'navigate' && (url.pathname === new URL(SCOPE).pathname || url.pathname === new URL(SHELL).pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isShell ? SHELL : request);
    return cached || fetch(request);
  })());
});

function notificationUrl(value) {
  try { if (typeof value === 'string') { const url = new URL(value, SCOPE); if (url.origin === self.location.origin && url.href.startsWith(SCOPE)) return url.href; } } catch {}
  return new URL('#/agenda', SCOPE).href;
}
self.addEventListener('push', event => {
  // Every push must display a notification, including malformed payloads (required by iOS).
  let data = {}; try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(typeof data.title === 'string' ? data.title.slice(0, 512) : 'ECCV 2026 reminder', {
    body: typeof data.body === 'string' ? data.body.slice(0, 512) : 'Open your agenda to see your saved sessions.',
    icon: new URL('icons/icon-192.png', SCOPE).href,
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 200) : 'eccv-reminder',
    renotify: false,
    data: { url: notificationUrl(data.url) },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = notificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(SCOPE));
    if (existing) { const client = await existing.navigate(url); if (client) { await client.focus(); return; } }
    await self.clients.openWindow(url);
  })());
});
