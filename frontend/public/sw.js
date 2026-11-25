/**
 * Ikibondo service worker.
 *
 * - Only same-origin GET requests are handled. API calls (another origin) and all
 *   writes pass straight through, so health data is never stored by the worker and
 *   requests can't be held up by it.
 * - Hashed Next.js assets (/_next/static) are immutable: cache-first.
 * - Page navigations are network-first. The field-workflow pages are kept so a
 *   health worker can open them with no signal; anything else falls back to offline.html.
 * - On logout the app posts { type: 'LOGOUT' } and every cache is deleted.
 */
const CACHE = 'ikibondo-v2';
const OFFLINE_URL = '/offline.html';

// Pages that must open offline. Their HTML is an app shell; records are fetched client-side.
const OFFLINE_PAGES = ['/chw', '/chw/visit', '/chw/sync', '/chw/today', '/nurse/vaccines/session'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }

  if (request.mode === 'navigate') {
    const keep = OFFLINE_PAGES.includes(url.pathname.replace(/\/$/, ''));
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (keep && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (keep && (await caches.match(url.pathname))) || caches.match(OFFLINE_URL))
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LOGOUT') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
  // After sign-in: save the field pages now, so they open in the field even if the
  // health worker never visited them while online. Pages the role can't open redirect
  // and are skipped.
  if (event.data && event.data.type === 'WARM') {
    event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(OFFLINE_PAGES.map(async (page) => {
      try {
        const res = await fetch(page, { credentials: 'same-origin' });
        if (!res.ok || res.redirected) return;
        const html = await res.clone().text();
        await cache.put(page, res);
        // The page also needs its own script and style chunks to run offline
        const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
        await Promise.all([...assets].map(async (asset) => {
          if (await cache.match(asset)) return;
          const a = await fetch(asset);
          if (a.ok) await cache.put(asset, a);
        }));
      } catch {
        // Offline or the page failed: try again on the next sign-in
      }
    }))));
  }
});
