/**
 * pionier-core -- instrument surface + audio graph
 * Local vendored core (no remote fetch / string-patch boot).
 * Looper v2: exposes getInstrumentBus for pre-FX recording
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js?v=2';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js?v=7';
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
  // iOS Safari: play a tiny silent buffer inside the user-gesture stack so the
  // context is allowed to run even when resume() alone is deferred.
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
  if (!ctx) {
    updateInstrumentUI();
    return;
  }
  if (!app.instrumentBus) ensureAudio();
  if (!app.instrumentBus) {
    updateInstrumentUI();
    return;
  }

  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) {
    updateInstrumentUI();
    return;
  }

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
  const noteCountEl = document.getElementById('noteCountLabel');
  if (scaleEl && handpan.scaleLabel) scaleEl.textContent = handpan.scaleLabel + ' \u25be';
  if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
  if (noteCountEl) {
    const n = Number.isFinite(handpan.noteCount) ? handpan.noteCount : 9;
    noteCountEl.textContent = String(n);
  }
  // Disable note-count steppers at limits (9–14)
  const n = Number.isFinite(handpan.noteCount) ? handpan.noteCount : 9;
  const prevN = document.getElementById('noteCountPrev');
  const nextN = document.getElementById('noteCountNext');
  if (prevN) prevN.disabled = n <= 9;
  if (nextN) nextN.disabled = n >= 14;
  const voiceEl = document.getElementById('instrumentDropdownToggle');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = (inst.name || inst.id) + ' \u25be';
}

function updateInstrumentUI() {
  updateLabels();
  renderInstrumentMenu();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;
  surface.layoutHandpanFields(notes.slice(0, handpan.noteCount || 9), isFieldPlayable);
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

function triggerTouchFeedback(x, y, noteIndex) {
  if (window.PionierSettings?.touchFeedback !== true) return;
  surface.addRipple?.(x, y, noteIndex);
  // Vibration is a progressive enhancement: some mobile browsers (notably iOS
  // Safari) do not expose navigator.vibrate, so the visual ripple still works.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(9);
    }
  } catch (_) {}
}

function resize() {
  if (!surface) return;
  surface.resize();
  layoutFields();
  draw();
}

;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas?.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});
canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

canvas?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType === 'touch') e.stopPropagation();
  ensureAudio();
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  if (!hit) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const inst = activeInstrument();
  const alreadyHeld = Array.from(app.pointers.values()).some((rec) =>
    (typeof rec === 'object' ? rec?.index : rec) === hit.index
  );
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture);
  app.pointers.set(e.pointerId, { index: hit.index, originY: y, originX: x });
  app.lastVelocity = gesture.velocity;
  if (!alreadyHeld) {
    inst.noteOn(gesture, hit);
    triggerTouchFeedback(x, y, hit.index);
    if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
  }
  draw();
});

canvas?.addEventListener('pointermove', (e) => {
  if (!app.pointers.has(e.pointerId)) return;
  e.preventDefault();
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  const rec = app.pointers.get(e.pointerId);
  const prevIdx = rec?.index ?? rec;
  const inst = activeInstrument();

  const moved = app.gestureTracker.move(e.pointerId, hit?.x ?? x, hit?.y ?? y, {
    radial: hit?.radial,
    angle: hit?.angleRad,
    pressure: e.pressure || 0,
    force: e.force || 0,
    activeTouches: app.gestureTracker.activeCount
  });

  if (hit && hit.index !== prevIdx) {
    const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount, inst.lastStrikeAt);
    gesture.velocity = Math.min(1, (gesture.velocity || 0.65) * 0.85);
    let glided = false;
    const sharedPrev = prevIdx != null && hasOtherPointerAt(prevIdx, e.pointerId);
    const sharedTarget = hasOtherPointerAt(hit.index, e.pointerId);
    if (false) { /* glide disabled */ }
    if (!glided) {
      if (prevIdx != null && !sharedPrev) inst.noteOff(prevIdx);
      if (!sharedTarget) {
        inst.noteOn(gesture, hit);
        triggerTouchFeedback(x, y, hit.index);
      }
    }
    if (glided || !sharedTarget) {
      if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
    }
    app.pointers.set(e.pointerId, { index: hit.index, originY: y, originX: x });
    draw();
  } else if (hit && typeof inst.express === 'function' && moved) {
    const originY = (typeof rec === 'object' && rec?.originY != null) ? rec.originY : y;
    const dy = originY - y;
    const bendNorm = Math.max(-1, Math.min(1, dy / PITCH_BEND_PIXELS));
    const range = inst.pitchBendRange ?? 2;
    moved.pitchBendNorm = 0;
    moved.pitchBend = 0;
    inst.express(moved, hit);
  }
});

