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
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface, WORLD_ZONE_INDICES } from './js/pionier-surface.js?v=25';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);

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

function activeInstrument() {
  return InstrumentRegistry.active || handpan;
}

function isFieldPlayable(fieldIndex) {
  const inst = activeInstrument();
  if (inst.id === 'handpan') return fieldIndex >= 0 && fieldIndex <= 8;
  return fieldIndex >= 0 && fieldIndex <= 8;
}

async function setInstrument(id) {
  ensureAudio();
  const ctx = getAudioContext();
  const prev = InstrumentRegistry.active;
  if (prev) prev.dampAll();
  await InstrumentRegistry.setActive(id, ctx, app.instrumentBus);
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
  for (const f of surface.fields) f.zoneLabel = null;
  handpan.setZones(surface.fields);
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

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType === 'touch') e.stopPropagation();
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
canvas.addEventListener('lostpointercapture', (e) => {
  const idx = app.pointers.get(e.pointerId);
  if (idx == null) return;
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  activeInstrument().noteOff(idx);
});

canvas.addEventListener('pointercancel', (e) => {
  const idx = app.pointers.get(e.pointerId);
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  if (idx != null) activeInstrument().noteOff(idx);
});


/* Soundscapes is a separate view; its audio element persists when switching back. */
(function setupSoundscapesPage() {
  const page = document.getElementById('soundscapesPage');
  const back = document.getElementById('backToHandpan');
  const audio = document.getElementById('soundscapeAudio');
  const play = document.getElementById('mandalaPlay');
  const playIcon = document.getElementById('mandalaPlayIcon');
  const fileInput = document.getElementById('soundscapeFile');
  const addButton = document.getElementById('addSoundscapeTrack');
  const title = document.getElementById('soundscapeTrackTitle');
  const subtitle = document.getElementById('soundscapeTrackSubtitle');
  const status = document.getElementById('soundscapeStatus');
  const volume = document.getElementById('soundscapeVolume');
  const playback = document.getElementById('soundscapePlayback');
  const drawer = document.getElementById('soundscapeControlDrawer');
  const toggle = document.getElementById('soundscapeControlsToggle');
  if (!page || !audio) return;
  let currentObjectUrl = null;

  let leavingTimer = null;
  const pan = document.getElementById('pan');
  const mandala = document.getElementById('mandalaWrap');
  // Portal the artwork to <body> so no transformed/overflowing Soundscapes
  // ancestor can change the coordinate system of position:fixed.
  const mandalaHome = mandala?.parentNode || null;
  const mandalaHomeNext = mandala?.nextSibling || null;
  if (mandala && mandala.parentNode !== document.body) document.body.appendChild(mandala);
  function syncMandalaToPan() {
    if (!pan || !mandala) return;
    const rect = pan.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mandala.style.setProperty('position', 'fixed', 'important');
    mandala.style.setProperty('left', rect.left + 'px', 'important');
    mandala.style.setProperty('top', rect.top + 'px', 'important');
    mandala.style.setProperty('right', 'auto', 'important');
    mandala.style.setProperty('bottom', 'auto', 'important');
    mandala.style.setProperty('width', rect.width + 'px', 'important');
    mandala.style.setProperty('height', rect.height + 'px', 'important');
    mandala.style.setProperty('max-width', 'none', 'important');
    mandala.style.setProperty('max-height', 'none', 'important');
    mandala.style.setProperty('margin', '0', 'important');
    mandala.style.setProperty('padding', '0', 'important');
    mandala.style.setProperty('transform', 'none', 'important');
    mandala.style.setProperty('z-index', '1501', 'important');
  }
  window.addEventListener('resize', syncMandalaToPan, { passive: true });
  function showPage(show) {
    if (show) syncMandalaToPan();
    if (leavingTimer) { clearTimeout(leavingTimer); leavingTimer = null; }
    page.classList.remove('is-interactive-swipe');
    page.style.setProperty('--sc-progress', show ? '1' : '0');
    document.getElementById('app')?.style.setProperty('--sc-progress', show ? '1' : '0');
    if (mandala) mandala.style.opacity = show ? '1' : '0';
    if (show) {
      page.classList.remove('is-leaving');
      page.classList.add('is-active');
      mandala?.classList.add('is-overlay-active');
      page.setAttribute('aria-hidden', 'false');
      document.getElementById('app')?.classList.add('soundscapes-away', 'is-interactive-swipe');
    } else {
      closeControls();
      if (!page.classList.contains('is-active')) return;
      page.setAttribute('aria-hidden', 'true');
      leavingTimer = setTimeout(() => {
        page.classList.remove('is-active', 'is-leaving');
        mandala?.classList.remove('is-overlay-active');
        document.getElementById('app')?.classList.remove('soundscapes-away');
        page.style.removeProperty('--sc-progress');
        document.getElementById('app')?.style.removeProperty('--sc-progress');
        leavingTimer = null;
      }, 430);
    }
  }
  function openControls(open) {
    drawer?.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle?.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }
  function closeControls() { openControls(false); }
  back?.addEventListener('click', () => showPage(false));
  toggle?.addEventListener('click', () => openControls(!drawer.classList.contains('is-open')));
  addButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(file);
    audio.src = currentObjectUrl;
    audio.load();
    title.textContent = file.name.replace(/\.[^.]+$/, '');
    subtitle.textContent = 'Local preview · add hosted MP3 links in a later pass';
    status.textContent = 'TRACK LOADED';
    audio.play().then(() => updatePlaying(true)).catch(() => {
      status.textContent = 'PRESS PLAY TO START';
      updatePlaying(false);
    });
  });
  function updatePlaying(isPlaying) {
    page.classList.toggle('is-playing', isPlaying);
    if (playIcon) playIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
    play?.setAttribute('aria-label', isPlaying ? 'Pause soundscape' : 'Play soundscape');
    if (isPlaying) status.textContent = 'NOW PLAYING';
    else if (audio.src) status.textContent = 'PAUSED';
  }
  play?.addEventListener('click', () => {
    if (!audio.src) {
      fileInput?.click();
      return;
    }
    if (audio.paused) audio.play().then(() => updatePlaying(true)).catch(() => {
      status.textContent = 'PLAYBACK UNAVAILABLE';
    });
    else { audio.pause(); updatePlaying(false); }
  });
  audio.addEventListener('play', () => updatePlaying(true));
  audio.addEventListener('pause', () => updatePlaying(false));
  audio.addEventListener('ended', () => {
    if (playback?.value === 'loop') {
      audio.currentTime = 0;
      audio.play().catch(() => updatePlaying(false));
    } else updatePlaying(false);
  });
  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });
  playback?.addEventListener('change', () => { audio.loop = playback.value === 'loop'; });
  audio.loop = true;
  audio.volume = 0.8;
  document.getElementById('soundscapesHelp')?.addEventListener('click', () => {
    alert('Add an MP3 to preview your first soundscape. Playback continues when you return to the handpan.');
  });

  /*
   * Edge-swipe navigation lives on window, not the pan canvas:
   * start in the right edge and swipe left to reveal Soundscapes.
   * The reverse gesture from the left edge returns to the handpan.
   * Ignore controls so sliders and knobs remain completely untouched.
   */
  let swipeStart = null;
  let swipeProgress = 0;
  function isInteractiveTarget(target) {
    return !!target?.closest?.('button, input, select, textarea, a, .mobile-control-drawer, .soundscape-control-drawer, .effect-bubble');
  }
  function setSwipeProgress(progress) {
    swipeProgress = Math.max(0, Math.min(1, progress));
    page.style.setProperty('--sc-progress', String(swipeProgress));
    document.getElementById('app')?.style.setProperty('--sc-progress', String(swipeProgress));
    if (mandala) mandala.style.opacity = String(swipeProgress);
  }
  function prepareSwipePage() {
    if (leavingTimer) { clearTimeout(leavingTimer); leavingTimer = null; }
    syncMandalaToPan();
    page.classList.add('is-interactive-swipe', 'is-active');
    mandala?.classList.add('is-overlay-active');
    page.classList.remove('is-leaving');
    page.setAttribute('aria-hidden', 'false');
    document.getElementById('app')?.classList.add('soundscapes-away');
  }
  function finishSwipe(open) {
    page.classList.remove('is-interactive-swipe');
    setSwipeProgress(open ? 1 : 0);
    document.getElementById('app')?.classList.remove('is-interactive-swipe');
    if (open) {
      page.setAttribute('aria-hidden', 'false');
      return;
    }
    closeControls();
    page.setAttribute('aria-hidden', 'true');
    if (leavingTimer) clearTimeout(leavingTimer);
    leavingTimer = setTimeout(() => {
      page.classList.remove('is-active', 'is-leaving');
      mandala?.classList.remove('is-overlay-active');
      document.getElementById('app')?.classList.remove('soundscapes-away');
      page.style.removeProperty('--sc-progress');
      swipeProgress = 0;
      leavingTimer = null;
    }, 430);
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isInteractiveTarget(e.target)) { swipeStart = null; return; }
    const onSoundscapes = page.classList.contains('is-active');
    const edgeWidth = Math.max(44, Math.min(92, window.innerWidth * 0.16));
    const fromRightEdge = e.clientX >= window.innerWidth - edgeWidth;
    const fromLeftEdge = e.clientX <= edgeWidth;
    if ((!onSoundscapes && fromRightEdge) || (onSoundscapes && fromLeftEdge)) {
      if (!onSoundscapes) { prepareSwipePage(); setSwipeProgress(0); }
      else {
        setSwipeProgress(1);
        document.getElementById('app')?.classList.add('is-interactive-swipe');
      }
      page.classList.add('is-interactive-swipe');
      swipeStart = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastTime: performance.now(), pointerId: e.pointerId, onSoundscapes, moved: false };
    } else swipeStart = null;
  }, { capture: true, passive: true });
  window.addEventListener('pointermove', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.pointerId) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      if (!swipeStart.onSoundscapes) finishSwipe(false);
      else setSwipeProgress(1);
      swipeStart = null;
      return;
    }
    if (Math.abs(dx) < 3) return;
    swipeStart.moved = true;
    const distance = Math.max(1, window.innerWidth * 0.88);
    setSwipeProgress(swipeStart.onSoundscapes ? 1 - Math.max(0, dx) / distance : Math.max(0, -dx) / distance);
    swipeStart.lastX = e.clientX;
    swipeStart.lastTime = performance.now();
  }, { capture: true, passive: true });
  window.addEventListener('pointerup', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.pointerId) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    const mostlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    const progress = swipeStart.onSoundscapes ? swipeProgress : swipeProgress;
    if (mostlyHorizontal && Math.abs(dx) >= 28) {
      finishSwipe(swipeStart.onSoundscapes ? progress > 0.72 : progress > 0.22);
    } else {
      finishSwipe(swipeStart.onSoundscapes);
    }
    swipeStart = null;
  }, { capture: true, passive: true });
  window.addEventListener('pointercancel', () => {
    if (swipeStart) finishSwipe(swipeStart.onSoundscapes);
    swipeStart = null;
  }, { capture: true, passive: true });
})();

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
      'Swipe right from the center of the pan to open Soundscapes.\n' +
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

