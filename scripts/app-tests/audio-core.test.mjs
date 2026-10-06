import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor() {
    this.connections = [];
    this.gain = { value: 1 };
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 0 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
  }
  connect(node) { this.connections.push(node); return node; }
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = new FakeNode();
  }
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

globalThis.window = { AudioContext: FakeAudioContext };
const audio = await import('../../handpan-app/js/audio-core.js');

test('shared audio core creates one reusable AudioContext', () => {
  const first = audio.getAudioContext();
  const second = audio.getAudioContext();
  assert.ok(first instanceof FakeAudioContext);
  assert.strictEqual(first, second);
});

test('audio buses route into the shared master graph', () => {
  const bus = audio.createBus('test', 0.25);
  assert.equal(bus.gain.value, 0.25);
  assert.equal(bus.connections.length, 1);
  assert.equal(audio.getAudioMaster().connections.length, 1);
});

test('audio lifecycle can suspend, resume and recreate after close', async () => {
  await audio.resumeAudio();
  assert.equal(audio.audioState(), 'running');
  await audio.suspendAudio();
  assert.equal(audio.audioState(), 'suspended');
  await audio.closeAudio();
  assert.equal(audio.audioState(), 'uninitialized');
  const recreated = audio.getAudioContext();
  assert.notEqual(recreated, null);
});
