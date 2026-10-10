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
import { NoteSampleBank } from '../note-sample-bank.js';
import { VOICE_PRESETS } from '../voice-presets.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];
const ZIGZAG_SLOTS = [0, 1, 7, 2, 6, 3, 5, 4];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const PITCH_BEND_RANGE = 2;
const GLIDE_TIME = 0.12;
const BEND_SMOOTH = 0.055;
const PRESSURE_SMOOTH = 0.06;

/** Semitones → cents. */
function semiToCents(s) { return s * 100; }

/** Just-intonation ratio → cents. */
function ratioToCents(num, den) {
  return 1200 * Math.log2(num / den);
}

/**
 * Scale table.
 * - `intervals`: 12-TET semitone steps from root (legacy / standard handpan)
 * - `cents`: absolute cents from root (microtonal; takes precedence)
 * - `tuning`: label for UI / hints
 */
export const HANDPAN_SCALES = [
  // ── Standard 12-TET handpan scales ──────────────────────────────────────
  { id: 'celtic-minor', label: 'Celtic Minor', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'kurdan-integral', label: 'Kurdan / Integral', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'hijaz', label: 'Hijaz', tuning: '12-TET',
    intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19] },
  { id: 'pygmy', label: 'Pygmy', tuning: '12-TET',
    intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24] },
  { id: 'amara', label: 'Amara', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22] },
  { id: 'akebono', label: 'AkeBono', tuning: '12-TET',
    intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24] },
  { id: 'equinox', label: 'Equinox', tuning: '12-TET',
    intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24] },
  { id: 'mixolydian', label: 'Mixolydian', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22] },
  { id: 'aeolian', label: 'Aeolian', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19] },
  { id: 'major-sabye', label: 'Major / Sabye', tuning: '12-TET',
    intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23] },

  // ── Just intonation ─────────────────────────────────────────────────────
  // Celtic-like layout with pure 5-limit intervals
  { id: 'just-celtic', label: 'Just Celtic', tuning: 'Just (5-limit)',
    cents: [
      0,
      ratioToCents(3, 2),          // P5  ~701.96
      ratioToCents(8, 5),          // m6  ~813.69
      ratioToCents(9, 5),          // M6  ~1017.60
      ratioToCents(2, 1),          // P8  1200
      ratioToCents(9, 4),          // M9  ~1403.91
      ratioToCents(12, 5),         // m10 ~1626.31? use 6/5 above 8ve: 1200+315.64
      ratioToCents(5, 2),          // M10 ~1586.31 — reorder below
      ratioToCents(3, 1)           // P12 ~1901.96
    ].map((c, i, a) => {
      // Rebuild clean just celtic: 1, 5, m6, M6, 8, 9, m10, 11, 12
      const clean = [
        0,
        ratioToCents(3, 2),
        ratioToCents(8, 5),
        ratioToCents(5, 3),
        ratioToCents(2, 1),
        ratioToCents(9, 4),
        ratioToCents(8, 5) + 1200,
        ratioToCents(15, 8) + 1200,
        ratioToCents(3, 1)
      ];
      return clean[i];
    }) },

  { id: 'just-major', label: 'Just Major', tuning: 'Just (5-limit)',
    cents: [
      0,
      ratioToCents(3, 2),           // 5
      ratioToCents(5, 3),           // M6
      ratioToCents(15, 8),          // M7
      ratioToCents(2, 1),           // 8
      ratioToCents(9, 4),           // 9
      ratioToCents(5, 2),           // M10
      ratioToCents(15, 4),          // M11? 15/4 = 2 oct + M7 → use 8/3 = 11th
      ratioToCents(3, 1)            // 12
    ].map((_, i) => {
      const clean = [
        0,
        ratioToCents(3, 2),
        ratioToCents(5, 3),
        ratioToCents(15, 8),
        ratioToCents(2, 1),
        ratioToCents(9, 4),
        ratioToCents(5, 2),
        ratioToCents(8, 3),
        ratioToCents(3, 1)
      ];
      return clean[i];
    }) },

  { id: 'harmonic-series', label: 'Harmonic Series', tuning: 'Just (harmonics)',
    cents: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => 1200 * Math.log2(h / 1) - 1200 * Math.log2(2 / 1) + 0)
      // Degrees as harmonics 2..10 relative to harmonic 2 as root (octave of fundamental)
      .map((_, i) => {
        const harm = i + 2; // 2,3,4,5,6,7,8,9,10
        return 1200 * Math.log2(harm / 2);
      }) },

  // ── 24-TET / quarter-tone ───────────────────────────────────────────────
  { id: 'hijaz-24', label: 'Hijaz ¼-tone', tuning: '24-TET',
    // Classic hijaz colour with neutral / quarter steps
    cents: [0, 700, 800, 1050, 1200, 1400, 1500, 1700, 1900] },

  { id: 'rast', label: 'Rast (maqam)', tuning: '24-TET / maqam',
    // Approximate: 1, 2, neutral 3, 4, 5, 6, neutral 7, 8, 9
    cents: [0, 200, 350, 500, 700, 900, 1050, 1200, 1400] },

  { id: 'bayati', label: 'Bayati (maqam)', tuning: '24-TET / maqam',
    cents: [0, 150, 300, 500, 700, 800, 1000, 1200, 1350] },

  { id: 'saba', label: 'Saba (maqam)', tuning: '24-TET / maqam',
    cents: [0, 150, 300, 400, 700, 800, 1000, 1200, 1350] },

  // ── Other microtonal ────────────────────────────────────────────────────
  { id: 'pelog-approx', label: 'Pelog (approx)', tuning: 'Slendro/Pelog-ish',
    // Simplified pelog-like uneven steps
    cents: [0, 120, 400, 660, 780, 1100, 1220, 1480, 1720] },

  { id: '19tet-celtic', label: '19-TET Celtic', tuning: '19-TET',
    // Map celtic degree pattern onto 19 equal steps (step ≈ 63.16¢)
    cents: (() => {
      const step = 1200 / 19;
      // degrees in 19-TET roughly matching celtic minor shape
      const deg = [0, 11, 13, 16, 19, 22, 24, 27, 30];
      return deg.map((d) => d * step);
    })() },

  { id: 'bohlen-pierce', label: 'Bohlen–Pierce (subset)', tuning: '13-TET tritave',
    // BP odd-integer ratios projected into a 9-note handpan layout
    cents: [1, 3, 5, 7, 9, 11, 13, 15, 17].map((n) => 1901.955 * Math.log(n) / Math.log(3) - 1901.955 * Math.log(1) / Math.log(3))
      .map((_, i) => {
        const odds = [1, 3, 5, 7, 9, 11, 13, 15, 17];
        return (1200 * Math.log2(3)) * Math.log(odds[i]) / Math.log(3);
      }) },

  { id: 'quarter-comma', label: '¼-comma Meantone', tuning: 'Meantone',
    // 9-note meantone chain from root
    cents: (() => {
      // Fifth = 696.578¢ in quarter-comma meantone
      const fifth = 696.578;
      // Build by stacking fifths then octave-reduce into handpan-like spread
      // Use scale degrees approximating celtic shape in meantone
      const deg12 = [0, 7, 8, 10, 12, 14, 15, 17, 19]; // same shape, but meantone sizes
      // Meantone chromatic steps (approximation via fifth chain)
      const mt = {
        0: 0,
        1: 76.05,
        2: 193.16,
        3: 310.26,
        4: 386.31,
        5: 503.42,
        6: 579.47,
        7: 696.58,
        8: 772.63,
        9: 889.74,
        10: 1006.84,
        11: 1082.89,
        12: 1200
      };
      return deg12.map((d) => {
        const oct = Math.floor(d / 12);
        const pc = d % 12;
        return mt[pc] + oct * 1200;
      });
    })() }
];

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function centsToFreq(rootMidi, cents) {
  return mtof(rootMidi) * Math.pow(2, cents / 1200);
}
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
/** Microtonal-aware name from cents offset + root. */
function centsName(rootMidi, cents) {
  const totalMidi = rootMidi + cents / 100;
  const nearest = Math.round(totalMidi);
  const diff = Math.round((totalMidi - nearest) * 100); // cents from nearest 12-TET
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

/** Resolve scale degree list to cents array. */
function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice(0, 9);
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.slice(0, 9).map(semiToCents);
}

