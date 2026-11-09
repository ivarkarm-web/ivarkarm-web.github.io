import test from 'node:test';
import assert from 'node:assert/strict';

class Param {
  constructor(value = 0) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
}
class Node {
  constructor(context, kind) {
    this.context = context; this.kind = kind; this.connections = [];
    this.gain = new Param(1); this.frequency = new Param(); this.Q = new Param();
    this.delayTime = new Param(); this.pan = new Param();
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect(node) { this.connections = node ? this.connections.filter((target) => target !== node) : []; }
  start() {}
  stop() {}
}
class FakeContext {
  constructor() { FakeContext.created += 1; this.state = 'running'; this.currentTime = 0; this.destination = new Node(this, 'destination'); this.nodes = []; this.listeners = {}; this.resumeCalls = 0; }
  make(kind) { const node = new Node(this, kind); this.nodes.push(node); return node; }
  createGain() { return this.make('gain'); }
  createDynamicsCompressor() {
    const node = this.make('compressor');
    for (const [key, value] of Object.entries({ threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 })) node[key] = new Param(value);
    return node;
  }
  createBiquadFilter() { return this.make('filter'); }
  createDelay() { return this.make('delay'); }
  createOscillator() { return this.make('oscillator'); }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}
FakeContext.created = 0;
globalThis.AudioContext = FakeContext;
globalThis.window = globalThis;

const core = await import('../../handpan-app/js/audio-core.js?routing-test');
const { FxChain } = await import('../../handpan-app/js/fx.js');

test('instrument FX are isolated from sequencer and looper buses on the shared master', async () => {
  await core.closeAudio();
  const context = core.getAudioContext();
  const master = core.getAudioMaster();
  const instrumentBus = context.createGain();
  const fx = new FxChain(context, master);
  fx.add('filter');
  fx.add('delay');
  instrumentBus.connect(fx.input);
  const sequencerBus = core.createBus('sequencer', 0.82);
  const looperBus = core.createBus('looper', 0.7);

  assert.equal(core.getAudioContext(), context);
  assert.ok(instrumentBus.connections.includes(fx.input));
  assert.ok(fx.master.connections.includes(master));
  assert.ok(sequencerBus.connections.includes(master));
  assert.ok(looperBus.connections.includes(master));
  assert.ok(!sequencerBus.connections.includes(fx.input));
  assert.ok(!looperBus.connections.includes(fx.input));
  assert.ok(!master.connections.includes(context.destination), 'only the shared compressor reaches the destination');

  fx.setBypass('filter', true);
  assert.ok(sequencerBus.connections.includes(master), 'changing an instrument FX module leaves the sequencer route intact');
  assert.ok(looperBus.connections.includes(master), 'changing an instrument FX module leaves the looper route intact');
  fx.dispose();
  await core.closeAudio();
});

test('shared master trims concurrent sources before its final compressor', async () => {
  await core.closeAudio();
  const context = core.getAudioContext();
  const master = core.getAudioMaster();
  const compressor = context.nodes.find((node) => node.kind === 'compressor');
  assert.ok(master.connections.includes(compressor));
  assert.ok(compressor.connections.includes(context.destination));
  assert.equal(master.gain.value, 0.85);
  assert.equal(compressor.threshold.value, -12);
  assert.equal(compressor.ratio.value, 2);
  assert.ok(master.gain.value < 1, 'shared pre-compressor trim leaves headroom for overlapping sources');
  await core.closeAudio();
});

test('shared master gain changes are observable for direct HTML media playback', async () => {
  await core.closeAudio();
  const context = core.getAudioContext();
  const observed = [];
  globalThis.addEventListener = (name, handler) => { if (name === 'pionier-master-gain') globalThis._masterGainHandler = handler; };
  globalThis.dispatchEvent = (event) => { observed.push(event.detail.gain); globalThis._masterGainHandler?.(event); };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  assert.equal(core.setMasterGain(0.6), 0.6);
  assert.equal(core.getAudioMaster().gain.value, 0.6);
  assert.deepEqual(observed, [0.6]);
  assert.equal(core.setMasterGain(4), 1, 'master gain is bounded to preserve output headroom');
  await core.closeAudio();
});

test('lifecycle events do not create audio or resume a context without prior playback', async () => {
  const documentListeners = {};
  const windowListeners = {};
  globalThis.document = { hidden: false, addEventListener: (name, fn) => { documentListeners[name] = fn; } };
  globalThis.addEventListener = (name, fn) => { windowListeners[name] = fn; };
  const lifecycle = await import('../../handpan-app/js/audio-core.js?lifecycle-test');
  const beforeEvents = FakeContext.created;
  windowListeners.focus();
  windowListeners.pageshow();
  documentListeners.visibilitychange();
  assert.equal(FakeContext.created, beforeEvents, 'focus and visibility do not allocate or start audio');

  const context = lifecycle.getAudioContext();
  const created = FakeContext.created;
  context.state = 'interrupted';
  context.listeners.statechange();
  context.state = 'suspended';
  context.listeners.statechange();
  assert.equal(context.resumeCalls, 1, 'a context that was active before interruption resumes once');
  assert.equal(FakeContext.created, created, 'interruption recovery reuses the existing AudioContext');
  await lifecycle.closeAudio();
  delete globalThis.document;
});

