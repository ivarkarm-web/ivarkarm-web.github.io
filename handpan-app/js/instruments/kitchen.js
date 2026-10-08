/**
 * instruments/kitchen.js — Kitchen as resonant objects inside the Pionier surface
 * Pitch comes from shared pentatonic mapping (active handpan scale/root/octave).
 */
import { Instrument } from '../instrument.js';

const OBJECTS = [
  { id: 'glass', name: 'Glass', brightness: 0.95, noise: 0.18, metallic: 0.15, decay: 1.9, partials: [1, 2.01, 3.15, 4.8], q: 8 },
  { id: 'ceramic', name: 'Ceramic', brightness: 0.55, noise: 0.1, metallic: 0.05, decay: 2.4, partials: [1, 1.48, 2.32, 3.1], q: 4.5 },
  { id: 'pot', name: 'Pot', brightness: 0.32, noise: 0.14, metallic: 0.35, decay: 3.0, partials: [1, 1.52, 2.05, 2.7], q: 3.2 },
  { id: 'pan', name: 'Pan', brightness: 0.72, noise: 0.22, metallic: 0.55, decay: 2.0, partials: [1, 1.9, 2.75, 4.1], q: 6 },
  { id: 'spoon', name: 'Spoon', brightness: 1.0, noise: 0.32, metallic: 0.85, decay: 0.85, partials: [1, 2.4, 4.2, 6.5], q: 10 }
];

/** Map 5 kitchen voices onto handpan field indices (ding + selected rings). */
export const KITCHEN_ZONE_INDICES = [0, 1, 3, 5, 7];

export class KitchenInstrument extends Instrument {
  constructor() {
    super({
      id: 'kitchen',
      name: 'Kitchen',
      description: 'Playable resonant kitchen objects — glass, ceramic, metal.',
      category: 'kitchen',
      polyphony: 8,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'lowpass', 'chorus']
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
      midi: n.midi,
      freq: n.freq,
      name: n.name
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
        midi: p?.midi ?? 60 + i * 2,
        name: o.name,
        freq: p?.freq ?? 220 * Math.pow(2, i / 5),
        kind: i === 0 ? 'ding' : 'ring'
      };
    });
  }

  fieldToObject(fieldIndex) {
    return KITCHEN_ZONE_INDICES.indexOf(fieldIndex);
  }

  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const fieldIdx = zone?.index ?? zone?.idx ?? 0;
    const objIdx = this.fieldToObject(fieldIdx);
    if (objIdx < 0) return;

    const obj = this.objects[objIdx];
    if (!obj) return;
    const pitch = this.pitches[objIdx];
    const baseFreq = pitch?.freq || 220;

    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.1, Math.min(1, gesture.velocity ?? 0.75));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    const nx = zone.nx ?? gesture.nx ?? 0.5;
    const ny = zone.ny ?? gesture.ny ?? 0.5;
    const movement = Math.min(1, (gesture.movementMagnitude || 0) / 80);

    const brightness = Math.max(0.12, Math.min(1, obj.brightness * (0.55 + ny * 0.7 + (1 - radial) * 0.15)));
    const metallic = Math.max(0, Math.min(1, obj.metallic * (0.6 + nx * 0.5)));
    const freq = baseFreq * (0.985 + vel * 0.03);

    this.glow[fieldIdx] = Math.min(1, 0.5 + vel * 0.5);
    this.zoneFlash[fieldIdx] = radial;
    this.lastStrikeAt.set(fieldIdx, performance.now());

    const prev = this.activeVoices.get(fieldIdx);
    if (prev?.stop) prev.stop(t, 0.025);

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);

    const nlen = Math.floor(ctx.sampleRate * (0.04 + obj.noise * 0.04));
    const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < nlen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * (0.18 + obj.noise * 0.15)));
    }
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = metallic > 0.4 ? 'bandpass' : 'highpass';
    nf.frequency.value = 900 + brightness * 4500 + metallic * 2000;
    nf.Q.value = 0.8 + metallic * 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(obj.noise * vel * (0.35 + metallic * 0.25), t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + obj.noise * 0.04);
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    ns.start(t);
    ns.stop(t + 0.1);

    const decay = obj.decay * (0.75 + vel * 0.45);
    const peak = 0.28 * vel;
    const oscs = [];
    obj.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : (metallic > 0.5 ? 'triangle' : 'sine');
      const pf = freq * ratio * (1 + ((i % 2) ? -1 : 1) * 0.003 * (1 + movement));
      osc.frequency.setValueAtTime(pf, t);
      if (i === 0) {
        osc.frequency.exponentialRampToValueAtTime(pf * 0.97, t + decay * 0.35);
      }

      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(pf * (0.9 + brightness * 0.4), t);
      filt.frequency.exponentialRampToValueAtTime(pf * 0.7, t + decay);
      filt.Q.value = obj.q * (0.6 + (1 - radial) * 0.5) * (0.8 + brightness * 0.4);

      const g = ctx.createGain();
      const amp = peak * (i === 0 ? 1 : (0.45 / (i + 0.5)) * (0.5 + brightness * 0.7));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.003 + i * 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay * (1 - i * 0.08));

      osc.connect(filt);
      filt.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.2);
      oscs.push(osc);
    });

    if (obj.brightness < 0.6) {
      const body = ctx.createOscillator();
      body.type = 'sine';
      body.frequency.setValueAtTime(freq * 0.5, t);
      body.frequency.exponentialRampToValueAtTime(freq * 0.42, t + 0.15);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(peak * 0.35 * (1 - obj.brightness), t + 0.008);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.55);
      body.connect(bg);
      bg.connect(out);
      body.start(t);
      body.stop(t + decay);
      oscs.push(body);
    }

    const voice = {
      idx: fieldIdx,
      out,
      stop: (tt, tc = 0.05) => {
        try {
          out.gain.cancelScheduledValues(tt);
          out.gain.setTargetAtTime(0, tt, tc);
        } catch (_) {}
      }
    };
    if (oscs[0]) {
      oscs[0].onended = () => {
        this.activeVoices.delete(fieldIdx);
        try { out.disconnect(); } catch (_) {}
      };
    }
    this.activeVoices.set(fieldIdx, voice);
  }

  noteOff(zoneId) {
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    v.stop(this.audioCtx.currentTime, 0.1);
  }

  tickGlow() {
    let any = false;
    for (let i = 0; i < 9; i++) {
      if (this.glow[i] > 0.001) {
        this.glow[i] *= 0.9;
        any = true;
      } else this.glow[i] = 0;
    }
    return any;
  }

  getPerformanceHints() {
    return { maxVoices: 8, prefersSamples: false };
  }
}
