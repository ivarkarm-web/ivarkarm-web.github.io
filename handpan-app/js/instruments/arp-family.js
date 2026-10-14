/**
 * instruments/arp-family.js — Cinematic ambient arpeggiators for Pionier
 * Infinite hold-loops · overlapping multi-voice polyphony · long atmospheric tails
 * Output → instrument bus (pre-FX) → Compressor → Ambiance → Reverb → Master
 */
import { Instrument } from '../instrument.js';
import { getSharedScheduler } from '../sound/scheduler.js';

const MAX_PADS = 14;
const VOICE_POOL = 12;

function safeExp(g, value, time) {
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
}

function envGain(ctx, t0, {
  peak = 0.2, attack = 0.08, decay = 0.4, sustain = 0.35, release = 2.2, hold = 0.15
} = {}) {
  const g = ctx.createGain();
  const p = Math.max(0.0001, peak);
  g.gain.setValueAtTime(0.0001, t0);
  safeExp(g, p, t0 + Math.max(0.005, attack));
  const tDec = t0 + attack + decay;
  safeExp(g, Math.max(0.0001, p * sustain), tDec);
  g.gain.setValueAtTime(Math.max(0.0001, p * sustain), tDec + hold);
  safeExp(g, 0.0001, tDec + hold + release);
  return g;
}

function createLfo(ctx, rateHz, depth) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = rateHz;
  const g = ctx.createGain();
  g.gain.value = depth;
  osc.connect(g);
  osc.start();
  return { osc, out: g, stop() { try { osc.stop(); } catch (_) {} } };
}

function acquireVoice(pool, now) {
  let best = pool[0];
  let bestT = best?.freeAt ?? 0;
  for (let i = 1; i < pool.length; i++) {
    const v = pool[i];
    if ((v.freeAt ?? 0) <= now) return v;
    if ((v.freeAt ?? 0) < bestT) { best = v; bestT = v.freeAt; }
  }
  return best;
}

function scaleFreqs(pitches) {
  return (pitches || []).filter(Boolean).map((p) => p.freq).filter((f) => f > 20 && f < 12000);
}

function pickBase(pitches, zoneIdx) {
  const live = (pitches || []).filter(Boolean);
  if (!live.length) return 0;
  return Math.max(0, Math.min(zoneIdx, live.length - 1));
}

function playAether(ctx, dest, { freq, t0, vel, lfo }) {
  const release = 2.8;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = 600 + vel * 2800;
  filter.frequency.setValueAtTime(bright * 0.4, t0);
  filter.frequency.linearRampToValueAtTime(bright, t0 + 0.9);
  filter.frequency.linearRampToValueAtTime(bright * 0.55, t0 + 2.2);
  filter.Q.setValueAtTime(0.6, t0);
  if (lfo) { try { lfo.connect(filter.frequency); } catch (_) {} }

  const g = envGain(ctx, t0, {
    peak: 0.1 + 0.16 * vel, attack: 0.18, decay: 0.6, sustain: 0.45, release, hold: 0.55
  });

  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.setValueAtTime(freq, t0);
  const g1 = ctx.createGain(); g1.gain.value = 0.7; o1.connect(g1); g1.connect(filter);

  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2, t0); o2.detune.setValueAtTime(7, t0);
  const g2 = ctx.createGain(); g2.gain.value = 0.28; o2.connect(g2); g2.connect(filter);

  const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.setValueAtTime(freq * 1.498, t0); o3.detune.setValueAtTime(-5, t0);
  const g3 = ctx.createGain(); g3.gain.value = 0.12; o3.connect(g3); g3.connect(filter);

  filter.connect(g); g.connect(dest);
  const stopAt = t0 + 0.55 + release + 0.3;
  for (const o of [o1, o2, o3]) { o.start(t0); o.stop(stopAt); }
  return stopAt;
}

function playPrism(ctx, dest, { freq, t0, vel }) {
  const release = 2.0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800 + vel * 5000, t0);
  filter.Q.setValueAtTime(0.8, t0);

  const g = envGain(ctx, t0, {
    peak: 0.12 + 0.18 * vel, attack: 0.008, decay: 0.25, sustain: 0.2, release, hold: 0.08
  });

  const delay = ctx.createDelay(1.5);
  delay.delayTime.setValueAtTime(0.28 + Math.random() * 0.12, t0);
  const fb = ctx.createGain();
  fb.gain.setValueAtTime(0.42, t0);
  safeExp(fb, 0.0001, t0 + 2.5);
  const wet = ctx.createGain(); wet.gain.value = 0.35;

  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.setValueAtTime(freq, t0);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2.01, t0); o2.detune.setValueAtTime(9, t0);
  const mix = ctx.createGain(); mix.gain.value = 1;
  o1.connect(mix);
  const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(mix);

  mix.connect(filter); filter.connect(g); g.connect(dest);
  g.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(dest);

  const stopAt = t0 + release + 2.8;
  o1.start(t0); o2.start(t0); o1.stop(stopAt); o2.stop(stopAt);
  return stopAt;
}

