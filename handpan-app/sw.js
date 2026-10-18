/**
 * Pionier service worker.
 * Keep versioned shell URLs aligned with handpan-app/index.html and the
 * app's dynamic imports. Network-first for versioned assets prevents stale
 * code from surviving a deployment; CACHE_VERSION invalidates the old shell.
 */
const CACHE_VERSION = 'pionier-v84';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './pionier.css?v=151',
  './screenshot-ui.css?v=10',
  './soundscapes-shell.css?v=2',
  './legacy-hide.css?v=1',
  './topbar-narrow.css?v=6',
  './looper.css?v=209',
  './scale-menu.css?v=9',
  './atelier.css?v=10',
  './ui-stability.css?v=5',
  './desktop-reference.css?v=4',
  './js/skin-palette.js?v=2',
  './js/overlay-controller.js?v=14',
  './js/layout-boot.js?v=100',
  './js/boot-fix.js?v=1',
  './js/ui-extras.js?v=5',
  './js/filter-bridge.js?v=1',
  './pionier-app.js?v=224',
  './pionier-core.js?v=60',
  './js/soundscapes.js?v=10',
  './js/instruments/arp-family.js?v=3',
  './js/instruments/handpan.js?v=11',
  './js/note-plus.js?v=3',
  './js/looper.js?v=213',
  './js/scale-selector.js?v=7',
  './js/pionier-surface.js?v=142',
  './js/fx.js',
  './js/pad-layout.js',
  './registerSW.js',
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
        if (res && res.ok) await cache.put(req, res.clone());
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
          await cache.put(req, res.clone());
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
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
