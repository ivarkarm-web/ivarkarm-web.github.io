import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit test for the service worker install handler logic.
 * Verifies that if any SHELL asset fetch fails, the install rejects
 * and skipWaiting() is NOT called, so the old SW keeps serving.
 */

// Mock browser service worker environment BEFORE importing sw.js
globalThis.self = globalThis;

let installHandler = null;
let skipWaitingCalled = false;
self.skipWaiting = () => { skipWaitingCalled = true; };

self.caches = {
  open: async () => ({
    put: async () => {},
  }),
};

self.addEventListener = (type, handler) => {
  if (type === 'install') installHandler = handler;
};

// Import sw.js — top-level code registers the install handler with our mocks
await import('../../handpan-app/sw.js');

async function runInstall(fetchImpl) {
  skipWaitingCalled = false;
  let installPromise = null;

  const event = {
    waitUntil: (promise) => {
      installPromise = promise;
    },
  };

  // Trigger the install handler (registers waitUntil, returns immediately)
  installHandler(event);

  let threw = null;
  try {
    await installPromise;
  } catch (err) {
    threw = err;
  }

  return { threw, skipWaitingCalled };
}

test('sw install throws and does not skipWaiting when any shell asset fetch fails', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('looper.js')) {
      throw new Error('Network error: asset unreachable');
    }
    return new Response('ok', { status: 200 });
  };

  const { threw, skipWaitingCalled } = await runInstall(globalThis.fetch);

  assert.ok(threw, 'expected install to throw');
  assert.match(String(threw), /SW install failed/);
  assert.equal(skipWaitingCalled, false);
});

test('sw install calls skipWaiting when all shell asset fetches succeed', async () => {
  globalThis.fetch = async (url) => new Response('ok', { status: 200 });

  const { threw, skipWaitingCalled } = await runInstall(globalThis.fetch);

  assert.equal(threw, null);
  assert.equal(skipWaitingCalled, true);
});

test('sw install treats non-ok responses (e.g. 404) as failures', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('looper.js')) {
      return new Response('not found', { status: 404 });
    }
    return new Response('ok', { status: 200 });
  };

  const { threw, skipWaitingCalled } = await runInstall(globalThis.fetch);

  assert.ok(threw, 'expected install to throw');
  assert.match(String(threw), /SW install failed/);
  assert.equal(skipWaitingCalled, false);
});