function playZen(ctx, dest, { freq, t0, vel, peak }) {
  const release = peak ? 3.5 : 2.6;
  const ratios = [1, 2.76, 5.40, 8.93];
  const amps = [1, 0.55, 0.28, 0.12];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime((peak ? 2200 : 1400) + vel * 3000, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const g = envGain(ctx, t0, {
    peak: (peak ? 0.16 : 0.11) + 0.12 * vel, attack: 0.25, decay: 0.9, sustain: 0.4, release, hold: 0.4
  });

  const stopAt = t0 + release + 1.2;
  ratios.forEach((r, i) => {
    const beat = (i + 1) * 0.15;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq * r - beat, t0);
    const pg = ctx.createGain(); pg.gain.value = amps[i] * (i === 0 ? 1 : 0.5 + 0.5 * vel);
    o.connect(pg); pg.connect(filter); o.start(t0); o.stop(stopAt);
    if (i < 3) {
      const oB = ctx.createOscillator(); oB.type = 'sine'; oB.frequency.setValueAtTime(freq * r + beat, t0);
      const pgB = ctx.createGain(); pgB.gain.value = amps[i] * 0.7 * (0.5 + 0.5 * vel);
      oB.connect(pgB); pgB.connect(filter); oB.start(t0); oB.stop(stopAt);
    }
  });
  filter.connect(g); g.connect(dest);
  return stopAt;
}

function playShamanic(ctx, dest, { freq, t0, vel }) {
  const release = 2.4;
  const fund = Math.max(45, freq * 0.5);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(fund * 1.15, t0);
  o.frequency.exponentialRampToValueAtTime(fund, t0 + 0.08);

  const body = envGain(ctx, t0, {
    peak: 0.22 + 0.2 * vel, attack: 0.02, decay: 0.18, sustain: 0.25, release, hold: 0.1
  });
  o.connect(body);

  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.3));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(120 + vel * 180, t0); bp.Q.setValueAtTime(0.9, t0);
  const noiseG = envGain(ctx, t0, {
    peak: 0.12 * vel, attack: 0.005, decay: 0.08, sustain: 0, release: 0.15, hold: 0.02
  });
  src.connect(bp); bp.connect(noiseG);

  const delay = ctx.createDelay(2.0); delay.delayTime.setValueAtTime(0.55, t0);
  const fb = ctx.createGain(); fb.gain.setValueAtTime(0.38, t0); safeExp(fb, 0.0001, t0 + 3.5);
  const wet = ctx.createGain(); wet.gain.value = 0.4;

  body.connect(dest); noiseG.connect(dest);
  body.connect(delay); noiseG.connect(delay);
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(dest);

  const stopAt = t0 + release + 3.5;
  o.start(t0); o.stop(stopAt); src.start(t0); src.stop(t0 + 0.2);
  return stopAt;
}

function playHarp(ctx, dest, { freq, t0, vel }) {
  const release = 2.2;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400 + vel * 4200, t0);
  filter.Q.setValueAtTime(0.65, t0);

  const g = envGain(ctx, t0, {
    peak: 0.11 + 0.16 * vel, attack: 0.012, decay: 0.35, sustain: 0.28, release, hold: 0.12
  });

  const partials = [[1, 1], [2.003, 0.4], [3.01, 0.15], [4.02, 0.06]];
  const stopAt = t0 + release + 0.8;
  for (const [ratio, amp] of partials) {
    const o = ctx.createOscillator();
    o.type = ratio === 1 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(freq * ratio, t0);
    const pg = ctx.createGain(); pg.gain.value = amp;
    o.connect(pg); pg.connect(filter); o.start(t0); o.stop(stopAt);
  }
  filter.connect(g); g.connect(dest);
  return stopAt;
}

