/**
 * instruments/kitchen.js — World Instrument: Kitchen
 */
import { Instrument } from '../instrument.js';

const OBJECTS = [
  { id: 'glass', name: 'Glass', baseFreq: 880, decay: 1.8, brightness: 0.9, noise: 0.15 },
  { id: 'bowl', name: 'Ceramic Bowl', baseFreq: 420, decay: 2.6, brightness: 0.55, noise: 0.08 },
  { id: 'pot', name: 'Pot', baseFreq: 180, decay: 3.2, brightness: 0.35, noise: 0.12 },
  { id: 'pan', name: 'Pan', baseFreq: 260, decay: 2.1, brightness: 0.7, noise: 0.22 },
  { id: 'spoon', name: 'Spoon', baseFreq: 1200, decay: 0.9, brightness: 1.0, noise: 0.28 }
];

export class KitchenInstrument extends Instrument {
  constructor() {
    super({ id: 'kitchen', name: 'Kitchen', description: 'Playable resonant kitchen objects — glass, ceramic, metal.', category: 'kitchen', polyphony: 8, compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'lowpass', 'chorus'] });
    this.objects = OBJECTS;
  }
  async activate(audioCtx, bus) { await super.activate(audioCtx, bus); }
  getZones() { return this._zones || this.objects.map((o, i) => ({ id: o.id, index: i, label: o.name })); }
  getNotes() { return this.objects.map((o, i) => ({ index: i, midi: 60 + i * 2, name: o.name, freq: o.baseFreq })); }
  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone?.index ?? 0;
    const obj = this.objects[idx]; if (!obj) return;
    const ctx = this.audioCtx; const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.1, Math.min(1, gesture.velocity));
    const nx = zone.nx ?? gesture.nx ?? 0.5; const ny = zone.ny ?? gesture.ny ?? 0.5;
    const pitchMul = 0.92 + nx * 0.18;
    const bright = Math.max(0.15, Math.min(1, obj.brightness * (0.6 + ny * 0.7)));
    const freq = obj.baseFreq * pitchMul * (0.97 + vel * 0.06);
    const prev = this.activeVoices.get(idx); if (prev?.stop) prev.stop(t, 0.03);
    const out = ctx.createGain(); out.gain.value = 1; out.connect(this.bus);
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + obj.decay * 0.4);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(800 + bright * 6000 * vel, t);
    filt.frequency.exponentialRampToValueAtTime(300 + bright * 1200, t + obj.decay);
    filt.Q.value = 1.2 + (1 - ny) * 2;
    const g = ctx.createGain(); const peak = 0.35 * vel;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + obj.decay * (0.7 + vel * 0.5));
    osc.connect(filt); filt.connect(g); g.connect(out); osc.start(t); osc.stop(t + obj.decay + 0.15);
    if (obj.noise > 0.05) {
      const nlen = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * 0.25));
      const ns = ctx.createBufferSource(); ns.buffer = buf;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(obj.noise * vel * 0.4, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1200 + bright * 3000;
      ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(t); ns.stop(t + 0.08);
    }
    const voice = { idx, out, stop: (tt, tc = 0.05) => { try { out.gain.cancelScheduledValues(tt); out.gain.setTargetAtTime(0, tt, tc); } catch (_) {} } };
    osc.onended = () => { this.activeVoices.delete(idx); try { out.disconnect(); } catch (_) {} };
    this.activeVoices.set(idx, voice);
  }
  noteOff(zoneId) { const v = this.activeVoices.get(zoneId); if (!v || !this.audioCtx) return; v.stop(this.audioCtx.currentTime, 0.12); }
  getPerformanceHints() { return { maxVoices: 8, prefersSamples: false }; }
}
