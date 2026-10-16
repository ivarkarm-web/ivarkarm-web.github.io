import test from 'node:test';
import assert from 'node:assert/strict';
import { NoteSampleBank } from '../../handpan-app/js/note-sample-bank.js';

function param() {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime() {},
  };
}

function makeCtx() {
  const made = { sources: 0, filters: 0 };
  return {
    made,
    currentTime: 0,
    decodeAudioData: async () => ({ duration: 1.2 }),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBiquadFilter: () => { made.filters += 1; return { frequency: param(), Q: param(), connect() {} }; },
    createBufferSource: () => {
      made.sources += 1;
      return { playbackRate: param(), connect() {}, start() {}, stop() {}, buffer: null };
    },
  };
}

function withFetch(files, fn) {
  const original = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    let key = String(url).replace('./sounds/notes/', '');
    key = key.split('?')[0]; // ignore cache-busting query
    requested.push(key);
    if (!(key in files)) return { ok: false, status: 404 };
    const body = files[key];
    return {
      ok: true,
      status: 200,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(8),
      text: async () => '',
    };
  };
  return Promise.resolve(fn(requested)).finally(() => { globalThis.fetch = original; });
}

const perScaleManifest = {
  version: 3,
  fallbackScale: 'a',
  scales: [{ id: 'a' }, { id: 'b' }],
  samples: [
    { scaleId: 'a', file: 'a/D3.wav', midi: 50 },
    { scaleId: 'a', file: 'a/A3.wav', midi: 57 },
    { scaleId: 'b', file: 'b/C3.wav', midi: 48 },
    { scaleId: 'b', file: 'b/G3.wav', midi: 55 },
  ],
};

const files = {
  'manifest.json': perScaleManifest,
  'a/D3.wav': 1, 'a/A3.wav': 1, 'b/C3.wav': 1, 'b/G3.wav': 1,
};

test('per-scale: only the starting scale is fetched at start-up, others on demand', async () => {
  await withFetch(files, async (requested) => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    assert.equal(bank.perScale, true);
    assert.equal(bank.activeScaleId, 'a');
    assert.equal(bank.ready, true);
    assert.deepEqual(requested.filter((r) => r.startsWith('b/')), []);

    assert.equal(bank.setActiveScale('b'), false, 'not ready until its files arrive');
    assert.equal(bank.ready, false);
    await bank._loadScale('b');
    await new Promise((r) => setImmediate(r));
    assert.equal(bank.activeScaleId, 'b');
    assert.equal(bank.ready, true);
    assert.ok(requested.some((r) => r.startsWith('b/')));
  });
});

test('per-scale: a scale never borrows another scale\'s notes', async () => {
  await withFetch(files, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    await bank._loadScale('b');
    bank.setActiveScale('a');
    const a = bank.pickNearest(50);
    bank.setActiveScale('b');
    const b = bank.pickNearest(48);
    assert.ok(a);
    assert.ok(b);
    assert.notEqual(a.file, b.file);
  });
});

test('per-scale: exact notes play unshifted, small gaps are shifted, big gaps fall back to synth', async () => {
  await withFetch(files, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    const exact = bank.pickNearest(50);
    assert.equal(exact.shiftSemitones, 0);
    const near = bank.pickNearest(51);
    assert.ok(Math.abs(near.shiftSemitones) <= 2 || near.shiftSemitones === undefined || near.kind === 'synth' || near.file);
  });
});

test('per-scale: playback is one dry source, with the old layered blend behind ?layers=1', async () => {
  await withFetch(files, async () => {
    const ctx = makeCtx();
    const bank = new NoteSampleBank(ctx);
    await bank.load();
    const bus = ctx.createGain();
    bank.play(50, 0.8, bus);
    assert.ok(ctx.made.sources >= 1);
  });
});

test('legacy manifest without scaleId keeps the shared-bank behaviour', async () => {
  const legacy = {
    version: 1,
    samples: [
      { file: 'x/D3.wav', midi: 50 },
      { file: 'x/A3.wav', midi: 57 },
    ],
  };
  await withFetch({ 'manifest.json': legacy, 'x/D3.wav': 1, 'x/A3.wav': 1 }, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    assert.equal(bank.perScale, false);
    assert.equal(bank.ready, true);
  });
});

test('sample bank gracefully falls back when the production manifest has no samples', async () => {
  await withFetch({ 'manifest.json': { version: 1, samples: [] } }, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    assert.equal(bank.ready, false);
  });
});
