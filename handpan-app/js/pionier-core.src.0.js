/**
 * pionier-core -- instrument surface + audio graph
 * Local vendored core (no remote fetch / string-patch boot).
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
import { createSurface } from './js/pionier-surface.js?v=120';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];
const PITCH_BEND_PIXELS = 90;

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);
for (const instrument of createLibraryInstruments()) InstrumentRegistry.register(instrument);

const ACTIVE_INSTRUMENT_STORAGE_KEY = 'pionier.activeInstrument';
let storageAvailable = true;
function readSavedInstrumentId() {
  try {
    const saved = localStorage.getItem(ACTIVE_INSTRUMENT_STORAGE_KEY);
    return saved && InstrumentRegistry.get(saved) ? saved : 'handpan';
  } catch (_) {
    storageAvailable = false;
    return 'handpan';
  }
}
function persistActiveInstrumentId(id) {
  try { localStorage.setItem(ACTIVE_INSTRUMENT_STORAGE_KEY, id); }
  catch (_) { storageAvailable = false; }
}

const app = {
  fxChain: null,
  instrumentBus: null,
  gestureTracker: new GestureTracker(),
  pointers: new Map(),
  keysHeld: new Set(),
  catchMode: null,
  lastVelocity: 0.75,
  fps: 0,
  _fpsFrames: 0,
  _fpsLast: performance.now(),
  reducedMotion: false
};
try {
  app.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch (_) {}

const canvas = document.getElementById('pan');
if (!canvas) console.error('Pionier: #pan canvas missing');
const surface = createSurface(canvas);

function ensureAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (!app.instrumentBus) {
    app.instrumentBus = ctx.createGain();
    app.instrumentBus.gain.value = 1.0;
    app.fxChain = new FxChain(ctx, getAudioMaster());
    app.fxChain.seedDefaults();
    app.instrumentBus.connect(app.fxChain.input);
    wireKnobs();
  }
  resumeAudio();
  return true;
}

function activeInstrument() {
  return InstrumentRegistry.active || handpan;
}

function syncWorldPitch() {
  const notes = handpan.getNotes();
  for (const item of InstrumentRegistry.list()) {
    const instrument = InstrumentRegistry.get(item.id);
    if (instrument && typeof instrument.setMusicalContext === 'function') {
      instrument.setMusicalContext(notes);
    }
  }
}

function isFieldPlayable(fieldIndex) {
  return fieldIndex >= 0 && fieldIndex < (handpan.noteCount || 9);
}

async function setInstrument(id) {
  releaseAllPointers();
  ensureAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (!app.instrumentBus) ensureAudio();
  if (!app.instrumentBus) return;

  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;

  const prev = InstrumentRegistry.active;
  if (prev) { try { prev.dampAll(); } catch (_) {} }

  for (const item of InstrumentRegistry.list()) {
    const inst = InstrumentRegistry.get(item.id);
    if (inst && typeof inst.setMusicalContext === 'function') {
      try { inst.setMusicalContext(notes); } catch (_) {}
    }
  }

  try {
    await InstrumentRegistry.setActive(id, ctx, app.instrumentBus);
  } catch (err) {
    console.warn('setInstrument failed', id, err);
    try { await InstrumentRegistry.setActive('handpan', ctx, app.instrumentBus); } catch (_) {}
