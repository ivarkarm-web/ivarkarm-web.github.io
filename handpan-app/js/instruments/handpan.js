/**
 * instruments/handpan.js — Handpan as first-class Instrument
 * Synthesized handpan voice with scale-aware 8–13 note layouts.
 */
import { Instrument } from '../instrument.js';
import { HANDPAN_SCALES, scaleToCents } from './handpan-scales.js?v=6';
import { MIN_NOTES, MAX_NOTES, ringAngles } from '../pad-layout.js?v=3';

export { HANDPAN_SCALES, MIN_NOTES, MAX_NOTES };

const NOTE_NAMES = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];

export function extendScaleCents(baseCents, count) {
  const out = baseCents.slice(0, Math.min(baseCents.length, Math.max(1, count)));
  if (count <= out.length) return out.slice(0, Math.max(1, count));
  const octave = 1200;
  const classes = [...new Set(out.map((c) => Math.round((((c % octave) + octave) % octave) * 100) / 100))].sort((a, b) => a - b);
  let top = Math.max(...out);
  while (out.length < count) {
    const floorOct = Math.floor(top / octave) * octave;
    let next = null;
    for (let oct = 0; oct < 3 && next === null; oct++) {
      for (const pc of classes) {
        const c = floorOct + oct * octave + pc;
        if (c > top + 0.5) { next = c; break; }
      }
    }
    if (next == null) break;
    out.push(next);
    top = next;
  }
  return out;
}

const DEFAULT_NOTE_COUNT = 8;
const PITCH_BEND_RANGE = 2;
const GLIDE_TIME = 0.12;
const BEND_SMOOTH = 0.055;
const PRESSURE_SMOOTH = 0.06;

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function centsToFreq(rootMidi, cents) { return mtof(rootMidi) * Math.pow(2, cents / 1200); }
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
function centsName(rootMidi, cents) {
  const totalMidi = rootMidi + cents / 100;
  const nearest = Math.round(totalMidi);
  const diff = Math.round((totalMidi - nearest) * 100);
  const base = NOTE_NAMES[((nearest % 12) + 12) % 12] + (Math.floor(nearest / 12) - 1);
  if (Math.abs(diff) < 8) return base;
  const sign = diff > 0 ? '+' : '\u2212';
  return base + sign + Math.abs(diff) + '\xA2';
}
function rootToMidi(rootIndex, octaveOffset) { return 48 + rootIndex + octaveOffset * 12; }
function pressureCurve(p) {
  p = Math.max(0, Math.min(1, p));
  return p * 0.35 + Math.pow(p, 1.6) * 0.65;
}

export class HandpanInstrument extends Instrument {
  constructor() {
    super({
      id: 'handpan',
      name: 'Handpan',
      description: 'Radial steel handpan with scale-fixed tonefields, aftertouch and MPE pitch bend.',
      category: 'handpan',
      engineKind: 'synth',
      polyphony: MAX_NOTES,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer']
    });
    this.scaleIndex = 0;
    this.rootIndex = 2;
    this.octaveOffset = 0;
    this.voiceIndex = 0;
    this.noteCount = MIN_NOTES;
    this.notes = [];
    this.lastStrikeAt = new Map();
    this.glow = new Float32Array(MAX_NOTES);
    this.zoneFlash = new Float32Array(MAX_NOTES);
    this.held = new Uint8Array(MAX_NOTES);
    this.pitchBendCents = new Float32Array(MAX_NOTES);
    this.pitchBendRange = PITCH_BEND_RANGE;
    this.glideTime = GLIDE_TIME;
    this._smoothPressure = new Float32Array(MAX_NOTES);
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
    this.rebuildNotes();
  }

  deactivate() { super.deactivate(); }

  rebuildNotes() {
    const scale = HANDPAN_SCALES[this.scaleIndex] || HANDPAN_SCALES[0];
    const base = rootToMidi(this.rootIndex, this.octaveOffset);
    // Note count is fixed by the active scale definition (not user-adjustable).
    const count = Math.max(MIN_NOTES, Math.min(MAX_NOTES, Math.round(Number(this.noteCount) || DEFAULT_NOTE_COUNT)));
    const scaleCents = extendScaleCents(scaleToCents(scale), count);
    this.noteCount = count;
    const centsList = scaleCents.slice(0, count);
    const isMicro = !!(scale.cents && scale.cents.length) || (scale.tuning && scale.tuning !== '12-TET');
    const angles = ringAngles(Math.max(1, centsList.length - 1));

    this.notes = centsList.map((cents, i) => {
      const midiExact = base + cents / 100;
      const midiNearest = Math.round(midiExact);
      const isDing = i === 0;
      return {
        index: i,
        midi: midiNearest,
        midiExact,
        cents,
        name: isMicro ? centsName(base, cents) : midiName(midiExact),
        freq: centsToFreq(base, cents),
        kind: isDing ? 'ding' : 'ring',
        angle: isDing ? 0 : angles[i - 1],
        key: KEYS[i],
        microtonal: isMicro
      };
    });
  }

  getNotes() { return this.notes.slice(); }
  getZones() { return this._zones || []; }

