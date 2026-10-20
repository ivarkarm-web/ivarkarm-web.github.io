/**
 * pionier-core — playable core with dual buses, FX knobs, scale/root steppers.
 * Expanded from emergency shell (full chrome still available in local Phase tree).
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
    wireKnobs();
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
  try { updateLabels(); } catch (_) {}
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

function paintKnob(canvasEl, value01, size = 88) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvasEl.width !== size * dpr) {
    canvasEl.width = size * dpr;
    canvasEl.height = size * dpr;
    canvasEl.style.width = size + 'px';
    canvasEl.style.height = size + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const start = -Math.PI * 0.75;
  const end = Math.PI * 0.75;
  const angle = start + (end - start) * Math.max(0, Math.min(1, value01));
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, angle);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(18,18,20,0.95)';
  ctx.fill();
}

function paintAllKnobs() {
  if (!app.fxChain) return;
  const map = [
    { knobId: 'knobCompress', fxId: 'compressor', def: 0.4, size: 68 },
    { knobId: 'knobDelay', fxId: 'delay', def: 0.15, size: 68 },
    { knobId: 'knobReverb', fxId: 'reverb', def: 0.25, size: 68 },
    { knobId: 'knobFilter', fxId: 'filter', def: 0.12, size: 68 },
    { knobId: 'knobBass', tone: 'bass', def: 0.5, size: 72 },
    { knobId: 'knobLow', tone: 'low', def: 0.5, size: 72 },
    { knobId: 'knobMid', tone: 'mid', def: 0.5, size: 72 },
    { knobId: 'knobMaster', tone: 'master', def: 0.82, size: 72 }
  ];
  for (const m of map) {
    const el = document.getElementById(m.knobId);
    if (!el) continue;
    const canvasEl = el.querySelector('.knob-canvas');
    let v = m.def;
    try {
      if (m.tone === 'bass') v = app.fxChain.bass ?? m.def;
      else if (m.tone === 'low') v = app.fxChain.low ?? m.def;
      else if (m.tone === 'mid') v = app.fxChain.mid ?? m.def;
      else if (m.tone === 'master') v = app.fxChain.master ?? m.def;
      else {
        const mod = app.fxChain.modules?.find((x) => x.id === m.fxId);
        if (mod && Number.isFinite(mod.value)) v = mod.value;
      }
    } catch (_) {}
    paintKnob(canvasEl, v, m.size || 88);
  }
}

function wireKnobs() {
  if (!app.fxChain) return;
  if (app._knobsWired) { paintAllKnobs(); return; }
  app._knobsWired = true;
  const map = [
    { knobId: 'knobCompress', valId: 'valCompress', fxId: 'compressor', def: 0.4, size: 68 },
    { knobId: 'knobDelay', valId: 'valDelay', fxId: 'delay', def: 0.15, size: 68 },
    { knobId: 'knobReverb', valId: 'valReverb', fxId: 'reverb', def: 0.25, size: 68 },
    { knobId: 'knobFilter', valId: 'valFilter', fxId: 'filter', def: 0.12, size: 68 },
    { knobId: 'knobBass', valId: 'valBass', tone: 'bass', def: 0.5, size: 72 },
    { knobId: 'knobLow', valId: 'valLow', tone: 'low', def: 0.5, size: 72 },
    { knobId: 'knobMid', valId: 'valMid', tone: 'mid', def: 0.5, size: 72 },
    { knobId: 'knobMaster', valId: 'valMaster', tone: 'master', def: 0.82, size: 72 }
  ];
  for (const m of map) {
    const el = document.getElementById(m.knobId);
    const val = document.getElementById(m.valId);
    if (!el) continue;
    const canvasEl = el.querySelector('.knob-canvas');
    let value = m.def;
    const apply = (v) => {
      value = Math.max(0, Math.min(1, v));
      if (m.tone === 'bass') app.fxChain.setBass(value);
      else if (m.tone === 'low') app.fxChain.setLow(value);
      else if (m.tone === 'mid') app.fxChain.setMid(value);
      else if (m.tone === 'master') app.fxChain.setMaster(value);
      else app.fxChain.setValue(m.fxId, value);
      paintKnob(canvasEl, value, m.size || 88);
      if (val) val.textContent = String(Math.round(value * 100));
      el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    };
    apply(value);
    let dragging = false;
    let startY = 0;
    let startX = 0;
    let startVal = 0;
    let moved = false;
    let lastTapAt = 0;
    const openDetailedEditor = () => {
      if (m.fxId) window.dispatchEvent(new CustomEvent('pionier:fx-editor-open', { detail: { id: m.fxId } }));
    };
    if (m.fxId) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', m.fxId + ' effect knob. Double-tap to open detailed editor.');
      el.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' && e.altKey) || (e.key === 'Enter' && e.shiftKey)) {
          e.preventDefault(); openDetailedEditor();
        }
      });
    }
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      moved = false;
      startY = e.clientY;
      startX = e.clientX;
      startVal = value;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (Math.abs(e.clientY - startY) > 7 || Math.abs(e.clientX - startX) > 7) moved = true;
      apply(startVal + (startY - e.clientY) / 140);
    });
    el.addEventListener('pointerup', () => {
      dragging = false;
      if (!m.fxId || moved) { lastTapAt = 0; return; }
      const now = Date.now();
      if (lastTapAt && now - lastTapAt <= 420) {
        lastTapAt = 0;
        openDetailedEditor();
      } else {
        lastTapAt = now;
      }
    });
    el.addEventListener('pointercancel', () => { dragging = false; lastTapAt = 0; });
  }
}

function updateLabels() {
  const scaleEl = document.getElementById('scaleLabel');
  const rootEl = document.getElementById('rootLabel');
  const noteCountEl = document.getElementById('noteCountLabel');
  if (scaleEl && handpan.scaleLabel) scaleEl.textContent = handpan.scaleLabel + ' \u25be';
  if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
  if (noteCountEl) {
    const n = Number.isFinite(handpan.noteCount) ? handpan.noteCount : 8;
    noteCountEl.textContent = String(n);
  }
  const n = Number.isFinite(handpan.noteCount) ? handpan.noteCount : 9;
  const prevN = document.getElementById('noteCountPrev');
  const nextN = document.getElementById('noteCountNext');
  if (prevN) prevN.disabled = n <= 8;
  if (nextN) nextN.disabled = n >= 13;
  const voiceEl = document.getElementById('instrumentDropdownToggle');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = (inst.name || inst.id) + ' \u25be';
}

window.PionierCore = {
  handpan,
  surface,
  activeInstrument: () => activeInstrument(),
  setInstrument: (id) => setInstrument(id),
  ensureAudio: () => ensureAudio(),
  getAudioContext: () => getAudioContext(),
  getInstrumentBus: () => { if (!app.instrumentBus) ensureAudio(); return app.instrumentBus; },
  getAmbientBus: () => { if (!app.ambientBus) ensureAudio(); return app.ambientBus; },
  paintFxKnobs: () => { ensureAudio(); wireKnobs(); paintAllKnobs(); },
  refreshFxKnobs: () => paintAllKnobs(),
  getFxModule: (id) => app.fxChain?.modules?.find((m) => m.id === id) || null,
  health: () => ({ audioAvailable: !!getAudioContext(), audioState: audioState(), instrumentReady: !!InstrumentRegistry.active?.ready }),
  draw() { draw(); },
  refreshPitch() { layoutFields(); draw(); try { updateLabels(); } catch (_) {} },
  noteCount: () => handpan.noteCount || 8,
  setScaleIndex(i) { try { handpan.setScaleIndex(i); } catch (_) {} layoutFields(); draw(); try { updateLabels(); } catch (_) {} },
  setNoteCount(count) {
    const target = Math.max(8, Math.min(13, Math.round(Number(count) || 8)));
    try { handpan.setNoteCount(target); } catch (_) {}
    layoutFields(); draw(); try { updateLabels(); } catch (_) {}
  }
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
  const wireStep = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  wireStep('scalePrev', () => { handpan.setScaleIndex((handpan.scaleIndex || 0) - 1); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  wireStep('scaleNext', () => { handpan.setScaleIndex((handpan.scaleIndex || 0) + 1); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  wireStep('rootPrev', () => { handpan.setRootIndex((handpan.rootIndex || 0) - 1); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  wireStep('rootNext', () => { handpan.setRootIndex((handpan.rootIndex || 0) + 1); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  wireStep('noteCountPrev', () => { handpan.setNoteCount(Math.max(8, (handpan.noteCount || 8) - 1)); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  wireStep('noteCountNext', () => { handpan.setNoteCount(Math.min(13, (handpan.noteCount || 8) + 1)); layoutFields(); draw(); try { updateLabels(); } catch (_) {} });
  try { updateLabels(); } catch (_) {}
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
}

await boot();
export default window.PionierCore;
