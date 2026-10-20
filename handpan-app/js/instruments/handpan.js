/**
 * instruments/handpan.js — Handpan as first-class Instrument
 *
 * Expression:
 *   - aftertouch: pressure → gain + vibrato depth, radial → brightness
 *   - MPE pitch bend: vertical drift → cents detune (smoothed)
 *   - glide/portamento: slide between pads retargets pitch smoothly
 *
 * Tuning:
 *   - 12-TET scales via `intervals` (semitones)
 *   - Microtonal via `cents` (absolute cents from root) or just ratios
 */
import { Instrument } from '../instrument.js';
import { NoteSampleBank } from '../note-sample-bank.js?v=4';
import { getSoundLibrary } from './library-family.js?v=1';
import { HANDPAN_SCALES, scaleToCents } from './handpan-scales.js?v=6';
import { MIN_NOTES, MAX_NOTES, ringAngles } from '../pad-layout.js?v=2';

export { HANDPAN_SCALES, MIN_NOTES, MAX_NOTES };

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];

export function extendScaleCents(baseCents, count) {
  const out = baseCents.slice(0, MIN_NOTES);
  if (count <= out.length) return out.slice(0, Math.max(1, count));
  const octave = 1200;
  const classes = [...new Set(out.map((c) => Math.round((((c % octave) + octave) % octave) * 100) / 100))]
    .sort((a, b) => a - b);
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
    out.push(next);
    top = next;
  }
  return out;
}

const PITCH_BEND_RANGE = 2;
const GLIDE_TIME = 0.12;
const BEND_SMOOTH = 0.055;
const PRESSURE_SMOOTH = 0.06;

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function centsToFreq(rootMidi, cents) {
  return mtof(rootMidi) * Math.pow(2, cents / 1200);
}
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
  const sign = diff > 0 ? '+' : '−';
  return base + sign + Math.abs(diff) + '¢';
}
function rootToMidi(rootIndex, octaveOffset) {
  return 48 + rootIndex + octaveOffset * 12;
}

function pressureCurve(p) {
  p = Math.max(0, Math.min(1, p));
  return p * 0.35 + Math.pow(p, 1.6) * 0.65;
}

export class HandpanInstrument extends Instrument {
  constructor() {
    super({
      id: 'handpan',
      name: 'Handpan',
      description: 'Radial steel handpan, 8 to 13 notes, with microtonal scales, aftertouch and MPE pitch bend.',
      category: 'handpan',
      engineKind: 'sample',
      polyphony: MAX_NOTES,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer']
    });
    this.scaleIndex = 0;
    this.rootIndex = 2;
    this.octaveOffset = 0;
    this.voiceIndex = 0;
    this.noteCount = MIN_NOTES;
    this.notes = [];
    this.sampleBank = null;
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
    this.lib = getSoundLibrary(audioCtx, bus);
    this._ensureSampleBank();
    this.rebuildNotes();
  }

  _isRecordedScale() {
    return HANDPAN_SCALES[this.scaleIndex]?.id === 'e-amara-recorded';
  }

  _ensureSampleBank() {
    if (!this._isRecordedScale() || !this.audioCtx || this.sampleBank) return;
    this.sampleBank = new NoteSampleBank(this.audioCtx, './sounds/notes/');
    try {
      this.sampleBank.load()
        .then(() => {
          const sc = HANDPAN_SCALES[this.scaleIndex];
          if (sc?.id) this.sampleBank.setActiveScale(sc.id);
          console.info('[handpan] recorded samples', this.sampleBank.activeScaleId, this.sampleBank.byMidi.size);
        })
        .catch((e) => console.warn('[handpan] recorded sample load failed', e));
    } catch (e) {
      console.warn('[handpan] recorded sample load failed', e);
    }
  }

  _prewarm() {
    if (!this.lib || !this.ready || this._isRecordedScale()) return;
    const freqs = this.notes.map((n) => n.freq);
    this._prewarmToken = (this._prewarmToken || 0) + 1;
    const token = this._prewarmToken;
    this.lib.prewarm(['handpan'], freqs, [0.65], () => token === this._prewarmToken).catch(() => {});
  }

  deactivate() {
    super.deactivate();
  }

