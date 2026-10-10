/**
 * instruments/handpan.js — Handpan as first-class Instrument
 * Supports aftertouch: pressure → gain, radial position → brightness while held.
 */
import { Instrument } from '../instrument.js';
import { NoteSampleBank } from '../note-sample-bank.js';
import { VOICE_PRESETS } from '../voice-presets.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];
const ZIGZAG_SLOTS = [0, 1, 7, 2, 6, 3, 5, 4];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

export const HANDPAN_SCALES = [
  { id: 'celtic-minor', label: 'Celtic Minor', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'kurdan-integral', label: 'Kurdan / Integral', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'hijaz', label: 'Hijaz', intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19] },
  { id: 'pygmy', label: 'Pygmy', intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24] },
  { id: 'amara', label: 'Amara', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22] },
  { id: 'akebono', label: 'AkeBono', intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24] },
  { id: 'equinox', label: 'Equinox', intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24] },
  { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22] },
  { id: 'aeolian', label: 'Aeolian', intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19] },
  { id: 'major-sabye', label: 'Major / Sabye', intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23] }
];

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
function rootToMidi(rootIndex, octaveOffset) {
  return 48 + rootIndex + octaveOffset * 12;
}

export class HandpanInstrument extends Instrument {
  constructor() {
    super({
      id: 'handpan',
      name: 'Handpan',
      description: '9-note radial steel handpan with interval scales, dynamic transposition, and aftertouch.',
      category: 'handpan',
      polyphony: 9,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer']
    });
    this.scaleIndex = 0;
    this.rootIndex = 2;
    this.octaveOffset = 0;
    this.voiceIndex = 0;
    this.notes = [];
    this.sampleBank = null;
    this.lastStrikeAt = new Map();
    this.glow = new Float32Array(9);
    this.zoneFlash = new Float32Array(9);
    this.held = new Uint8Array(9);
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
    if (!this.sampleBank) {
      this.sampleBank = new NoteSampleBank(audioCtx, './sounds/notes/');
      try {
        await this.sampleBank.load();
        console.info('[handpan] samples', this.sampleBank.byMidi.size);
      } catch (e) {
        console.warn('[handpan] sample load failed, synth fallback active', e);
      }
    }
    this.rebuildNotes();
  }

  deactivate() {
    super.deactivate();
  }

  rebuildNotes() {
    const scale = HANDPAN_SCALES[this.scaleIndex] || HANDPAN_SCALES[0];
    const base = rootToMidi(this.rootIndex, this.octaveOffset);
    this.notes = scale.intervals.map((iv, i) => {
      const midi = base + iv;
      const isDing = i === 0;
      return {
        index: i,
        midi,
        name: midiName(midi),
        freq: mtof(midi),
        kind: isDing ? 'ding' : 'ring',
        angle: isDing ? 0 : RING_ANGLES[ZIGZAG_SLOTS[i - 1]],
        key: KEYS[i]
      };
    });
  }

  getNotes() {
    return this.notes.slice();
  }

  getZones() {
    return this._zones || [];
  }

  setScaleIndex(i) {
    this.scaleIndex = ((i % HANDPAN_SCALES.length) + HANDPAN_SCALES.length) % HANDPAN_SCALES.length;
    this.rebuildNotes();
  }

  setRootIndex(i) {
    this.rootIndex = ((i % 12) + 12) % 12;
    this.rebuildNotes();
  }

  setOctaveOffset(o) {
    this.octaveOffset = Math.max(-1, Math.min(1, o));
    this.rebuildNotes();
  }

  setVoiceIndex(i) {
    this.voiceIndex = ((i % VOICE_PRESETS.length) + VOICE_PRESETS.length) % VOICE_PRESETS.length;
  }

  get scaleLabel() {
    return HANDPAN_SCALES[this.scaleIndex]?.label || '';
  }

  get rootLabel() {
    return NOTE_NAMES[this.rootIndex];
  }

