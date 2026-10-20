import test from 'node:test';
import assert from 'node:assert/strict';

class FakeParam {
  constructor(value = 0) { this.value = value; }
}
class FakeNode {
  constructor() { this.connections = []; this.gain = new FakeParam(1); }
  connect(target) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; }
}
class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = new FakeParam(-24);
    this.knee = new FakeParam(30);
    this.ratio = new FakeParam(12);
    this.attack = new FakeParam(0.003);
    this.release = new FakeParam(0.25);
  }
}
class FakeContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 48000;
    this.destination = new FakeNode();
    this.created = [];
  }
  createGain() { const n = new FakeNode(); this.created.push(n); return n; }
  createDynamicsCompressor() { const n = new FakeCompressor(); this.created.push(n); return n; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  addEventListener() {}
}

globalThis.AudioContext = FakeContext;
globalThis.window = globalThis;

const {
  getAudioContext, getAudioMaster, createBus, resumeAudio, suspendAudio, closeAudio, audioState, audioHealth
} = await import('../../handpan-app/js/audio-core.js');

test('shared audio core creates one reusable AudioContext', async () => {
  await closeAudio();
  const a = getAudioContext();
  const b = getAudioContext();
  assert.equal(a, b);
  assert.equal(audioState(), 'running');
});

test('audio buses route into the shared master graph', async () => {
  await closeAudio();
  const ctx = getAudioContext();
  const master = getAudioMaster();
  const bus = createBus('test', 0.5);
  assert.ok(bus);
  assert.equal(bus.gain.value, 0.5);
  assert.ok(bus.connections.includes(master));
  assert.ok(master.connections.length >= 1);
});

test('audio lifecycle can suspend, resume and recreate after close', async () => {
  await closeAudio();
  const first = getAudioContext();
  await suspendAudio();
  assert.equal(audioState(), 'suspended');
  await resumeAudio();
  assert.equal(audioState(), 'running');
  await closeAudio();
  assert.equal(audioState(), 'uninitialized');
  const second = getAudioContext();
  assert.notEqual(first, second);
});

test('audioHealth reports availability and state', async () => {
  await closeAudio();
  getAudioContext();
  const h = audioHealth();
  assert.equal(h.available, true);
  assert.equal(h.hasContext, true);
  assert.equal(h.state, 'running');
  assert.equal(h.sampleRate, 48000);
});
