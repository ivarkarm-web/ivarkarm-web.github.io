/**
 * Pionier service worker
 * CACHE_VERSION and SHELL query stamps must match index.html / pionier-app.js.
 * Bump CACHE_VERSION on every deploy that changes shell assets.
 */
const CACHE_VERSION = 'pionier-v15';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './pionier.css?v=131',
  './atelier.css?v=10',
  './ui-layout-extras.css?v=41',
  './looper.css?v=204',
  './scale-menu.css?v=5',
  './settings-panel.css?v=10',
  './topbar-narrow.css?v=6',
  './js/skin-palette.js?v=1',
  './js/customization-catalog.js?v=5',
  './js/overlay-controller.js?v=3',
  './js/layout-boot.js?v=58',
  './js/settings-panel.js?v=13',
  './js/ambient-fx.js?v=12',
  './js/skin-mandala.js?v=4',
  './pionier-app.js?v=174',
  './registerSW.js',
  './pionier-core.js?v=28',
  './js/audio-core.js',
  './js/instrument.js',
  './js/gesture.js',
  './js/fx.js',
  './js/pionier-surface.js',
  './js/note-sample-bank.js',
  './js/soundscapes.js?v=7',
  './js/scale-selector.js?v=3',
  './js/looper.js?v=206',
  './js/instruments/handpan.js',
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