  get voiceName() {
    return VOICE_PRESETS[this.voiceIndex]?.name || 'Steel';
  }

  /**
   * Build shared aftertouch nodes (expressGain + expressFilter) that sit
   * between the voice output and the instrument bus.
   */
  _makeExpressNodes(ctx, dest, t) {
    const expressFilter = ctx.createBiquadFilter();
    expressFilter.type = 'lowpass';
    expressFilter.frequency.setValueAtTime(12000, t);
    expressFilter.Q.value = 0.7;

    const expressGain = ctx.createGain();
    expressGain.gain.setValueAtTime(1, t);

    expressFilter.connect(expressGain);
    expressGain.connect(dest);

    return { expressFilter, expressGain };
  }

  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone?.index ?? zone?.i;
    if (idx == null || idx < 0 || idx > 8) return;
    const note = this.notes[idx];
    if (!note) return;

    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.12, Math.min(1, gesture.velocity ?? 0.75));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    const angleRad = zone.angleRad ?? gesture.angle ?? 0;
    const pressure = Math.max(0, Math.min(1, gesture.pressure || gesture.force || vel));

    const prev = this.activeVoices.get(idx);
    if (prev) {
      if (prev.stop) prev.stop(t, 0.04);
      else this._releaseVoice(prev, t, 0.04);
    }

    this.glow[idx] = Math.min(1, 0.55 + vel * 0.45);
    this.zoneFlash[idx] = radial;
    this.held[idx] = 1;
    this.lastStrikeAt.set(idx, performance.now());

    // Prefer samples when available
    if (this.sampleBank && this.sampleBank.ready) {
      const played = this.sampleBank.play(note.midi, this.bus, t, { vel, radial, angleRad });
      if (played) {
        // Insert aftertouch gain on the sample bus for live pressure control
        const expressGain = ctx.createGain();
        expressGain.gain.setValueAtTime(0.85 + pressure * 0.3, t);
        try {
          played.bus.disconnect();
          played.bus.connect(expressGain);
          expressGain.connect(this.bus);
        } catch (_) {
          // If graph already locked, keep original path
        }
        this.activeVoices.set(idx, {
          idx,
          stop: (tt, tc) => {
            played.stop(tt, tc);
            try {
              expressGain.gain.cancelScheduledValues(tt);
              expressGain.gain.setTargetAtTime(0, tt, tc);
            } catch (_) {}
          },
          released: false,
          expressGain,
          expressFilter: null,
          kind: 'sample',
          baseGain: 0.85 + pressure * 0.3
        });
        return;
      }
    }

    this._strikeSynth(note, idx, t, vel, radial, pressure);
  }

  _strikeSynth(note, idx, t, vel, radial, pressure = 0.5) {
    const ctx = this.audioCtx;
    const preset = VOICE_PRESETS[this.voiceIndex] || VOICE_PRESETS[0];
    const f = note.freq;
    const z = NoteSampleBank.zoneWeights(radial);

    const { expressFilter, expressGain } = this._makeExpressNodes(ctx, this.bus, t);
    // Initial aftertouch state from strike
    const bright = Math.max(0, Math.min(1, radial));
    const cutoff = 1800 + bright * 10000 + vel * 2000;
    expressFilter.frequency.setValueAtTime(cutoff, t);
    expressGain.gain.setValueAtTime(0.9 + pressure * 0.25, t);

    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(expressFilter);

    const T0 = Math.max(1.5, 5.5 - Math.log(f / 165) / Math.LN2);
    const oscs = [];
    const gains = [
      0.55 * z.fundamental,
      0.32 * z.partials,
      0.18 * z.partials,
      0.1 * z.brightness,
      0.05 * z.brightness
    ];

    preset.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = preset.wave || 'sine';
      osc.frequency.value = f * ratio * (1 + ((i % 2) ? -1 : 1) * (preset.spread || 0.005));
      const g = ctx.createGain();
      const peak = (0.32 + 0.28 * vel) * (gains[i] || 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004 + (1 - vel) * 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + T0 * (preset.decay / 6.2) * (1 - i * 0.07));
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + T0 + 0.12);
      oscs.push(osc);
    });

    const voice = {
      idx,
      out,
      oscs,
      released: false,
      expressGain,
      expressFilter,
      kind: 'synth',
      baseGain: 0.9 + pressure * 0.25,
      stop: (tt, tc) => this._releaseVoice(voice, tt, tc)
    };

    oscs[0].onended = () => {
      this.activeVoices.delete(idx);
      try {
        out.disconnect();
        expressFilter.disconnect();
        expressGain.disconnect();
      } catch (_) {}
    };

    this.activeVoices.set(idx, voice);
  }

  /**
   * Continuous aftertouch while a pad is held.
   * - pressure / force → subtle gain swell
   * - radial position → brightness (filter cutoff)
   * - also refreshes visual glow
   */
  express(gesture, zone) {
    if (!this.ready || !this.audioCtx) return;
    const idx = zone?.index ?? zone?.i;
    if (idx == null || idx < 0 || idx > 8) return;
    if (!this.held[idx]) return;

    const voice = this.activeVoices.get(idx);
    if (!voice || voice.released) return;

    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const pressure = Math.max(
      0,
      Math.min(1, gesture.pressure || gesture.force || gesture.intensity || 0.5)
    );
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));

    // Visual feedback — keep glow alive while pressing
    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.35 + pressure * 0.55));
    this.zoneFlash[idx] = radial;

    // Gain aftertouch (pressure)
    if (voice.expressGain) {
      const target = (voice.baseGain ?? 1) * (0.82 + pressure * 0.35);
      try {
        voice.expressGain.gain.cancelScheduledValues(t);
        voice.expressGain.gain.setTargetAtTime(target, t, 0.04);
      } catch (_) {}
    }

    // Brightness aftertouch (radial → filter cutoff) — synth voices only
    if (voice.expressFilter) {
      const bright = Math.max(0, Math.min(1, radial));
      const cutoff = 1600 + bright * 11000 + pressure * 1500;
      try {
        voice.expressFilter.frequency.cancelScheduledValues(t);
        voice.expressFilter.frequency.setTargetAtTime(cutoff, t, 0.05);
      } catch (_) {}
    }
  }

  _releaseVoice(voice, t, tc) {
    if (!voice || voice.released) return;
    voice.released = true;
    try {
      if (voice.expressGain) {
        voice.expressGain.gain.cancelScheduledValues(t);
        voice.expressGain.gain.setTargetAtTime(0, t, tc);
      } else if (voice.out) {
        voice.out.gain.cancelScheduledValues(t);
        voice.out.gain.setTargetAtTime(0, t, tc);
      }
    } catch (_) {}
  }

  noteOff(zoneId) {
    this.held[zoneId] = 0;
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    if (v.stop) v.stop(this.audioCtx.currentTime, 0.07);
    else this._releaseVoice(v, this.audioCtx.currentTime, 0.07);
  }

  dampAll() {
    this.held.fill(0);
    const t = this.audioCtx ? this.audioCtx.currentTime : 0;
    for (const [, v] of this.activeVoices) {
      if (v.stop) v.stop(t, 0.05);
      else this._releaseVoice(v, t, 0.05);
    }
    this.activeVoices.clear();
  }

  tickGlow() {
    let any = false;
    for (let i = 0; i < 9; i++) {
      if (this.glow[i] > 0.001) {
        // Decay slower while held so aftertouch glow stays visible
        this.glow[i] *= this.held[i] ? 0.97 : 0.9;
        any = true;
      } else {
        this.glow[i] = 0;
      }
    }
    return any;
  }

  getPerformanceHints() {
    return { maxVoices: 9, prefersSamples: true, supportsAftertouch: true };
  }
}