const ARP_DEFS = [
  {
    id: 'aether_ripple', name: 'Aether Ripple',
    desc: 'Lush shimmering pad — Root → 5th → Octave → 2nd Octave, infinite hold.',
    bpm: 64, mode: 'loop', subdiv: 2, steps: 8,
    pattern(_b, step) {
      const map = [0, 0, 4, 4, 7, 7, 12, 12];
      return { rel: map[step % 8], velMul: 0.7 + 0.05 * (step % 4) };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 220;
      if (rel <= 0) return freqs[baseIdx];
      if (rel <= 4) return freqs[Math.min(baseIdx + Math.max(2, Math.floor(freqs.length * 0.4)), freqs.length - 1)];
      if (rel <= 7) return freqs[baseIdx] * 2;
      return freqs[baseIdx] * 4;
    },
    play: playAether, lfoRate: 0.07, lfoDepth: 180
  },
  {
    id: 'prism_shards', name: 'Prism Shards',
    desc: 'Glassy ambient plucks with long echo trails — random-walk scale notes.',
    bpm: 88, mode: 'loop', subdiv: 1, steps: 16,
    pattern(_b, step) {
      return { rel: 0, velMul: 0.55 + 0.35 * ((step * 13) % 5) / 5, randomWalk: true };
    },
    resolve(freqs, baseIdx, _r, walk) {
      if (!freqs.length) return 440;
      return freqs[Math.max(0, Math.min(freqs.length - 1, walk ?? baseIdx))];
    },
    play: playPrism, lfoRate: 0.11, lfoDepth: 90
  },
  {
    id: 'zen_pendulum', name: 'Zen Pendulum',
    desc: 'Deep singing-bowl harmonics — 1→2→3→4→3→2, multi-bar ring.',
    bpm: 56, mode: 'loop', subdiv: 3, steps: 6,
    pattern(_b, step) {
      const seq = [0, 1, 2, 3, 2, 1];
      const s = seq[step % 6];
      return { rel: s, velMul: s === 3 ? 1 : 0.6 + s * 0.08, peak: s === 3 };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 330;
      return freqs[Math.min(baseIdx + rel, freqs.length - 1)];
    },
    play: playZen, lfoRate: 0.05, lfoDepth: 120
  },
  {
    id: 'shamanic_pulse', name: 'Shamanic Pulse',
    desc: 'Soft organic heartbeat with distant echo — infinite while held.',
    bpm: 72, mode: 'loop', subdiv: 2, steps: 16,
    pattern(_b, step, bar) {
      const hits = new Set([0, 3, 6, 8, 11, 14]);
      if (!hits.has(step % 16)) return { skip: true };
      const accent = step % 16 === 0 || step % 16 === 8;
      return { rel: 0, velMul: accent ? 0.95 : 0.55, pitchShift: Math.floor(bar / 4) % 2 === 1 ? -0.5 : 0 };
    },
    resolve(freqs, baseIdx, _r, _w, pitchShift = 0) {
      if (!freqs.length) return 80;
      const f = freqs[Math.min(baseIdx, Math.floor(freqs.length * 0.35))];
      return f * Math.pow(2, pitchShift / 12);
    },
    play: playShamanic, lfoRate: 0.04, lfoDepth: 40
  },
  {
    id: 'harp_cascade', name: 'Harp Cascade',
    desc: 'Continuous rolling cascade up and down the scale while held.',
    bpm: 78, mode: 'loop', subdiv: 1, steps: 12,
    pattern(_b, step) {
      const s = step % 12;
      const rel = s < 6 ? s : (11 - s);
      return { rel, velMul: 0.85 - Math.abs(rel - 2.5) * 0.06 };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 440;
      return freqs[Math.min(baseIdx + rel, freqs.length - 1)];
    },
    play: playHarp, lfoRate: 0.09, lfoDepth: 70
  }
];

class ArpInstrument extends Instrument {
  constructor(def) {
    super({
      id: def.id, name: def.name, description: def.desc,
      category: 'arp', polyphony: MAX_PADS,
      compatibleFx: ['compressor', 'delay', 'reverb', 'filter']
    });
    this.def = def;
    this.pitches = [];
    this.scheduler = null;
    this._unsub = null;
    this._pads = new Map();
    this._voicePool = [];
    this._lfo = null;
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
    if (!this._lfo && this.def.lfoRate) {
      this._lfo = createLfo(audioCtx, this.def.lfoRate, this.def.lfoDepth || 100);
    }
    this._voicePool = Array.from({ length: VOICE_POOL }, () => ({ freeAt: 0 }));
    if (!this._unsub) {
      this._unsub = this.scheduler.onTick((ev) => this._onClock(ev));
    }
  }

