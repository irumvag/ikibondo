/**
 * Ikibondo Service Worker — cache-first for static, network-first for API.
 */
const CACHE_NAME = 'ikibondo-v1';
const API_PREFIX = '/api/v1/';

// Static assets to pre-cache on install
const PRECACHE_URLS = ['/', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GETs
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Cache-first for everything else (Next.js static)
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'ikibondo-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) =>
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }))
      )
    );
  }
});
