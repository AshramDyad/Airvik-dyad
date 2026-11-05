/* Scanner-only cache. API requests and validation results are never cached. */
const CACHE = 'bhojan-scanner-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/bhojan/scan', '/bhojan/icon-180.png', '/bhojan/icon-192.png', '/bhojan/icon-512.png', '/bhojan/manifest.webmanifest'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bhojan-scanner-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_ASSETS' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(value => typeof value === 'string').map(value => new URL(value, self.location.origin)).filter(url => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'));
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(urls.map(url => cache.add(url.href).catch(() => undefined)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/bhojan/scan' && event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/bhojan/scan', copy))); }
      return response;
    }).catch(() => caches.match('/bhojan/scan')));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/bhojan/icon')) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    })));
  }
});
