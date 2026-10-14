/**
 * pionier-core — instrument surface + audio graph
 * Looper v2: exposes getInstrumentBus for pre-FX recording
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js?v=6';
import { createLibraryInstruments } from './js/instruments/library-family.js?v=3';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface } from './js/pionier-surface.js?v=95';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];

// Register instruments
InstrumentRegistry.register(new HandpanInstrument());
for (const instrument of createLibraryInstruments()) InstrumentRegistry.register(instrument);

let handpan = InstrumentRegistry.get('handpan');
let currentId = 'handpan';
let audioCtx = null;
let instrumentBus = null;
let fxChain = null;
let surface = null;
let gesture = null;
let catchMode = null;
let bootPromise = null;

function getNotesLayout() {
  const notes = handpan?.getNotes?.() || [];
  return notes.map((n, i) => ({
    index: n.index != null ? n.index : i,
    midi: n.midi,
    freq: n.freq,
    name: n.name,
    kind: n.kind || (i === 0 ? 'ding' : 'tone')
  }));
}

function syncWorldPitch() {
  const notes = getNotesLayout();
  for (const inst of InstrumentRegistry.all()) {
    if (inst === handpan) continue;
    try { inst.setMusicalContext?.(notes); } catch (_) {}
  }
}

function refreshPitch() {
  syncWorldPitch();
  try { surface?.redraw?.(); } catch (_) {}
}

function updateLabels() {
  try {
    const scale = HANDPAN_SCALES?.[handpan?.scaleIndex ?? 0];
    const el = document.getElementById('scaleLabel');
    if (el && scale) {
      const t = scale.label || scale.name || '';
      el.textContent = t.includes('▾') ? t : (t + ' ▾');
    }
    const rootLabel = document.getElementById('rootLabel');
    if (rootLabel && handpan) {
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      rootLabel.textContent = names[(handpan.rootPc ?? 2) % 12] || 'D';
    }
    const octLabel = document.getElementById('octLabel');
    if (octLabel && handpan) octLabel.textContent = String(handpan.octaveOffset ?? 0);
  } catch (_) {}
}

function changeNoteCount(delta) {
  const before = Number.isFinite(handpan?.noteCount) ? handpan.noteCount : 9;
  const after = Math.max(9, Math.min(14, before + delta));
  if (after === before) return false;
  handpan?.setNoteCount?.(after);
  refreshPitch();
  try {
    const countEl = document.getElementById('notePlusCount');
    if (countEl) countEl.textContent = after + '/14';
  } catch (_) {}
  return true;
}

async function ensureGraph() {
  audioCtx = getAudioContext();
  await resumeAudio();
  if (!instrumentBus) {
    instrumentBus = audioCtx.createGain();
    instrumentBus.gain.value = 1;
    if (!fxChain) {
      try {
        fxChain = new FxChain(audioCtx);
        instrumentBus.connect(fxChain.input);
        fxChain.output.connect(getAudioMaster() || audioCtx.destination);
      } catch (_) {
        instrumentBus.connect(getAudioMaster() || audioCtx.destination);
      }
    }
  }
  return audioCtx;
}

async function activateInstrument(id) {
  const ctx = await ensureGraph();
  const next = InstrumentRegistry.get(id);
  if (!next) return false;
  const prev = InstrumentRegistry.get(currentId);
  if (prev && prev !== next) {
    try { prev.dampAll?.(); } catch (_) {}
  }
  if (!next.ready) await next.activate(ctx, instrumentBus);
  currentId = id;
  if (id === 'handpan') handpan = next;
  syncWorldPitch();
  return true;
}

async function boot() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await ensureGraph();
    await activateInstrument('handpan');
    syncWorldPitch();
    updateLabels();
    try {
      const canvas = document.getElementById('pan');
      if (canvas && !surface) {
        surface = createSurface(canvas, {
          getInstrument: () => InstrumentRegistry.get(currentId) || handpan,
          getHandpan: () => handpan
        });
      }
    } catch (e) {
      console.warn('[pionier] surface mount failed', e);
    }
    if (isDebugEnabled()) {
      try { mountDebugPanel(); } catch (_) {}
    }
    return true;
  })();
  return bootPromise;
}

// Scale / root steppers
function wireControls() {
  const n = () => HANDPAN_SCALES?.length || 1;
  document.getElementById('scalePrev')?.addEventListener('click', () => {
    handpan?.setScaleIndex?.((handpan.scaleIndex - 1 + n()) % n());
    refreshPitch();
    updateLabels();
  });
  document.getElementById('scaleNext')?.addEventListener('click', () => {
    handpan?.setScaleIndex?.((handpan.scaleIndex + 1) % n());
    refreshPitch();
    updateLabels();
  });
  document.getElementById('rootDown')?.addEventListener('click', () => {
    handpan?.shiftRoot?.(-1);
    refreshPitch();
    updateLabels();
  });
  document.getElementById('rootUp')?.addEventListener('click', () => {
    handpan?.shiftRoot?.(1);
    refreshPitch();
    updateLabels();
  });
  document.getElementById('octDown')?.addEventListener('click', () => {
    handpan?.shiftOctave?.(-1);
    refreshPitch();
    updateLabels();
  });
  document.getElementById('octUp')?.addEventListener('click', () => {
    handpan?.shiftOctave?.(1);
    refreshPitch();
    updateLabels();
  });
}

wireControls();
boot().catch((e) => console.error('[pionier-core] boot failed', e));

const PionierCore = {
  get handpan() { return handpan; },
  get currentInstrumentId() { return currentId; },
  boot,
  ensureAudio() { resumeAudio(); boot(); },
  getInstrumentBus: () => instrumentBus,
  health() {
    return {
      audioAvailable: !!getAudioContext(),
      storageAvailable: (() => {
        try { localStorage.setItem('__p', '1'); localStorage.removeItem('__p'); return true; }
        catch (_) { return false; }
      })()
    };
  },
  noteCount() {
    return Number.isFinite(handpan?.noteCount) ? handpan.noteCount : 9;
  },
  changeNoteCount,
  addNote() { return changeNoteCount(1); },
  removeNote() { return changeNoteCount(-1); },
  setScaleIndex(i) {
    handpan?.setScaleIndex?.(i);
    refreshPitch();
    updateLabels();
    return true;
  },
  syncWorldPitch,
  refreshPitch,
  updateLabels,
  async setInstrument(id) {
    return activateInstrument(id);
  },
  getFx() { return fxChain; }
};

window.PionierCore = PionierCore;
export default PionierCore;
