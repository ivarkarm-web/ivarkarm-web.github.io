/**
 * Pionier service worker — cache-first for app shell and note samples.
 * Version bump CACHE_VERSION to invalidate.
 */
const CACHE_VERSION = 'pionier-v1';
const SHELL = [
  './',
  './index.html',
  './pionier.css',
  './pionier-app.js',
  './pionier-core.js',
  './js/audio-core.js',
  './js/instrument.js',
  './js/gesture.js',
  './js/fx.js',
  './js/pionier-surface.js',
  './js/layout-boot.js',
  './js/settings-panel.js',
  './js/note-sample-bank.js',
  './js/instruments/handpan.js',
  './js/instruments/library-family.js',
  './sounds/notes/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations so deploys are picked up; fall back to cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for same-origin static assets (JS/CSS/audio/manifest).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
