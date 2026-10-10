/**
 * instruments/handpan.js — Handpan as first-class Instrument
 *
 * Expression:
 *   - aftertouch: pressure → gain + vibrato depth, radial → brightness
 *   - MPE pitch bend: vertical drift → cents detune (smoothed)
 *   - glide/portamento: slide between pads retargets pitch smoothly
 */
import { Instrument } from '../instrument.js';
import { NoteSampleBank } from '../note-sample-bank.js';
import { VOICE_PRESETS } from '../voice-presets.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];
const ZIGZAG_SLOTS = [0, 1, 7, 2, 6, 3, 5, 4];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const PITCH_BEND_RANGE = 2;
/** Portamento time when gliding between pads (seconds). */
const GLIDE_TIME = 0.12;
/** Smoothing time constant for live pitch bend (seconds). */
const BEND_SMOOTH = 0.055;
/** Smoothing for pressure-driven gain / filter. */
const PRESSURE_SMOOTH = 0.06;

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

/** Ease pressure into a musical curve (soft knee). */
function pressureCurve(p) {
  p = Math.max(0, Math.min(1, p));
  // Blend linear + exponential for natural aftertouch feel
  return p * 0.35 + Math.pow(p, 1.6) * 0.65;
}

export class HandpanInstrument extends Instrument {
  constructor() {
    super({
      id: 'handpan',
      name: 'Handpan',
      description: '9-note radial steel handpan with aftertouch, MPE bend, and glide.',
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
    this.pitchBendCents = new Float32Array(9);
    this.pitchBendRange = PITCH_BEND_RANGE;
    this.glideTime = GLIDE_TIME;
    /** Smoothed pressure per pad for continuous effects. */
    this._smoothPressure = new Float32Array(9);
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

  getNotes() { return this.notes.slice(); }
  getZones() { return this._zones || []; }

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
  setPitchBendRange(semitones) {
    this.pitchBendRange = Math.max(0.25, Math.min(48, semitones));
  }
  setGlideTime(seconds) {
    this.glideTime = Math.max(0.02, Math.min(1.5, seconds));
  }

  get scaleLabel() { return HANDPAN_SCALES[this.scaleIndex]?.label || ''; }
  get rootLabel() { return NOTE_NAMES[this.rootIndex]; }
  get voiceName() { return VOICE_PRESETS[this.voiceIndex]?.name || 'Steel'; }

  _makeExpressNodes(ctx, dest, t) {
    const expressFilter = ctx.createBiquadFilter();
    expressFilter.type = 'lowpass';
    expressFilter.frequency.setValueAtTime(12000, t);
    expressFilter.Q.value = 0.7;

    const expressGain = ctx.createGain();
    expressGain.gain.setValueAtTime(1, t);

    // Subtle vibrato LFO driven by pressure depth
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0, t);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5.2, t);
    lfo.connect(vibGain);
    lfo.start(t);

    expressFilter.connect(expressGain);
    expressGain.connect(dest);

    return { expressFilter, expressGain, vibGain, lfo };
  }

  _applyPitchBend(voice, cents, t, smooth = BEND_SMOOTH) {
    if (!voice || voice.released) return;
    const clamped = Math.max(-this.pitchBendRange * 100, Math.min(this.pitchBendRange * 100, cents));

    if (voice.oscs) {
      for (const osc of voice.oscs) {
        try {
          osc.detune.cancelScheduledValues(t);
          osc.detune.setTargetAtTime(clamped, t, smooth);
        } catch (_) {
          try { osc.detune.value = clamped; } catch (_) {}
        }
      }
    }

    if (voice.sampleSources) {
      const ratio = Math.pow(2, clamped / 1200);
      for (const src of voice.sampleSources) {
        if (!src || !src.playbackRate) continue;
        const base = src._baseRate ?? 1;
        try {
          src.playbackRate.cancelScheduledValues(t);
          src.playbackRate.setTargetAtTime(base * ratio, t, smooth);
        } catch (_) {
          try { src.playbackRate.value = base * ratio; } catch (_) {}
        }
      }
    }
  }

  /**
   * Glide an existing synth voice to a new pad frequency (portamento).
   * Returns true if glide was applied; false if a fresh strike is needed.
   */
  glideTo(fromIdx, toIdx, gesture, zone) {
    if (!this.ready || !this.audioCtx) return false;
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return false;
    if (toIdx < 0 || toIdx > 8) return false;

    const voice = this.activeVoices.get(fromIdx);
    const note = this.notes[toIdx];
    if (!voice || voice.released || !note) return false;

    // Samples are one-shots — fall back to strike for sample voices
    if (voice.kind === 'sample' || !voice.oscs) return false;

    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const glide = this.glideTime;
    const preset = VOICE_PRESETS[this.voiceIndex] || VOICE_PRESETS[0];
    const f = note.freq;

    // Move voice map entry to new index
    this.activeVoices.delete(fromIdx);
    this.held[fromIdx] = 0;
    this.pitchBendCents[fromIdx] = 0;

    voice.idx = toIdx;
    voice.baseFreq = f;
    this.activeVoices.set(toIdx, voice);
    this.held[toIdx] = 1;
    this.pitchBendCents[toIdx] = 0;
    this.glow[toIdx] = Math.min(1, 0.5 + (gesture?.velocity ?? 0.5) * 0.4);
    this.zoneFlash[toIdx] = zone?.radial ?? 0.4;

    // Portamento: ramp each partial to new frequency
    preset.partials.forEach((ratio, i) => {
      const osc = voice.oscs[i];
      if (!osc) return;
      const target = f * ratio * (1 + ((i % 2) ? -1 : 1) * (preset.spread || 0.005));
      try {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, target), t + glide);
        osc.detune.cancelScheduledValues(t);
        osc.detune.setTargetAtTime(0, t, 0.04);
      } catch (_) {
        try { osc.frequency.value = target; } catch (_) {}
      }
    });

