import test from 'node:test';
import assert from 'node:assert/strict';

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exp', value, time]); }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); }
}
class Node {
  constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.connections = []; this.gain = new Param(1); this.frequency = new Param(); this.Q = new Param(); this.type = ''; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(time) { this.startTime = time; }
  stop(time) { this.stopTime = time; }
}
class FakeContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = new Node(this, 'destination'); this.nodes = []; }
  createGain() { return this.make('gain'); }
  createBiquadFilter() { return this.make('filter'); }
  createDelay() { const node = this.make('delay'); node.delayTime = new Param(); return node; }
  createOscillator() { return this.make('oscillator'); }
  createDynamicsCompressor() {
    const n = this.make('compressor');
    for (const [key, value] of Object.entries({ threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 })) n[key] = new Param(value);
    return n;
  }
  make(kind) { const n = new Node(this, kind); this.nodes.push(n); return n; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  addEventListener() {}
}

globalThis.AudioContext = FakeContext;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { createAmbientSequenceEngine } = await import('../../handpan-app/js/ambient-sequencer-grid-engine.js?engine-test');

test('sequencer maps independent voice rows to distinct synthesized pitches and schedules transport lifecycle', async () => {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let nextTimer = 1;
  globalThis.setTimeout = (fn, ms = 0) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  try {
    const notes = Array.from({ length: 8 }, (_, i) => ({ name: 'Scale ' + i, freq: 146.832 * Math.pow(2, i / 12) }));
    // The shared audio module creates the context through this constructor.
    const engine = createAmbientSequenceEngine({ getNotes: () => notes });
    engine.toggleSync(false);
    engine.clearPattern();
    for (let row = 0; row < 4; row++) engine.toggleStep(row, 0);
    engine.toggleStep(0, 1);
    engine.cycleCell(0, 1);
    const rows = engine.snapshot().voices;
    assert.deepEqual(rows.map((row) => row.name), ['Mallet', 'Deep', 'Pluck', 'Air']);
    assert.equal(new Set(rows.map((row) => row.pattern[0]?.noteIndex)).size, 4);
    assert.deepEqual(rows.map((row) => row.pattern[0]?.noteIndex), [0, 2, 4, 6]);
    const audioModule = await import('../../handpan-app/js/audio-core.js?v=2');
    const shared = audioModule.getAudioContext();
    assert.ok(shared instanceof FakeContext);
    assert.equal(engine.start(), true);
    const fxSend = shared.nodes.find((node) => node.name === 'sequence-fx-send');
    const sequenceBus = shared.nodes.find((node) => node.name === 'pionier-ambient-sequence-grid');
    assert.ok(fxSend && sequenceBus);
    assert.equal(fxSend.gain.value, 0, 'effects send is silent by default');
    assert.ok(sequenceBus.connections.includes(audioModule.getAudioMaster()), 'dry sequence path reaches shared master');
    engine.setFxEnabled(true);
    assert.equal(fxSend.gain.value, 0.32, 'enabling effects opens only the sequence send');
    engine.setFxEnabled(false);
    assert.equal(fxSend.gain.value, 0, 'disabling effects closes only the sequence send');
    assert.ok(sequenceBus.connections.includes(audioModule.getAudioMaster()), 'dry sequence path remains intact when effects change');

    // The audio-core module owns the created context; fetch it from the bus
    // routed graph through the engine's first note oscillator records.
    const fireNext = (advance = 0.02) => {
      const due = [...timers.entries()].sort((a, b) => a[1].ms - b[1].ms)[0];
      assert.ok(due, 'one scheduler timer remains active');
      timers.delete(due[0]);
      shared.currentTime += advance;
      due[1].fn();
    };
    // Obtain context via AudioContext construction; each engine bus belongs to
    // the singleton created by the shared audio-core import.
    fireNext();
    const liveContext = engine.snapshot();
    assert.equal(liveContext.playing, true);
    // Engine uses the singleton; capture it by checking created oscillator
    // configuration from the globally retained fake context instances.
    fireNext();
    const oscillators = shared.nodes.filter((node) => node.kind === 'oscillator');
    const expectedPitches = [notes[0].freq, notes[2].freq, notes[4].freq, notes[6].freq];
    const fundamentals = expectedPitches.map((pitch) => oscillators.find((node) => node.frequency.events[0]?.[1] === pitch));
    assert.ok(fundamentals.every(Boolean), 'each row schedules its selected scale pitch');
    assert.deepEqual(fundamentals.map((node) => node.frequency.events[0][1]), expectedPitches);
    const filters = shared.nodes.filter((node) => node.kind === 'filter' && node.Q.value > 0);
    assert.ok(filters.length >= 4);
    assert.ok(new Set(filters.map((node) => node.Q.value)).size > 1, 'voice timbres use distinct filter settings');
    assert.ok(new Set(fundamentals.map((node) => node.type)).size > 1, 'voice timbres use distinct oscillator waveforms');

    const beforeBpm = shared.nodes.filter((node) => node.kind === 'oscillator').length;
    engine.setBpm(120);
    assert.equal(engine.snapshot().freeBpm, 120);
    while (shared.currentTime < 0.16) fireNext();
    const changedTempoHit = shared.nodes.find((node) => node.kind === 'oscillator' && node.frequency.events[0]?.[1] === notes[1].freq);
    assert.ok(changedTempoHit, 'next unscheduled step follows the updated free-run tempo');
    assert.ok(Math.abs(changedTempoHit.startTime - 0.165) < 0.025, 'tempo change resets only the unqueued step boundary');
    assert.ok(shared.nodes.filter((node) => node.kind === 'oscillator').length >= beforeBpm);
    engine.pause();
    assert.equal(engine.snapshot().playing, false);
    assert.equal([...timers.values()].filter((timer) => timer.ms <= 100).length, 0);
    engine.start();
    assert.equal(engine.snapshot().playing, true);
    engine.stop();
    assert.equal(engine.snapshot().playing, false);
    assert.equal([...timers.values()].filter((timer) => timer.ms <= 100).length, 0);
    const scheduledOscillators = shared.nodes.filter((node) => node.kind === 'oscillator');
    engine.destroy();
    assert.ok(scheduledOscillators.length > 0, 'test scheduled synthesized voices');
    assert.ok(scheduledOscillators.every((node) => node.connections.length === 0), 'destroy disconnects scheduled voice nodes');
    assert.equal(timers.size, 0, 'destroy clears scheduler and voice cleanup timers');
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
});
