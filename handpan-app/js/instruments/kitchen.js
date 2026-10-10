/**
 * instruments/kitchen.js — Kitchen as resonant objects inside the Pionier surface
 * Pitch comes from shared pentatonic mapping (active handpan scale/root/octave).
 */
import { Instrument } from '../instrument.js';

const OBJECTS = [
  { id: 'glass', name: 'Glass', brightness: 0.95, noise: 0.18, metallic: 0.15, decay: 1.9, partials: [1, 2.01, 3.15, 4.8], q: 8 },
  { id: 'ceramic', name: 'Ceramic', brightness: 0.55, noise: 0.1, metallic: 0.05, decay: 2.4, partials: [1, 1.48, 2.32, 3.1], q: 4.5 },
  { id: 'wood', name: 'Wood', brightness: 0.35, noise: 0.22, metallic: 0.0, decay: 0.55, partials: [1, 2.8, 4.2], q: 2.2 },
  { id: 'metal', name: 'Metal', brightness: 0.85, noise: 0.12, metallic: 0.55, decay: 1.4, partials: [1, 2.76, 5.4, 8.2], q: 9 },
  { id: 'bowl', name: 'Bowl', brightness: 0.7, noise: 0.08, metallic: 0.25, decay: 2.8, partials: [1, 1.01, 2.71, 5.36], q: 6 }
];

export const KITCHEN_ZONE_INDICES = [0, 1, 3, 5, 7];

export class KitchenInstrument extends Instrument {
  constructor() {
    super({
      id: 'kitchen',
      name: 'Kitchen',
      description: 'Resonant kitchen objects over the shared pentatonic framework.',
      category: 'found',
      polyphony: 6,
      compatibleFx: ['delay', 'reverb', 'compressor', 'lowpass']
    });
    this.objects = OBJECTS;
    this.pitches = [];
    this.glow = new Float32Array(9);
    this.zoneFlash = new Float32Array(9);
    this.lastStrikeAt = new Map();
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
  }

  setMusicalContext(notes) {
    this.pitches = (notes || []).slice(0, 5).map((n) => ({
      midi: n.midi, freq: n.freq, name: n.name
    }));
  }

  getZones() {
    return this._zones || this.objects.map((o, i) => ({ id: o.id, index: KITCHEN_ZONE_INDICES[i], label: o.name }));
  }

  getNotes() {
    return this.objects.map((o, i) => {
      const p = this.pitches[i];
      return {
        index: KITCHEN_ZONE_INDICES[i],
        midi: p?.midi ?? 60 + i * 3,
        name: o.name,
        freq: p?.freq ?? 220 * Math.pow(2, i / 5),
        kind: i === 0 ? 'ding' : 'ring'
      };
    });
  }

  fieldToObject(fieldIndex) {
    const exact = KITCHEN_ZONE_INDICES.indexOf(fieldIndex);
    if (exact >= 0) return exact;
    let best = 0, bestDist = 99;
    for (let i = 0; i < KITCHEN_ZONE_INDICES.length; i++) {
      const d = Math.abs(KITCHEN_ZONE_INDICES[i] - fieldIndex);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  noteOn(gesture, zone) {
    if (!this.audioCtx || !this.bus) return;
    if (!this.ready) this._ready = true;
    const fieldIdx = zone?.index ?? zone?.idx ?? 0;
    const objIdx = this.fieldToObject(fieldIdx);
    if (objIdx < 0) return;

    const obj = this.objects[objIdx];
    if (!obj) return;
    const pitch = this.pitches[objIdx];
    const baseFreq = pitch?.freq || 220;

    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.12, Math.min(1, gesture.velocity ?? 0.75));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    const ny = zone.ny ?? gesture.ny ?? 0.5;

    const brightness = Math.max(0.15, Math.min(1, obj.brightness * (0.55 + ny * 0.5)));
    const decay = obj.decay * (0.7 + vel * 0.45);
    const f0 = baseFreq * (0.94 + ny * 0.12);

    this.glow[fieldIdx] = Math.min(1, 0.5 + vel * 0.5);
    this.zoneFlash[fieldIdx] = radial;
    this.lastStrikeAt.set(fieldIdx, performance.now());

    const prev = this.activeVoices.get(fieldIdx);
    if (prev?.stop) prev.stop(t, 0.02);

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);

    const oscillators = [];
    obj.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = obj.metallic > 0.3 ? 'triangle' : 'sine';
      const freq = f0 * ratio;
      osc.frequency.setValueAtTime(freq, t);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.45, freq * (2 + brightness * 4)), t);
      filt.Q.value = obj.q * (0.5 + brightness * 0.5);
      const g = ctx.createGain();
      const peak = (0.22 / (i + 1)) * vel * (1.1 - i * 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.08, decay * (1 - i * 0.12)));
      osc.connect(filt);
      filt.connect(g);
      g.connect(out);
      osc.start(t);
      try { osc.stop(t + decay + 0.15); } catch (_) {}
      oscillators.push(osc);
    });

    if (obj.noise > 0.05) {
      const nlen = Math.floor(ctx.sampleRate * (0.04 + obj.noise * 0.04));
      const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * 0.25));
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 1200 + brightness * 2800;
      nf.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(obj.noise * 0.12 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(out);
      ns.start(t);
      ns.stop(t + 0.06);
    }

    const voice = {
      idx: fieldIdx,
      out,
      stop: (tt, tc = 0.04) => {
        try {
          out.gain.cancelScheduledValues(tt);
          out.gain.setTargetAtTime(0, tt, tc);
        } catch (_) {}
      }
    };
    if (oscillators[0]) {
      oscillators[0].onended = () => {
        this.activeVoices.delete(fieldIdx);
        try { out.disconnect(); } catch (_) {}
      };
    }
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
      if (this.glow[i] > 0.001) {
        this.glow[i] *= 0.9;
        any = true;
      } else {
        this.glow[i] = 0;
      }
    }
    return any;
  }

  getPerformanceHints() {
    return { maxVoices: 6, prefersSamples: false };
  }
}