  deactivate() {
    this.dampAll();
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (this._lfo) { this._lfo.stop(); this._lfo = null; }
    super.deactivate();
  }

  setMusicalContext(notes) {
    const list = (notes || []).slice(0, MAX_PADS);
    this.pitches = new Array(MAX_PADS).fill(null);
    list.forEach((n, i) => {
      const idx = n.index != null && n.index >= 0 && n.index < MAX_PADS ? n.index : i;
      this.pitches[idx] = { midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: idx };
    });
  }

  getNotes() { return this.pitches.filter(Boolean).slice(); }

  noteOn(gesture = {}, zone = {}) {
    if (!this.audioCtx || !this.bus) return;
    if (!this.ready) this._ready = true;
    const idx = zone.index ?? zone.idx ?? 0;
    if (idx < 0 || idx >= MAX_PADS) return;

    const vel = Math.max(0.12, Math.min(1, gesture.velocity ?? 0.72));
    const baseIdx = pickBase(this.pitches, idx);

    this._pads.set(idx, { idx, baseIdx, vel, walk: baseIdx, step: 0, released: false });
    this.heldPad[idx] = 1;
    this.glow[idx] = Math.min(1, 0.5 + vel * 0.45);
    this.zoneFlash[idx] = zone.radial ?? 0.4;
    this.lastStrikeAt.set(idx, performance.now());

    if (this.scheduler && !this.scheduler.isRunning) this.scheduler.start();
    this._trigger(this._pads.get(idx), this.audioCtx.currentTime + 0.01, 0, 0);
  }

  noteOff(idx) {
    this.heldPad[idx] = 0;
    if (this.glow[idx] > 0.15) this.glow[idx] = Math.min(this.glow[idx], 0.28);
    const state = this._pads.get(idx);
    if (!state) return;
    // Stop scheduling new notes only — existing voices keep their long release
    state.released = true;
  }

  noteMove(idx, gesture = {}) {
    if (idx < 0 || idx >= MAX_PADS || !this.heldPad[idx]) return;
    const p = Math.max(0, Math.min(1, gesture.pressure || gesture.force || 0));
    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.25 + p * 0.5));
  }

  dampAll() {
    this.heldPad.fill(0);
    for (const state of this._pads.values()) state.released = true;
    this._pads.clear();
  }

  tickGlow() {
    let active = false;
    for (let i = 0; i < MAX_PADS; i++) {
      if (this.glow[i] > 0.001) { this.glow[i] *= this.heldPad[i] ? 0.95 : 0.88; active = true; }
      else this.glow[i] = 0;
      if (this.zoneFlash[i] > 0.001) { this.zoneFlash[i] *= 0.87; active = true; }
      else this.zoneFlash[i] = 0;
    }
    return active;
  }

  _onClock(ev) {
    if (!this._pads.size) return;
    const subdiv = this.def.subdiv || 2;
    for (const state of [...this._pads.values()]) {
      if (state.released) {
        this._pads.delete(state.idx);
        continue;
      }
      if (ev.step % subdiv !== 0) continue;
      state.step += 1;
      this._trigger(state, ev.time, state.step, ev.bar);
    }
  }

  _trigger(state, time, patternStep, bar) {
    const def = this.def;
    const freqs = scaleFreqs(this.pitches);
    if (!freqs.length) return;

    const pat = def.pattern(state.baseIdx, patternStep, bar) || {};
    if (pat.skip) return;

    if (pat.randomWalk) {
      const len = freqs.length;
      const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() < 0.25 ? 1 : 0));
      state.walk = Math.max(0, Math.min(len - 1, (state.walk ?? state.baseIdx) + delta));
    }

    const freq = def.resolve(freqs, state.baseIdx, pat.rel ?? 0, state.walk, pat.pitchShift ?? 0);
    const vel = Math.max(0.08, Math.min(1, state.vel * (pat.velMul ?? 1)));
    const slot = acquireVoice(this._voicePool, time);

    try {
      const stopAt = def.play(this.audioCtx, this.bus, {
        freq, t0: time, vel, peak: !!pat.peak, lfo: this._lfo?.out || null
      });
      if (slot) slot.freeAt = Math.max(slot.freeAt || 0, stopAt || time + 3);
    } catch (e) {
      console.warn('[arp] voice', def.id, e);
    }

    this.glow[state.idx] = Math.min(1, 0.35 + vel * 0.55);
    this.zoneFlash[state.idx] = 0.45;
  }
}

export function createArpInstruments() {
  return ARP_DEFS.map((def) => new ArpInstrument(def));
}

export { ARP_DEFS };
