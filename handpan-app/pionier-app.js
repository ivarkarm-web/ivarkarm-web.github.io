/**
 * pionier-app.js — integrated instrument surface
 * Pointer → Gesture → Active Instrument → Bus → FxChain → Master → Output
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js';
import { VOICE_PRESETS } from './js/voice-presets.js';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js';
import { KitchenInstrument } from './js/instruments/kitchen.js';
import { BirdInstrument } from './js/instruments/bird.js';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];

const handpan = new HandpanInstrument();
const kitchen = new KitchenInstrument();
const bird = new BirdInstrument();
InstrumentRegistry.register(handpan);
InstrumentRegistry.register(kitchen);
InstrumentRegistry.register(bird);

const app = {
  fxChain: null, instrumentBus: null, gestureTracker: new GestureTracker(),
  pointers: new Map(), catchMode: null, lastVelocity: 0.75,
  fps: 0, _fpsFrames: 0, _fpsLast: performance.now(), reducedMotion: false
};
try { app.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

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

async function setInstrument(id) {
  ensureAudio();
  const ctx = getAudioContext();
  const prev = InstrumentRegistry.active;
  if (prev) prev.dampAll();
  await InstrumentRegistry.setActive(id, ctx, app.instrumentBus);
  updateInstrumentUI(); layoutFields(); draw();
}

function activeInstrument() { return InstrumentRegistry.active || handpan; }

app.catchMode = new CatchMode({
  getInstrument: () => activeInstrument(),
  onStatus: (msg) => { const el = document.getElementById('catchStatus'); if (el) el.textContent = msg || ''; },
  onPhase: (phase) => {
    document.body.dataset.catchPhase = phase;
    const appEl = document.getElementById('app');
    if (!appEl) return;
    appEl.classList.toggle('catch-darken', ['darken','focus-knobs','focus-fx','focus-scale'].includes(phase));
    appEl.classList.toggle('catch-focus-knobs', phase === 'focus-knobs');
    appEl.classList.toggle('catch-focus-fx', phase === 'focus-fx');
    appEl.classList.toggle('catch-focus-scale', phase === 'focus-scale');
    appEl.classList.toggle('catch-active', ['ascending','descending','catch-intro'].includes(phase));
    if (['idle','complete','ready'].includes(phase)) {
      appEl.classList.remove('catch-darken','catch-focus-knobs','catch-focus-fx','catch-focus-scale');
    }
  }
});
app.catchMode.reducedMotion = app.reducedMotion;

function updateLabels() {
  const inst = activeInstrument();
  if (inst.id === 'handpan') {
    const scaleEl = document.getElementById('scaleLabel');
    const rootEl = document.getElementById('rootLabel');
    const octEl = document.getElementById('octLabel');
    const voiceEl = document.getElementById('voiceName');
    if (scaleEl) scaleEl.textContent = inst.scaleLabel;
    if (rootEl) rootEl.textContent = inst.rootLabel;
    if (octEl) { const o = inst.octaveOffset; octEl.textContent = o === 0 ? '0' : (o > 0 ? '+' + o : String(o)); }
    if (voiceEl) voiceEl.textContent = inst.voiceName;
  } else {
    const voiceEl = document.getElementById('voiceName');
    if (voiceEl) voiceEl.textContent = inst.name;
  }
}

function updateInstrumentUI() {
  updateLabels();
  document.querySelectorAll('[data-instrument]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-instrument') === activeInstrument().id);
  });
  const left = document.querySelector('.sidebar.left');
  if (left) left.style.visibility = activeInstrument().id === 'handpan' ? '' : 'hidden';
}

const canvas = document.getElementById('pan');
const ctx2 = canvas.getContext('2d');
let W = 800, H = 800, R = 0, CX = 0, CY = 0;
let fields = [];

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(rect.width * dpr));
  H = Math.max(1, Math.round(rect.height * dpr));
  canvas.width = W; canvas.height = H;
  CX = W / 2; CY = H / 2; R = Math.min(W, H) * 0.48;
  layoutFields(); draw();
}

function layoutFields() {
  const inst = activeInstrument();
  if (inst.id === 'handpan') layoutHandpanFields(inst);
  else if (inst.id === 'kitchen') layoutObjectFields(inst.objects || [], 0.38);
  else if (inst.id === 'bird') layoutObjectFields(inst.calls || [], 0.36);
  else fields = [];
  inst.setZones(fields);
}

function layoutHandpanFields(inst) {
  if (!inst.getNotes().length) inst.rebuildNotes?.();
  const list = inst.getNotes();
  const midis = list.map((n) => n.midi);
  const midiMin = Math.min(...midis), midiMax = Math.max(...midis);
  const midiSpan = Math.max(1, midiMax - midiMin);
  fields = list.map((n) => {
    const lowAmount = (midiMax - n.midi) / midiSpan;
    const size = 1 + lowAmount * 0.42;
    if (n.kind === 'ding') {
      const rr = R * 0.185 * size;
      return { i: n.index, index: n.index, x: CX, y: CY, rx: rr, ry: rr, rot: 0, label: n.name };
    }
    const a = (n.angle * Math.PI) / 180;
    const d = R * 0.58;
    const radial = R * 0.155 * size;
    const tangential = R * 0.112 * size;
    const ux = Math.sin(a), uy = -Math.cos(a);
    return { i: n.index, index: n.index, x: CX + ux * d, y: CY + uy * d, rx: radial, ry: tangential, rot: Math.atan2(uy, ux), ux, uy, label: n.name };
  });
}

function layoutObjectFields(items, radiusScale) {
  const n = items.length;
  const ringR = R * radiusScale;
  fields = items.map((obj, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = CX + Math.cos(a) * ringR, y = CY + Math.sin(a) * ringR;
    const rr = R * 0.14;
    return { i, index: i, x, y, rx: rr, ry: rr * 0.85, rot: 0, label: obj.name || obj.id, nx: 0.5 + Math.cos(a) * 0.5, ny: 0.5 + Math.sin(a) * 0.5 };
  });
}

function pathPad(f) { ctx2.beginPath(); ctx2.ellipse(f.x, f.y, f.rx, f.ry, f.rot || 0, 0, Math.PI * 2); }

function draw() {
  ctx2.clearRect(0, 0, W, H);
  const inst = activeInstrument();
  if (inst.id === 'handpan') drawHandpanBody(inst); else drawWorldBody(inst);
  if (app.catchMode?.isActive) drawCatchWaves();
}

function drawHandpanBody(inst) {
  const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
  g.addColorStop(0, '#2c2d32'); g.addColorStop(0.5, '#16171b'); g.addColorStop(1, '#0a0a0c');
  ctx2.fillStyle = g; ctx2.beginPath(); ctx2.arc(CX, CY, R, 0, Math.PI * 2); ctx2.fill();
  ctx2.strokeStyle = 'rgba(201,162,39,0.14)'; ctx2.lineWidth = Math.max(1.5, R * 0.01);
  ctx2.beginPath(); ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2); ctx2.stroke();
  const translucent = document.getElementById('app')?.classList.contains('catch-active');
  if (translucent) ctx2.globalAlpha = 0.72;
  fields.forEach((f, i) => {
    const glow = inst.glow?.[i] || 0; const radial = inst.zoneFlash?.[i] || 0;
    const isDing = inst.notes?.[i]?.kind === 'ding';
    const hlx = f.ux != null ? f.ux : -0.35, hly = f.uy != null ? f.uy : -0.45;
    const pad = ctx2.createRadialGradient(f.x + hlx * f.rx * 0.35, f.y + hly * f.ry * 0.35, 0, f.x, f.y, Math.max(f.rx, f.ry));
    pad.addColorStop(0, 'rgba(78,80,88,0.95)'); pad.addColorStop(0.55, 'rgba(40,42,48,0.95)'); pad.addColorStop(1, 'rgba(22,23,27,0.98)');
    ctx2.fillStyle = pad; pathPad(f); ctx2.fill();
    ctx2.strokeStyle = glow > 0.04 ? `rgba(201,162,39,${0.3 + glow * 0.55})` : 'rgba(255,255,255,0.12)';
    ctx2.lineWidth = isDing ? 2.2 : 1.5; pathPad(f); ctx2.stroke();
    if (glow > 0.02) {
      ctx2.save(); ctx2.globalCompositeOperation = 'lighter';
      const gr = Math.max(f.rx, f.ry) * (0.95 + radial * 0.4);
      const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, gr);
      hg.addColorStop(0, `rgba(201,162,39,${glow * (0.25 + (1 - radial) * 0.2)})`);
      hg.addColorStop(0.55, `rgba(228,195,90,${glow * radial * 0.22})`);
      hg.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = hg; pathPad({ x: f.x, y: f.y, rx: f.rx * 1.12, ry: f.ry * 1.12, rot: f.rot }); ctx2.fill(); ctx2.restore();
    }
  });
  ctx2.globalAlpha = 1;
}

function drawWorldBody(inst) {
  const g = ctx2.createRadialGradient(CX, CY, R * 0.1, CX, CY, R);
  g.addColorStop(0, 'rgba(28,30,36,0.9)'); g.addColorStop(1, 'rgba(10,10,12,0.4)');
  ctx2.fillStyle = g; ctx2.beginPath(); ctx2.arc(CX, CY, R * 0.92, 0, Math.PI * 2); ctx2.fill();
  fields.forEach((f) => {
    const pad = ctx2.createRadialGradient(f.x - f.rx * 0.3, f.y - f.ry * 0.3, 0, f.x, f.y, Math.max(f.rx, f.ry));
    if (inst.id === 'kitchen') {
      pad.addColorStop(0, 'rgba(90,88,82,0.95)'); pad.addColorStop(0.6, 'rgba(48,46,42,0.95)'); pad.addColorStop(1, 'rgba(24,22,20,0.98)');
    } else {
      pad.addColorStop(0, 'rgba(70,85,95,0.95)'); pad.addColorStop(0.6, 'rgba(35,45,52,0.95)'); pad.addColorStop(1, 'rgba(18,22,26,0.98)');
    }
    ctx2.fillStyle = pad; pathPad(f); ctx2.fill();
    ctx2.strokeStyle = 'rgba(201,162,39,0.22)'; ctx2.lineWidth = 1.4; pathPad(f); ctx2.stroke();
    ctx2.fillStyle = 'rgba(232,228,216,0.75)';
    ctx2.font = `${Math.max(11, R * 0.035)}px Inter, system-ui, sans-serif`;
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    ctx2.fillText(f.label || '', f.x, f.y);
  });
}

function drawCatchWaves() {
  for (const w of app.catchMode.getActiveWaves()) {
    const target = fields[w.targetIndex]; if (!target) continue;
    const p = Math.min(1.15, w.progress);
    const x = CX + (target.x - CX) * p, y = CY + (target.y - CY) * p;
    const rr = R * 0.08 + p * Math.max(target.rx, target.ry) * 1.1;
    const alpha = Math.max(0, 0.55 * (1 - Math.abs(p - 0.92) * 2.5));
    ctx2.save(); ctx2.globalCompositeOperation = 'lighter';
    const ring = ctx2.createRadialGradient(x, y, rr * 0.2, x, y, rr);
    ring.addColorStop(0, `rgba(255,220,120,${alpha * 0.5})`);
    ring.addColorStop(0.55, `rgba(201,162,39,${alpha * 0.35})`);
    ring.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = ring; ctx2.beginPath(); ctx2.arc(x, y, rr, 0, Math.PI * 2); ctx2.fill();
    ctx2.strokeStyle = `rgba(255,230,150,${alpha * 0.8})`; ctx2.lineWidth = Math.max(1.5, R * 0.008);
    ctx2.beginPath(); ctx2.arc(x, y, rr * 0.85, 0, Math.PI * 2); ctx2.stroke(); ctx2.restore();
  }
}

function hitVector(cx, cy) {
  let best = null, bestD = Infinity;
  for (const f of fields) {
    const dx = cx - f.x, dy = cy - f.y; const rot = f.rot || 0;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
    const d = Math.hypot(lx / f.rx, ly / f.ry);
    if (d <= 1.28 && d < bestD) {
      bestD = d;
      best = { idx: f.index, index: f.index, radial: d, angleRad: Math.atan2(dy, dx), nx: f.nx ?? (0.5 + (f.x - CX) / (R * 2)), ny: f.ny ?? (0.5 + (f.y - CY) / (R * 2)), x: cx, y: cy };
    }
  }
  return best;
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect(); const dpr = W / rect.width;
  return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
}

;['touchstart','touchmove','touchend'].forEach((type) => {
  canvas.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); ensureAudio(); canvas.setPointerCapture(e.pointerId);
  const { x, y } = canvasCoords(e); const hit = hitVector(x, y); if (!hit) return;
  const inst = activeInstrument();
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture); app.pointers.set(e.pointerId, hit.index);
  app.lastVelocity = gesture.velocity; inst.noteOn(gesture, hit);
  if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index); draw();
});
canvas.addEventListener('pointerup', (e) => {
  const idx = app.pointers.get(e.pointerId); app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId); if (idx != null) activeInstrument().noteOff(idx);
});
canvas.addEventListener('pointercancel', (e) => {
  const idx = app.pointers.get(e.pointerId); app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId); if (idx != null) activeInstrument().noteOff(idx);
});

const keyMap = Object.fromEntries(KEYS.map((k, i) => [k, i]));
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const idx = keyMap[e.key.toLowerCase()];
  if (idx == null || activeInstrument().id !== 'handpan') return;
  e.preventDefault(); ensureAudio();
  const gesture = gestureFromPointer({ pointerId: -1, pressure: 0.8, force: 0, type: 'keydown', clientX: 0, clientY: 0 }, { idx, index: idx, radial: 0.35, angleRad: 0 }, 1, handpan.lastStrikeAt);
  handpan.noteOn(gesture, { index: idx, radial: 0.35, angleRad: 0 });
  if (app.catchMode?.isActive) app.catchMode.onStrike(idx); draw();
});
window.addEventListener('keyup', (e) => {
  const idx = keyMap[e.key.toLowerCase()];
  if (idx != null && activeInstrument().id === 'handpan') handpan.noteOff(idx);
});

function wire(id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
wire('scalePrev', () => { if (activeInstrument().id !== 'handpan') return; handpan.setScaleIndex(handpan.scaleIndex - 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('scaleNext', () => { if (activeInstrument().id !== 'handpan') return; handpan.setScaleIndex(handpan.scaleIndex + 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('rootDown', () => { if (activeInstrument().id !== 'handpan') return; handpan.setRootIndex(handpan.rootIndex - 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('rootUp', () => { if (activeInstrument().id !== 'handpan') return; handpan.setRootIndex(handpan.rootIndex + 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('octDown', () => { if (activeInstrument().id !== 'handpan') return; handpan.setOctaveOffset(handpan.octaveOffset - 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('octUp', () => { if (activeInstrument().id !== 'handpan') return; handpan.setOctaveOffset(handpan.octaveOffset + 1); layoutFields(); updateLabels(); draw(); if (app.catchMode?.phase === 'focus-scale') app.catchMode.advanceFromUI(); });
wire('voicePrev', () => { if (activeInstrument().id === 'handpan') { handpan.setVoiceIndex(handpan.voiceIndex - 1); updateLabels(); } else cycleInstrument(-1); });
wire('voiceNext', () => { if (activeInstrument().id === 'handpan') { handpan.setVoiceIndex(handpan.voiceIndex + 1); updateLabels(); } else cycleInstrument(1); });
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => { alert('Play: tap fields or Q–O (handpan). Switch instruments via selector. Knobs: Comp / Ambiance / Room. Catch: ?catch=1 or debug panel.'); });

function cycleInstrument(dir) {
  const ids = InstrumentRegistry.list().map((x) => x.id);
  const cur = ids.indexOf(activeInstrument().id);
  setInstrument(ids[(cur + dir + ids.length) % ids.length]);
}

function setupKnob(id, fxId, initial) {
  const el = document.getElementById(id); if (!el) return;
  const cnv = el.querySelector('.knob-canvas');
  const valMap = { compress: 'valCompress', delay: 'valDelay', reverb: 'valReverb' };
  const valEl = document.getElementById(valMap[fxId]);
  const chainId = fxId === 'compress' ? 'compressor' : fxId;
  let value = initial, dragging = false, lastY = 0;
  function paint() {
    if (!cnv) return; const c = cnv.getContext('2d'); const s = cnv.width;
    c.clearRect(0, 0, s, s); const cx = s / 2, cy = s / 2, r = s * 0.38;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 6; c.stroke();
    c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * value);
    c.strokeStyle = '#c9a227'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
  }
  function setVal(v) {
    value = Math.max(0, Math.min(1, v));
    if (valEl) valEl.textContent = Math.round(value * 100);
    el.setAttribute('aria-valuenow', Math.round(value * 100));
    paint(); ensureAudio();
    if (app.fxChain) app.fxChain.setValue(chainId, value);
    if (app.catchMode?.phase === 'focus-knobs' && Math.abs(value - initial) > 0.08) app.catchMode.advanceFromUI();
  }
  setVal(initial);
  el.addEventListener('pointerdown', (e) => { dragging = true; lastY = e.clientY; el.setPointerCapture(e.pointerId); el.classList.add('is-active'); });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; const dy = lastY - e.clientY; lastY = e.clientY; setVal(value + dy * 0.005); });
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
    const hide = () => { if (!panel.classList.contains('is-open')) { panel.hidden = true; backdrop.hidden = true; } };
    panel.addEventListener('transitionend', hide, { once: true }); setTimeout(hide, 360);
  }
}
document.getElementById('btnFxSettings')?.addEventListener('click', () => {
  const btn = document.getElementById('btnFxSettings');
  setFxPanelOpen(!btn?.classList.contains('is-open'));
});
document.getElementById('fxPanelClose')?.addEventListener('click', () => setFxPanelOpen(false));
document.getElementById('fxBackdrop')?.addEventListener('click', () => setFxPanelOpen(false));

function injectInstrumentSelector() {
  if (document.getElementById('instrumentSelector')) return;
  const nav = document.querySelector('.instrument-nav');
  if (!nav || !nav.parentNode) return;
  const wrap = document.createElement('div');
  wrap.id = 'instrumentSelector';
  wrap.style.cssText = 'display:flex;gap:6px;align-items:center;margin-left:12px;flex-wrap:wrap';
  for (const inst of InstrumentRegistry.list()) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.setAttribute('data-instrument', inst.id); btn.textContent = inst.name;
    btn.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid rgba(201,162,39,0.25);background:transparent;color:inherit;cursor:pointer';
    btn.addEventListener('click', () => setInstrument(inst.id));
    wrap.appendChild(btn);
  }
  nav.parentNode.insertBefore(wrap, nav.nextSibling);
}

function injectCatchStatus() {
  if (document.getElementById('catchStatus')) return;
  const el = document.createElement('div');
  el.id = 'catchStatus'; el.setAttribute('aria-live', 'polite');
  el.style.cssText = 'position:fixed;top:12%;left:50%;transform:translateX(-50%);z-index:50;color:#c9a227;font:600 18px/1.2 Inter,system-ui,sans-serif;letter-spacing:0.12em;pointer-events:none;text-shadow:0 2px 12px rgba(0,0,0,0.6)';
  document.body.appendChild(el);
}

function tick(now) {
  app._fpsFrames++;
  if (now - app._fpsLast >= 1000) { app.fps = app._fpsFrames; app._fpsFrames = 0; app._fpsLast = now; }
  const inst = activeInstrument();
  let dirty = false;
  if (inst.id === 'handpan' && inst.tickGlow?.()) dirty = true;
  if (app.catchMode?.isActive) { app.catchMode.tick(now); dirty = true; }
  if (dirty) draw();
  requestAnimationFrame(tick);
}

async function boot() {
  injectInstrumentSelector(); injectCatchStatus();
  await setInstrument('handpan'); resize(); requestAnimationFrame(tick);
  try { const q = new URLSearchParams(window.location.search); if (q.get('catch') === '1') app.catchMode.startOnboarding(); } catch (_) {}
  if (isDebugEnabled()) {
    mountDebugPanel({
      setInstrument: (id) => setInstrument(id),
      startCatch: () => {
        if (activeInstrument().id !== 'handpan') setInstrument('handpan').then(() => app.catchMode.startCatchSequence());
        else app.catchMode.startCatchSequence();
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
        tier: (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 'low' : 'high',
        catchPhase: app.catchMode?.phase
      })
    });
  }
}

function unlock() { ensureAudio(); window.removeEventListener('pointerdown', unlock); }
window.addEventListener('pointerdown', unlock);
boot();
