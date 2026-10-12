import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKDROP_TRACKS, createLoopingNoiseBuffer } from '../../handpan-app/js/backdrop-player.js';

class FakeNode {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.connections = [];
    this.gain = { value: 1 };
    this.frequency = { value: 440 };
    this.offset = { value: 0 };
    this.Q = { value: 1 };
    this.type = 'sine';
    this.loop = false;
    this.startCalls = 0;
    this.stopCalls = 0;
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start() { this.startCalls++; }
  stop() { this.stopCalls++; }
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.nodes = [];
  }
  node(kind) {
    const node = new FakeNode(this, kind);
    this.nodes.push(node);
    return node;
  }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('oscillator'); }
  createBufferSource() { return this.node('buffer-source'); }
  createBiquadFilter() { return this.node('filter'); }
  createConstantSource() { return this.node('constant-source'); }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (channel) => data[channel] };
  }
}

test('procedural ambience includes rain, storm, forest wind, and ocean beds', () => {
  const labels = BACKDROP_TRACKS.map((track) => track.label);
  assert.ok(labels.includes('Soft Rain'));
  assert.ok(labels.includes('Storm Front'));
  assert.ok(labels.includes('Forest Wind'));
  assert.ok(labels.includes('Ocean Shore'));
});

test('looping noise has eased boundaries and finite samples', () => {
  const ctx = new FakeAudioContext();
  const buffer = createLoopingNoiseBuffer(ctx, 2);
  const data = buffer.getChannelData(0);
  assert.equal(data.length, 16000);
  assert.equal(data[0], 0);
  assert.equal(data[data.length - 1], 0);
  assert.ok(data.every(Number.isFinite));
  assert.ok(data.some((sample) => Math.abs(sample) > 0.1));
});

test('every ambient bed builds a graph and returns a cleanup handler', () => {
  const ctx = new FakeAudioContext();
  const destination = ctx.createGain();
  for (const track of BACKDROP_TRACKS) {
    const startIndex = ctx.nodes.length;
    const stop = track.build(ctx, destination);
    assert.equal(typeof stop, 'function', track.id + ' must provide cleanup');
    const started = ctx.nodes.slice(startIndex).filter((node) => node.startCalls > 0);
    assert.ok(started.length > 0, track.id + ' must start at least one audio source');
    stop();
    assert.ok(started.every((node) => node.stopCalls > 0), track.id + ' must stop its sources');
  }
});

test('noise-based beds use looping buffer sources', () => {
  for (const id of ['rain', 'storm', 'forest-wind', 'ocean-shore']) {
    const ctx = new FakeAudioContext();
    const stop = BACKDROP_TRACKS.find((track) => track.id === id).build(ctx, ctx.createGain());
    const loops = ctx.nodes.filter((node) => node.kind === 'buffer-source' && node.loop);
    assert.ok(loops.length > 0, id + ' should loop its generated noise buffer');
    stop();
  }
});