    // Soft gain bump on glide arrival
    if (voice.expressGain) {
      const g = voice.expressGain.gain;
      try {
        const cur = g.value;
        g.cancelScheduledValues(t);
        g.setValueAtTime(cur, t);
        g.linearRampToValueAtTime(Math.min(1.2, cur * 1.08), t + 0.03);
        g.setTargetAtTime(voice.baseGain ?? 1, t + 0.03, 0.08);
      } catch (_) {}
    }

    this.lastStrikeAt.set(toIdx, performance.now());
    return true;
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
    this._smoothPressure[idx] = pressure;

    const prev = this.activeVoices.get(idx);
    if (prev) {
      if (prev.stop) prev.stop(t, 0.04);
      else this._releaseVoice(prev, t, 0.04);
    }

    this.glow[idx] = Math.min(1, 0.55 + vel * 0.45);
    this.zoneFlash[idx] = radial;
    this.held[idx] = 1;
    this.pitchBendCents[idx] = 0;
    this.lastStrikeAt.set(idx, performance.now());

    if (this.sampleBank && this.sampleBank.ready) {
      const played = this.sampleBank.play(note.midi, this.bus, t, { vel, radial, angleRad });
      if (played) {
        const expressGain = ctx.createGain();
        const pc = pressureCurve(pressure);
        expressGain.gain.setValueAtTime(0.8 + pc * 0.4, t);
        try {
          played.bus.disconnect();
          played.bus.connect(expressGain);
          expressGain.connect(this.bus);
        } catch (_) {}

        const sampleSources = [];
        if (Array.isArray(played.nodes)) {
          for (const n of played.nodes) {
            if (n && typeof n.start === 'function' && n.playbackRate) {
              n._baseRate = n.playbackRate.value || 1;
              sampleSources.push(n);
            }
          }
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
          vibGain: null,
          sampleSources,
          kind: 'sample',
          baseGain: 0.8 + pc * 0.4,
          baseFreq: note.freq
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
    const pc = pressureCurve(pressure);

    const { expressFilter, expressGain, vibGain, lfo } = this._makeExpressNodes(ctx, this.bus, t);
    const bright = Math.max(0, Math.min(1, radial));
    const cutoff = 1800 + bright * 10000 + vel * 2000;
    expressFilter.frequency.setValueAtTime(cutoff, t);
    expressFilter.Q.setValueAtTime(0.6 + pc * 0.8, t);
    expressGain.gain.setValueAtTime(0.88 + pc * 0.28, t);
    // Vibrato depth starts near zero; pressure opens it
    vibGain.gain.setValueAtTime(pc * 6, t); // cents-ish via detune connection below

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
      osc.detune.value = 0;
      // Wire vibrato LFO into detune
      try { vibGain.connect(osc.detune); } catch (_) {}
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
      vibGain,
      lfo,
      kind: 'synth',
      baseGain: 0.88 + pc * 0.28,
      baseFreq: f,
      stop: (tt, tc) => this._releaseVoice(voice, tt, tc)
    };

    oscs[0].onended = () => {
      this.activeVoices.delete(idx);
      try {
        out.disconnect();
        expressFilter.disconnect();
        expressGain.disconnect();
        vibGain.disconnect();
        lfo.stop();
      } catch (_) {}
    };

    this.activeVoices.set(idx, voice);
  }

  /**
   * Continuous expression while held.
   * pressure → gain + vibrato depth + filter Q (smoothed)
   * radial → brightness
   * pitchBend → MPE detune (smoothed)
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
    const rawP = Math.max(
      0,
      Math.min(1, gesture.pressure || gesture.force || gesture.intensity || 0.5)
    );
    // One-pole smooth pressure
    const sp = this._smoothPressure[idx] + (rawP - this._smoothPressure[idx]) * 0.22;
    this._smoothPressure[idx] = sp;
    const pc = pressureCurve(sp);

    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));

    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.3 + pc * 0.65));
    this.zoneFlash[idx] = radial;

    // Gain aftertouch (smoothed)
    if (voice.expressGain) {
      const target = (voice.baseGain ?? 1) * (0.78 + pc * 0.45);
      try {
        voice.expressGain.gain.cancelScheduledValues(t);
        voice.expressGain.gain.setTargetAtTime(target, t, PRESSURE_SMOOTH);
      } catch (_) {}
    }

    // Brightness + resonance from pressure
    if (voice.expressFilter) {
      const bright = Math.max(0, Math.min(1, radial));
      const cutoff = 1500 + bright * 11500 + pc * 1800;
      const q = 0.55 + pc * 1.1;
      try {
        voice.expressFilter.frequency.cancelScheduledValues(t);
        voice.expressFilter.frequency.setTargetAtTime(cutoff, t, PRESSURE_SMOOTH);
        voice.expressFilter.Q.cancelScheduledValues(t);
        voice.expressFilter.Q.setTargetAtTime(q, t, PRESSURE_SMOOTH);
      } catch (_) {}
    }

    // Pressure → vibrato depth (cents)
    if (voice.vibGain) {
      const vibDepth = pc * 9; // 0…9 cents
      try {
        voice.vibGain.gain.cancelScheduledValues(t);
        voice.vibGain.gain.setTargetAtTime(vibDepth, t, 0.08);
      } catch (_) {}
    }
    // Slightly speed up vibrato under pressure
    if (voice.lfo) {
      try {
        voice.lfo.frequency.cancelScheduledValues(t);
        voice.lfo.frequency.setTargetAtTime(4.6 + pc * 2.2, t, 0.1);
      } catch (_) {}
    }

    // MPE pitch bend with smoother constant
    let bendSemi = gesture.pitchBend;
    if (bendSemi == null && typeof gesture.pitchBendNorm === 'number') {
      // Cubic ease for finer control near center
      const n = gesture.pitchBendNorm;
      const eased = Math.sign(n) * Math.pow(Math.abs(n), 1.35);
      bendSemi = eased * this.pitchBendRange;
    }
    if (typeof bendSemi === 'number' && Number.isFinite(bendSemi)) {
      const cents = bendSemi * 100;
      this.pitchBendCents[idx] = cents;
      this._applyPitchBend(voice, cents, t, BEND_SMOOTH);
    }
  }

  _releaseVoice(voice, t, tc) {
    if (!voice || voice.released) return;
    voice.released = true;
    try {
      if (voice.vibGain) {
        voice.vibGain.gain.cancelScheduledValues(t);
        voice.vibGain.gain.setTargetAtTime(0, t, 0.05);
      }
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
    this.pitchBendCents[zoneId] = 0;
    this._smoothPressure[zoneId] = 0;
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    if (v.stop) v.stop(this.audioCtx.currentTime, 0.08);
    else this._releaseVoice(v, this.audioCtx.currentTime, 0.08);
  }

  dampAll() {
    this.held.fill(0);
    this.pitchBendCents.fill(0);
    this._smoothPressure.fill(0);
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
        this.glow[i] *= this.held[i] ? 0.97 : 0.9;
        any = true;
      } else {
        this.glow[i] = 0;
      }
    }
    return any;
  }

  getPerformanceHints() {
    return {
      maxVoices: 9,
      prefersSamples: true,
      supportsAftertouch: true,
      supportsPitchBend: true,
      supportsGlide: true,
      pitchBendRange: this.pitchBendRange,
      glideTime: this.glideTime
    };
  }
}
