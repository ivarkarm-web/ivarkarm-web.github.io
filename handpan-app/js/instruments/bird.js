/**
 * instruments/bird.js — Bird-inspired voices inside the Pionier surface
 */
import { Instrument } from '../instrument.js';

const CALLS = [
  { id: 'chirp', name: 'Chirp', decay: 0.28, vibrato: 0.15, contour: 'up', brightness: 0.9, attack: 0.004 },
  { id: 'trill', name: 'Trill', decay: 0.85, vibrato: 0.85, contour: 'trill', brightness: 0.75, attack: 0.01 },
  { id: 'whistle', name: 'Whistle', decay: 1.35, vibrato: 0.35, contour: 'slow', brightness: 0.65, attack: 0.02 },
  { id: 'click', name: 'Click', decay: 0.14, vibrato: 0.05, contour: 'snap', brightness: 1.0, attack: 0.002 },
  { id: 'call', name: 'Call', decay: 1.7, vibrato: 0.45, contour: 'phrase', brightness: 0.55, attack: 0.015 }
];

export const BIRD_ZONE_INDICES = [0, 1, 3, 5, 7];

export class BirdInstrument extends Instrument {
  constructor() {
    super({
      id: 'bird',
      name: 'Bird',
      description: 'Expressive bird-gesture voices over the shared pentatonic framework.',
      category: 'bird',
      polyphony: 6,
      compatibleFx: ['delay', 'reverb', 'chorus', 'air', 'lowpass']
    });
    this.calls = CALLS;
    this.pitches = [];
    this.glow = new Float32Array(9);
    this.zoneFlash = new Float32Array(9);
    this.lastStrikeAt = new Map();
  }

  async activate(audioCtx, bus) { await super.activate(audioCtx, bus); }

  setMusicalContext(notes) {
    this.pitches = (notes || []).slice(0, 5).map((n) => ({
      midi: n.midi, freq: n.freq, name: n.name
    }));
  }

  getZones() {
    return this._zones || this.calls.map((c, i) => ({ id: c.id, index: i, label: c.name }));
  }

  getNotes() {
    return this.calls.map((c, i) => {
      const p = this.pitches[i];
      return {
        index: i,
        midi: p?.midi ?? 72 + i * 3,
        name: c.name,
        freq: p?.freq ?? 880 * Math.pow(2, i / 5),
        kind: i === 0 ? 'ding' : 'ring'
      };
    });
  }

  fieldToCall(fieldIndex) {
    if (fieldIndex >= 0 && fieldIndex <= 4) return fieldIndex;
    return BIRD_ZONE_INDICES.indexOf(fieldIndex);
  }

  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const fieldIdx = zone?.index ?? zone?.idx ?? 0;
    const callIdx = this.fieldToCall(fieldIdx);
    if (callIdx < 0 || callIdx > 4) return;

