/**
 * instruments/bird.js — World Instrument: Bird
 * Hybrid FM + noise synthesis placeholder for expressive bird calls.
 */
import { Instrument } from '../instrument.js';

const CALLS = [
  { id: 'chirp', name: 'Chirp', base: 2200, ratio: 1.4, decay: 0.35 },
  { id: 'trill', name: 'Trill', base: 1800, ratio: 2.1, decay: 0.9 },
  { id: 'whistle', name: 'Whistle', base: 1400, ratio: 1.05, decay: 1.4 },
  { id: 'click', name: 'Click', base: 3200, ratio: 3.5, decay: 0.18 },
  { id: 'call', name: 'Call', base: 980, ratio: 1.8, decay: 1.8 }
];

export class BirdInstrument extends Instrument {
  constructor() {
    super({
      id: 'bird',
      name: 'Bird',
      description: 'Expressive bird calls — pitch, intensity and character from gesture.',
      category: 'bird',
      polyphony: 6,
      compatibleFx: ['delay', 'reverb', 'chorus', 'air', 'lowpass']
    });
    this.calls = CALLS;
  }

  async activate(audioCtx, bus) { await super.activate(audioCtx, bus); }

  getZones() {
    return this._zones || this.calls.map((c, i) => ({ id: c.id, index: i, label: c.name }));
  }

  getNotes() {
    return this.calls.map((c, i) => ({ index: i, midi: 72 + i * 3, name: c.name, freq: c.base }));
  }

  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone?.index ?? 0;
    const call = this.calls[idx];
    if (!call) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.12, Math.min(1, gesture.velocity));
    const ny = zone.ny ?? gesture.ny ?? 0.5;
    const nx = zone.nx ?? gesture.nx ?? 0.5;
    const holdBoost = Math.min(1.5, 1 + (gesture.holdMs || 0) / 1200);
    const pitch = call.base * (0.7 + ny * 0.9);
    const modRatio = call.ratio * (0.85 + nx * 0.4);
    const decay = call.decay * holdBoost * (0.8 + vel * 0.4);
    const prev = this.activeVoices.get(idx);
    if (prev?.stop) prev.stop(t, 0.02);
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.setValueAtTime(pitch, t);
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(pitch * modRatio, t);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(pitch * (0.4 + vel * 1.2) * (0.5 + nx * 0.8), t);
    modG.gain.exponentialRampToValueAtTime(pitch * 0.05, t + decay * 0.6);
    mod.connect(modG); modG.connect(car.frequency);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5 + (gesture.movementMagnitude || 0) * 0.02;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 4 + vel * 12;
    lfo.connect(lfoG); lfoG.connect(car.frequency);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(pitch * 1.2, t);
    filt.Q.value = 2 + (1 - nx) * 4;
    const g = ctx.createGain();
    const peak = 0.22 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008 + (1 - vel) * 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    car.connect(filt); filt.connect(g); g.connect(out);
    car.start(t); mod.start(t); lfo.start(t);
    car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1); lfo.stop(t + decay + 0.1);
    if (call.id === 'click' || call.id === 'chirp') {
      const nlen = Math.floor(ctx.sampleRate * 0.04);
      const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * 0.3));
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.12 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      ns.connect(ng); ng.connect(out);
      ns.start(t); ns.stop(t + 0.05);
    }
    const voice = { idx, out, stop: (tt, tc = 0.04) => { try { out.gain.cancelScheduledValues(tt); out.gain.setTargetAtTime(0, tt, tc); } catch (_) {} } };
    car.onended = () => { this.activeVoices.delete(idx); try { out.disconnect(); } catch (_) {} };
    this.activeVoices.set(idx, voice);
  }

  noteOff(zoneId) {
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    v.stop(this.audioCtx.currentTime, 0.08);
  }

  getPerformanceHints() { return { maxVoices: 6, prefersSamples: false }; }
}