  rebuildNotes() {
    const scale = HANDPAN_SCALES[this.scaleIndex] || HANDPAN_SCALES[0];
    const base = rootToMidi(this.rootIndex, this.octaveOffset);
    const centsList = extendScaleCents(scaleToCents(scale), this.noteCount);
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
    this._prewarm();
  }

  getNotes() { return this.notes.slice(); }
  getZones() { return this._zones || []; }

  addNote() {
    if (this.noteCount >= MAX_NOTES) return false;
    this.noteCount += 1;
    this.rebuildNotes();
    return true;
  }
  setNoteCount(n) {
    this.noteCount = Math.max(MIN_NOTES, Math.min(MAX_NOTES, Math.round(n) || MIN_NOTES));
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
    this._ensureSampleBank();
    if (this.sampleBank && s?.id && typeof this.sampleBank.setActiveScale === 'function') {
      this.sampleBank.setActiveScale(s.id);
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
  setVoiceIndex(i) {
    this.voiceIndex = 0;
  }
  setPitchBendRange(semitones) {
    this.pitchBendRange = Math.max(0.25, Math.min(48, semitones));
  }
  setGlideTime(seconds) {
    this.glideTime = Math.max(0.02, Math.min(1.5, seconds));
  }

  get scaleLabel() {
    const s = HANDPAN_SCALES[this.scaleIndex];
    if (!s) return '';
    return s.tuning && s.tuning !== '12-TET' ? `${s.label} · ${s.tuning}` : s.label;
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
    const recordedScale = HANDPAN_SCALES[this.scaleIndex]?.id === 'e-amara-recorded';
    if (recordedScale && (!this.sampleBank || !this.sampleBank.ready)) return;
    if (recordedScale && this.sampleBank && this.sampleBank.ready) {
      const played = this.sampleBank.play(note.midiExact ?? note.midi, this.bus, t, { vel, radial, angleRad });
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
        const voice = {
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
        };
        this.activeVoices.set(idx, voice);
        const strikeSource = played.nodes?.find((node) =>
          node && typeof node.start === 'function' && node.buffer
        );
        if (strikeSource) {
          const onEnded = strikeSource.onended;
          strikeSource.onended = (event) => {
            try { onEnded?.call(strikeSource, event); } catch (_) {}
            if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx);
            try { expressGain.disconnect(); } catch (_) {}
          };
        }
        return;
      }
    }
    if (recordedScale) {
      console.warn('[handpan] no exact E Amara recording for pad', note.name, 'MIDI', note.midi, '— refusing synth fallback to preserve timbre');
      return;
    }
    this._strikeLibrary(note, idx, vel, angleRad, pressure);
  }

  _strikeLibrary(note, idx, vel, angleRad, pressure = 0.5) {
    if (!this.lib) return;
    const handle = this.lib.play('handpan', note.freq, { vel, pan: Math.sin(angleRad || 0) * 0.3 });
    if (!handle) return;
    handle.level(0.85 + pressureCurve(pressure) * 0.3, 0.01);
    const voice = {
      idx, handle, kind: 'lib', released: false, baseFreq: note.freq,
      stop: (tt, tc) => {
        if (voice.released) return;
        voice.released = true;
        handle.stop(Math.max(0.03, tc || 0.05));
      }
    };
    this.activeVoices.set(idx, voice);
    setTimeout(() => { if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx); }, 6000);
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
    if (this.glow[zoneId] > 0.15) this.glow[zoneId] = Math.min(this.glow[zoneId], 0.35);
    if (this.zoneFlash[zoneId] > 0.1) this.zoneFlash[zoneId] *= 0.5;
    const v = this.activeVoices.get(zoneId);
    if (!v || !this.audioCtx) return;
    // Handpan notes are struck one-shots — finger-up ends gesture, sound rings out.
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
      if (this.glow[i] > 0.001) {
        this.glow[i] *= decay;
        any = true;
      } else {
        this.glow[i] = 0;
      }
      if (this.zoneFlash[i] > 0.001) {
        this.zoneFlash[i] *= this.held[i] ? 0.9 : 0.78;
        any = true;
      } else {
        this.zoneFlash[i] = 0;
      }
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
