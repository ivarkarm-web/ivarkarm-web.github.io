/**
 * Pionier service worker
 * - HTML always network-first (never serve stale index after deploy)
 * - Old caches deleted on activate
 * - CACHE_VERSION must bump with each intentional deploy
 */
const CACHE_VERSION = 'pionier-v3';

self.addEventListener('install', (event) => {
  // Do not precache a brittle shell list here — install always succeeds.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isDocumentRequest(req, url) {
  if (req.mode === 'navigate') return true;
  if (req.destination === 'document') return true;
  const path = url.pathname;
  return path.endsWith('.html') || path.endsWith('/') || path.endsWith('/handpan-app');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML / navigations: network-first, never block on a failed cache match.
  if (isDocumentRequest(req, url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin assets: cache-first, then network.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
