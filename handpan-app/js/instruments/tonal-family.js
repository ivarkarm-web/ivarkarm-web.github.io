/**
 * Pionier tonal instrument family — physics-informed Web Audio models.
 *
 * Instrument references used for the sound models:
 * - RAV / steel tongue drums: tuned partials and long, layered resonance.
 * - Kalimba / mbira: plucked metal tine modes plus a quieter body resonance.
 * - Marimba: wooden-bar modes with a strong, inharmonic upper partial.
 * - Singing bowls: paired, slightly detuned modal partials that create beating.
 * - Ocarina: cavity-resonator tone dominated by a near-pure fundamental.
 * - Flute: sustained fundamental with breath noise.
 *
 * These are original procedural models, not recordings or claimed exact replicas.
 * Every model inherits Pionier's current nine pitches from the selected handpan scale.
 */
import { Instrument } from '../instrument.js';

const PRESETS = [
  {
    id: 'tongue-drum', name: 'Tongue Drum',
    description: 'Steel-tongue strike with a rounded fundamental and tuned, lingering partials.',
    model: 'tongue', wave: 'sine', decay: 3.0, attack: .006, brightness: .68,
    modes: [[1, 1, 1], [2.01, .34, .72], [3.98, .17, .56], [5.43, .09, .42], [6.82, .035, .30]]
  },
  {
    id: 'kalimba', name: 'Kalimba',
    description: 'Plucked tine with inharmonic metal modes and a subtle wooden resonator.',
    model: 'kalimba', wave: 'triangle', decay: 1.55, attack: .002, brightness: .9,
    modes: [[1, 1, 1], [2.76, .31, .58], [5.42, .105, .40], [8.92, .035, .25]]
  },
  {
    id: 'marimba', name: 'Marimba',
    description: 'Soft mallet attack and the inharmonic modes of a wooden bar.',
    model: 'marimba', wave: 'sine', decay: .88, attack: .002, brightness: .55,
    modes: [[1, 1, 1], [3.96, .24, .52], [9.18, .065, .30], [16.2, .018, .18]]
  },
  {
    id: 'crystal-bowl', name: 'Crystal Bowls',
    description: 'Long glassy resonance with paired modes and slow acoustic beating.',
    model: 'bowl', wave: 'sine', decay: 5.4, attack: .025, brightness: .98,
    modes: [[1, 1, 1], [1.006, .42, .98], [2.71, .22, .72], [2.724, .10, .70], [5.36, .055, .45], [5.39, .025, .42]]
  },
  {
    id: 'rav-vast', name: 'Resonant Tongue',
    description: 'Deep tuned-tongue tone with chorus-like overtones and a long steel-shell tail.',
    model: 'rav', wave: 'sine', decay: 3.7, attack: .009, brightness: .72,
    modes: [[1, 1, 1], [2, .46, .80], [3.01, .26, .62], [4.04, .14, .50], [5.43, .075, .38], [6.8, .03, .28]]
  },
  {
    id: 'ocarina', name: 'Ocarina',
    description: 'Breathy vessel-flute tone, with a stable near-sine cavity resonance.',
    model: 'ocarina', wave: 'sine', decay: 1.1, attack: .035, brightness: .38, sustain: true,
    modes: [[1, 1, 1], [2.02, .075, .22], [3.01, .018, .12]]
  },
  {
    id: 'pentatonic-flute', name: 'Pentatonic Flute',
    description: 'Airy, sustained flute voice with a soft breath component.',
    model: 'flute', wave: 'sine', decay: 1.8, attack: .065, brightness: .32, sustain: true,
    modes: [[1, 1, 1], [2, .13, .28], [3.01, .035, .16], [4.02, .012, .09]]
  }
];

const noiseBuffers = new WeakMap();
function getNoiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (buffer) return buffer;
  const length = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
  buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

function addNoise(ctx, out, t, options = {}) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.loop = !!options.loop;
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter || 'bandpass';
  filter.frequency.setValueAtTime(options.frequency || 2600, t);
  filter.Q.value = options.q || .7;
  const gain = ctx.createGain();
  const peak = options.level || .018;
  gain.gain.setValueAtTime(.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + (options.attack || .003));
  if (!options.loop) {
    gain.gain.exponentialRampToValueAtTime(.0001, t + (options.duration || .075));
    source.stop(t + (options.duration || .075) + .02);
  }
  source.connect(filter); filter.connect(gain); gain.connect(out); source.start(t);
  return { source, gain, filter };
}

export class TonalInstrument extends Instrument {
  constructor(preset) {
    super({
      id: preset.id, name: preset.name, description: preset.description,
      category: 'tonal', polyphony: 9,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer', 'lowpass']
    });
    this.preset = preset;
    this.pitches = [];
    this.glow = new Float32Array(9);
    this.zoneFlash = new Float32Array(9);
    this.lastStrikeAt = new Map();
  }

  setMusicalContext(notes) {
    this.pitches = (notes || []).slice(0, 9).map(n => ({
      midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: n.index
    }));
  }
  getNotes() { return this.pitches.slice(); }
  getZones() { return this._zones || []; }

  noteOn(gesture = {}, zone = {}) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone.index ?? zone.idx;
    const note = this.pitches[idx];
    if (!note || idx < 0 || idx > 8) return;