    const call = this.calls[callIdx];
    if (!call) return;
    const pitch = this.pitches[callIdx];
    const baseFreq = (pitch?.freq || 440) * (call.id === 'call' ? 2 : call.id === 'click' ? 4 : 3);

    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.12, Math.min(1, gesture.velocity ?? 0.75));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    const nx = zone.nx ?? gesture.nx ?? 0.5;
    const ny = zone.ny ?? gesture.ny ?? 0.5;
    const movement = Math.min(1, (gesture.movementMagnitude || 0) / 60);
    const holdBoost = Math.min(1.6, 1 + (gesture.holdMs || 0) / 1400);

    const brightness = Math.max(0.2, Math.min(1, call.brightness * (0.55 + ny * 0.6 + (1 - radial) * 0.2)));
    const decay = call.decay * holdBoost * (0.75 + vel * 0.4);
    const f0 = baseFreq * (0.92 + ny * 0.16);

    this.glow[fieldIdx] = Math.min(1, 0.5 + vel * 0.5);
    this.zoneFlash[fieldIdx] = radial;
    this.lastStrikeAt.set(fieldIdx, performance.now());

    const prev = this.activeVoices.get(fieldIdx);
    if (prev?.stop) prev.stop(t, 0.02);

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);

    const car = ctx.createOscillator();
    car.type = 'sine';
    if (call.contour === 'up') {
      car.frequency.setValueAtTime(f0 * 0.85, t);
      car.frequency.exponentialRampToValueAtTime(f0 * 1.15, t + decay * 0.35);
      car.frequency.exponentialRampToValueAtTime(f0 * 0.95, t + decay);
    } else if (call.contour === 'trill') {
      car.frequency.setValueAtTime(f0, t);
    } else if (call.contour === 'snap') {
      car.frequency.setValueAtTime(f0 * 1.3, t);
      car.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + decay * 0.6);
    } else if (call.contour === 'phrase') {
      car.frequency.setValueAtTime(f0 * 0.9, t);
      car.frequency.exponentialRampToValueAtTime(f0 * 1.08, t + decay * 0.25);
      car.frequency.exponentialRampToValueAtTime(f0 * 0.88, t + decay * 0.7);
      car.frequency.exponentialRampToValueAtTime(f0 * 0.95, t + decay);
    } else {
      car.frequency.setValueAtTime(f0, t);
      car.frequency.exponentialRampToValueAtTime(f0 * 0.97, t + decay);
    }

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    const modRatio = 1.4 + nx * 1.8 + (call.id === 'click' ? 2.5 : 0);
    mod.frequency.setValueAtTime(f0 * modRatio * 0.15, t);
    const modG = ctx.createGain();
    const modDepth = f0 * (0.15 + vel * 0.55) * (0.4 + brightness * 0.8);
    modG.gain.setValueAtTime(modDepth, t);
    modG.gain.exponentialRampToValueAtTime(modDepth * 0.08, t + decay * 0.7);
    mod.connect(modG); modG.connect(car.frequency);

    const lfoRate = call.contour === 'trill' ? 12 + movement * 18 + vel * 8 : 4 + call.vibrato * 6 + movement * 8;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = lfoRate;
    const lfoG = ctx.createGain();
    lfoG.gain.value = (3 + vel * 14) * call.vibrato * (0.5 + nx * 0.8);
    lfo.connect(lfoG); lfoG.connect(car.frequency);

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(f0 * (1.1 + brightness * 0.5), t);
    filt.Q.value = 2.5 + (1 - nx) * 5 + brightness * 2;

    const g = ctx.createGain();
    const peak = 0.2 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + call.attack + (1 - vel) * 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    car.connect(filt); filt.connect(g); g.connect(out);
    car.start(t); mod.start(t); lfo.start(t);
    car.stop(t + decay + 0.12); mod.stop(t + decay + 0.12); lfo.stop(t + decay + 0.12);

    if (call.id === 'click' || call.id === 'chirp') {
      const nlen = Math.floor(ctx.sampleRate * (call.id === 'click' ? 0.025 : 0.04));
      const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * 0.22));
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      const nf = ctx.createBiquadFilter();
      nf.type = 'highpass';
      nf.frequency.value = 2000 + brightness * 4000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime((call.id === 'click' ? 0.18 : 0.1) * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      ns.connect(nf); nf.connect(ng); ng.connect(out);
      ns.start(t); ns.stop(t + 0.05);
    }

    const voice = {
      idx: fieldIdx, out,
      stop: (tt, tc = 0.04) => {
        try { out.gain.cancelScheduledValues(tt); out.gain.setTargetAtTime(0, tt, tc); } catch (_) {}
      }
    };
    car.onended = () => {
      this.activeVoices.delete(fieldIdx);
      try { out.disconnect(); } catch (_) {}
    };
    this.activeVoices.set(fieldIdx, voice);
  }

  noteOff(zoneId) {
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    v.stop(this.audioCtx.currentTime, 0.07);
  }

  tickGlow() {
    let any = false;
    for (let i = 0; i < 9; i++) {
      if (this.glow[i] > 0.001) { this.glow[i] *= 0.9; any = true; }
      else this.glow[i] = 0;
    }
    return any;
  }

  getPerformanceHints() { return { maxVoices: 6, prefersSamples: false }; }
}
