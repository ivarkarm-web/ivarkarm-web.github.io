/**
 * pionier-app.js — restored working instrument surface (backup-compatible)
 * MPE pitch bend + smooth glide between pads + pressure expression
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js';
import { createTonalInstruments } from './js/instruments/tonal-family.js?v=5';
import { BirdInstrument } from './js/instruments/bird.js';
import { KitchenInstrument } from './js/instruments/kitchen.js';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface } from './js/pionier-surface.js?v=28';
import { mountScaleSelector } from './js/scale-selector.js';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
const PITCH_BEND_PIXELS = 90;

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);
for (const instrument of createTonalInstruments()) InstrumentRegistry.register(instrument);
InstrumentRegistry.register(new BirdInstrument());
InstrumentRegistry.register(new KitchenInstrument());

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
  return fieldIndex >= 0 && fieldIndex <= 8;
}

async function setInstrument(id) {
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
  }

  const active = InstrumentRegistry.active;
  if (active) {
    if (typeof active.setMusicalContext === 'function') active.setMusicalContext(notes);
    if (typeof active.setZones === 'function') active.setZones(surface.fields);
    if (!active.ready && active.audioCtx) active._ready = true;
  }

  updateInstrumentUI();
  layoutFields();
  draw();
}

app.catchMode = new CatchMode({
  getInstrument: () => activeInstrument(),
  onStatus: (msg) => {
    const el = document.getElementById('catchStatus');
    if (el) el.textContent = msg || '';
  },
  onPhase: (phase) => { document.body.dataset.catchPhase = phase; }
});
app.catchMode.reducedMotion = app.reducedMotion;

let scaleSelectorApi = null;

function updateLabels() {
  const rootEl = document.getElementById('rootLabel');
  const octEl = document.getElementById('octLabel');
  if (scaleSelectorApi) scaleSelectorApi.updateLabel();
  else {
    const scaleEl = document.getElementById('scaleLabel');
    if (scaleEl && handpan.scaleLabel) scaleEl.textContent = handpan.scaleLabel + ' ▾';
  }
  if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
  if (octEl) {
    const o = handpan.octaveOffset ?? 0;
    octEl.textContent = o === 0 ? '0' : o > 0 ? '+' + o : String(o);
  }
  const voiceEl = document.getElementById('instrumentDropdownToggle');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = (inst.name || inst.id) + ' ▾';
}

function updateInstrumentUI() {
  updateLabels();
  renderInstrumentMenu();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;
  surface.layoutHandpanFields(notes, isFieldPlayable);
  for (const f of surface.fields) f.zoneLabel = null;
  handpan.setZones?.(surface.fields);
  const active = activeInstrument();
  if (active && active !== handpan && typeof active.setZones === 'function') {
    active.setZones(surface.fields);
  }
}

function draw() {
  if (!surface || !canvas) return;
  surface.drawBody(activeInstrument(), false, null);
}

function resize() {
  if (!surface) return;
  surface.resize();
  layoutFields();
  draw();
}
