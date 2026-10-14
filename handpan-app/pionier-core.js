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
  }

  const active = InstrumentRegistry.active;
  if (active) {
    persistActiveInstrumentId(active.id);
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

function updateLabels() {
  const scaleEl = document.getElementById('scaleLabel');
  const rootEl = document.getElementById('rootLabel');
  const octEl = document.getElementById('octLabel');
  if (scaleEl && handpan.scaleLabel) scaleEl.textContent = handpan.scaleLabel;
  if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
  if (octEl) {
    const o = handpan.octaveOffset ?? 0;
    octEl.textContent = o > 0 ? '+' + o : String(o);
  }
  const countEl = document.getElementById('notePlusCount');
  if (countEl) countEl.textContent = (handpan.noteCount || 9) + '/14';
}

function updateInstrumentUI() {
  const active = activeInstrument();
  const name = active?.name || 'Handpan';
  const toggle = document.getElementById('instrumentDropdownToggle');
  if (toggle) toggle.textContent = name + ' ▾';
  const menu = document.getElementById('instrumentMenu');
  if (menu) {
    menu.querySelectorAll('[data-instrument-id]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-instrument-id') === active?.id);
    });
  }
}

function layoutFields() {
  try {
    surface.layout?.(handpan.noteCount || 9);
  } catch (_) {}
}

function draw() {
  try {
    const active = activeInstrument();
    surface.draw?.(active);
  } catch (_) {}
}

function refreshPitch() {
  syncWorldPitch();
  layoutFields();
  updateLabels();
  draw();
}

function releaseAllPointers() {
  for (const [id, p] of app.pointers) {
    try { activeInstrument()?.noteOff?.(p.fieldIndex); } catch (_) {}
  }
  app.pointers.clear();
}

function wireKnobs() {
  if (!app.fxChain) return;
  try { app.fxChain.bindUI?.(document); } catch (_) {}
}

function onPointerDown(e) {
  if (!canvas) return;
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const hit = surface.hitTest?.(x, y);
  if (!hit || !isFieldPlayable(hit.index)) return;
  const gesture = gestureFromPointer?.(e, hit) || { velocity: 0.7 };
  app.lastVelocity = gesture.velocity ?? 0.7;
  app.pointers.set(e.pointerId, { fieldIndex: hit.index, x, y });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  activeInstrument()?.noteOn?.(gesture, hit);
  draw();
}

function onPointerMove(e) {
  const p = app.pointers.get(e.pointerId);
  if (!p || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const dx = x - p.x;
  const gesture = {
    velocity: app.lastVelocity,
    pitchBendNorm: Math.max(-1, Math.min(1, dx / PITCH_BEND_PIXELS)),
    pressure: e.pressure || 0
  };
  activeInstrument()?.noteMove?.(p.fieldIndex, gesture, surface.fields?.[p.fieldIndex]);
  draw();
}

function onPointerUp(e) {
  const p = app.pointers.get(e.pointerId);
  if (!p) return;
  activeInstrument()?.noteOff?.(p.fieldIndex);
  app.pointers.delete(e.pointerId);
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  draw();
}

if (canvas) {
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function resize() {
  try {
    surface.resize?.();
    layoutFields();
    draw();
  } catch (_) {}
}

function buildInstrumentMenu() {
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.replaceChildren();
  for (const item of InstrumentRegistry.list()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instrument-menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('data-instrument-id', item.id);
    btn.textContent = item.name || item.id;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setInstrument(item.id);
      menu.hidden = true;
      document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(btn);
  }
}

document.getElementById('instrumentDropdownToggle')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  buildInstrumentMenu();
  const open = menu.hidden;
  menu.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
});

document.addEventListener('click', () => {
  const menu = document.getElementById('instrumentMenu');
  if (menu) menu.hidden = true;
  document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
});

