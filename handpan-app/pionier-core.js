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

let currentInstrumentId = readSavedInstrumentId();
let surface = null;
let bootDone = false;

function getActiveInstrument() {
  return InstrumentRegistry.get(currentInstrumentId) || handpan;
}

function syncWorldPitch() {
  const notes = (handpan.getNotes?.() || []).map((n, i) => ({
    index: n.index != null ? n.index : i,
    midi: n.midi,
    freq: n.freq,
    name: n.name,
    kind: n.kind || (i === 0 ? 'ding' : 'tone')
  }));
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
  const ctx = getAudioContext();
  await resumeAudio();
  if (!app.instrumentBus) {
    app.instrumentBus = ctx.createGain();
    app.instrumentBus.gain.value = 1;
    try {
      app.fxChain = new FxChain(ctx);
      app.instrumentBus.connect(app.fxChain.input);
      app.fxChain.output.connect(getAudioMaster() || ctx.destination);
    } catch (_) {
      app.instrumentBus.connect(getAudioMaster() || ctx.destination);
    }
  }
  return ctx;
}

async function setInstrument(id) {
  const ctx = await ensureGraph();
  const next = InstrumentRegistry.get(id);
  if (!next) return false;
  const prev = getActiveInstrument();
  if (prev && prev !== next) {
    try { prev.dampAll?.(); } catch (_) {}
  }
  if (!next.ready) await next.activate(ctx, app.instrumentBus);
  currentInstrumentId = id;
  persistActiveInstrumentId(id);
  syncWorldPitch();
  return true;
}

async function boot() {
  if (bootDone) return true;
  const ctx = await ensureGraph();
  await setInstrument(currentInstrumentId);
  if (!handpan.ready) await handpan.activate(ctx, app.instrumentBus);
  syncWorldPitch();
  updateLabels();
  try {
    const canvas = document.getElementById('pan');
    if (canvas) {
      surface = createSurface(canvas, {
        getInstrument: getActiveInstrument,
        getHandpan: () => handpan,
        onStrike: (zone, gesture) => {
          const inst = getActiveInstrument();
          inst?.noteOn?.(gesture, zone);
        },
        onRelease: (idx) => getActiveInstrument()?.noteOff?.(idx),
        onMove: (idx, gesture, zone) => getActiveInstrument()?.noteMove?.(idx, gesture, zone)
      });
    }
  } catch (e) {
    console.warn('[pionier] surface failed', e);
  }
  bootDone = true;
  return true;
}

function wireControls() {
  const n = () => HANDPAN_SCALES?.length || 1;
  document.getElementById('scalePrev')?.addEventListener('click', () => {
    handpan?.setScaleIndex?.((handpan.scaleIndex - 1 + n()) % n());
    refreshPitch(); updateLabels();
  });
  document.getElementById('scaleNext')?.addEventListener('click', () => {
    handpan?.setScaleIndex?.((handpan.scaleIndex + 1) % n());
    refreshPitch(); updateLabels();
  });
  document.getElementById('rootDown')?.addEventListener('click', () => {
    handpan?.shiftRoot?.(-1); refreshPitch(); updateLabels();
  });
  document.getElementById('rootUp')?.addEventListener('click', () => {
    handpan?.shiftRoot?.(1); refreshPitch(); updateLabels();
  });
  document.getElementById('octDown')?.addEventListener('click', () => {
    handpan?.shiftOctave?.(-1); refreshPitch(); updateLabels();
  });
  document.getElementById('octUp')?.addEventListener('click', () => {
    handpan?.shiftOctave?.(1); refreshPitch(); updateLabels();
  });
}

wireControls();
boot().catch((e) => console.error('[pionier-core] boot', e));

const PionierCore = {
  get handpan() { return handpan; },
  get currentInstrumentId() { return currentInstrumentId; },
  boot,
  ensureAudio() { resumeAudio(); boot(); },
  getInstrumentBus: () => app.instrumentBus,
  health() {
    return {
      audioAvailable: !!getAudioContext(),
      storageAvailable
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
    refreshPitch(); updateLabels();
    return true;
  },
  syncWorldPitch,
  refreshPitch,
  updateLabels,
  setInstrument,
  getFx: () => app.fxChain
};

window.PionierCore = PionierCore;
export default PionierCore;
