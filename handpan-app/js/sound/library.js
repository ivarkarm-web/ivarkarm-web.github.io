/**
 * sound/library.js — renders, equalises, caches and plays the voices.
 *
 * renderNote() is pure (Node-testable). SoundLibrary wraps it for the browser.
 */
import { makeRng, fadeEdges, removeDC, rmsRange, dbToGain, clamp } from './dsp.js';
import { VOICES, VOICE_MAP } from './voices.js';
import { createSpace } from './space.js';

/** Every note is scaled so its first 1.5 s sits at this RMS (dBFS) — the "cohesion" rule. */
export const TARGET_RMS_DB = -21;
export const PEAK_CEILING = 0.9;
const VEL_LAYERS = [0.3, 0.65, 1.0];

const velCurve = (v) => 0.16 + 0.84 * Math.pow(clamp(v, 0, 1), 1.35);

/** Low notes feel quieter at equal RMS; lift them gently. */
export function pitchLoudnessTrimDb(f) {
  if (f >= 220) return 0;
  return clamp(-4.5 * Math.log2(f / 220), 0, 4.5);
}

function hash(str, n) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const layerOf = (vel) => {
  let best = 0;
  for (let i = 1; i < VEL_LAYERS.length; i++) {
    if (Math.abs(VEL_LAYERS[i] - vel) < Math.abs(VEL_LAYERS[best] - vel)) best = i;
  }
  return best;
};

/**
 * Render one note to a mono Float32Array (loudness-equalised, edge-faded).
 * @returns {{ data: Float32Array, sr: number, voice: object }}
 */
export function renderNote(voiceId, f, vel = 0.7) {
  const voice = VOICE_MAP.get(voiceId);
  if (!voice) throw new Error('Unknown voice: ' + voiceId);
  f = clamp(f, 30, 6000);
  const layer = layerOf(vel);
  const rnd = makeRng(hash(voiceId, Math.round(f * 16) * 4 + layer));
  const data = voice.render({ f, vel: VEL_LAYERS[layer], sr: voice.sr, rnd });
  removeDC(data);
  fadeEdges(data, voice.sr, voice.fade[0], voice.fade[1]);

  const win = Math.round(voice.sr * 1.5);
  // Measure over the loudest 1.5 s window so slow-attack pads are judged fairly.
  let rms = 0;
  const hop = Math.round(voice.sr * 0.25);
  for (let a = 0; a + hop < data.length; a += hop) rms = Math.max(rms, rmsRange(data, a, a + win));
  const target = dbToGain(TARGET_RMS_DB + (voice.trim || 0) + pitchLoudnessTrimDb(f));
  const scale = target / Math.max(rms, 1e-9);
  // Equalise on RMS, then tame sharp transients (plucks) with a soft limiter so
  // loudness stays consistent instead of being dictated by the first millisecond.
  const C = PEAK_CEILING;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] * scale;
    data[i] = Math.abs(v) < C * 0.5 ? v : Math.sign(v) * (C * 0.5 + (C * 0.5) * Math.tanh((Math.abs(v) - C * 0.5) / (C * 0.5)));
  }
  return { data, sr: voice.sr, voice };
}

export function listVoices() {
  return VOICES.map(({ id, name, family, desc, send }) => ({ id, name, family, desc, send }));
}

