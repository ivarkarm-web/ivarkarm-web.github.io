/**
 * Pionier service worker
 * CACHE_VERSION and SHELL query stamps MUST match index.html / pionier-app.js.
 * Bump CACHE_VERSION on every deploy that changes shell assets.
 *
 * Strategy:
 *  - HTML / navigations: network-first (fallback to cache offline)
 *  - Versioned shell assets (?v=): network-first when online, cache fallback
 *  - Other same-origin GET: cache-first, then network
 */
const CACHE_VERSION = 'pionier-v80';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './pionier.css?v=151',
  './screenshot-ui.css?v=10',
  './atelier.css?v=10',
  './looper.css?v=208',
  './scale-menu.css?v=9',
  './ui-stability.css?v=5',
  './topbar-narrow.css?v=6',
  './js/skin-palette.js?v=2',
  './js/overlay-controller.js?v=10',
  './js/layout-boot.js?v=100',
  './js/boot-fix.js?v=1',
  './js/ui-extras.js?v=5',
  './js/filter-bridge.js?v=1',
  './pionier-app.js?v=220',
  './registerSW.js',
  './js/fx.js',
  './js/pionier-surface.js?v=160',
  './js/pad-layout.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res && res.ok) await cache.put(url, res);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isDocumentRequest(req, url) {
  if (req.mode === 'navigate') return true;
  if (req.destination === 'document') return true;
  const path = url.pathname;
  return path.endsWith('.html') || path.endsWith('/') || path.endsWith('/handpan-app');
}

function isVersionedAsset(url) {
  return url.searchParams.has('v');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isDocumentRequest(req, url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, res.clone());
        return res;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }

  if (isVersionedAsset(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch (_) {
        return (await caches.match(req)) || fetch(req);
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
