/**
 * instruments/library-family.js — the Pionier sound library as playable instruments.
 *
 * One Instrument per library voice (koto, harp, kalimba, bowl, breath, tine,
 * musicbox, choir, drone, cloud). The handpan voice itself is played by
 * HandpanInstrument, which owns the scale / layout logic. Every instrument here
 * inherits the nine-to-fourteen pitches of the selected handpan scale through
 * setMusicalContext(), so all voices always play the same layout.
 */
import { Instrument } from '../instrument.js';
import { SoundLibrary, listVoices } from '../sound/library.js?v=1';

const MAX_PADS = 14;
const PITCH_BEND_RANGE = 2;
const BEND_SMOOTH = 0.055;
const PRESSURE_SMOOTH = 0.06;

// Voices that keep sounding while the finger is down and fade out on release.
const HELD_VOICES = new Set(['bowl', 'breath', 'choir', 'drone', 'cloud']);

let shared = null;

/** One SoundLibrary per AudioContext + bus, shared by every instrument. */
export function getSoundLibrary(ctx, bus) {
  if (shared && shared.ctx === ctx && shared.bus === bus) return shared.lib;
  if (shared) { try { shared.lib.dispose(); } catch (_) {} }
  const lib = new SoundLibrary(ctx, bus || ctx.destination, { outGain: 0.9 });
  shared = { ctx, bus, lib };
  return lib;
}

export function pressureCurve(p) {
  p = Math.max(0, Math.min(1, p));
  return p * 0.35 + Math.pow(p, 1.6) * 0.65;
}

export class LibraryInstrument extends Instrument {
  constructor(voice) {
    super({
      id: voice.id,
      name: voice.name,
      description: voice.desc,
      category: voice.family,
      polyphony: MAX_PADS,
      compatibleFx: ['compressor', 'delay', 'reverb', 'warmth', 'air', 'chorus', 'shimmer', 'lowpass']
    });
    this.voice = voice;
    this.held = HELD_VOICES.has(voice.id);
    this.pitches = [];
    this.pitchBendRange = PITCH_BEND_RANGE;
    this.glow = new Float32Array(MAX_PADS);
    this.zoneFlash = new Float32Array(MAX_PADS);
    this.heldPad = new Uint8Array(MAX_PADS);
    this._smoothPressure = new Float32Array(MAX_PADS);
    this.lastStrikeAt = new Map();
    this.lib = null;
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
    this.lib = getSoundLibrary(audioCtx, bus);
    this._prewarm();
  }

  /** Render the current layout's notes in the background so first hits don't stall. */
  _prewarm() {
    if (!this.lib || !this.ready) return;
    const freqs = this.pitches.filter(Boolean).map((p) => p.freq);
    if (!freqs.length) return;
    this._prewarmToken = (this._prewarmToken || 0) + 1;
    const token = this._prewarmToken;
    // prewarm() yields between notes; a newer call (layout change) supersedes this one
    this.lib.prewarm([this.id], freqs, [0.65], () => (token === this._prewarmToken)).catch(() => {});
  }

  setMusicalContext(notes) {
    const list = (notes || []).slice(0, MAX_PADS);
    this.pitches = new Array(MAX_PADS).fill(null);
    list.forEach((n, i) => {
      const idx = (n.index != null && n.index >= 0 && n.index < MAX_PADS) ? n.index : i;
      this.pitches[idx] = { midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: idx };
    });
    for (let i = 0; i < MAX_PADS; i++) {
      if (!this.pitches[i]) {
        const src = list[Math.min(i, Math.max(0, list.length - 1))];
        if (src) this.pitches[i] = { midi: src.midi, freq: src.freq, name: src.name, kind: src.kind, index: i };
      }
    }
    if (this.ready) this._prewarm();
  }

  getNotes() { return this.pitches.filter(Boolean).slice(); }
  getZones() { return this._zones || []; }

