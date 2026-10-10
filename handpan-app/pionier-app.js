/**
 * pionier-app.js — integrated instrument surface
 * Pointer → Gesture → Active Instrument → Bus → FxEngine → Master → Output
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js';
import { createTonalInstruments } from './js/instruments/tonal-family.js?v=4';
import { FxEngine } from './js/fx-engine.js';
import { setupControlsUI } from './js/controls-ui.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface, WORLD_ZONE_INDICES } from './js/pionier-surface.js?v=26';
import { createMandalaRenderer } from './js/mandala-canvas.js';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const handpan = new HandpanInstrument();
InstrumentRegistry.register(handpan);
for (const instrument of createTonalInstruments()) InstrumentRegistry.register(instrument);

const app = {
  fxEngine: null,
  controlsReady: false,
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
    app.fxEngine = new FxEngine(ctx, getAudioMaster());
    app.instrumentBus.connect(app.fxEngine.input);
    if (!app.controlsReady) {
      setupControlsUI(app.fxEngine);
      app.controlsReady = true;
    }
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
    if (instrument && typeof instrument.setMusicalContext === 'function') instrument.setMusicalContext(notes);
  }
}

function isFieldPlayable(fieldIndex) {
  return fieldIndex >= 0 && fieldIndex <= 8;
}

async function setInstrument(id) {
  ensureAudio();
  const ctx = getAudioContext();
  const prev = InstrumentRegistry.active;
  if (prev) prev.dampAll();
  syncWorldPitch();
  await InstrumentRegistry.setActive(id, ctx, app.instrumentBus);
  syncWorldPitch();
  updateInstrumentUI();
  layoutFields();
  draw();
}

app.catchMode = new CatchMode({
  getInstrument: () => activeInstrument(),
  onStatus: (msg) => {
    const el = document.getElementById('catchStatus');
    if (!el) return;
    el.textContent = msg || '';
  },
  onPhase: (phase) => {
    document.body.dataset.catchPhase = phase;
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
  const voiceEl = document.getElementById('instrumentDropdownToggle');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = inst.name + ' ▾';
}

function updateInstrumentUI() {
  updateLabels();
  renderInstrumentMenu();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes?.();
  surface.layoutHandpanFields(handpan.getNotes(), isFieldPlayable);
  for (const f of surface.fields) f.zoneLabel = null;
  handpan.setZones?.(surface.fields);
}

function draw() {
  surface.drawBody(activeInstrument(), false, null);
}

function resize() {
  surface.resize();
  layoutFields();
  draw();
}

;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

/* Soundscapes — persistent audio, progress UI, Mandala canvas */
(function setupSoundscapesPage() {
  const page = document.getElementById('soundscapesPage');
  const back = document.getElementById('backToHandpan');
  const audio = document.getElementById('soundscapeAudio');
  const play = document.getElementById('mandalaPlay');
  const playIcon = document.getElementById('mandalaPlayIcon');
  const previousTrackButton = document.getElementById('mandalaPreviousTrack');
  const nextTrackButton = document.getElementById('mandalaNextTrack');
  const fileInput = document.getElementById('soundscapeFile');
  const addButton = document.getElementById('addSoundscapeTrack');
  const title = document.getElementById('soundscapeTrackTitle');
  const subtitle = document.getElementById('soundscapeTrackSubtitle');
  const status = document.getElementById('soundscapeStatus');
  const volume = document.getElementById('soundscapeVolume');
  const progressEl = document.getElementById('soundscapeProgress');
  const timeElapsed = document.getElementById('soundscapeTimeElapsed');
  const timeTotal = document.getElementById('soundscapeTimeTotal');
  const playback = document.getElementById('soundscapePlayback');
  const drawer = document.getElementById('soundscapeControlDrawer');
  const toggle = document.getElementById('soundscapeControlsToggle');
  if (!page || !audio) return;
  if (drawer && drawer.parentNode !== document.body) document.body.appendChild(drawer);
  let trackList = [];
  let currentTrackIndex = -1;
  let trackObjectUrls = [];
  let leavingTimer = null;
  let seeking = false;
  const pan = document.getElementById('pan');
  const mandala = document.getElementById('mandalaWrap');
  if (mandala && mandala.parentNode !== document.body) document.body.appendChild(mandala);

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }
  function syncProgress() {
    if (!audio || seeking) return;
    const dur = audio.duration;
    const cur = audio.currentTime;
    if (timeElapsed) timeElapsed.textContent = fmtTime(cur);
    if (timeTotal) timeTotal.textContent = fmtTime(isFinite(dur) ? dur : 0);
    if (progressEl && isFinite(dur) && dur > 0) progressEl.value = String(Math.round((cur / dur) * 1000));
  }
  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('durationchange', syncProgress);
  progressEl?.addEventListener('pointerdown', () => { seeking = true; });
  progressEl?.addEventListener('pointerup', () => {
    if (!audio || !isFinite(audio.duration)) { seeking = false; return; }
    audio.currentTime = (Number(progressEl.value) / 1000) * audio.duration;
    seeking = false;
    syncProgress();
  });
  progressEl?.addEventListener('input', () => {
    if (!seeking || !audio || !isFinite(audio.duration)) return;
    if (timeElapsed) timeElapsed.textContent = fmtTime((Number(progressEl.value) / 1000) * audio.duration);
  });

  let mandalaRenderer = null;
  if (mandala) mandalaRenderer = createMandalaRenderer(mandala);

  function syncMandalaToPan() {
    if (!pan || !mandala) return;
    const rect = pan.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mandala.style.setProperty('position', 'fixed', 'important');
    mandala.style.setProperty('left', rect.left + 'px', 'important');
    mandala.style.setProperty('top', rect.top + 'px', 'important');
    mandala.style.setProperty('width', rect.width + 'px', 'important');
    mandala.style.setProperty('height', rect.height + 'px', 'important');
    mandala.style.setProperty('z-index', '1501', 'important');
  }
  window.addEventListener('resize', syncMandalaToPan, { passive: true });

  function showPage(show) {
    if (show) syncMandalaToPan();
    if (leavingTimer) { clearTimeout(leavingTimer); leavingTimer = null; }
    page.style.setProperty('--sc-progress', show ? '1' : '0');
    document.getElementById('app')?.style.setProperty('--sc-progress', show ? '1' : '0');
    if (mandala) mandala.style.opacity = show ? '1' : '0';
    if (show) {
      page.classList.add('is-active');
      document.body.classList.add('soundscapes-active');
      mandalaRenderer?.start();
      mandala?.classList.add('is-overlay-active');
      page.setAttribute('aria-hidden', 'false');
      document.getElementById('app')?.classList.add('soundscapes-away');
    } else {
      closeControls();
      if (!page.classList.contains('is-active')) return;
      page.setAttribute('aria-hidden', 'true');
      leavingTimer = setTimeout(() => {
        page.classList.remove('is-active');
        document.body.classList.remove('soundscapes-active');
        mandalaRenderer?.stop();
        mandala?.classList.remove('is-overlay-active');
        document.getElementById('app')?.classList.remove('soundscapes-away');
        leavingTimer = null;
      }, 430);
    }
  }
  function openControls(open) {
    if (!drawer || !toggle) return;
    drawer.classList.toggle('is-open', !!open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }
  function closeControls() { openControls(false); }
  back?.addEventListener('click', () => showPage(false));
  toggle?.addEventListener('click', () => openControls(!drawer.classList.contains('is-open')));
  addButton?.addEventListener('click', () => fileInput?.click());

  function playTrackAt(index, autoplay = true) {
    if (!trackList.length) { fileInput?.click(); return; }
    currentTrackIndex = (index + trackList.length) % trackList.length;
    const track = trackList[currentTrackIndex];
    audio.pause(); audio.src = track.url; audio.load();
    title.textContent = track.name;
    subtitle.textContent = trackList.length > 1 ? 'TRACK ' + (currentTrackIndex + 1) + ' / ' + trackList.length : 'ONE TRACK LOADED';
    status.textContent = 'TRACK LOADED';
    if (autoplay) audio.play().then(() => updatePlaying(true)).catch(() => { status.textContent = 'PRESS PLAY TO START'; updatePlaying(false); });
    else updatePlaying(false);
  }
  function stepTrack(direction) {
    if (!trackList.length) { fileInput?.click(); return; }
    if (trackList.length === 1) { playTrackAt(0, true); return; }
    playTrackAt(currentTrackIndex + direction, true);
  }
  previousTrackButton?.addEventListener('click', () => stepTrack(-1));
  nextTrackButton?.addEventListener('click', () => stepTrack(1));
  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(f.name));
    if (!files.length) return;
    audio.pause();
    trackObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    trackObjectUrls = [];
    trackList = files.map((file) => {
      const url = URL.createObjectURL(file);
      trackObjectUrls.push(url);
      return { name: file.name.replace(/\.[^.]+$/, ''), url };
    });
    currentTrackIndex = -1;
    playTrackAt(0, true);
    fileInput.value = '';
  });
  function updatePlaying(isPlaying) {
    page.classList.toggle('is-playing', isPlaying);
    if (playIcon) playIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
    play?.setAttribute('aria-label', isPlaying ? 'Pause soundscape' : 'Play soundscape');
    if (isPlaying) status.textContent = 'NOW PLAYING';
    else if (audio.src) status.textContent = 'PAUSED';
  }
  play?.addEventListener('click', () => {
    if (!audio.src) { fileInput?.click(); return; }
    if (audio.paused) audio.play().then(() => updatePlaying(true)).catch(() => { status.textContent = 'PLAYBACK UNAVAILABLE'; });
    else { audio.pause(); updatePlaying(false); }
  });
  audio.addEventListener('play', () => updatePlaying(true));
  audio.addEventListener('pause', () => updatePlaying(false));
  audio.addEventListener('ended', () => {
    if (playback?.value === 'loop') {
      audio.currentTime = 0;
      audio.play().catch(() => updatePlaying(false));
    } else if (trackList.length > 1 && currentTrackIndex < trackList.length - 1) {
      playTrackAt(currentTrackIndex + 1, true);
    } else updatePlaying(false);
  });
  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });
  playback?.addEventListener('change', () => { audio.loop = playback.value === 'loop'; });
  audio.loop = true;
  audio.volume = 0.8;

  let swipeStart = null;
  function isInteractiveTarget(target) {
    return !!target?.closest?.('button, input, select, textarea, a, .mobile-control-drawer, .soundscape-control-drawer');
  }
  window.addEventListener('pointerdown', (e) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const edge = 28;
    if (e.clientX > window.innerWidth - edge || e.clientX < edge) {
      swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.id) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && !page.classList.contains('is-active')) showPage(true);
      else if (dx > 0 && page.classList.contains('is-active')) showPage(false);
    }
  });
})();

function wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  alert('Play: tap tonefields or Q–O.\nScale / Base / Octave shape pitch.\nSwipe from the right edge to open Soundscapes.\nPlayback continues when you return.');
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
wire('octDown', () => { handpan.setOctaveOffset(Math.max(-1, handpan.octaveOffset - 1)); refreshPitch(); });
wire('octUp', () => { handpan.setOctaveOffset(Math.min(1, handpan.octaveOffset + 1)); refreshPitch(); });

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
document.getElementById('instrumentDropdownToggle')?.addEventListener('click', () => {
  const menu = document.getElementById('instrumentMenu');
  if (!menu) return;
  menu.hidden = !menu.hidden;
  document.getElementById('instrumentDropdownToggle')?.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
});

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const i = KEYS.indexOf(e.key.toLowerCase());
  if (i >= 0) {
    e.preventDefault();
    ensureAudio();
    const inst = activeInstrument();
    const hit = { index: i, radial: 0.5, angleRad: 0 };
    const gesture = { velocity: 0.75, pointerId: -1 - i };
    inst.noteOn(gesture, hit);
    setTimeout(() => inst.noteOff(i), 180);
    draw();
  }
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
  await setInstrument('handpan');
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
  if (isDebugEnabled?.()) mountDebugPanel?.(app);
}
boot();
