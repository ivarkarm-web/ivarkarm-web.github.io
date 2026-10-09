/**
 * Pionier tonal instrument family.
 * Every instrument keeps the shared nine-note surface and inherits the active
 * handpan scale, root and octave. Timbral differences are synthesized locally.
 */
import { Instrument } from '../instrument.js';

const PRESETS = [
  { id: 'tongue-drum', name: 'Tongue Drum', description: 'Warm steel tongue drum with a soft attack and rounded, lingering partials.', category: 'tonal', wave: 'sine', partials: [1, 2.76, 5.4, 8.9], levels: [1, .34, .14, .045], decay: 2.6, attack: .008, pitchDrop: .012, brightness: .75 },
  { id: 'kalimba', name: 'Kalimba', description: 'Bright thumb-piano plucks with woody metallic overtones.', category: 'tonal', wave: 'triangle', partials: [1, 2.73, 5.42, 8.2], levels: [1, .26, .08, .025], decay: 1.35, attack: .003, pitchDrop: .004, brightness: .88 },
  { id: 'marimba', name: 'Marimba', description: 'Rounded wooden bars with a mallet-like transient.', category: 'tonal', wave: 'sine', partials: [1, 3.95, 9.2, 15.1], levels: [1, .22, .055, .015], decay: .78, attack: .002, pitchDrop: .006, brightness: .58 },
  { id: 'crystal-bowl', name: 'Crystal Bowls', description: 'Pure, singing bowl-like tones with long, glassy resonance.', category: 'tonal', wave: 'sine', partials: [1, 2.01, 3.02, 4.08], levels: [1, .2, .075, .025], decay: 4.4, attack: .025, pitchDrop: .001, brightness: .96 },
  { id: 'rav-vast', name: 'Resonant Tongue', description: 'Deep, layered tank-drum resonance with a gentle metallic bloom.', category: 'tonal', wave: 'triangle', partials: [1, 2.01, 3.47, 5.8], levels: [1, .4, .17, .055], decay: 3.1, attack: .01, pitchDrop: .009, brightness: .7 }
];

export class TonalInstrument extends Instrument {
  constructor(preset) {
    super({
      id: preset.id, name: preset.name, description: preset.description,
      category: preset.category, polyphony: 9,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer', 'lowpass']
    });
    this.preset = preset;
    this.pitches = [];
    this.glow = new Float32Array(9);
    this.zoneFlash = new Float32Array(9);
    this.lastStrikeAt = new Map();
  }
  setMusicalContext(notes) {
    this.pitches = (notes || []).slice(0, 9).map(n => ({ midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: n.index }));
  }
  getNotes() { return this.pitches.slice(); }
  getZones() { return this._zones || []; }
  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone?.index ?? zone?.idx;
    const note = this.pitches[idx];
    if (!note || idx < 0 || idx > 8) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime + .001;
    const vel = Math.max(.08, Math.min(1, gesture.velocity ?? .72));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? .4));
    const preset = this.preset;
    const prev = this.activeVoices.get(idx);
    if (prev?.stop) prev.stop(t, .025);
    this.glow[idx] = Math.min(1, .55 + vel * .45);
    this.zoneFlash[idx] = radial;
    this.lastStrikeAt.set(idx, performance.now());
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);
    const oscillators = [];
    const decay = preset.decay * (.7 + vel * .45);
    preset.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = preset.wave;
      const base = note.freq * ratio;
      if (i === 0 && preset.pitchDrop > 0) {
        osc.frequency.setValueAtTime(base * (1 + preset.pitchDrop * (1 - vel)), t);
        osc.frequency.exponentialRampToValueAtTime(base, t + Math.min(.12, decay * .18));
      } else osc.frequency.setValueAtTime(base, t);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.max(900, base * (2.5 + preset.brightness * 7) * (1 + radial * .12)), t);
      filter.Q.value = .65 + preset.brightness * 1.2;
      const gain = ctx.createGain();
      const peak = .22 * vel * preset.levels[i] * (i === 0 ? 1 : .85 + radial * .15);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + preset.attack + i * .002);
      gain.gain.exponentialRampToValueAtTime(.0001, t + decay * (1 - i * .09));
      osc.connect(filter); filter.connect(gain); gain.connect(out);
      osc.start(t); osc.stop(t + decay + .15);
      oscillators.push(osc);
    });
    const voice = {
      idx, out, oscillators, released: false,
      stop: (when, tc = .06) => {
        if (voice.released) return;
        voice.released = true;
        try {
          out.gain.cancelScheduledValues(when);
          out.gain.setTargetAtTime(.0001, when, tc);
        } catch (_) {}
      }
    };
    oscillators[0].onended = () => {
      if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
      try { out.disconnect(); } catch (_) {}
    };
    this.activeVoices.set(idx, voice);
  }
  noteOff(idx) {
    const voice = this.activeVoices.get(idx);
    if (voice && this.audioCtx) voice.stop(this.audioCtx.currentTime, .08);
  }
  dampAll() {
    const t = this.audioCtx?.currentTime ?? 0;
    for (const voice of this.activeVoices.values()) voice.stop?.(t, .04);
    this.activeVoices.clear();
  }
  tickGlow() {
    let active = false;
    for (let i = 0; i < 9; i++) {
      if (this.glow[i] > .001) { this.glow[i] *= .9; active = true; }
      else this.glow[i] = 0;
    }
    return active;
  }
  getPerformanceHints() { return { maxVoices: 9, prefersSamples: false }; }
}

export const TONAL_INSTRUMENT_PRESETS = PRESETS;
export function createTonalInstruments() { return PRESETS.map(preset => new TonalInstrument(preset)); }
