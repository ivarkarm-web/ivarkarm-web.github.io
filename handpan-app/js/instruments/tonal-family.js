/**
 * Pionier tonal instrument family — physics-informed Web Audio models.
 * Every model inherits Pionier's nine pitches from the selected handpan scale.
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
    modes: [[1, 1, 1], [2.005, .38, .78], [3.01, .16, .58], [4.15, .075, .38], [6.8, .03, .28]]
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
  },
  {
    id: 'temple-bell', name: 'Temple Bell',
    description: 'Bright struck bell with long metallic shimmer and slow decay.',
    model: 'bowl', wave: 'sine', decay: 4.2, attack: .004, brightness: .95,
    modes: [[1, 1, 1], [2.76, .28, .7], [5.4, .12, .45], [8.2, .05, .3], [11.1, .02, .2]]
  },
  {
    id: 'gong', name: 'Gong',
    description: 'Deep wash of inharmonic partials with a swelling body.',
    model: 'rav', wave: 'sine', decay: 5.0, attack: .02, brightness: .55,
    modes: [[1, 1, 1], [1.37, .4, .9], [1.92, .25, .8], [2.55, .15, .65], [3.4, .08, .5], [4.7, .04, .35]]
  },
  {
    id: 'harp', name: 'Harp',
    description: 'Plucked string with clear partials and gentle decay.',
    model: 'kalimba', wave: 'triangle', decay: 2.4, attack: .003, brightness: .75,
    modes: [[1, 1, 1], [2.01, .4, .7], [3.02, .18, .5], [4.05, .08, .35], [5.1, .03, .22]]
  },
  {
    id: 'piano', name: 'Soft Piano',
    description: 'Gentle hammered-string character with medium sustain.',
    model: 'marimba', wave: 'triangle', decay: 1.9, attack: .004, brightness: .6,
    modes: [[1, 1, 1], [2, .32, .65], [3, .12, .45], [4.1, .05, .3], [5.2, .02, .18]]
  },
  {
    id: 'synth-pad', name: 'Synth Pad',
    description: 'Slow-attack sustained pad for ambient layering.',
    model: 'flute', wave: 'sine', decay: 3.5, attack: .12, brightness: .4, sustain: true,
    modes: [[1, 1, 1], [1.5, .2, .6], [2, .15, .5], [3, .06, .3]]
  },
  {
    id: 'pluck', name: 'Soft Pluck',
    description: 'Short muted pluck, useful for rhythmic patterns.',
    model: 'kalimba', wave: 'triangle', decay: 0.55, attack: .001, brightness: .85,
    modes: [[1, 1, 1], [2.4, .22, .4], [4.1, .06, .22]]
  },
  {
    id: 'glass', name: 'Glass Harmonica',
    description: 'Ethereal rubbed-glass tone with slow bloom.',
    model: 'bowl', wave: 'sine', decay: 3.8, attack: .08, brightness: .9, sustain: true,
    modes: [[1, 1, 1], [1.01, .35, .95], [2.02, .12, .55], [3.05, .04, .3]]
  },
  {
    id: 'log-drum', name: 'Log Drum',
    description: 'Wooden slit-drum thump with short, warm body.',
    model: 'marimba', wave: 'sine', decay: 0.7, attack: .003, brightness: .4,
    modes: [[1, 1, 1], [2.8, .2, .4], [5.2, .05, .22]]
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
    const list = (notes || []).slice(0, 9);
    this.pitches = new Array(9).fill(null);
    list.forEach((n, i) => {
      const idx = (n.index != null && n.index >= 0 && n.index <= 8) ? n.index : i;
      this.pitches[idx] = {
        midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: idx
      };
    });
    for (let i = 0; i < 9; i++) {
      if (!this.pitches[i]) {
        const src = list[Math.min(i, Math.max(0, list.length - 1))];
        if (src) {
          this.pitches[i] = {
            midi: src.midi, freq: src.freq, name: src.name, kind: src.kind, index: i
          };
        }
      }
    }
  }
  getNotes() { return this.pitches.filter(Boolean).slice(); }
  getZones() { return this._zones || []; }

  noteOn(gesture = {}, zone = {}) {
    if (!this.audioCtx || !this.bus) return;
    if (!this.ready) this._ready = true;
    const idx = zone.index ?? zone.idx ?? 0;
    if (idx < 0 || idx > 8) return;
    let note = this.pitches[idx];
    if (!note) note = this.pitches.find(Boolean);
    if (!note || !note.freq) return;

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
      const levelBoost = isSustain ? 1 : 1.35;
      const peak = level * vel * (.55 + (1 - radial * .25) * .45) * levelBoost;
      gain.gain.setValueAtTime(.0001, t);
      const atk = Math.max(0.002, preset.attack || 0.005);
      gain.gain.linearRampToValueAtTime(Math.max(.0002, peak), t + atk);
      if (!isSustain) {
        const end = t + Math.max(atk + 0.06, decay * damping);
        try { gain.gain.exponentialRampToValueAtTime(.0001, end); }
        catch (_) { gain.gain.linearRampToValueAtTime(.0001, end); }
        try { osc.stop(end + .05); } catch (_) {}
      }
      osc.connect(partialFilter);
      partialFilter.connect(gain);
      gain.connect(out);
      osc.start(t);
      oscillators.push({ osc, gain, filter: partialFilter });
    });

    if (preset.model === 'flute' || preset.model === 'ocarina') {
      addNoise(ctx, out, t, {
        frequency: preset.model === 'flute' ? 3200 : 1800,
        level: preset.model === 'flute' ? .022 * vel : .012 * vel,
        attack: preset.attack * .6,
        duration: isSustain ? undefined : Math.min(.2, decay * .15),
        loop: isSustain,
        filter: 'bandpass',
        q: 1.2
      });
    }

    const voice = {
      idx,
      oneShot: !isSustain,
      stop: (when, release = .08) => {
        const stopAt = when ?? ctx.currentTime;
        for (const { osc, gain } of oscillators) {
          try {
            gain.gain.cancelScheduledValues(stopAt);
            gain.gain.setTargetAtTime(.0001, stopAt, Math.max(.01, release / 3));
            osc.stop(stopAt + release + .05);
          } catch (_) {}
        }
        setTimeout(() => {
          if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
          try { out.disconnect(); } catch (_) {}
        }, (release + .08) * 1000);
      }
    };
    if (!isSustain && oscillators[0]) {
      oscillators[0].osc.onended = () => {
        if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
        try { out.disconnect(); } catch (_) {}
      };
    }
    this.activeVoices.set(idx, voice);
  }

  noteOff(idx) {
    const voice = this.activeVoices.get(idx);
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
      if (this.zoneFlash[i] > .001) { this.zoneFlash[i] *= .88; active = true; }
      else this.zoneFlash[i] = 0;
    }
    return active;
  }
}

export const TONAL_INSTRUMENT_PRESETS = PRESETS;
export function createTonalInstruments() { return PRESETS.map(preset => new TonalInstrument(preset)); }