export class SoundLibrary {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} [out]
   * @param {{ maxCacheMB?: number, outGain?: number }} [opts]
   */
  constructor(ctx, out = ctx.destination, opts = {}) {
    this.ctx = ctx;
    this.space = createSpace(ctx);
    this.master = ctx.createGain();
    this.master.gain.value = opts.outGain ?? 0.8;
    this.dry = ctx.createGain();
    this.dry.connect(this.master);
    this.space.output.connect(this.master);
    this.master.connect(out);
    this.maxBytes = (opts.maxCacheMB ?? 96) * 1024 * 1024;
    this.cache = new Map();
    this.bytes = 0;
    this.live = new Set();
  }

  static voices() { return listVoices(); }

  _key(id, f, vel) { return id + '|' + Math.round(f * 8) / 8 + '|' + layerOf(vel); }

  getBuffer(id, f, vel = 0.7) {
    const key = this._key(id, f, vel);
    const hit = this.cache.get(key);
    if (hit) { this.cache.delete(key); this.cache.set(key, hit); return hit; }
    const { data, sr } = renderNote(id, f, vel);
    const buf = this.ctx.createBuffer(1, data.length, sr);
    buf.copyToChannel(data, 0);
    this.cache.set(key, buf);
    this.bytes += data.length * 4;
    while (this.bytes > this.maxBytes && this.cache.size > 1) {
      const [oldKey, old] = this.cache.entries().next().value;
      this.cache.delete(oldKey);
      this.bytes -= old.length * 4;
    }
    return buf;
  }

  /** Render notes ahead of time without freezing the UI (yields between notes). Return false from onProgress to cancel. */
  async prewarm(ids, freqs, vels = [0.65], onProgress) {
    const jobs = [];
    for (const id of ids) for (const f of freqs) for (const v of vels) jobs.push([id, f, v]);
    for (let i = 0; i < jobs.length; i++) {
      this.getBuffer(...jobs[i]);
      if (onProgress && onProgress((i + 1) / jobs.length, jobs[i][0]) === false) break;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /**
   * Play a note. Returns { stop(release = 0.3) }.
   * opts: vel 0..1, when (ctx time), pan -1..1, send { rev, dly } overrides.
   */
  play(id, f, opts = {}) {
    const voice = VOICE_MAP.get(id);
    if (!voice) return null;
    const vel = clamp(opts.vel ?? 0.7, 0, 1);
    const ctx = this.ctx;
    const when = Math.max(opts.when ?? 0, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = this.getBuffer(id, f, vel);
    const g = ctx.createGain();
    g.gain.value = velCurve(vel);
    src.connect(g);
    // separate stage for live expression (pressure) so it never fights the velocity gain
    const lvl = ctx.createGain();
    lvl.gain.value = 1;
    g.connect(lvl);

    let tail = lvl;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp((opts.pan ?? 0) + (voice.pan || 0), -1, 1);
      lvl.connect(p);
      tail = p;
    }
    tail.connect(this.dry);
    const send = { ...voice.send, ...(opts.send || {}) };
    const sends = [];
    if (send.rev > 0) { const s = ctx.createGain(); s.gain.value = send.rev; tail.connect(s); s.connect(this.space.reverbIn); sends.push(s); }
    if (send.dly > 0) { const s = ctx.createGain(); s.gain.value = send.dly; tail.connect(s); s.connect(this.space.delayIn); sends.push(s); }

    const handle = {
      /** Pitch offset in cents (pitch bend / glide). tc = smoothing time constant. */
      detune: (cents, tc = 0.05) => {
        const t = ctx.currentTime;
        try { src.detune.cancelScheduledValues(t); src.detune.setTargetAtTime(cents, t, Math.max(0.005, tc)); }
        catch { try { src.detune.value = cents; } catch { /* noop */ } }
      },
      /** Live level multiplier (aftertouch / pressure). */
      level: (mult, tc = 0.06) => {
        const t = ctx.currentTime;
        try { lvl.gain.cancelScheduledValues(t); lvl.gain.setTargetAtTime(mult, t, Math.max(0.005, tc)); }
        catch { /* noop */ }
      },
      stop: (release = 0.3) => {
        const t = Math.max(ctx.currentTime, when);
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + release);
        try { src.stop(t + release + 0.02); } catch { /* already stopped */ }
      }
    };
    this.live.add(handle);
    src.onended = () => {
      this.live.delete(handle);
      try { src.disconnect(); g.disconnect(); lvl.disconnect(); tail.disconnect(); sends.forEach((s) => s.disconnect()); } catch { /* noop */ }
    };
    src.start(when);
    return handle;
  }

  stopAll(release = 0.15) { for (const h of [...this.live]) h.stop(release); }

  setSpace(o) { this.space.set(o); }

  dispose() { this.stopAll(0.02); this.cache.clear(); this.bytes = 0; }
}
