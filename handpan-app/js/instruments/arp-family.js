/**
 * instruments/arp-family.js — 5 arpeggiator instruments for Pionier
 *
 * Pad press starts a scale-synced sequence; release fades cleanly.
 * Timing: LookAheadScheduler vs audioContext.currentTime.
 * Audio: Instrument Bus (pre-FX) with exponential ADSR ramps.
 */

import { Instrument } from '../instrument.js';
import { getSharedScheduler } from '../sound/scheduler.js';

const MAX_PADS = 14;

function envGain(ctx, t0, {
  peak = 0.35, attack = 0.01, decay = 0.08, sustain = 0.0, release = 0.12, hold = 0.05
} = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  const tDec = t0 + attack + decay;
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain + 0.0001), tDec);
  if (sustain > 0.001) {
    g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), tDec + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, tDec + hold + release);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, tDec + release);
  }
  return g;
}

function toneVoice(ctx, dest, {
  freq, t0, dur = 0.25, vel = 0.7, type = 'sine', bright = 0.5, harmonics = 1, detuneCents = 0
}) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400 + bright * 6000 + vel * 2500, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const g = envGain(ctx, t0, {
    peak: 0.12 + 0.28 * vel,
    attack: 0.004 + (1 - vel) * 0.02,
    decay: Math.min(dur * 0.55, 0.2),
    sustain: 0.05,
    release: Math.max(0.04, dur * 0.4),
    hold: Math.max(0.01, dur * 0.2)
  });

  const stopAt = t0 + dur + 0.25;
  const partials = Math.max(1, Math.min(5, harmonics | 0));
  for (let k = 1; k <= partials; k++) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * k, t0);
    if (detuneCents) osc.detune.setValueAtTime(detuneCents / k, t0);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(1 / (k * k), t0);
    osc.connect(pg);
    pg.connect(filter);
    osc.start(t0);
    osc.stop(stopAt);
  }
  filter.connect(g);
  g.connect(dest);
}