function hasOtherPointerAt(index, pointerId) {
  for (const [id, rec] of app.pointers) {
    if (id !== pointerId && (typeof rec === 'object' ? rec?.index : rec) === index) return true;
  }
  return false;
}

function releaseAllPointers() {
  const heldIndices = new Set();
  for (const [pointerId, rec] of app.pointers) {
    const index = typeof rec === 'object' ? rec?.index : rec;
    if (index != null) heldIndices.add(index);
    app.gestureTracker.up(pointerId);
    try { canvas?.releasePointerCapture?.(pointerId); } catch (_) {}
  }
  app.pointers.clear();
  const inst = activeInstrument();
  if (typeof inst?.dampAll === 'function') {
    try { inst.dampAll(); } catch (_) {}
    return;
  }
  for (const index of heldIndices) {
    try { inst?.noteOff(index); } catch (_) {}
  }
}

function releasePointer(e) {
  const rec = app.pointers.get(e.pointerId);
  if (!app.pointers.has(e.pointerId)) return;
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  const idx = (typeof rec === 'object' && rec != null) ? rec.index : rec;
  if (idx != null && !hasOtherPointerAt(idx, e.pointerId)) activeInstrument().noteOff(idx);
  try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
}

window.addEventListener('blur', releaseAllPointers);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllPointers();
});