    const ctx = this.audioCtx;
    const t = ctx.currentTime + .001;
    const vel = Math.max(.08, Math.min(1, gesture.velocity ?? .72));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? .4));
    const preset = this.preset;
    const previous = this.activeVoices.get(idx);
    if (previous?.stop) previous.stop(t, .025);

    this.glow[idx] = Math.min(1, .55 + vel * .45);
    this.zoneFlash[idx] = radial;
    this.lastStrikeAt.set(idx, performance.now());

    const out = ctx.createGain();
    out.gain.setValueAtTime(1, t);
    out.connect(this.bus);
    const oscillators = [];
    const decay = preset.decay * (.78 + vel * .38);
    const isSustain = !!preset.sustain;
    const fundamental = note.freq;

    preset.modes.forEach((mode, i) => {
      const [ratio, level, damping] = mode;
      const osc = ctx.createOscillator();
      osc.type = preset.wave;
      const base = fundamental * ratio;
      const detuneCents = preset.model === 'bowl' ? 0 : (preset.model === 'rav' && i > 0 ? (i % 2 ? -2.2 : 1.8) : 0);
      osc.frequency.setValueAtTime(base, t);
      if (detuneCents) osc.detune.setValueAtTime(detuneCents, t);

      const partialFilter = ctx.createBiquadFilter();
      partialFilter.type = 'lowpass';
      partialFilter.frequency.setValueAtTime(
        Math.min(ctx.sampleRate * .45, Math.max(700, base * (2.8 + preset.brightness * 5.8) * (1 + radial * .12))), t
      );
      partialFilter.Q.setValueAtTime(.55 + preset.brightness * .65, t);

      const gain = ctx.createGain();
      const peak = .24 * vel * level * (i === 0 ? 1 : .9 + radial * .16);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + preset.attack + i * .0015);

      if (isSustain) {
        // Wind instruments sustain until the pointer is released.
      } else {
        const modeDecay = decay * damping;
        gain.gain.exponentialRampToValueAtTime(.0001, t + Math.max(.12, modeDecay));
        osc.stop(t + Math.max(.18, modeDecay) + .08);
      }
      osc.connect(partialFilter); partialFilter.connect(gain); gain.connect(out);
      osc.start(t);
      oscillators.push(osc);
    });

    // A short, filtered strike excites the metal/wood models. Wind voices use
    // a quieter continuous air stream while held, not a generic percussive click.
    let noise = null;
    if (preset.model === 'kalimba') {
      noise = addNoise(ctx, out, t, { frequency: 3300 + fundamental * 1.2, level: .035 * vel, duration: .055, attack: .001, filter: 'highpass', q: .5 });
      // Quiet body modes add the box/gourd resonance heard behind a tine.
      [180, 360, 620].forEach((hz, i) => {
        const body = ctx.createOscillator();
        body.type = 'sine'; body.frequency.setValueAtTime(hz, t);
        const g = ctx.createGain(); const peak = vel * [.012, .008, .003][i];
        g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + .004);
        g.gain.exponentialRampToValueAtTime(.0001, t + decay * [.65, .38, .24][i]);
        body.connect(g); g.connect(out); body.start(t); body.stop(t + decay + .05); oscillators.push(body);
      });
    } else if (preset.model === 'marimba') {
      noise = addNoise(ctx, out, t, { frequency: 1500 + fundamental * 2, level: .024 * vel, duration: .028, attack: .001, filter: 'lowpass', q: .6 });
    } else if (preset.model === 'tongue' || preset.model === 'rav') {
      noise = addNoise(ctx, out, t, { frequency: 2100 + fundamental * 1.4, level: .012 * vel, duration: .045, attack: .002, filter: 'bandpass', q: .9 });
    } else if (preset.model === 'bowl') {
      noise = addNoise(ctx, out, t, { frequency: 4600, level: .007 * vel, duration: .022, attack: .003, filter: 'highpass', q: .7 });
    } else if (isSustain) {
      noise = addNoise(ctx, out, t, {
        frequency: preset.model === 'ocarina' ? 1900 : 2800,
        level: preset.model === 'ocarina' ? .012 * vel : .021 * vel,
        attack: preset.attack, filter: 'highpass', q: .55, loop: true
      });
    }

    const voice = {
      idx, out, oscillators, noise, released: false, oneShot: !isSustain,
      stop: (when, timeConstant = .06) => {
        if (voice.released) return;
        voice.released = true;
        try {
          out.gain.cancelScheduledValues(when);
          out.gain.setTargetAtTime(.0001, when, timeConstant);
          if (noise?.source?.loop) {
            noise.gain.gain.cancelScheduledValues(when);
            noise.gain.gain.setTargetAtTime(.0001, when, timeConstant);
            noise.source.stop(when + Math.max(.08, timeConstant * 5));
          }
          if (isSustain) oscillators.forEach(osc => { try { osc.stop(when + Math.max(.1, timeConstant * 5)); } catch (_) {} });
        } catch (_) {}
      }
    };

    if (!isSustain) {
      oscillators[0].onended = () => {
        if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
        try { out.disconnect(); } catch (_) {}
      };
    } else {
      oscillators[0].onended = () => {
        if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
        try { out.disconnect(); } catch (_) {}
      };
    }
    this.activeVoices.set(idx, voice);
  }

  noteOff(idx) {
    const voice = this.activeVoices.get(idx);
    // Struck instruments ring naturally after the finger leaves the surface.
    if (voice && !voice.oneShot && this.audioCtx) voice.stop(this.audioCtx.currentTime, .09);
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
  getPerformanceHints() { return { maxVoices: 9, prefersSamples: false, synthesis: 'modal' }; }
}

export const TONAL_INSTRUMENT_PRESETS = PRESETS;
export function createTonalInstruments() { return PRESETS.map(preset => new TonalInstrument(preset)); }
