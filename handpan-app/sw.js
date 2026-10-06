const CACHE = 'handpan-app-v1';
const CORE = [
  './',
  './index.html',
  './handpan.css',
  './app.css',
  './manifest.json',
  './js/handpan.js',
  './js/audio-core.js',
  './js/voice-presets.js',
  './js/sample-bank.js',
  './js/loop-core.js',
  './js/loop.js',
  './js/learn-core.js',
  './js/lessons.js',
  './js/learn.js',
  './js/wav-export.js',
  './js/storage.js',
  './js/ambient.js',
  './js/transport.js',
  './js/app-shell.js',
  './fonts/Fraunces[SOFT,WONK,opsz,wght].ttf',
  './fonts/Inter[opsz,wght].ttf',
  './icons/handpan-mark.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './sounds/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(self.registration.scope.replace(url.origin, ''))) return;
  if (url.pathname.includes('/sounds/fixtures/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
