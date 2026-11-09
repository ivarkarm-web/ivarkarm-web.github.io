globalThis.self = globalThis;
let installHandler = null;
let skipWaitingCalled = false;
let installPromise = null;
self.skipWaiting = () => { skipWaitingCalled = true; };

let cachesOpenCalled = false;
self.caches = {
  open: async (name) => {
    cachesOpenCalled = true;
    console.log('caches.open called with:', name);
    return { put: async (key, val) => { console.log('cache.put called:', String(key)); } };
  },
};

self.addEventListener = (type, handler) => {
  if (type === 'install') installHandler = handler;
};

await import('./handpan-app/sw.js');
console.log('installHandler set:', !!installHandler);

let fetchCount = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  fetchCount++;
  console.log('fetch #' + fetchCount + ' for:', u);
  if (u.includes('/assets/')) {
    console.log('  -> throwing for', u);
    throw new Error('Network error');
  }
  return new Response('ok', { status: 200 });
};

const event = { waitUntil: (p) => { installPromise = p; } };
installHandler(event);
try {
  await installPromise;
  console.log('installPromise resolved - NO THROW');
} catch (err) {
  console.log('installPromise rejected - THREW:', err.message);
}
console.log('skipWaitingCalled:', skipWaitingCalled);
console.log('fetchCount:', fetchCount);
console.log('cachesOpenCalled:', cachesOpenCalled);