function noiseBurst(ctx, dest, { t0, dur = 0.04, vel = 0.5, fc = 800 }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(fc, t0);
  bp.Q.setValueAtTime(1.2, t0);
  const g = envGain(ctx, t0, {
    peak: 0.15 * vel, attack: 0.002, decay: dur * 0.6, sustain: 0, release: dur * 0.4, hold: 0.005
  });
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function scaleFreqs(pitches) {
  return (pitches || []).filter(Boolean).map((p) => p.freq).filter((f) => f > 0);
}

function pickScaleIndex(pitches, zoneIdx) {
  if (!pitches?.length) return 0;
  const max = pitches.filter(Boolean).length;
  return Math.max(0, Math.min(zoneIdx, max - 1));
}

const ARP_DEFS = [
  {
    id: 'aether_ripple',
    name: 'Aether Ripple',
    desc: 'Ambient glassy pad: Root → 5th → Octave → 2nd Octave swell.',
    bpm: 72,
    mode: 'loop',
    steps: 8,
    pattern(_scaleIdx, step) {
      const map = [0, 0, 4, 4, 7, 7, 12, 12];
      return { rel: map[step % 8], velMul: 0.55 + 0.08 * (step % 4) };
    },
    resolveFreq(freqs, baseIdx, rel) {
      const len = freqs.length;
      if (!len) return 220;
      if (rel <= 0) return freqs[baseIdx];
      if (rel <= 4) return freqs[Math.min(baseIdx + Math.max(2, Math.floor(len * 0.4)), len - 1)];
      if (rel <= 7) return freqs[baseIdx] * 2;
      return freqs[baseIdx] * 4;
    },
    voice(ctx, dest, { freq, t0, vel }) {
      toneVoice(ctx, dest, { freq, t0, dur: 0.55, vel: vel * 0.85, type: 'sine', bright: 0.35 + vel * 0.35, harmonics: 3 });
    }
  },
  {
    id: 'prism_shards',
    name: 'Prism Shards',
    desc: 'Ultra-sharp crystalline 16th plucks — randomized adjacent scale notes.',
    bpm: 110,
    mode: 'loop',
    steps: 16,
    pattern(_scaleIdx, step) {
      return { rel: 0, velMul: 0.5 + 0.5 * ((step * 17) % 7) / 7, randomWalk: true };
    },
    resolveFreq(freqs, baseIdx, _rel, walk) {
      const len = freqs.length;
      if (!len) return 440;
      return freqs[Math.max(0, Math.min(len - 1, walk ?? baseIdx))];
    },
    voice(ctx, dest, { freq, t0, vel }) {
      toneVoice(ctx, dest, { freq, t0, dur: 0.08, vel, type: 'triangle', bright: 0.75 + vel * 0.25, harmonics: 4, detuneCents: 6 });
      noiseBurst(ctx, dest, { t0, dur: 0.02, vel: vel * 0.6, fc: freq * 3 });
    }
  },
  {
    id: 'zen_pendulum',
    name: 'Zen Pendulum',
    desc: 'Meditative bells: 1→2→3→4→3→2 with air on peaks.',
    bpm: 66,
    mode: 'loop',
    steps: 6,
    pattern(_scaleIdx, step) {
      const seq = [0, 1, 2, 3, 2, 1];
      const s = seq[step % 6];
      return { rel: s, velMul: s === 3 ? 0.95 : 0.55 + s * 0.1, peak: s === 3 };
    },
    resolveFreq(freqs, baseIdx, rel) {
      const len = freqs.length;
      if (!len) return 330;
      return freqs[Math.min(baseIdx + rel, len - 1)];
    },
    voice(ctx, dest, { freq, t0, vel, peak }) {
      toneVoice(ctx, dest, { freq, t0, dur: 0.9, vel: vel * (peak ? 1 : 0.75), type: 'sine', bright: peak ? 0.7 : 0.4, harmonics: peak ? 5 : 3 });
      if (peak) {
        toneVoice(ctx, dest, { freq: freq * 2.76, t0, dur: 0.5, vel: vel * 0.25, type: 'sine', bright: 0.9, harmonics: 1 });
      }
    }
  },
  {
    id: 'shamanic_pulse',
    name: 'Shamanic Pulse',
    desc: 'Syncopated udu/clay heartbeat with pitch drift every 4 bars.',
    bpm: 84,
    mode: 'loop',
    steps: 16,
    pattern(_scaleIdx, step, bar) {
      const hits = new Set([0, 3, 6, 8, 11, 14]);
      if (!hits.has(step % 16)) return { skip: true };
      const accent = (step % 16 === 0 || step % 16 === 8);
      return { rel: 0, velMul: accent ? 1 : 0.55, pitchShift: Math.floor(bar / 4) % 2 === 1 ? -0.5 : 0 };
    },
    resolveFreq(freqs, baseIdx, _rel, _walk, pitchShift = 0) {
      const len = freqs.length;
      if (!len) return 80;
      const f = freqs[Math.min(baseIdx, Math.floor(len * 0.35))];
      return f * Math.pow(2, pitchShift / 12);
    },
    voice(ctx, dest, { freq, t0, vel }) {
      toneVoice(ctx, dest, { freq: freq * 0.5, t0, dur: 0.22, vel, type: 'sine', bright: 0.2 + vel * 0.25, harmonics: 2 });
      noiseBurst(ctx, dest, { t0, dur: 0.05, vel, fc: 180 + vel * 220 });
    }
  },
  {
    id: 'harp_cascade',
    name: 'Harp Cascade',
    desc: 'One-shot cascade of 6 plucked notes — harp strum with velocity decay.',
    bpm: 100,
    mode: 'oneshot',
    steps: 6,
    pattern(_scaleIdx, step) {
      return { rel: step, velMul: 1 - step * 0.12 };
    },
    resolveFreq(freqs, baseIdx, rel) {
      const len = freqs.length;
      if (!len) return 440;
      return freqs[Math.min(baseIdx + rel, len - 1)];
    },
    voice(ctx, dest, { freq, t0, vel }) {
      toneVoice(ctx, dest, { freq, t0, dur: 0.45, vel, type: 'triangle', bright: 0.45 + vel * 0.3, harmonics: 3 });
    }
  }
];

class ArpInstrument extends Instrument {
  constructor(def) {
    super({
      id: def.id,
      name: def.name,
      description: def.desc,
      category: 'arp',
      polyphony: MAX_PADS,
      compatibleFx: ['compressor', 'delay', 'reverb', 'filter']
    });
    this.def = def;
    this.pitches = [];
    this.scheduler = null;
    this._unsub = null;
    this._voices = new Map();
    this.glow = new Float32Array(MAX_PADS);
    this.zoneFlash = new Float32Array(MAX_PADS);
    this.heldPad = new Uint8Array(MAX_PADS);
    this.lastStrikeAt = new Map();
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
    this.scheduler = getSharedScheduler(audioCtx, { bpm: this.def.bpm });
    this.scheduler.setBpm(this.def.bpm);
    if (!this.scheduler.isRunning) this.scheduler.start();
    if (!this._unsub) {
      this._unsub = this.scheduler.onTick((ev) => this._onClock(ev));
    }
  }

  deactivate() {
    this.dampAll();
    if (this._unsub) { this._unsub(); this._unsub = null; }
    super.deactivate();
  }

  setMusicalContext(notes) {
    const list = (notes || []).slice(0, MAX_PADS);
    this.pitches = new Array(MAX_PADS).fill(null);
    list.forEach((n, i) => {
      const idx = (n.index != null && n.index >= 0 && n.index < MAX_PADS) ? n.index : i;
      this.pitches[idx] = { midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: idx };
    });
  }

  getNotes() {
    return this.pitches.filter(Boolean).slice();
  }

  noteOn(gesture = {}, zone = {}) {
    if (!this.audioCtx || !this.bus) return;
    if (!this.ready) this._ready = true;
    const idx = zone.index ?? zone.idx ?? 0;
    if (idx < 0 || idx >= MAX_PADS) return;

    const vel = Math.max(0.1, Math.min(1, gesture.velocity ?? 0.72));
    const baseIdx = pickScaleIndex(this.pitches, idx);

    this._stopPad(idx);

    const state = {
      idx, baseIdx, vel, walk: baseIdx,
      stepInPattern: 0, oneshotDone: false, released: false
    };
    this._voices.set(idx, state);
    this.heldPad[idx] = 1;
    this.glow[idx] = Math.min(1, 0.55 + vel * 0.45);
    this.zoneFlash[idx] = zone.radial ?? 0.4;
    this.lastStrikeAt.set(idx, performance.now());

    if (this.scheduler && !this.scheduler.isRunning) this.scheduler.start();
    this._fireStep(state, this.audioCtx.currentTime + 0.01, 0, 0);
  }

  noteOff(idx) {
    this.heldPad[idx] = 0;
    if (this.glow[idx] > 0.15) this.glow[idx] = Math.min(this.glow[idx], 0.3);
    const state = this._voices.get(idx);
    if (!state) return;
    if (this.def.mode === 'oneshot') {
      state.released = true;
    } else {
      this._stopPad(idx);
    }
  }

  noteMove(idx, gesture = {}) {
    if (idx < 0 || idx >= MAX_PADS) return;
    if (this.heldPad[idx]) {
      const p = Math.max(0, Math.min(1, gesture.pressure || gesture.force || 0));
      this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.25 + p * 0.5));
    }
  }

  dampAll() {
    this.heldPad.fill(0);
    for (const idx of [...this._voices.keys()]) this._stopPad(idx);
  }

  tickGlow() {
    let active = false;
    for (let i = 0; i < MAX_PADS; i++) {
      if (this.glow[i] > 0.001) { this.glow[i] *= this.heldPad[i] ? 0.94 : 0.86; active = true; }
      else this.glow[i] = 0;
      if (this.zoneFlash[i] > 0.001) { this.zoneFlash[i] *= 0.85; active = true; }
      else this.zoneFlash[i] = 0;
    }
    return active;
  }

  _stopPad(idx) {
    const state = this._voices.get(idx);
    if (state) state.released = true;
    this._voices.delete(idx);
    this.heldPad[idx] = 0;
  }

  _onClock(ev) {
    if (!this._voices.size) return;
    for (const state of [...this._voices.values()]) {
      if (state.released && this.def.mode !== 'oneshot') {
        this._voices.delete(state.idx);
        continue;
      }
      if (state.oneshotDone) continue;

      const subdiv = this.def.mode === 'oneshot' ? 1 : (this.def.id === 'prism_shards' ? 1 : 2);
      if (ev.step % subdiv !== 0) continue;

      state.stepInPattern += 1;
      this._fireStep(state, ev.time, state.stepInPattern, ev.bar);

      if (this.def.mode === 'oneshot' && state.stepInPattern >= this.def.steps - 1) {
        state.oneshotDone = true;
        state.released = true;
        const idx = state.idx;
        setTimeout(() => {
          if (this._voices.get(idx) === state) this._voices.delete(idx);
        }, 800);
      }
    }
  }

  _fireStep(state, time, patternStep, bar) {
    const def = this.def;
    const freqs = scaleFreqs(this.pitches);
    if (!freqs.length) return;

    const pat = def.pattern(state.baseIdx, patternStep, bar) || {};
    if (pat.skip) return;

    if (pat.randomWalk) {
      const len = freqs.length;
      const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() < 0.3 ? 1 : 0));
      state.walk = Math.max(0, Math.min(len - 1, (state.walk ?? state.baseIdx) + delta));
    }

    const freq = def.resolveFreq(freqs, state.baseIdx, pat.rel ?? 0, state.walk, pat.pitchShift ?? 0);
    const vel = Math.max(0.08, Math.min(1, state.vel * (pat.velMul ?? 1)));

    try {
      def.voice(this.audioCtx, this.bus, {
        freq, t0: time, vel, step: patternStep, bar, peak: !!pat.peak
      });
    } catch (e) {
      console.warn('[arp] voice error', def.id, e);
    }

    this.glow[state.idx] = Math.min(1, 0.4 + vel * 0.55);
    this.zoneFlash[state.idx] = 0.5;
  }
}

export function createArpInstruments() {
  return ARP_DEFS.map((def) => new ArpInstrument(def));
}

export { ARP_DEFS };
