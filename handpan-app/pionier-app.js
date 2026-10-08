/**
 * pionier-app.js — integrated instrument surface
 * Pointer → Gesture → Active Instrument → Bus → FxChain → Master → Output
 *
 * ONE visual surface (handpan body + tonefields + slits) for all instruments.
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument } from './js/instruments/handpan.js';
import { KitchenInstrument } from './js/instruments/kitchen.js';
import { BirdInstrument } from './js/instruments/bird.js';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface, WORLD_ZONE_INDICES } from './js/pionier-surface.js?v=25';
import { createSoundscapes } from './js/soundscapes.js?v=4';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const handpan = new HandpanInstrument();
const kitchen = new KitchenInstrument();
const bird = new BirdInstrument();
InstrumentRegistry.register(handpan);
InstrumentRegistry.register(kitchen);
InstrumentRegistry.register(bird);

const app = {
  fxChain: null,
  instrumentBus: null,
  gestureTracker: new GestureTracker(),
  pointers: new Map(),
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
const surface = createSurface(canvas);

const soundscapes = createSoundscapes({
  getNotes: () => {
    if (!handpan.getNotes?.().length) handpan.rebuildNotes?.();
    return handpan.getNotes() || [];
  },
  ensureAudio
});
app.soundscapes = soundscapes;

function ensureAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (!app.instrumentBus) {
    app.instrumentBus = ctx.createGain();
    app.instrumentBus.gain.value = 1.45;
    app.fxChain = new FxChain(ctx, getAudioMaster());
    app.fxChain.seedDefaults();
    app.instrumentBus.connect(app.fxChain.input);
  }
  resumeAudio();
  return true;
}

function pentatonicFromHandpan() {
  if (!handpan.notes?.length) handpan.rebuildNotes?.();
  const notes = handpan.getNotes();
  return WORLD_ZONE_INDICES.map((i) => {
    const n = notes[i] || notes[0];
    return { midi: n.midi, freq: n.freq, name: n.name, index: i };
  });
}

function syncWorldPitch() {
  const penta = pentatonicFromHandpan();
  kitchen.setMusicalContext(penta);
  bird.setMusicalContext(penta);
}

function activeInstrument() {
  return InstrumentRegistry.active || handpan;
}

function isFieldPlayable(fieldIndex) {
  const inst = activeInstrument();
  if (inst.id === 'handpan') return fieldIndex >= 0 && fieldIndex <= 8;
  return WORLD_ZONE_INDICES.includes(fieldIndex);
}

async function setInstrument(id) {
  ensureAudio();
  const ctx = getAudioContext();
  const prev = InstrumentRegistry.active;
  if (prev) prev.dampAll();
  await InstrumentRegistry.setActive(id, ctx, app.instrumentBus);
  syncWorldPitch();
  updateInstrumentUI();
  layoutFields();
  const phase = app.catchMode?.phase;
  if (phase && ['ascending', 'descending', 'catch-intro'].includes(phase)) {
    app.catchMode.startCatchSequence();
  }
  draw();
}

app.catchMode = new CatchMode({
  getInstrument: () => activeInstrument(),
  onStatus: (msg) => {
    const el = document.getElementById('catchStatus');
    if (!el) return;
    el.textContent = msg || '';
    if (msg && /PERFECT|GREAT|GOOD|LATE|MISS|DESCEND|Caught/.test(msg)) {
      el.classList.remove('is-flash');
      void el.offsetWidth;
      el.classList.add('is-flash');
    }
  },
  onPhase: (phase) => {
    document.body.dataset.catchPhase = phase;
    const appEl = document.getElementById('app');
    if (!appEl) return;
    appEl.classList.toggle('catch-darken', ['darken', 'focus-knobs', 'focus-fx', 'focus-scale'].includes(phase));
    appEl.classList.toggle('catch-focus-knobs', phase === 'focus-knobs');
    appEl.classList.toggle('catch-focus-fx', phase === 'focus-fx');
    appEl.classList.toggle('catch-focus-scale', phase === 'focus-scale');
    appEl.classList.toggle('catch-active', ['ascending', 'descending', 'catch-intro'].includes(phase));
    if (['idle', 'complete', 'ready'].includes(phase)) {
      appEl.classList.remove('catch-darken', 'catch-focus-knobs', 'catch-focus-fx', 'catch-focus-scale');
    }
  }
});
app.catchMode.reducedMotion = app.reducedMotion;

function updateLabels() {
  const scaleEl = document.getElementById('scaleLabel');
  const rootEl = document.getElementById('rootLabel');
  const octEl = document.getElementById('octLabel');
  if (scaleEl) scaleEl.textContent = handpan.scaleLabel;
  if (rootEl) rootEl.textContent = handpan.rootLabel;
  if (octEl) {
    const o = handpan.octaveOffset;
    octEl.textContent = o === 0 ? '0' : o > 0 ? '+' + o : String(o);
  }
  const voiceEl = document.getElementById('voiceName');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = inst.id === 'handpan' ? inst.voiceName : inst.name;
}

function updateInstrumentUI() {
  updateLabels();
  document.querySelectorAll('[data-instrument]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-instrument') === activeInstrument().id);
  });
  const left = document.querySelector('.sidebar.left');
  if (left) left.style.visibility = '';
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes?.();
  surface.layoutHandpanFields(handpan.getNotes(), isFieldPlayable);
  const inst = activeInstrument();
  if (inst.id === 'kitchen' || inst.id === 'bird') {
    const notes = inst.getNotes?.() || [];
    const byIndex = new Map(notes.map((n) => [n.index, n.name]));
    for (const f of surface.fields) {
      f.zoneLabel = byIndex.get(f.index) || null;
    }
  } else {
    for (const f of surface.fields) f.zoneLabel = null;
  }
  inst.setZones(surface.fields);
}

function draw() {
  const catchActive = document.getElementById('app')?.classList.contains('catch-active');
  const waves = app.catchMode?.isActive ? app.catchMode.getActiveWaves() : [];
  const waveTargets = waves.length
    ? new Map(waves.map((w) => [w.targetIndex, w.progress]))
    : null;
  surface.drawBody(activeInstrument(), catchActive, waveTargets);
  if (waves.length) surface.drawCatchWaves(waves);
}

function resize() {
  surface.resize();
  layoutFields();
  draw();
}

;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ensureAudio();
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  if (!hit) return;
  const inst = activeInstrument();
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture);
  app.pointers.set(e.pointerId, hit.index);
  app.lastVelocity = gesture.velocity;
  inst.noteOn(gesture, hit);
  if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
  draw();
});
canvas.addEventListener('pointerup', (e) => {
  const idx = app.pointers.get(e.pointerId);
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  if (idx != null) activeInstrument().noteOff(idx);
});
canvas.addEventListener('pointercancel', (e) => {
  const idx = app.pointers.get(e.pointerId);
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  if (idx != null) activeInstrument().noteOff(idx);
});

const keyMap = Object.fromEntries(KEYS.map((k, i) => [k, i]));
const keysHeld = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
  const idx = keyMap[e.key.toLowerCase()];
  if (idx == null || !isFieldPlayable(idx)) return;
  if (keysHeld.has(idx)) return;
  e.preventDefault();
  ensureAudio();
  const inst = activeInstrument();
  const gesture = gestureFromPointer(
    { pointerId: -1 - idx, pressure: 0.8, force: 0, type: 'keydown', clientX: 0, clientY: 0 },
    { idx, index: idx, radial: 0.35, angleRad: 0 },
    1,
    inst.lastStrikeAt
  );
  keysHeld.add(idx);
  inst.noteOn(gesture, { index: idx, radial: 0.35, angleRad: 0 });
  if (app.catchMode?.isActive) app.catchMode.onStrike(idx);
  draw();
});
window.addEventListener('keyup', (e) => {
  const idx = keyMap[e.key.toLowerCase()];
  if (idx == null || !keysHeld.has(idx)) return;
  keysHeld.delete(idx);
  activeInstrument().noteOff(idx);
});
window.addEventListener('blur', () => {
  for (const idx of keysHeld) activeInstrument().noteOff(idx);
  keysHeld.clear();
});

function onMusicalChange() {
  handpan.rebuildNotes?.();
  syncWorldPitch();
  layoutFields();
  updateLabels();
  draw();
  soundscapes.syncScale?.();
  if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI();
}

function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

wire('scalePrev', () => { handpan.setScaleIndex(handpan.scaleIndex - 1); onMusicalChange(); });
wire('scaleNext', () => { handpan.setScaleIndex(handpan.scaleIndex + 1); onMusicalChange(); });
wire('rootDown', () => { handpan.setRootIndex(handpan.rootIndex - 1); onMusicalChange(); });
wire('rootUp', () => { handpan.setRootIndex(handpan.rootIndex + 1); onMusicalChange(); });
wire('octDown', () => { handpan.setOctaveOffset(handpan.octaveOffset - 1); onMusicalChange(); });
wire('octUp', () => { handpan.setOctaveOffset(handpan.octaveOffset + 1); onMusicalChange(); });
wire('voicePrev', () => {
  if (activeInstrument().id === 'handpan') { handpan.setVoiceIndex(handpan.voiceIndex - 1); updateLabels(); }
  else cycleInstrument(-1);
});
wire('voiceNext', () => {
  if (activeInstrument().id === 'handpan') { handpan.setVoiceIndex(handpan.voiceIndex + 1); updateLabels(); }
  else cycleInstrument(1);
});
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  const inst = activeInstrument();
  const keys =
    inst.id === 'handpan'
      ? 'Q–O (all 9 tonefields)'
      : 'Q W R Y I (5 active zones — same geometry as the lit pads)';
  alert(
    `Play: tap tonefields or ${keys}.\n` +
      'Scale / Base / Octave shape pitch for all instruments.\n' +
      'Switch Handpan · Kitchen · Bird via the selector.\n' +
      'Catch works on every instrument (same surface, active zones).'
  );
});

function cycleInstrument(dir) {
  const ids = InstrumentRegistry.list().map((x) => x.id);
  const cur = ids.indexOf(activeInstrument().id);
  setInstrument(ids[(cur + dir + ids.length) % ids.length]);
}

function setupKnob(id, fxId, initial) {
  const el = document.getElementById(id);
  if (!el) return;
  const cnv = el.querySelector('.knob-canvas');
  const valMap = { compress: 'valCompress', delay: 'valDelay', reverb: 'valReverb' };
  const valEl = document.getElementById(valMap[fxId]);
  const chainId = fxId === 'compress' ? 'compressor' : fxId;
  let value = initial, dragging = false, lastY = 0;
  function paint() {
    if (!cnv) return;
    const c = cnv.getContext('2d');
    const s = cnv.width;
    c.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, r = s * 0.38;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 6; c.stroke();
    c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * value);
    c.strokeStyle = '#c9a227'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
  }
  function setVal(v) {
    value = Math.max(0, Math.min(1, v));
    if (valEl) valEl.textContent = Math.round(value * 100);
    el.setAttribute('aria-valuenow', Math.round(value * 100));
    paint();
    ensureAudio();
    if (app.fxChain) app.fxChain.setValue(chainId, value);
    if (app.catchMode?.phase === 'focus-knobs' && Math.abs(value - initial) > 0.08) {
      app.catchMode.advanceFromUI();
    }
  }
  setVal(initial);
  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastY = e.clientY;
    el.setPointerCapture(e.pointerId); el.classList.add('is-active');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = lastY - e.clientY; lastY = e.clientY;
    setVal(value + dy * 0.005);
  });
  el.addEventListener('pointerup', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('pointercancel', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setVal(value + 0.05); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setVal(value - 0.05); }
  });
}
setupKnob('knobCompress', 'compress', 0.4);
setupKnob('knobDelay', 'delay', 0.15);
setupKnob('knobReverb', 'reverb', 0.25);

function setFxPanelOpen(open) {
  const panel = document.getElementById('fxPanel');
  const backdrop = document.getElementById('fxBackdrop');
  const btn = document.getElementById('btnFxSettings');
  if (!panel || !backdrop || !btn) return;
  if (open) {
    panel.hidden = false; backdrop.hidden = false; void panel.offsetWidth;
    panel.classList.add('is-open'); backdrop.classList.add('is-open');
    btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
    if (app.catchMode?.phase === 'focus-fx') app.catchMode.advanceFromUI();
  } else {
    panel.classList.remove('is-open'); backdrop.classList.remove('is-open');
    btn.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
    const hide = () => {
      if (!panel.classList.contains('is-open')) { panel.hidden = true; backdrop.hidden = true; }
    };
    panel.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 360);
  }
}
document.getElementById('btnFxSettings')?.addEventListener('click', () => {
  const btn = document.getElementById('btnFxSettings');
  setFxPanelOpen(!btn?.classList.contains('is-open'));
});
document.getElementById('fxPanelClose')?.addEventListener('click', () => setFxPanelOpen(false));
document.getElementById('fxBackdrop')?.addEventListener('click', () => setFxPanelOpen(false));

document.querySelectorAll('[data-delay]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-delay]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setDelayType) app.fxChain.setDelayType(btn.getAttribute('data-delay'));
  });
});
document.querySelectorAll('[data-reverb]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-reverb]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setReverbType) app.fxChain.setReverbType(btn.getAttribute('data-reverb'));
  });
});
document.querySelectorAll('[data-comp]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-comp]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setCompressorType) app.fxChain.setCompressorType(btn.getAttribute('data-comp'));
  });
});
const masterVol = document.getElementById('masterVol');
if (masterVol) {
  masterVol.addEventListener('input', () => {
    ensureAudio();
    const v = Number(masterVol.value) / 100;
    const valEl = document.getElementById('masterVolVal');
    if (valEl) valEl.textContent = Math.round(v * 100) + '%';
    if (app.fxChain?.setMasterGain) app.fxChain.setMasterGain(v);
    else {
      const m = getAudioMaster();
      if (m) m.gain.value = v;
    }
  });
}

function injectInstrumentSelector() {
  if (document.getElementById('instrumentSelector')) return;
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const wrap = document.createElement('div');
  wrap.id = 'instrumentSelector';
  wrap.className = 'instrument-selector';
  wrap.setAttribute('role', 'tablist');
  wrap.setAttribute('aria-label', 'Instrument');
  [
    { id: 'handpan', label: 'Handpan' },
    { id: 'kitchen', label: 'Kitchen' },
    { id: 'bird', label: 'Bird' }
  ].forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'instrument-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '\u00b7';
      wrap.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'instrument-sel-btn';
    btn.setAttribute('data-instrument', item.id);
    btn.setAttribute('role', 'tab');
    btn.textContent = item.label;
    btn.addEventListener('click', () => setInstrument(item.id));
    wrap.appendChild(btn);
  });
  const nav = topbar.querySelector('.instrument-nav');
  if (nav) topbar.insertBefore(wrap, nav);
  else topbar.appendChild(wrap);
}

function injectCatchStatus() {
  if (document.getElementById('catchStatus')) return;
  const el = document.createElement('div');
  el.id = 'catchStatus';
  el.setAttribute('aria-live', 'polite');
  el.className = 'catch-status';
  document.body.appendChild(el);
}

function tick(now) {
  app._fpsFrames++;
  if (now - app._fpsLast >= 1000) {
    app.fps = app._fpsFrames;
    app._fpsFrames = 0;
    app._fpsLast = now;
  }
  surface.setSlitPhase(now * 0.0015);
  const inst = activeInstrument();
  let dirty = false;
  if (inst.tickGlow?.()) dirty = true;
  if (app.catchMode?.isActive) { app.catchMode.tick(now); dirty = true; }
  if (!app.reducedMotion) dirty = true;
  if (dirty) draw();
  requestAnimationFrame(tick);
}

function wireSoundscapes() {
  const back = document.getElementById('scapeBacking');
  const pad = document.getElementById('scapePad');
  const nat = document.getElementById('scapeNature');
  const backVol = document.getElementById('scapeBackingVol');
  const padVol = document.getElementById('scapePadVol');
  const natVol = document.getElementById('scapeNatureVol');
  const backSolo = document.getElementById('scapeBackingSolo');
  const padSolo = document.getElementById('scapePadSolo');
  const natSolo = document.getElementById('scapeNatureSolo');
  if (back) {
    back.addEventListener('change', () => {
      ensureAudio();
      soundscapes.setBacking(back.value);
    });
  }
  if (pad) {
    pad.addEventListener('change', () => {
      ensureAudio();
      soundscapes.setPad(pad.value);
    });
  }
  if (nat) {
    nat.addEventListener('change', () => {
      ensureAudio();
      soundscapes.setNature(nat.value);
    });
  }
  if (backVol) {
    backVol.addEventListener('input', () => {
      ensureAudio();
      soundscapes.setBackingLevel(Number(backVol.value));
    });
  }
  if (padVol) {
    padVol.addEventListener('input', () => {
      ensureAudio();
      soundscapes.setPadLevel(Number(padVol.value));
    });
  }
  if (natVol) {
    natVol.addEventListener('input', () => {
      ensureAudio();
      soundscapes.setNatureLevel(Number(natVol.value));
    });
  }
  function wireSolo(btn, layer) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      ensureAudio();
      const next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      btn.classList.toggle('is-active', next);
      soundscapes.setSolo(layer, next);
    });
  }
  wireSolo(backSolo, 'backing');
  wireSolo(padSolo, 'pad');
  wireSolo(natSolo, 'nature');
}

async function boot() {
  injectInstrumentSelector();
  injectCatchStatus();
  wireSoundscapes();
  await setInstrument('handpan');
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
  try {
    const q = new URLSearchParams(window.location.search);
    const instParam = (q.get('instrument') || '').toLowerCase();
    if (instParam === 'kitchen' || instParam === 'bird' || instParam === 'handpan') {
      await setInstrument(instParam);
    }
    if (q.get('catch') === '1') app.catchMode.startOnboarding();
  } catch (_) {}
  if (isDebugEnabled()) {
    mountDebugPanel({
      setInstrument: (id) => setInstrument(id),
      startCatch: () => {
        app.catchMode.startCatchSequence();
      },
      resetCatch: () => app.catchMode.reset(),
      resetOnboarding: () => app.catchMode.startOnboarding(),
      getStats: () => ({
        instrument: activeInstrument().id,
        voices: activeInstrument().activeVoices?.size ?? 0,
        touches: app.gestureTracker.activeCount,
        velocity: app.lastVelocity,
        audioState: audioState(),
        fps: app.fps,
        dpr: window.devicePixelRatio || 1,
        tier: navigator.deviceMemory && navigator.deviceMemory <= 4 ? 'low' : 'high',
        catchPhase: app.catchMode?.phase
      })
    });
  }
}

function unlock() {
  ensureAudio();
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('pointerdown', unlock);
boot();