  addNote() {
    if (this.noteCount >= MAX_NOTES) return false;
    this.setNoteCount(this.noteCount + 1);
    return true;
  }
  setNoteCount(n) {
    this.noteCount = Math.max(MIN_NOTES, Math.min(MAX_NOTES, Math.round(Number(n) || DEFAULT_NOTE_COUNT)));
    this.rebuildNotes();
  }

  setScaleIndex(i) {
    this.scaleIndex = ((i % HANDPAN_SCALES.length) + HANDPAN_SCALES.length) % HANDPAN_SCALES.length;
    const s = HANDPAN_SCALES[this.scaleIndex];
    if (s && typeof s.rootMidi === 'number') {
      const midi = s.rootMidi;
      let bestPc = 0, bestOct = 0, bestDist = 999;
      for (let oct = -1; oct <= 1; oct++) {
        for (let pc = 0; pc < 12; pc++) {
          const m = 48 + pc + oct * 12;
          const d = Math.abs(m - midi);
          if (d < bestDist) { bestDist = d; bestPc = pc; bestOct = oct; }
        }
      }
      this.rootIndex = bestPc;
      this.octaveOffset = bestOct;
    } else if (s && typeof s.rootPc === 'number') {
      this.rootIndex = ((s.rootPc % 12) + 12) % 12;
    }
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
  setVoiceIndex(i) { this.voiceIndex = 0; }
  setPitchBendRange(semitones) {
    this.pitchBendRange = Math.max(0.25, Math.min(48, semitones));
  }
  setGlideTime(seconds) {
    this.glideTime = Math.max(0.02, Math.min(1.5, seconds));
  }

  get scaleLabel() {
    const s = HANDPAN_SCALES[this.scaleIndex];
    if (!s) return '';
    return s.tuning && s.tuning !== '12-TET' ? s.label + ' \u00B7 ' + s.tuning : s.label;
  }
  get rootLabel() { return NOTE_NAMES[this.rootIndex]; }
  get voiceName() { return 'Handpan'; }
  get isMicrotonal() {
    const s = HANDPAN_SCALES[this.scaleIndex];
    return !!(s && s.cents && s.cents.length);
  }

  _applyPitchBend(voice, cents, t, smooth = BEND_SMOOTH) {
    if (!voice || voice.released) return;
    const clamped = Math.max(-this.pitchBendRange * 100, Math.min(this.pitchBendRange * 100, cents));
    if (voice.handle) { voice.handle.detune(clamped, smooth); return; }
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
  }

  glideTo() { return false; }

  noteOn(gesture, zone) {
    if (!this.ready || !this.audioCtx || !this.bus) return;
    const idx = zone?.index ?? zone?.i;
    if (idx == null || idx < 0 || idx >= this.noteCount) return;
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
    this._strikeSynth(note, idx, vel, angleRad, pressure, radial);
  }

  // Modal, fully synthesized handpan voice: no note recordings or sample-bank
  // dependency. Inharmonic partials give the ding its characteristic bloom.
  _strikeSynth(note, idx, velocity, angleRad, pressure = 0.5, radial = 0.4) {
    const ctx = this.audioCtx;
    if (!ctx || !this.bus) return;
    const now = ctx.currentTime + 0.001;
    const pan = Math.max(-1, Math.min(1, Math.sin(angleRad || 0) * 0.3));
    const output = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const expression = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const partials = note.kind === 'ding'
      ? [[1, 0.62], [2.756, 0.30], [5.404, 0.15], [8.933, 0.065], [12.2, 0.025]]
      : [[1, 0.72], [2.01, 0.24], [3.9, 0.105], [5.43, 0.045]];
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500 + Math.max(0, Math.min(1, radial)) * 9000, now);
    filter.Q.setValueAtTime(0.7 + pressureCurve(pressure) * 1.1, now);
    expression.gain.setValueAtTime(0.82 + pressureCurve(pressure) * 0.32, now);
    output.gain.setValueAtTime(0.0001, now);
    output.gain.linearRampToValueAtTime(Math.max(0.025, velocity) * (note.kind === 'ding' ? 0.58 : 0.46), now + 0.006);
    output.gain.exponentialRampToValueAtTime(0.0001, now + (note.kind === 'ding' ? 4.8 : 3.5));
    const oscs = [];
    for (const [ratio, amplitude] of partials) {
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(Math.max(24, Math.min(12000, note.freq * ratio)), now);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 3.5, now);
      partialGain.gain.value = amplitude;
      osc.connect(partialGain);
      partialGain.connect(filter);
      osc.start(now);
      osc.stop(now + 5.1);
      oscs.push(osc);
    }
    filter.connect(expression);
    if (panner) {
      panner.pan.setValueAtTime(pan, now);
      expression.connect(panner);
      panner.connect(output);
    } else {
      expression.connect(output);
    }
    output.connect(this.bus);
    const voice = {
      idx, kind: 'synth', oscs, out: output, expressGain: expression, expressFilter: filter,
      released: false, baseFreq: note.freq,
      stop: (time = ctx.currentTime, release = 0.12) => {
        if (voice.released) return;
        voice.released = true;
        const at = Math.max(ctx.currentTime, time || ctx.currentTime);
        try {
          output.gain.cancelScheduledValues(at);
          output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), at);
          output.gain.setTargetAtTime(0.0001, at, Math.max(0.025, release));
        } catch (_) {}
        try { oscs.forEach((osc) => { try { osc.stop(at + Math.max(0.08, release) * 5); } catch (_) {} }); } catch (_) {}
        setTimeout(() => {
          try { oscs.forEach((osc) => osc.disconnect()); filter.disconnect(); expression.disconnect(); output.disconnect(); panner?.disconnect(); } catch (_) {}
          if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
        }, Math.max(400, release * 5000));
      }
    };
    const previous = this.activeVoices.get(idx);
    if (previous?.stop) previous.stop(now, 0.07);
    this.activeVoices.set(idx, voice);
    setTimeout(() => {
      if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
    }, 6000);
  }

  express(gesture, zone) {
    if (!this.ready || !this.audioCtx) return;
    const idx = zone?.index ?? zone?.i;
    if (idx == null || idx < 0 || idx >= this.noteCount) return;
    if (!this.held[idx]) return;
    const voice = this.activeVoices.get(idx);
    if (!voice || voice.released) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const rawP = Math.max(0, Math.min(1, gesture.pressure || gesture.force || gesture.intensity || 0.5));
    const sp = this._smoothPressure[idx] + (rawP - this._smoothPressure[idx]) * 0.22;
    this._smoothPressure[idx] = sp;
    const pc = pressureCurve(sp);
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.12 + pc * 0.18));
    this.zoneFlash[idx] = radial * 0.55;
    if (voice.handle) voice.handle.level(0.82 + pc * 0.4, PRESSURE_SMOOTH);
    if (voice.expressGain) {
      try {
        voice.expressGain.gain.cancelScheduledValues(t);
        voice.expressGain.gain.setTargetAtTime((voice.baseGain ?? 1) * (0.78 + pc * 0.45), t, PRESSURE_SMOOTH);
      } catch (_) {}
    }
    if (voice.expressFilter) {
      try {
        voice.expressFilter.frequency.cancelScheduledValues(t);
        voice.expressFilter.frequency.setTargetAtTime(1500 + Math.max(0, Math.min(1, radial)) * 11500 + pc * 1800, t, PRESSURE_SMOOTH);
        voice.expressFilter.Q.cancelScheduledValues(t);
        voice.expressFilter.Q.setTargetAtTime(0.55 + pc * 1.1, t, PRESSURE_SMOOTH);
      } catch (_) {}
    }
    if (voice.vibGain) {
      try {
        voice.vibGain.gain.cancelScheduledValues(t);
        voice.vibGain.gain.setTargetAtTime(pc * 9, t, 0.08);
      } catch (_) {}
    }
    if (voice.lfo) {
      try {
        voice.lfo.frequency.cancelScheduledValues(t);
        voice.lfo.frequency.setTargetAtTime(4.6 + pc * 2.2, t, 0.1);
      } catch (_) {}
    }
    let bendSemi = gesture.pitchBend;
    if (bendSemi == null && typeof gesture.pitchBendNorm === 'number') {
      const n = gesture.pitchBendNorm;
      bendSemi = Math.sign(n) * Math.pow(Math.abs(n), 1.35) * this.pitchBendRange;
    }
    if (typeof bendSemi === 'number' && Number.isFinite(bendSemi)) {
      this.pitchBendCents[idx] = bendSemi * 100;
      this._applyPitchBend(voice, bendSemi * 100, t, BEND_SMOOTH);
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
    const voice = this.activeVoices.get(zoneId);
    if (voice && !voice.released && voice.out && this.audioCtx) {
      // Let a struck note ring, then gently damp it after the finger lifts.
      const at = this.audioCtx.currentTime;
      try {
        voice.out.gain.cancelScheduledValues(at);
        voice.out.gain.setValueAtTime(Math.max(0.0001, voice.out.gain.value), at);
        voice.out.gain.setTargetAtTime(0.0001, at + 1.6, 0.65);
      } catch (_) {}
    }
    if (this.glow[zoneId] > 0.15) this.glow[zoneId] = Math.min(this.glow[zoneId], 0.35);
    if (this.zoneFlash[zoneId] > 0.1) this.zoneFlash[zoneId] *= 0.5;
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
    for (let i = 0; i < MAX_NOTES; i++) {
      const decay = this.held[i] ? 0.92 : 0.82;
      if (this.glow[i] > 0.001) { this.glow[i] *= decay; any = true; }
      else this.glow[i] = 0;
      if (this.zoneFlash[i] > 0.001) { this.zoneFlash[i] *= this.held[i] ? 0.9 : 0.78; any = true; }
      else this.zoneFlash[i] = 0;
    }
    return any;
  }

  getPerformanceHints() {
    return {
      maxVoices: MAX_NOTES,
      prefersSamples: false,
      supportsAftertouch: true,
      supportsPitchBend: true,
      supportsGlide: true,
      supportsMicrotonal: true,
      pitchBendRange: this.pitchBendRange,
      glideTime: this.glideTime
    };
  }
}
