/**
 * pionier-core -- emergency restore shell.
 * Full instrument graph is loaded from pionier-core-full.js when present.
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js?v=2';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument } from './js/instruments/handpan.js?v=11';
import { createLibraryInstruments } from './js/instruments/library-family.js?v=3';
import { FxChain } from './js/fx.js';
import { createSurface } from './js/pionier-surface.js?v=146';

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);
for (const instrument of createLibraryInstruments()) InstrumentRegistry.register(instrument);

const app = {
  fxChain: null,
  instrumentBus: null,
  ambientBus: null,
  gestureTracker: new GestureTracker(),
  pointers: new Map(),
  keysHeld: new Set()
};

const canvas = document.getElementById('pan');
const surface = createSurface(canvas);

function ensureAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (!app.instrumentBus) {
    app.instrumentBus = ctx.createGain();
    app.instrumentBus.gain.value = 1.0;
    app.instrumentBus.name = 'instrumentBus';
    app.fxChain = new FxChain(ctx, getAudioMaster());
    app.fxChain.seedDefaults();
    app.instrumentBus.connect(app.fxChain.input);
  }
  if (!app.ambientBus) {
    app.ambientBus = ctx.createGain();
    app.ambientBus.gain.value = 1.0;
    app.ambientBus.name = 'ambientBus';
    const master = getAudioMaster();
    if (master) app.ambientBus.connect(master);
  }
  if (ctx.state !== 'running') {
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (_) {}
  }
  resumeAudio();
  return true;
}

function activeInstrument() {
  return InstrumentRegistry.active || handpan;
}

async function setInstrument(id) {
  ensureAudio();
  const ctx = getAudioContext();
  if (!ctx || !app.instrumentBus) return;
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
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
  if (active && typeof active.setZones === 'function') active.setZones(surface.fields);
  layoutFields();
  draw();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;
  surface.layoutHandpanFields(notes.slice(0, handpan.noteCount || 8), (i) => i >= 0 && i < (handpan.noteCount || 8));
  handpan.setZones?.(surface.fields);
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

canvas?.addEventListener('contextmenu', (e) => e.preventDefault());
;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas?.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});

canvas?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ensureAudio();
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  if (!hit) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const inst = activeInstrument();
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture);
  app.pointers.set(e.pointerId, { index: hit.index });
  inst.noteOn(gesture, hit);
  draw();
});

function releasePointer(e) {
  const rec = app.pointers.get(e.pointerId);
  if (!app.pointers.has(e.pointerId)) return;
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  const idx = rec?.index;
  if (idx != null) activeInstrument().noteOff(idx);
  try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
}
canvas?.addEventListener('pointerup', (e) => { e.preventDefault(); releasePointer(e); });
canvas?.addEventListener('pointercancel', (e) => { releasePointer(e); });
canvas?.addEventListener('lostpointercapture', (e) => { releasePointer(e); });

window.PionierCore = {
  handpan,
  surface,
  activeInstrument: () => activeInstrument(),
  setInstrument: (id) => setInstrument(id),
  ensureAudio: () => ensureAudio(),
  getAudioContext: () => getAudioContext(),
  getInstrumentBus: () => { if (!app.instrumentBus) ensureAudio(); return app.instrumentBus; },
  getAmbientBus: () => { if (!app.ambientBus) ensureAudio(); return app.ambientBus; },
  health: () => ({ audioAvailable: !!getAudioContext(), audioState: audioState(), instrumentReady: !!InstrumentRegistry.active?.ready }),
  draw() { draw(); },
  refreshPitch() { layoutFields(); draw(); },
  noteCount: () => handpan.noteCount || 8
};

async function boot() {
  ensureAudio();
  await setInstrument('handpan');
  resize();
  window.addEventListener('resize', resize);
  const unlock = () => {
    ensureAudio();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
}

await boot();
export default window.PionierCore;
