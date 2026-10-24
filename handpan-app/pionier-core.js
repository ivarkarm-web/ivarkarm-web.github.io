/**
 * pionier-core -- instrument surface + audio graph
 * Local vendored core (no remote fetch / string-patch boot).
 * Looper v2: exposes getInstrumentBus for pre-FX recording
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js?v=2';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js?v=12';
import { createLibraryInstruments } from './js/instruments/library-family.js?v=3';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface } from './js/pionier-surface.js?v=146';

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
  ambientBus: null,
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
  return fieldIndex >= 0 && fieldIndex < (handpan.noteCount || 8);
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
  if (scaleEl && handpan.scaleLabel) { const root = handpan.rootLabel || ''; let scaleName = handpan.scaleLabel; if (root && scaleName.startsWith(root + ' ')) scaleName = scaleName.slice(root.length).trim(); scaleEl.textContent = scaleName + ' \u25be'; }
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

function updateInstrumentUI() {
  updateLabels();
  renderInstrumentMenu();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;
  surface.layoutHandpanFields(notes.slice(0, handpan.noteCount || 8), isFieldPlayable);
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
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([70, 30, 110, 25, 75]);
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
      if (m.tone) v = fxKnobValues[m.tone] ?? m.def;
      else {
        const mod = app.fxChain.modules?.find((x) => x.id === m.fxId);
        if (mod && Number.isFinite(mod.value)) v = mod.value;
      }
    } catch (_) {}
    paintKnob(canvasEl, v, m.size || 88);
  }
}

const FX_KNOB_MAP = [
  { knobId: 'knobCompress', valId: 'valCompress', fxId: 'compressor', def: 0.4 },
  { knobId: 'knobDelay', valId: 'valDelay', fxId: 'delay', def: 0.15 },
  { knobId: 'knobReverb', valId: 'valReverb', fxId: 'reverb', def: 0.25 },
  { knobId: 'knobFilter', valId: 'valFilter', fxId: 'filter', def: 0.12 },
  { knobId: 'knobBass', valId: 'valBass', tone: 'bass', def: 0.5 },
  { knobId: 'knobLow', valId: 'valLow', tone: 'low', def: 0.5 },
  { knobId: 'knobMid', valId: 'valMid', tone: 'mid', def: 0.5 },
  { knobId: 'knobMaster', valId: 'valMaster', tone: 'master', def: 0.82 }
];
const fxKnobValues = Object.create(null);
FX_KNOB_MAP.forEach((item) => { fxKnobValues[item.tone || item.fxId] = item.def; });

function setFxTone(key, value) {
  const v = Math.max(0, Math.min(1, Number(value)));
  if (!Number.isFinite(v) || !app.fxChain) return;
  const chain = app.fxChain;
  if (key === 'bass') chain.setBass?.(v);
  else if (key === 'low') chain.setLow?.(v);
  else if (key === 'mid') chain.setMid?.(v);
  else if (key === 'master') chain.setMaster?.(v);
  else chain.setValue?.(key, v);
  fxKnobValues[key] = v;
}

function wireKnobs() {
  if (!app.fxChain) return;
  paintAllKnobs();
  for (const item of FX_KNOB_MAP) {
    const el = document.getElementById(item.knobId);
    if (!el || el.dataset.coreKnobWired === '1') continue;
    el.dataset.coreKnobWired = '1';
    el.style.touchAction = 'none';
    const canvasEl = el.querySelector('.knob-canvas') || el;
    canvasEl.style.touchAction = 'none';
    let dragging = false;
    let startY = 0;
    let startValue = item.def;
    const key = item.tone || item.fxId;
    const paint = (value) => {
      paintKnob(el.querySelector('.knob-canvas'), value, item.tone ? 72 : 68);
      const valueEl = document.getElementById(item.valId);
      if (valueEl) valueEl.textContent = Math.round(value * 100) + '%';
    };
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      ensureAudio();
      dragging = true;
      startY = event.clientY;
      startValue = fxKnobValues[key] ?? item.def;
      try { el.setPointerCapture(event.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      event.preventDefault();
      const value = Math.max(0, Math.min(1, startValue + (startY - event.clientY) / 120));
      setFxTone(key, value);
      paint(value);
    });
    const finish = () => { dragging = false; };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('lostpointercapture', finish);
  }
}

function refreshPitch() {
  syncWorldPitch();
  layoutFields();
  updateLabels();
  draw();
}

const KEY_TO_PAD = {};
KEYS.forEach((k, i) => { KEY_TO_PAD[k] = i; });

function renderInstrumentMenu() {
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.innerHTML = '';
  const results = document.createElement('div');
  results.className = 'instrument-menu-results';
  menu.appendChild(results);
  const seen = new Set();
  const groups = new Map();
  function instrumentGroupId(item) {
    const c = (item.category || item.engineKind || 'other').toString().toLowerCase();
    if (c.includes('hand') || item.id === 'handpan') return 'handpan';
    if (c.includes('arp')) return 'arp';
    return 'library';
  }
  const labels = { handpan: 'Handpan', library: 'Library', arp: 'Arps' };
  for (const item of InstrumentRegistry.list()) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const gid = instrumentGroupId(item);
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push(item);
  }
  for (const [gid, items] of groups) {
    const section = document.createElement('div');
    section.className = 'instrument-menu-section';
    const h = document.createElement('div');
    h.className = 'instrument-menu-group';
    h.textContent = labels[gid] || gid;
    section.appendChild(h);
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const active = InstrumentRegistry.active?.id === item.id;
      btn.className = 'instrument-menu-item pionier-menu-option' + (active ? ' is-active' : '');
      btn.setAttribute('role', 'menuitem');
      btn.dataset.instrumentId = item.id;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name || item.id;
      btn.appendChild(nameSpan);
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        setInstrument(item.id).catch(() => {});
        if (window.PionierOverlay) window.PionierOverlay.closePickers();
        else {
          menu.hidden = true;
          menu.setAttribute('hidden', '');
          document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
        }
      });
      try { window.PionierFavorites?.decorateInstrumentItem?.(btn, item); } catch (_) {}
      section.appendChild(btn);
    }
    results.appendChild(section);
  }
}
window.__pionierRenderInstrumentMenu = renderInstrumentMenu;
document.addEventListener('pionier:picker-open', (e) => {
  if (e.detail?.id === 'instrumentMenu') renderInstrumentMenu();
});
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

function padCount() { return handpan.noteCount || 8; }
function changeNoteCount(delta) {
  const MIN = 8;
  const MAX = 13;
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
  updateLabels();
  draw();
  return true;
}

function wire(id, handler) {
  const element = document.getElementById(id);
  if (!element || element.dataset.coreActionWired === '1') return;
  element.dataset.coreActionWired = '1';
  element.addEventListener('click', handler);
}

wire('scalePrev', () => {
  handpan.setScaleIndex(handpan.scaleIndex - 1);
  refreshPitch();
});
wire('scaleNext', () => {
  handpan.setScaleIndex(handpan.scaleIndex + 1);
  refreshPitch();
});
wire('rootPrev', () => {
  handpan.setRootIndex(handpan.rootIndex - 1);
  refreshPitch();
});
wire('rootNext', () => {
  handpan.setRootIndex(handpan.rootIndex + 1);
  refreshPitch();
});
wire('noteCountPrev', () => changeNoteCount(-1));
wire('noteCountNext', () => changeNoteCount(1));

window.addEventListener('blur', () => {
  for (const k of [...app.keysHeld]) {
    const pad = KEY_TO_PAD[k];
    app.keysHeld.delete(k);
    if (pad != null) {
      try { activeInstrument().noteOff(pad); } catch (_) {}
    }
  }
});

async function loadArpsSafe() {
  try {
    const mod = await import(new URL('./js/instruments/arp-family.js?v=3', import.meta.url).href);
    const create = mod.createArpInstruments;
    if (typeof create !== 'function') return;
    const arps = create() || [];
    for (const a of arps) {
      try { InstrumentRegistry.register(a); } catch (_) {}
    }
  } catch (e) {
    console.warn('[core] arp load', e);
  }
}

window.PionierCore = {
  handpan, surface,
  activeInstrument: () => activeInstrument(),
  listInstruments: () => InstrumentRegistry.list(),
  registerInstrument: (inst) => InstrumentRegistry.register(inst),
  setInstrument: (id) => setInstrument(id),
  ensureAudio: () => ensureAudio(),
  paintFxKnobs: () => { ensureAudio(); wireKnobs(); paintAllKnobs(); },
  getFxModule: (id) => app.fxChain?.modules?.find((m) => m.id === id) || null,
  setFxTone: (key, value) => setFxTone(key, value),
  getAudioContext: () => getAudioContext(),
  refreshFxKnobs: () => paintAllKnobs(),
  getInstrumentBus: () => {
    if (!app.instrumentBus) ensureAudio();
    return app.instrumentBus;
  },
  getAmbientBus: () => {
    if (!app.ambientBus) ensureAudio();
    return app.ambientBus;
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
  setNoteCount(count) {
    const target = Math.max(8, Math.min(13, Math.round(Number(count) || 8)));
    return changeNoteCount(target - padCount());
  },
  setScaleIndex(i) {
    handpan.setScaleIndex(i);
    refreshPitch();
  },
  async randomizeSetup() {
    const list = InstrumentRegistry.list().filter((item) => item && item.id);
    const currentId = InstrumentRegistry.active?.id || activeInstrument()?.id || 'handpan';
    const nonArp = list.filter((item) => {
      const c = String(item.category || item.engineKind || '').toLowerCase();
      return !c.includes('arp');
    });
    const base = nonArp.length ? nonArp : list;
    let pool = base.filter((item) => item.id !== currentId);
    if (!pool.length) pool = base.slice();
    let switched = false;
    for (let attempt = 0; attempt < Math.min(8, pool.length || 1) && pool.length; attempt++) {
      const idx = Math.floor(Math.random() * pool.length);
      const pick = pool.splice(idx, 1)[0];
      if (!pick?.id) continue;
      try { await setInstrument(pick.id); } catch (err) {
        console.warn('[randomize] setInstrument failed', pick.id, err);
      }
      const now = InstrumentRegistry.active?.id || activeInstrument()?.id;
      if (now && now !== currentId) { switched = true; break; }
    }
    if (!switched && list.length > 1) {
      for (let s = 0; s < list.length; s++) {
        const cur = InstrumentRegistry.active?.id || 'handpan';
        const i = list.findIndex((x) => x.id === cur);
        const next = list[(i + 1) % list.length];
        if (!next) break;
        try { await setInstrument(next.id); } catch (_) {}
        if ((InstrumentRegistry.active?.id || '') !== currentId) break;
      }
    }
    const voiceEl = document.getElementById('instrumentDropdownToggle');
    const inst = activeInstrument();
    if (voiceEl && inst) voiceEl.textContent = (inst.name || inst.id) + ' \u25be';
    const scales = (typeof HANDPAN_SCALES !== 'undefined' && HANDPAN_SCALES) || window.HANDPAN_SCALES || [];
    if (scales.length > 1) {
      let next = Math.floor(Math.random() * scales.length);
      const curIdx = typeof handpan.scaleIndex === 'number' ? handpan.scaleIndex : -1;
      if (next === curIdx) next = (next + 1) % scales.length;
      handpan.setScaleIndex(next);
      refreshPitch();
      const label = document.getElementById('scaleLabel');
      const scale = scales[next];
      if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' \u25be';
    }
    draw();
    return {
      instrument: activeInstrument()?.id,
      scaleIndex: handpan.scaleIndex,
      instrumentCount: list.length,
    };
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
