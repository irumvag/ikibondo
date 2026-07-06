/**
 * Ikibondo Service Worker — cache-first for static, network-first for API.
 * Security: sensitive health-data API paths are never cached. On logout the
 * entire cache is cleared via a postMessage({ type: 'LOGOUT' }) from the app.
 */
const CACHE_NAME = 'ikibondo-v1';
const API_PREFIX = '/api/v1/';

// Paths that must NEVER be stored in the cache — they contain patient/family PII.
// Any user-specific health data could otherwise leak to the next person on a shared device.
const SENSITIVE_API_PATHS = [
  '/api/v1/children',
  '/api/v1/health-records',
  '/api/v1/vaccinations',
  '/api/v1/guardians',
  '/api/v1/notifications',
  '/api/v1/ml',
  '/api/v1/referrals',
  '/api/v1/consultations',
  '/api/v1/auth',
];

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
          // Cache successful GETs — but never cache sensitive health/auth data
          if (request.method === 'GET' && response.ok) {
            const isSensitive = SENSITIVE_API_PATHS.some((p) => url.pathname.startsWith(p));
            if (!isSensitive) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
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

// Logout — clear entire cache so the next user on a shared device cannot access
// the previous user's cached health records or family data.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LOGOUT') {
    caches.delete(CACHE_NAME);
  }
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
