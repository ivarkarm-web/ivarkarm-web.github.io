/**
 * instruments/library-family.js — the Pionier sound library as playable instruments.
 *
 * One Instrument per library voice (koto, harp, kalimba, bowl, tibetan, tongue,
 * crystal_kalimba, ice_chime, windchimes, breath, tine, musicbox, choir, drone, cloud).
 * The handpan voice itself is played by HandpanInstrument, which owns the scale /
 * layout logic. Every instrument here inherits the nine-to-fourteen pitches of the
 * selected handpan scale through setMusicalContext(), so all voices always play
 * the same layout.
 */
import { Instrument } from '../instrument.js';
import { SoundLibrary, listVoices } from '../sound/library.js?v=2';

const MAX_PADS = 14;
const PITCH_BEND_RANGE = 2;
const BEND_SMOOTH = 0.055;
const PRESSURE_SMOOTH = 0.06;

// Voices that keep sounding while the finger is down and fade out on release.
const HELD_VOICES = new Set(['bowl', 'tibetan', 'breath', 'choir', 'drone', 'cloud']);

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

    const handle = this.lib.play(this.id, note.freq, { vel, pan: Math.sin(angle) * 0.35 });
    if (!handle) return;
    const voice = { idx, handle, kind: 'lib', baseFreq: note.freq, released: false };
    voice.stop = (when, release = 0.08) => {
      if (voice.released) return;
      voice.released = true;
      handle.stop(Math.max(0.03, release));
    };
    this.activeVoices.set(idx, voice);
  }

  noteMove(idx, gesture = {}, zone = {}) {
    if (idx < 0 || idx >= MAX_PADS) return;
    const pressure = Math.max(0, Math.min(1, gesture.pressure || gesture.force || 0));
    this._smoothPressure[idx] = this._smoothPressure[idx] * (1 - PRESSURE_SMOOTH) + pressure * PRESSURE_SMOOTH;
    if (this.heldPad[idx]) {
      this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.25 + this._smoothPressure[idx] * 0.5));
    }
  }

  noteOff(idx) {
    this.heldPad[idx] = 0;
    this._smoothPressure[idx] = 0;
    if (this.glow[idx] > 0.15) this.glow[idx] = Math.min(this.glow[idx], 0.35);
    const voice = this.activeVoices.get(idx);
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
