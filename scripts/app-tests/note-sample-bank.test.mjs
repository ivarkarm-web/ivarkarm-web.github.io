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
    const key = String(url).replace('./sounds/notes/', '');
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
    assert.deepEqual([...bank.byMidi.keys()].sort((x, y) => x - y), [48, 55]);
  });
});

test('per-scale: a scale never borrows another scale\'s notes', async () => {
  await withFetch(files, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    assert.equal(bank.setActiveScale('does-not-exist'), false);
    assert.equal(bank.ready, false);
    assert.equal(bank.resolve(50), null);
  });
});

test('per-scale: exact notes play unshifted, small gaps are shifted, big gaps fall back to synth', async () => {
  await withFetch(files, async () => {
    const bank = new NoteSampleBank(makeCtx());
    await bank.load();
    assert.equal(bank.resolve(50).rate, 1);
    const near = bank.resolve(52);
    assert.equal(near.sourceMidi, 50);
    assert.ok(Math.abs(near.rate - Math.pow(2, 2 / 12)) < 1e-9);
    assert.equal(bank.resolve(62), null, '5 semitones from the nearest sample is too far');
  });
});

test('per-scale: playback is one dry source, with the old layered blend behind ?layers=1', async () => {
  await withFetch(files, async () => {
    const ctx = makeCtx();
    const bank = new NoteSampleBank(ctx);
    await bank.load();
    const voice = bank.play(50, { connect() {} }, 0, { vel: 0.8, radial: 0.3 });
    assert.ok(voice && typeof voice.stop === 'function');
    assert.equal(ctx.made.sources, 1);
    assert.equal(ctx.made.filters, 0);
    assert.ok(voice.nodes.some((n) => n && n.playbackRate && typeof n.start === 'function'));

    bank.layered = true;
    bank.play(50, { connect() {} }, 0, { vel: 0.8, radial: 0.3 });
    assert.equal(ctx.made.sources, 1 + 3);
    assert.equal(ctx.made.filters, 3);
  });
});

test('legacy manifest without scaleId keeps the shared-bank behaviour', async () => {
  const legacy = {
    version: 2,
    scales: [{ id: 'x', rootMidi: 50 }, { id: 'y', rootMidi: 48 }],
    samples: [{ file: 'owner-notes-9/D3.wav', midi: 50 }, { file: 'owner-notes-9/A3.wav', midi: 57 }],
  };
  await withFetch(
    { 'manifest.json': legacy, 'owner-notes-9/D3.wav': 1, 'owner-notes-9/A3.wav': 1 },
    async () => {
      const bank = new NoteSampleBank(makeCtx());
      await bank.load();
      assert.equal(bank.perScale, false);
      assert.equal(bank.ready, true);
      assert.equal(bank.setActiveScale('y'), true);
      assert.equal(bank.resolve(50).rate, 1);
      assert.ok(bank.resolve(60), 'legacy mode still stretches up to 12 semitones');
    }
  );
});