  noteOn(gesture = {}, zone = {}) {
    if (!this.audioCtx || !this.bus || !this.lib) return;
    if (!this.ready) this._ready = true;
    const idx = zone.index ?? zone.idx ?? 0;
    if (idx < 0 || idx >= MAX_PADS) return;
    const note = this.pitches[idx] || this.pitches.find(Boolean);
    if (!note || !note.freq) return;

    const ctx = this.audioCtx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.1, Math.min(1, gesture.velocity ?? 0.72));
    const radial = Math.max(0, Math.min(1.2, zone.radial ?? gesture.radial ?? 0.4));
    const angle = zone.angleRad ?? gesture.angle ?? 0;
    const pressure = Math.max(0, Math.min(1, gesture.pressure || gesture.force || vel));
    this._smoothPressure[idx] = pressure;

    const prev = this.activeVoices.get(idx);
    if (prev?.stop) prev.stop(t, 0.05);

    this.glow[idx] = Math.min(1, 0.55 + vel * 0.45);
    this.zoneFlash[idx] = radial;
    this.heldPad[idx] = 1;
    this.lastStrikeAt.set(idx, performance.now());

    // pads around the ring sit left/right in the stereo field
    const handle = this.lib.play(this.id, note.freq, { vel, pan: Math.sin(angle) * 0.35 });
    if (!handle) return;
    const voice = { idx, handle, kind: 'lib', baseFreq: note.freq, released: false };
    voice.stop = (when, release = 0.08) => {
      if (voice.released) return;
      voice.released = true;
      handle.stop(Math.max(0.03, release));
      setTimeout(() => { if (this.activeVoices.get(idx) === voice) this.activeVoices.delete(idx); }, (release + 0.1) * 1000);
    };
    this.activeVoices.set(idx, voice);
  }

  express(gesture, zone) {
    if (!this.ready) return;
    const idx = zone?.index ?? zone?.i;
    if (idx == null || idx < 0 || idx >= MAX_PADS || !this.heldPad[idx]) return;
    const voice = this.activeVoices.get(idx);
    if (!voice || voice.released) return;
    const rawP = Math.max(0, Math.min(1, gesture.pressure || gesture.force || gesture.intensity || 0.5));
    const sp = this._smoothPressure[idx] + (rawP - this._smoothPressure[idx]) * 0.22;
    this._smoothPressure[idx] = sp;
    voice.handle.level(0.82 + pressureCurve(sp) * 0.4, PRESSURE_SMOOTH);
    let bendSemi = gesture.pitchBend;
    if (bendSemi == null && typeof gesture.pitchBendNorm === 'number') {
      const n = gesture.pitchBendNorm;
      bendSemi = Math.sign(n) * Math.pow(Math.abs(n), 1.35) * this.pitchBendRange;
    }
    if (typeof bendSemi === 'number' && Number.isFinite(bendSemi)) {
      const cents = Math.max(-this.pitchBendRange * 100, Math.min(this.pitchBendRange * 100, bendSemi * 100));
      voice.handle.detune(cents, BEND_SMOOTH);
    }
  }

  noteOff(idx) {
    this.heldPad[idx] = 0;
    this._smoothPressure[idx] = 0;
    if (this.glow[idx] > 0.15) this.glow[idx] = Math.min(this.glow[idx], 0.35);
    const voice = this.activeVoices.get(idx);
    // Struck voices ring out on their own; held voices fade when the finger lifts.
    if (voice && this.held && this.audioCtx) voice.stop(this.audioCtx.currentTime, 0.9);
  }

  dampAll() {
    this.heldPad.fill(0);
    const t = this.audioCtx?.currentTime ?? 0;
    for (const voice of this.activeVoices.values()) voice.stop?.(t, 0.12);
    this.activeVoices.clear();
  }

  tickGlow() {
    let active = false;
    for (let i = 0; i < MAX_PADS; i++) {
      if (this.glow[i] > 0.001) { this.glow[i] *= this.heldPad[i] ? 0.92 : 0.84; active = true; }
      else this.glow[i] = 0;
      if (this.zoneFlash[i] > 0.001) { this.zoneFlash[i] *= this.heldPad[i] ? 0.9 : 0.8; active = true; }
      else this.zoneFlash[i] = 0;
    }
    return active;
  }

  getPerformanceHints() {
    return { maxVoices: MAX_PADS, prefersSamples: false, supportsAftertouch: true, supportsPitchBend: true };
  }
}

/** Every library voice except 'handpan' (that one is played by HandpanInstrument). */
export function createLibraryInstruments() {
  return listVoices().filter((v) => v.id !== 'handpan').map((v) => new LibraryInstrument(v));
}