export class HandpanInstrument extends Instrument {
  constructor() {
    super({
      id: 'handpan',
      name: 'Handpan',
      description: '9-note radial steel handpan with microtonal scales, aftertouch, MPE bend, and glide.',
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
    const centsList = scaleToCents(scale);
    const isMicro = !!(scale.cents && scale.cents.length) || (scale.tuning && scale.tuning !== '12-TET');

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
        angle: isDing ? 0 : RING_ANGLES[ZIGZAG_SLOTS[i - 1]],
        key: KEYS[i],
        microtonal: isMicro
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

  get scaleLabel() {
    const s = HANDPAN_SCALES[this.scaleIndex];
    if (!s) return '';
    return s.tuning && s.tuning !== '12-TET' ? `${s.label} · ${s.tuning}` : s.label;
  }
  get rootLabel() { return NOTE_NAMES[this.rootIndex]; }
  get voiceName() { return VOICE_PRESETS[this.voiceIndex]?.name || 'Steel'; }
  get isMicrotonal() {
    const s = HANDPAN_SCALES[this.scaleIndex];
    return !!(s && s.cents && s.cents.length);
  }

  _makeExpressNodes(ctx, dest, t) {
    const expressFilter = ctx.createBiquadFilter();
    expressFilter.type = 'lowpass';
    expressFilter.frequency.setValueAtTime(12000, t);
    expressFilter.Q.value = 0.7;

    const expressGain = ctx.createGain();
    expressGain.gain.setValueAtTime(1, t);

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

  glideTo(fromIdx, toIdx, gesture, zone) {
    if (!this.ready || !this.audioCtx) return false;
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return false;
    if (toIdx < 0 || toIdx > 8) return false;

    const voice = this.activeVoices.get(fromIdx);
    const note = this.notes[toIdx];
    if (!voice || voice.released || !note) return false;
    if (voice.kind === 'sample' || !voice.oscs) return false;

    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const glide = this.glideTime;
    const preset = VOICE_PRESETS[this.voiceIndex] || VOICE_PRESETS[0];
    const f = note.freq;

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

    // Prefer synth for clearly microtonal degrees (samples are 12-TET)
    const preferSynth = note.microtonal && Math.abs((note.midiExact - note.midi) * 100) > 15;

    if (!preferSynth && this.sampleBank && this.sampleBank.ready) {
      // Pitch-shift sample toward exact microtonal frequency
      const played = this.sampleBank.play(note.midiExact ?? note.midi, this.bus, t, {
        vel, radial, angleRad
      });
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
    vibGain.gain.setValueAtTime(pc * 6, t);

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
    const sp = this._smoothPressure[idx] + (rawP - this._smoothPressure[idx]) * 0.22;
    this._smoothPressure[idx] = sp;
    const pc = pressureCurve(sp);
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));

    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.3 + pc * 0.65));
    this.zoneFlash[idx] = radial;

    if (voice.expressGain) {
      const target = (voice.baseGain ?? 1) * (0.78 + pc * 0.45);
      try {
        voice.expressGain.gain.cancelScheduledValues(t);
        voice.expressGain.gain.setTargetAtTime(target, t, PRESSURE_SMOOTH);
      } catch (_) {}
    }

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
      prefersSamples: !this.isMicrotonal,
      supportsAftertouch: true,
      supportsPitchBend: true,
      supportsGlide: true,
      supportsMicrotonal: true,
      pitchBendRange: this.pitchBendRange,
      glideTime: this.glideTime
    };
  }
}
