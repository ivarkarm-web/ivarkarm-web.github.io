/**
 * pionier-app.js — restored working instrument surface (backup-compatible)
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
import { createSurface } from './js/pionier-surface.js?v=27';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

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
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture);
  app.pointers.set(e.pointerId, hit.index);
  app.lastVelocity = gesture.velocity;
  inst.noteOn(gesture, hit);
  if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
  draw();
});
canvas?.addEventListener('pointerup', (e) => {
  const idx = app.pointers.get(e.pointerId);
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  if (idx != null) activeInstrument().noteOff(idx);
});
canvas?.addEventListener('lostpointercapture', (e) => {
  const idx = app.pointers.get(e.pointerId);
  if (idx == null) return;
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  activeInstrument().noteOff(idx);
});
canvas?.addEventListener('pointercancel', (e) => {
  const idx = app.pointers.get(e.pointerId);
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  if (idx != null) activeInstrument().noteOff(idx);
});

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

(function setupSoundscapes() {
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
  if (!page || !audio) return;

  let trackObjectUrls = [];

  function showPage(show) {
    if (show) {
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      document.body.classList.add('soundscapes-active');
      document.getElementById('app')?.classList.add('soundscapes-away');
    } else {
      page.classList.remove('is-active');
      page.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('soundscapes-active');
      document.getElementById('app')?.classList.remove('soundscapes-away');
    }
  }
  back?.addEventListener('click', () => showPage(false));

  function updatePlaying(isPlaying) {
    page.classList.toggle('is-playing', isPlaying);
    if (playIcon) playIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
  }
  play?.addEventListener('click', () => {
    if (!audio.src) { fileInput?.click(); return; }
    if (audio.paused) audio.play().then(() => updatePlaying(true)).catch(() => {});
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
  addButton?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(f.name));
    if (!files.length) return;
    trackObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    trackObjectUrls = [];
    const trackList = files.map((file) => {
      const url = URL.createObjectURL(file);
      trackObjectUrls.push(url);
      return { name: file.name.replace(/\.[^.]+$/, ''), url };
    });
    const track = trackList[0];
    audio.src = track.url;
    audio.load();
    if (title) title.textContent = track.name;
    if (subtitle) subtitle.textContent = 'TRACK 1 / ' + trackList.length;
    if (status) status.textContent = 'TRACK LOADED';
    audio.play().then(() => updatePlaying(true)).catch(() => {
      if (status) status.textContent = 'PRESS PLAY TO START';
      updatePlaying(false);
    });
    fileInput.value = '';
  });

  let swipeStart = null;
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('button, input, select, textarea, a, .mobile-control-drawer, .soundscape-control-drawer, .knob')) return;
    if (e.clientX > window.innerWidth - 48) {
      swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (!swipeStart || e.pointerId !== swipeStart.id) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (dx < -36 && Math.abs(dx) > Math.abs(dy) * 1.2 && !page.classList.contains('is-active')) {
      showPage(true);
    }
  });
})();

function wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  alert('Play: tap tonefields or Q–O.\nControls: Comp, Ambiance, Room, Filter (⚙ for types), Bass, Low, Mid, Master.\nSwipe from the right edge for Soundscapes.');
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
  const i = KEYS.indexOf(e.key.toLowerCase());
  if (i >= 0) {
    e.preventDefault();
    ensureAudio();
    const inst = activeInstrument();
    const hit = { index: i, radial: 0.5, angleRad: 0 };
    inst.noteOn({ velocity: 0.75, pointerId: -1 - i }, hit);
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
  try { await setInstrument('handpan'); } catch (err) { console.error(err); }
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  if (isDebugEnabled?.()) mountDebugPanel?.({ setInstrument });
}
boot();