function restoreEffectBubble(bubble) {
  if (!bubble || !bubble.dataset.originId) return;
  const trigger = document.querySelector('[aria-controls="' + bubble.id + '"]');
  const origin = trigger?.closest('.effect-knob-wrap');
  if (origin) origin.appendChild(bubble);
  delete bubble.dataset.originId;
  bubble.classList.remove('is-viewport-menu');
  bubble.style.left = '';
  bubble.style.top = '';
}
function closeEffectBubbles() {
  document.querySelectorAll('.effect-bubble').forEach((bubble) => {
    bubble.hidden = true;
    const trigger = document.querySelector('[aria-controls="' + bubble.id + '"]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    trigger?.closest('.effect-knob-wrap')?.classList.remove('effect-menu-open');
    restoreEffectBubble(bubble);
  });
}
function positionEffectBubble(bubble, trigger) {
  const gap = 7, margin = 8;
  const vv = window.visualViewport;
  const viewportLeft = vv ? vv.offsetLeft : 0;
  const viewportTop = vv ? vv.offsetTop : 0;
  const viewportWidth = vv ? vv.width : window.innerWidth;
  const viewportHeight = vv ? vv.height : window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const anchor = trigger.getBoundingClientRect();
  const isCompact = window.matchMedia('(max-width: 900px), (max-height: 500px) and (pointer: coarse)').matches;
  const width = Math.max(0, Math.min(viewportWidth - margin * 2, isCompact ? 220 : 208));
  bubble.style.width = width + 'px';
  bubble.style.maxWidth = Math.max(0, viewportWidth - margin * 2) + 'px';
  bubble.style.maxHeight = Math.max(100, Math.min(isCompact ? 180 : 176, viewportHeight - margin * 2)) + 'px';
  bubble.style.left = Math.round(viewportLeft + margin) + 'px';
  bubble.style.top = Math.round(viewportTop + margin) + 'px';
  const menu = bubble.getBoundingClientRect();
  let left = anchor.left + anchor.width / 2 - width / 2;
  left = Math.max(viewportLeft + margin, Math.min(left, viewportRight - width - margin));
  let top = anchor.bottom + gap;
  if (top + menu.height > viewportBottom - margin) top = anchor.top - menu.height - gap;
  top = Math.max(viewportTop + margin, Math.min(top, viewportBottom - menu.height - margin));
  bubble.style.left = Math.round(left) + 'px';
  bubble.style.top = Math.round(top) + 'px';
}
document.querySelectorAll('.knob-effect-trigger').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const bubble = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!bubble) return;
    const shouldOpen = bubble.hidden;
    closeEffectBubbles();
    if (!shouldOpen) return;
    const origin = trigger.closest('.effect-knob-wrap');
    bubble.dataset.originId = origin?.getAttribute('data-param') || bubble.id;
    bubble.classList.add('is-viewport-menu');
    document.body.appendChild(bubble);
    bubble.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    origin?.classList.add('effect-menu-open');
    requestAnimationFrame(() => positionEffectBubble(bubble, trigger));
  });
});
function repositionOpenEffectBubbles() {
  document.querySelectorAll('.effect-bubble.is-viewport-menu:not([hidden])').forEach((bubble) => {
    const trigger = document.querySelector('[aria-controls="' + bubble.id + '"]');
    if (trigger) positionEffectBubble(bubble, trigger);
  });
}
window.addEventListener('resize', repositionOpenEffectBubbles);
window.visualViewport?.addEventListener('resize', repositionOpenEffectBubbles);
window.visualViewport?.addEventListener('scroll', repositionOpenEffectBubbles);
document.addEventListener('click',(event)=>{if(!event.target.closest('.effect-knob-wrap')&&!event.target.closest('.effect-bubble'))closeEffectBubbles();});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeEffectBubbles();});

document.querySelectorAll('[data-delay]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-delay]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setDelayType) app.fxChain.setDelayType(btn.getAttribute('data-delay'));
    closeEffectBubbles();
  });
});
document.querySelectorAll('[data-reverb]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-reverb]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setReverbType) app.fxChain.setReverbType(btn.getAttribute('data-reverb'));
    closeEffectBubbles();
  });
});
document.querySelectorAll('[data-comp]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-comp]').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    ensureAudio();
    if (app.fxChain?.setCompressorType) app.fxChain.setCompressorType(btn.getAttribute('data-comp'));
    closeEffectBubbles();
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

async function boot() {
  injectCatchStatus();
  await setInstrument('handpan');
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
  try {
    const q = new URLSearchParams(window.location.search);
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
