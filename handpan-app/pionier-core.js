/**
 * pionier-app.js — restored working instrument surface (backup-compatible)
 * MPE pitch bend + smooth glide between pads + pressure expression
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js';
import { createTonalInstruments } from './js/instruments/tonal-family.js?v=6';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface } from './js/pionier-surface.js?v=95';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];
const PITCH_BEND_PIXELS = 90;

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);
for (const instrument of createTonalInstruments()) InstrumentRegistry.register(instrument);

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
  // One engine voice is keyed per pad; don't retrigger/release it while another
  // pointer is already holding that pad.
  if (!alreadyHeld) {
    inst.noteOn(gesture, hit);
    window.dispatchEvent(new CustomEvent('pionier:learn-note', { detail: { index: hit.index, at: performance.now() } }));
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
    // Prefer smooth MPE glide/portamento when instrument supports it
    let glided = false;
    const sharedPrev = prevIdx != null && hasOtherPointerAt(prevIdx, e.pointerId);
    const sharedTarget = hasOtherPointerAt(hit.index, e.pointerId);
    if (!sharedPrev && !sharedTarget && prevIdx != null && typeof inst.glideTo === 'function') {
      glided = !!inst.glideTo(prevIdx, hit.index, gesture, hit);
    }
    if (!glided) {
      if (prevIdx != null && !sharedPrev) inst.noteOff(prevIdx);
      if (!sharedTarget) inst.noteOn(gesture, hit);
    }
    if (glided || !sharedTarget) {
      window.dispatchEvent(new CustomEvent('pionier:learn-note', { detail: { index: hit.index, at: performance.now(), instrument: inst.id || inst.name || 'handpan' } }));
      if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
    }
    app.pointers.set(e.pointerId, { index: hit.index, originY: y, originX: x });
    draw();
  } else if (hit && typeof inst.express === 'function' && moved) {
    const originY = (typeof rec === 'object' && rec?.originY != null) ? rec.originY : y;
    const dy = originY - y;
    const bendNorm = Math.max(-1, Math.min(1, dy / PITCH_BEND_PIXELS));
    const range = inst.pitchBendRange ?? 2;
    moved.pitchBendNorm = bendNorm;
    moved.pitchBend = bendNorm * range;
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
  // Blur can arrive after a pointer was lost by the browser, leaving a voice
  // active even when our pointer map is empty. Always hard-release the
  // instrument's held voices when the app loses focus.
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
  // A pad remains held until its final pointer leaves it.
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

function wireKnobs() {
  if (!app.fxChain) return;
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
  // Enter every page through a clean, collapsed controls state.
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

// Soundscapes playback and navigation are owned by js/soundscapes.js.
function wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  alert('Play: tap tonefields or Q–O (hold to sustain).\nSlide across pads for smooth glide/portamento.\nHold + drag up/down for MPE pitch bend (±2 semitones).\nPressure = gain, vibrato depth, filter resonance.\nRadial position = brightness.\nMulti-touch polyphony supported.');
});

function refreshPitch() {
  handpan.rebuildNotes();
  syncWorldPitch();
  updateLabels();
  layoutFields();
  draw();
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
wire('rootDown', () => { handpan.setRootIndex((handpan.rootIndex - 1 + 12) % 12); refreshPitch(); });
wire('rootUp', () => { handpan.setRootIndex((handpan.rootIndex + 1) % 12); refreshPitch(); });
wire('octDown', () => { handpan.setOctaveOffset(Math.max(-1, (handpan.octaveOffset ?? 0) - 1)); refreshPitch(); });
wire('octUp', () => { handpan.setOctaveOffset(Math.min(1, (handpan.octaveOffset ?? 0) + 1)); refreshPitch(); });

function cycleInstrument(dir) {
  const ids = InstrumentRegistry.list().map((x) => x.id);
  const cur = ids.indexOf(activeInstrument().id);
  setInstrument(ids[(cur + dir + ids.length) % ids.length]);
}
wire('voicePrev', () => cycleInstrument(-1));
wire('voiceNext', () => cycleInstrument(1));

function renderInstrumentMenu() {
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.replaceChildren();
  for (const item of InstrumentRegistry.list()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'instrument-menu-item' + (item.id === activeInstrument().id ? ' is-active' : '');
    button.textContent = item.name;
    button.addEventListener('click', () => {
      setInstrument(item.id);
      menu.hidden = true;
      document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(button);
  }
}
document.getElementById('instrumentDropdownToggle')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.hidden = !menu.hidden;
  document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
});
document.addEventListener('click', (e) => {
  const menu = document.getElementById('instrumentMenu');
  if (!menu || menu.hidden) return;
  if (e.target.closest('#instrumentMenu') || e.target.closest('#instrumentDropdownToggle')) return;
  menu.hidden = true;
});

window.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select, textarea')) return;
  if (e.repeat) return;
  const i = KEYS.indexOf(e.key.toLowerCase());
  if (i < 0) return;
  e.preventDefault();
  if (app.keysHeld.has(i)) return;
  app.keysHeld.add(i);
  ensureAudio();
  const inst = activeInstrument();
  const hit = { index: i, radial: 0.5, angleRad: 0 };
  inst.noteOn({ velocity: 0.75, pointerId: -1 - i }, hit);
  window.dispatchEvent(new CustomEvent('pionier:learn-note', { detail: { index: hit.index, at: performance.now(), instrument: inst.id || inst.name || 'handpan' } }));
  draw();
});
window.addEventListener('keyup', (e) => {
  const i = KEYS.indexOf(e.key.toLowerCase());
  if (i < 0) return;
  app.keysHeld.delete(i);
  activeInstrument().noteOff(i);
});
window.addEventListener('blur', () => {
  for (const i of app.keysHeld) activeInstrument().noteOff(i);
  app.keysHeld.clear();
});

function tick(now) {
  app._fpsFrames++;
  if (now - app._fpsLast >= 1000) {
    app.fps = app._fpsFrames;
    app._fpsFrames = 0;
    app._fpsLast = now;
  }
  surface.setSlitPhase?.(now * 0.0015);
  let dirty = !app.reducedMotion;
  if (activeInstrument().tickGlow?.()) dirty = true;
  if (dirty) draw();
  requestAnimationFrame(tick);
}

async function boot() {
  try { await setInstrument(readSavedInstrumentId()); }
  catch (err) {
    console.error(err);
    try { await setInstrument('handpan'); } catch (fallbackError) { console.error(fallbackError); }
  }
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  if (isDebugEnabled?.()) mountDebugPanel?.({ setInstrument });
}

function padCount() { return handpan.noteCount || 9; }
function changeNoteCount(delta) {
  const before = handpan.noteCount || 9;
  const after = Math.max(9, Math.min(13, before + delta));
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
  health: () => ({
    audioAvailable: !!getAudioContext(),
    audioState: audioState(),
    storageAvailable,
    instrumentReady: !!InstrumentRegistry.active?.ready
  }),
  draw() { draw(); },
  addNote() { return changeNoteCount(1); },
  removeNote() { return changeNoteCount(-1); },
  noteCount: () => {
    const inst = activeInstrument();
    const notes = inst?.getNotes?.();
    if (Array.isArray(notes) && notes.length) return notes.length;
    if (Number.isFinite(inst?.noteCount) && inst.noteCount > 0) return inst.noteCount;
    const fields = surface?.fields;
    if (Array.isArray(fields) && fields.length) return fields.length;
    return padCount();
  }
};

await boot();
