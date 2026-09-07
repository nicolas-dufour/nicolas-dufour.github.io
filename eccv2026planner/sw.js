/* Build placeholders are replaced by build/pwa.ts. No cross-origin responses are cached. */
const VERSION = "d5d189d1ad4e4435";
const FILES = ["assets/index-C9odMMNU.js","assets/index-Dk-nUMyQ.css","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
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