canvas?.addEventListener('pointerup', (e) => { e.preventDefault(); releasePointer(e); });
canvas?.addEventListener('lostpointercapture', (e) => { releasePointer(e); });
canvas?.addEventListener('pointercancel', (e) => { releasePointer(e); });

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
    let startVal = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startVal = value;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      apply(startVal + (startY - e.clientY) / 140);
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('pointercancel', () => { dragging = false; });
  }

  const wireType = (attr, moduleId) => {
    document.querySelectorAll(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = app.fxChain?.modules?.find((x) => x.id === moduleId);
        if (mod) mod.type = btn.getAttribute(attr);
        mod?._apply?.(getAudioContext());
        document.querySelectorAll(`[${attr}]`).forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
      });
    });
  };
  wireType('data-comp', 'compressor');
  wireType('data-delay', 'delay');
  wireType('data-reverb', 'reverb');
  wireType('data-filter', 'filter');

  document.querySelectorAll('[data-delay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mod = app.fxChain?.modules?.find((x) => x.id === 'delay');
      if (!mod) return;
      const t = btn.getAttribute('data-delay');
      mod.type = t === 'dub' ? 'ambient' : t;
      mod._apply?.(getAudioContext());
    });
  });

  document.querySelectorAll('.knob-effect-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('aria-controls');
      const bubble = id ? document.getElementById(id) : null;
      if (!bubble) return;
      const open = bubble.hasAttribute('hidden');
      document.querySelectorAll('.effect-bubble').forEach((b) => b.setAttribute('hidden', ''));
      document.querySelectorAll('.knob-effect-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (open) {
        bubble.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.effect-bubble').forEach((b) => b.setAttribute('hidden', ''));
    document.querySelectorAll('.knob-effect-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  });
}

(function setupDrawer() {
  const drawer = document.getElementById('mobileControlDrawer');
  const toggle = document.getElementById('mobileControlsToggle');
  if (!drawer || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = !drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  });
})();

function setActivePage(which) {
  const page = document.getElementById('soundscapesPage');
  const showSS = which === 'soundscapes';
  const drawer = document.getElementById('mobileControlDrawer');
  const toggle = document.getElementById('mobileControlsToggle');
  drawer?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  const toggleLabel = toggle?.querySelector('.mobile-controls-label');
  if (toggleLabel) toggleLabel.textContent = 'Controls';
  if (page) {
    page.classList.toggle('is-active', showSS);
    page.setAttribute('aria-hidden', showSS ? 'false' : 'true');
  }
  document.body.classList.toggle('soundscapes-active', showSS);
  document.getElementById('app')?.classList.toggle('soundscapes-away', showSS);
  document.querySelectorAll('.page-tab').forEach((tab) => {
    const isSS = tab.id === 'tabSoundscapes' || tab.id === 'tabSoundscapesActive';
    const isHand = tab.id === 'tabHandpan' || tab.id === 'tabHandpanFromSS';
    const active = showSS ? isSS : isHand;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

(function setupPageTabs() {
  document.getElementById('tabHandpan')?.addEventListener('click', () => setActivePage('handpan'));
  document.getElementById('tabSoundscapes')?.addEventListener('click', () => setActivePage('soundscapes'));
  document.getElementById('tabHandpanFromSS')?.addEventListener('click', () => setActivePage('handpan'));
  document.getElementById('tabSoundscapesActive')?.addEventListener('click', () => setActivePage('soundscapes'));
  document.getElementById('btnExitSS')?.addEventListener('click', () => { window.location.href = '../'; });
})();

function wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
function refreshPitch() {
  try {
    handpan.rebuildNotes();
    syncWorldPitch();
    updateLabels();
    layoutFields();
    draw();
  } catch (err) {
    console.warn('refreshPitch', err);
    try { updateLabels(); } catch (_) {}
  }
  // Keep chrome interactive after scale/root changes
  try {
    if (window.PionierOverlay?.closePickers) window.PionierOverlay.closePickers();
    document.getElementById('app')?.classList.remove('soundscapes-away');
    document.body.classList.remove('soundscapes-active');
    const bd = document.getElementById('pickerBackdrop');
    if (bd) { bd.hidden = true; bd.setAttribute('hidden', ''); }
  } catch (_) {}
  // Re-measure pan slot after label/layout shifts
  try {
    if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
  } catch (_) {}
}
wire('scalePrev', () => {
  const n = HANDPAN_SCALES.length;
  handpan.setScaleIndex((handpan.scaleIndex - 1 + n) % n);
  refreshPitch();
});
wire('scaleNext', () => {
  const n = HANDPAN_SCALES.length;
  handpan.setScaleIndex((handpan.scaleIndex + 1) % n);
  refreshPitch();
});
// HTML ids: rootPrev / rootNext (root wraps over 12)
wire('rootPrev', () => { handpan.setRootIndex((handpan.rootIndex - 1 + 12) % 12); refreshPitch(); });
wire('rootNext', () => { handpan.setRootIndex((handpan.rootIndex + 1) % 12); refreshPitch(); });
// HTML ids: noteCountPrev / noteCountNext (clamp 9–14 via changeNoteCount)
wire('noteCountPrev', () => { changeNoteCount(-1); });
wire('noteCountNext', () => { changeNoteCount(1); });

const INSTRUMENT_GROUP_ORDER = [
  { id: 'handpan', label: 'Handpan' },
  { id: 'traditional', label: 'Traditional' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'experimental', label: 'Ambient' },
  { id: 'arp', label: 'Arpeggiators' },
  { id: 'other', label: 'Other' },
];

function instrumentGroupId(item) {
  if (!item) return 'other';
  if (item.id === 'handpan') return 'handpan';
  const cat = (item.category || '').toLowerCase();
  if (cat === 'traditional' || cat === 'hybrid' || cat === 'experimental' || cat === 'arp') return cat;
  return 'other';
}

function renderInstrumentMenu() {
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.replaceChildren();
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Choose instrument');

  const seen = new Set();
  const groups = new Map(INSTRUMENT_GROUP_ORDER.map((g) => [g.id, []]));
  for (const item of InstrumentRegistry.list()) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const gid = instrumentGroupId(item);
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push(item);
  }

  let focusTarget = null;
  for (const meta of INSTRUMENT_GROUP_ORDER) {
    const items = groups.get(meta.id) || [];
    if (!items.length) continue;
    const head = document.createElement('div');
    head.className = 'instrument-menu-group';
    head.textContent = meta.label;
    head.setAttribute('role', 'presentation');
    menu.appendChild(head);
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const active = InstrumentRegistry.active?.id === item.id;
      btn.className = 'instrument-menu-item' + (active ? ' is-active' : '');
      btn.setAttribute('role', 'menuitem');
      btn.dataset.instrumentId = item.id;
      btn.textContent = item.name || item.id;
      if (active) {
        btn.setAttribute('aria-current', 'true');
        focusTarget = btn;
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setInstrument(item.id).catch(() => {});
        if (window.PionierOverlay) window.PionierOverlay.closePickers();
        else {
          menu.hidden = true;
          menu.setAttribute('hidden', '');
          document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
        }
      });
      menu.appendChild(btn);
    }
  }
  // Prefer focusing the active item when the sheet opens
  if (focusTarget) menu.dataset.focusItem = focusTarget.dataset.instrumentId || '';
}
window.__pionierRenderInstrumentMenu = renderInstrumentMenu;
document.addEventListener('pionier:picker-open', (e) => {
  if (e.detail?.id === 'instrumentMenu') renderInstrumentMenu();
});

/* instrument menu open/close: overlay-controller.js */
document.getElementById('instrumentDropdownToggle')?.addEventListener('click', () => {
  renderInstrumentMenu();
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


/* Keyboard: digits 1–9 (and Q–O) map to pads 0–8. Hold = sustain; release = noteOff. */
const KEY_TO_PAD = {
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8,
  'q': 0, 'w': 1, 'e': 2, 'r': 3, 't': 4, 'y': 5, 'u': 6, 'i': 7, 'o': 8,
};
function keyboardTargetOk(el) {
  if (!el) return true;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
  if (el.isContentEditable) return false;
  return true;
}
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!keyboardTargetOk(e.target)) return;
  const pad = KEY_TO_PAD[e.key.toLowerCase()];
  if (pad == null) return;
  const count = padCount();
  if (pad >= count) return;
  e.preventDefault();
  if (app.keysHeld.has(e.key.toLowerCase())) return;
  app.keysHeld.add(e.key.toLowerCase());
  ensureAudio();
  const inst = activeInstrument();
  const fields = surface?.fields || [];
  const field = fields[pad];
  if (!field) return;
  const alreadyHeld = Array.from(app.pointers.values()).some((rec) =>
    (typeof rec === 'object' ? rec?.index : rec) === pad
  );
  if (alreadyHeld) return;
  const gesture = {
    pointerId: 'key:' + e.key.toLowerCase(),
    x: field.x, y: field.y,
    velocity: 0.78,
    pressure: 0.5,
    timestamp: performance.now(),
    phase: 'down',
  };
  try { inst.noteOn(gesture, { index: pad, ...field }); } catch (_) {}
  draw();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  const pad = KEY_TO_PAD[k];
  if (pad == null) return;
  if (!app.keysHeld.has(k)) return;
  app.keysHeld.delete(k);
  const stillHeld =
    Array.from(app.pointers.values()).some((rec) => (typeof rec === 'object' ? rec?.index : rec) === pad) ||
    [...app.keysHeld].some((hk) => KEY_TO_PAD[hk] === pad);
  if (!stillHeld) {
    try { activeInstrument().noteOff(pad); } catch (_) {}
  }
  draw();
});
window.addEventListener('blur', () => {
  for (const k of [...app.keysHeld]) {
    const pad = KEY_TO_PAD[k];
    app.keysHeld.delete(k);
    if (pad != null) {
      try { activeInstrument().noteOff(pad); } catch (_) {}
    }
  }
});

window.PionierCore = {
  handpan, surface,
  activeInstrument: () => activeInstrument(),
  ensureAudio: () => ensureAudio(),
  paintFxKnobs: () => { ensureAudio(); wireKnobs(); paintAllKnobs(); },
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
  }
};

window.addEventListener('pionier:settings', () => {
  try { draw(); } catch (_) {}
  try { resize(); } catch (_) {}
});

async function boot() {
  ensureAudio();
  const saved = readSavedInstrumentId();
  await setInstrument(saved);
  refreshPitch();
  resize();
  window.addEventListener('resize', resize);
  // Unlock on the earliest gesture Safari accepts (touchstart + pointerdown).
  const unlock = () => {
    ensureAudio();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('touchstart', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  document.addEventListener('touchstart', unlock, { capture: true, passive: true });
  if (isDebugEnabled?.()) mountDebugPanel?.({ setInstrument });
}

await boot();
export default window.PionierCore;
