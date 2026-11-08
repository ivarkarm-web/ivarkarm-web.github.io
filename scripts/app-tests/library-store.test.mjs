import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  saveComposition,
  listCompositions,
  getComposition,
  renameComposition,
  deleteComposition,
  createWav,
  openLibraryDB,
} from '../../handpan-app/js/library-store.js';

function fakeIndexedDB({ failOpen = null, quota = false } = {}) {
  const records = new Map();
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    createObjectStore() {
      return { createIndex() {} };
    },
    transaction(_name, mode) {
      const tx = {
        error: null,
        objectStore() {
          return {
            put(value) {
              return request(() => {
                if (quota && mode === 'readwrite') {
                  throw Object.assign(new Error('Storage quota exceeded'), {
                    name: 'QuotaExceededError',
                  });
                }
                records.set(value.id, structuredClone(value));
                return value.id;
              }, tx);
            },
            get(id) {
              return request(() => structuredClone(records.get(id)), tx);
            },
            getAll() {
              return request(
                () => [...records.values()].map((value) => structuredClone(value)),
                tx
              );
            },
            delete(id) {
              return request(() => records.delete(id), tx);
            },
          };
        },
      };
      return tx;
    },
  };
  function request(run, tx) {
    const req = {};
    setTimeout(() => {
      try {
        req.result = run();
        req.onsuccess?.();
        setTimeout(() => tx.oncomplete?.(), 0);
      } catch (error) {
        req.error = error;
        tx.error = error;
        req.onerror?.();
        tx.onabort?.();
      }
    }, 0);
    return req;
  }
  return {
    records,
    open() {
      if (failOpen) {
        throw failOpen;
      }
      const req = {};
      setTimeout(() => {
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

const sampleRecord = (id, value = 0.25) => ({
  id,
  name: `Composition ${id}`,
  createdAt: Date.now(),
  duration: 1,
  sampleRate: 8000,
  settings: { instrumentId: 'handpan', scaleIndex: 2, rootIndex: 1 },
  timing: { bpm: 92 },
  layers: [
    {
      sampleRate: 8000,
      channels: [new Float32Array([value, -value]), new Float32Array([value, -value])],
      offset: 0,
      level: 1,
      pan: 0,
      muted: false,
      solo: false,
    },
  ],
});

test('IndexedDB composition CRUD preserves samples and independent recordings across reload reads', async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = fakeIndexedDB();
  try {
    await saveComposition(sampleRecord('one'));
    await saveComposition(sampleRecord('two', 0.5));
    const list = await listCompositions();
    assert.equal(list.length, 2);
    assert.equal((await getComposition('one')).layers[0].channels[0][0], 0.25);
    await renameComposition('one', 'Night study');
    assert.equal((await getComposition('one')).name, 'Night study');
    await deleteComposition('one');
    assert.equal(await getComposition('one'), undefined);
    assert.equal((await listCompositions()).length, 1);
    assert.equal((await getComposition('two')).layers[0].channels[0][0], 0.5);
  } finally {
    globalThis.indexedDB = original;
  }
});

test('WAV export includes a valid header and retrieved audio samples', async () => {
  const record = sampleRecord('wav');
  const blob = createWav(record),
    bytes = new DataView(await blob.arrayBuffer());
  assert.equal(blob.type, 'audio/wav');
  assert.equal(
    String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)),
    'RIFF'
  );
  assert.equal(
    String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()).slice(8, 12)),
    'WAVE'
  );
  assert.equal(bytes.getUint16(22, true), 2);
  assert.ok(bytes.getInt16(44, true) > 0);
});

test('WAV export resamples mixed layer rates and rejects files beyond RIFF size limit', async () => {
  const record = sampleRecord('resample');
  record.layers.push({
    sampleRate: 16000,
    channels: [new Float32Array([0.5, 0.5, 0.5, 0.5]), new Float32Array([0.5, 0.5, 0.5, 0.5])],
    offset: 0,
    level: 1,
  });
  const wav = new DataView(await createWav(record).arrayBuffer());
  assert.equal(wav.getUint32(24, true), 8000);
  assert.equal(wav.getUint32(40, true), 2 * 4);
  assert.ok(wav.getInt16(44, true) > Math.round(0.25 * 32767));
  const tooLarge = {
    layers: [{ sampleRate: 44100, channels: [{ length: 1_073_741_824 }], offset: 0 }],
  };
  assert.throws(() => createWav(tooLarge), /too large for WAV export.*4 GB limit/i);
});

test('blocked IndexedDB open closes a connection that succeeds after rejection', async () => {
  let closed = 0;
  const factory = {
    open() {
      const request = {};
      setTimeout(() => request.onblocked?.(), 0);
      setTimeout(() => {
        request.result = {
          close() {
            closed++;
          },
        };
        request.onsuccess?.();
      }, 10);
      return request;
    },
  };
  await assert.rejects(openLibraryDB(factory), /Close other Pionier tabs/);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(closed, 1);
});

test('library playback and modal retain lifecycle, focus, storage and shared-audio safeguards', async () => {
  const source = await readFile(
    new URL('../../handpan-app/js/library.js', import.meta.url),
    'utf8'
  );
  assert.match(source, /playbackId === thisPlayback && source === active/);
  assert.match(source, /old\.onended = null/);
  assert.match(source, /active\.disconnect\(\)/);
  assert.match(source, /node\.inert = true/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /restoreFocus\.focus/);
  assert.match(source, /getAudioMaster\(\)/);
  assert.match(source, /getAudioContext\(\)/);
  assert.match(source, /Persistent storage granted/);
  assert.match(source, /Persistent storage unavailable/);
});

test('database open and quota failures reject instead of silently losing compositions', async () => {
  const original = globalThis.indexedDB;
  try {
    globalThis.indexedDB = fakeIndexedDB({ failOpen: new Error('database unavailable') });
    await assert.rejects(saveComposition(sampleRecord('fail')), /database unavailable/);
    globalThis.indexedDB = fakeIndexedDB({ quota: true });
    await assert.rejects(
      saveComposition(sampleRecord('quota')),
      (error) => error.name === 'QuotaExceededError'
    );
  } finally {
    globalThis.indexedDB = original;
  }
});