const nScales = () => (HANDPAN_SCALES?.length || handpan.scales?.length || 1);
document.getElementById('scalePrev')?.addEventListener('click', () => {
  handpan.setScaleIndex((handpan.scaleIndex - 1 + nScales()) % nScales());
  refreshPitch();
});
document.getElementById('scaleNext')?.addEventListener('click', () => {
  handpan.setScaleIndex((handpan.scaleIndex + 1) % nScales());
  refreshPitch();
});
document.getElementById('rootDown')?.addEventListener('click', () => {
  handpan.shiftRoot?.(-1) || handpan.setRoot?.((handpan.rootPc + 11) % 12);
  refreshPitch();
});
document.getElementById('rootUp')?.addEventListener('click', () => {
  handpan.shiftRoot?.(1) || handpan.setRoot?.((handpan.rootPc + 1) % 12);
  refreshPitch();
});
document.getElementById('octDown')?.addEventListener('click', () => {
  handpan.shiftOctave?.(-1);
  refreshPitch();
});
document.getElementById('octUp')?.addEventListener('click', () => {
  handpan.shiftOctave?.(1);
  refreshPitch();
});
document.getElementById('voicePrev')?.addEventListener('click', () => {
  const list = InstrumentRegistry.list();
  const cur = InstrumentRegistry.active?.id || 'handpan';
  const i = list.findIndex((x) => x.id === cur);
  const next = list[(i - 1 + list.length) % list.length];
  if (next) setInstrument(next.id);
});
document.getElementById('voiceNext')?.addEventListener('click', () => {
  const list = InstrumentRegistry.list();
  const cur = InstrumentRegistry.active?.id || 'handpan';
  const i = list.findIndex((x) => x.id === cur);
  const next = list[(i + 1) % list.length];
  if (next) setInstrument(next.id);
});

function padCount() { return handpan.noteCount || 9; }
function changeNoteCount(delta) {
  const MIN = 9;
  const MAX = 14;
  const before = Number.isFinite(handpan.noteCount) ? handpan.noteCount : MIN;
  const after = Math.max(MIN, Math.min(MAX, before + delta));
  if (after === before) return false;
  handpan.setNoteCount(after);
  if (typeof surface.armTransition === 'function') surface.armTransition();
  syncWorldPitch();
  layoutFields();
  const active = activeInstrument();
  if (active && active.glow) {
    for (let i = 0; i < active.glow.length; i++) active.glow[i] = i === after - 1 ? 1 : 0;
  }
  if (active && active.zoneFlash && after > before && after - 1 < active.zoneFlash.length) active.zoneFlash[after - 1] = 0.3;
  updateLabels();
  draw();
  return true;
}

window.PionierCore = {
  handpan, surface,
  activeInstrument: () => activeInstrument(),
  ensureAudio: () => ensureAudio(),
  getInstrumentBus: () => {
    if (!app.instrumentBus) ensureAudio();
    return app.instrumentBus;
  },
  health: () => ({
    audioAvailable: !!getAudioContext(),
    audioState: audioState(),
    storageAvailable,
    instrumentReady: !!InstrumentRegistry.active?.ready
  }),
  draw() { draw(); },
  addNote() { return changeNoteCount(1); },
  removeNote() { return changeNoteCount(-1); },
  setScaleIndex(i) {
    handpan.setScaleIndex(i);
    refreshPitch();
  },
  refreshPitch() { refreshPitch(); },
  noteCount: () => {
    if (Number.isFinite(handpan?.noteCount) && handpan.noteCount > 0) return handpan.noteCount;
    const fields = surface?.fields;
    if (Array.isArray(fields) && fields.length) return fields.length;
    return padCount();
  },
  setInstrument,
  getFx: () => app.fxChain
};

async function boot() {
  ensureAudio();
  const saved = readSavedInstrumentId();
  await setInstrument(saved);
  refreshPitch();
  resize();
  window.addEventListener('resize', resize);
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  if (isDebugEnabled?.()) mountDebugPanel?.({ setInstrument });
  // rAF draw loop for glow
  function tick() {
    try {
      activeInstrument()?.tickGlow?.();
      draw();
    } catch (_) {}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

await boot();
export default window.PionierCore;
