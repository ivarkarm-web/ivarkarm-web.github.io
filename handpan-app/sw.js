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
const CACHE_VERSION = 'pionier-v72';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './pionier.css?v=144',
  './atelier.css?v=10',
  './looper.css?v=209',
  './scale-menu.css?v=7',
  './settings-panel.css?v=18',
  './ui-stability.css?v=5',
  './topbar-narrow.css?v=6',
  './js/skin-palette.js?v=1',
  './js/customization-catalog.js?v=6',
  './js/overlay-controller.js?v=10',
  './js/layout-boot.js?v=65',
  './js/settings-panel.js?v=27',
  './js/ambient-fx.js?v=12',
  './js/skin-mandala.js?v=5',
  './pionier-app.js?v=211',
  './registerSW.js',
  './pionier-core.js?v=58',
  './js/audio-core.js?v=2',
  './js/instrument.js',
  './js/gesture.js',
  './js/fx.js',
  './js/pionier-surface.js?v=141',
  './js/note-sample-bank.js',
  './js/soundscapes.js?v=8',
  './js/scale-selector.js?v=5',
  './js/looper.js?v=212',
  './js/repository-loop-save.js?v=1',
  './js/instruments/handpan.js?v=7',
  './js/instruments/handpan-scales.js?v=3',
  './js/instruments/arp-family.js',
  './js/note-plus.js?v=3',
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
  return url.search.includes('v=');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML: network-first
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

  // Versioned shell JS/CSS: network-first so deploys win over stale cache
  if (isVersionedAsset(url) && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first
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
