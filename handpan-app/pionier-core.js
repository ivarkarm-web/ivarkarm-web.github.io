/**
 * pionier-core — instrument surface + audio graph
 * Looper v2: exposes getInstrumentBus for pre-FX recording
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { HandpanInstrument } from './js/instruments/handpan.js?v=5';
import { createLibraryInstruments } from './js/instruments/library-family.js?v=3';
import { HANDPAN_SCALES } from './js/instruments/handpan-scales.js';

// Register instruments once
InstrumentRegistry.register(new HandpanInstrument());
for (const instrument of createLibraryInstruments()) InstrumentRegistry.register(instrument);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function midiToName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + Math.floor(n / 12 - 1);
}

/** Canonical musical layout from the active handpan scale. */
function buildNotesFromHandpan(handpan) {
  if (!handpan) return [];
  const notes = handpan.getNotes?.() || [];
  return notes.map((n, i) => ({
    index: n.index != null ? n.index : i,
    midi: n.midi,
    freq: n.freq || midiToFreq(n.midi),
    name: n.name || midiToName(n.midi),
    kind: n.kind || (i === 0 ? 'ding' : 'tone')
  }));
}

const PionierCore = {
  handpan: null,
  currentInstrumentId: 'handpan',
  _bus: null,
  _fx: null,

  async boot() {
    const ctx = getAudioContext();
    await resumeAudio();
    // Instrument bus sits before master FX so looper can tap clean stems
    if (!this._bus) {
      this._bus = ctx.createGain();
      this._bus.gain.value = 1;
      const master = getAudioMaster();
      if (master) this._bus.connect(master);
      else this._bus.connect(ctx.destination);
    }
    this.handpan = InstrumentRegistry.get('handpan');
    if (this.handpan && !this.handpan.ready) {
      await this.handpan.activate(ctx, this._bus);
    }
    this.syncWorldPitch();
    return true;
  },

  ensureAudio() {
    resumeAudio();
    try {
      if (!this.handpan?.ready) this.boot();
    } catch (_) {}
  },

  getInstrumentBus() {
    return this._bus;
  },

  health() {
    return {
      audioAvailable: !!getAudioContext(),
      storageAvailable: (() => {
        try {
          localStorage.setItem('__p', '1');
          localStorage.removeItem('__p');
          return true;
        } catch (_) {
          return false;
        }
      })()
    };
  },

  noteCount() {
    const h = this.handpan;
    return Number.isFinite(h?.noteCount) ? h.noteCount : 9;
  },

  changeNoteCount(delta) {
    const before = this.noteCount();
    const after = Math.max(9, Math.min(14, before + delta));
    if (after === before) return false;
    this.handpan?.setNoteCount?.(after);
    this.refreshPitch();
    return true;
  },

  setScaleIndex(idx) {
    if (!this.handpan) return false;
    this.handpan.setScaleIndex?.(idx);
    this.refreshPitch();
    this.updateLabels?.();
    return true;
  },

  /** Push current scale pitches to every library instrument. */
  syncWorldPitch() {
    const notes = buildNotesFromHandpan(this.handpan);
    for (const inst of InstrumentRegistry.all()) {
      if (inst === this.handpan) continue;
      try {
        inst.setMusicalContext?.(notes);
      } catch (_) {}
    }
  },

  refreshPitch() {
    this.syncWorldPitch();
  },

  updateLabels() {
    try {
      const scale = HANDPAN_SCALES?.[this.handpan?.scaleIndex ?? 0];
      const el = document.getElementById('scaleLabel');
      if (el && scale) {
        const t = scale.label || scale.name || '';
        el.textContent = t.includes('▾') ? t : t + ' ▾';
      }
    } catch (_) {}
  },

  async setInstrument(id) {
    const ctx = getAudioContext();
    const next = InstrumentRegistry.get(id);
    if (!next) return false;
    const prev = InstrumentRegistry.get(this.currentInstrumentId);
    if (prev && prev !== next) {
      try {
        prev.dampAll?.();
      } catch (_) {}
    }
    if (!next.ready) await next.activate(ctx, this._bus);
    this.currentInstrumentId = id;
    this.syncWorldPitch();
    return true;
  }
};

window.PionierCore = PionierCore;
export default PionierCore;
