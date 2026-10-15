/**
 * generative-ambient.js — Web Audio ambient beds (rain/storm/forest/wind).
 * No external files required. Routes through a dedicated bus into the master.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

let natureBus = null;
let natureGain = 0.22;
let mode = 'off';
let nodes = [];
let timers = [];

function ensure() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!natureBus) {
    natureBus = ctx.createGain();
    natureBus.gain.value = 0;
    const master = getAudioMaster?.() || ctx.destination;
    natureBus.connect(master);
  }
  return ctx;
}

function clear() {
  timers.forEach(clearTimeout);
  timers = [];
  for (const n of nodes) {
    try { n.stop?.(); } catch (_) {}
    try { n.disconnect?.(); } catch (_) {}
  }
  nodes = [];
}

function makeNoise(ctx, kind, seconds = 2) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.035 * w) / 1.035;
      d[i] = last * 3.1;
    } else if (kind === 'pink') {
      last = 0.985 * last + 0.015 * w;
      d[i] = last * 3.2;
    } else {
      d[i] = w;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function noiseLayer(ctx, bus, kind, cut, q, level) {
  const s = makeNoise(ctx, kind, 2);
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = 'lowpass';
  f.frequency.value = cut;
  f.Q.value = q || 0.2;
  g.gain.value = level;
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start();
  nodes.push(s, f, g);
}

function chirp(ctx, bus) {
  const run = () => {
    if (mode !== 'forest' && mode !== 'birds') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f0 = 1800 + Math.random() * 2200;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.5), t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.16);
    timers.push(setTimeout(run, 900 + Math.random() * 2400));
  };
  timers.push(setTimeout(run, 400));
}

function thunder(ctx, bus) {
  const boom = () => {
    if (mode !== 'storm') return;
    const t = ctx.currentTime;
    const s = makeNoise(ctx, 'brown', 1.2);
    s.loop = false;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t);
    s.stop(t + 1.2);
    timers.push(setTimeout(boom, 5000 + Math.random() * 8000));
  };
  timers.push(setTimeout(boom, 2000));
}

export function startAmbient(nextMode, level = natureGain) {
  mode = nextMode || 'off';
  clear();
  const ctx = ensure();
  if (!ctx || !natureBus) return false;
  resumeAudio();
  natureGain = Math.max(0, Math.min(0.6, level));
  const t = ctx.currentTime;
  natureBus.gain.cancelScheduledValues(t);
  if (mode === 'off') {
    natureBus.gain.setTargetAtTime(0, t, 0.25);
    return true;
  }
  natureBus.gain.setTargetAtTime(natureGain, t, 0.35);
  if (mode === 'rain') {
    noiseLayer(ctx, natureBus, 'pink', 6800, 0.12, 0.026);
    noiseLayer(ctx, natureBus, 'pink', 1800, 0.25, 0.01);
  } else if (mode === 'storm') {
    noiseLayer(ctx, natureBus, 'brown', 1200, 0.5, 0.038);
    noiseLayer(ctx, natureBus, 'pink', 3600, 0.16, 0.014);
    thunder(ctx, natureBus);
  } else if (mode === 'forest') {
    noiseLayer(ctx, natureBus, 'pink', 2400, 0.2, 0.012);
    chirp(ctx, natureBus);
  } else if (mode === 'wind') {
    noiseLayer(ctx, natureBus, 'brown', 900, 0.4, 0.04);
    noiseLayer(ctx, natureBus, 'pink', 3200, 0.15, 0.012);
  } else if (mode === 'water') {
    noiseLayer(ctx, natureBus, 'brown', 2600, 0.5, 0.045);
    noiseLayer(ctx, natureBus, 'pink', 5200, 0.18, 0.014);
  }
  return true;
}

export function setAmbientLevel(level) {
  natureGain = Math.max(0, Math.min(0.6, level));
  const ctx = getAudioContext();
  if (natureBus && ctx && mode !== 'off') {
    natureBus.gain.setTargetAtTime(natureGain, ctx.currentTime, 0.12);
  }
}

export function stopAmbient() {
  return startAmbient('off');
}

export function getAmbientMode() {
  return mode;
}
