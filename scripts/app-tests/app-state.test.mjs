import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage polyfill for Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); }
};
globalThis.window = globalThis;

const {
  loadAppState,
  getAppState,
  patchAppState,
  resetAppState,
  subscribeAppState
} = await import('../../handpan-app/js/app-state.js');

test('app-state defaults and patch round-trip', () => {
  resetAppState();
  const base = getAppState();
  assert.equal(base.instrumentId, 'handpan');
  assert.equal(base.noteCount, 9);
  patchAppState({ instrumentId: 'kalimba', noteCount: 11, scaleIndex: 2 });
  const next = getAppState();
  assert.equal(next.instrumentId, 'kalimba');
  assert.equal(next.noteCount, 11);
  assert.equal(next.scaleIndex, 2);
  // Nested ambient merge
  patchAppState({ ambient: { volume: 0.4 } });
  assert.equal(getAppState().ambient.volume, 0.4);
  assert.equal(getAppState().ambient.playing, false);
});

test('app-state persists and reloads', () => {
  resetAppState();
  patchAppState({ instrumentId: 'tongue', rootIndex: 5 });
  const loaded = loadAppState();
  assert.equal(loaded.instrumentId, 'tongue');
  assert.equal(loaded.rootIndex, 5);
});

test('app-state subscribers fire on patch', () => {
  resetAppState();
  let calls = 0;
  let last = null;
  const unsub = subscribeAppState((s) => { calls++; last = s; });
  patchAppState({ scaleIndex: 3 });
  assert.equal(calls, 1);
  assert.equal(last.scaleIndex, 3);
  unsub();
  patchAppState({ scaleIndex: 4 });
  assert.equal(calls, 1);
});
