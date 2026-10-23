/**
 * pionier-core — loads the last known-good vendored core, then installs FX knob drag.
 * Source: commit 832690dc (+ local setFxTone / wireKnobs patch applied after boot).
 */
import * as Base from 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@832690dc/handpan-app/pionier-core.js';

const core = (Base && Base.default) ? Base.default : Base;
window.PionierCore = core;

const KNOB_MAP = [
  { knobId: 'knobCompress', valId: 'valCompress', fxId: 'compressor', def: 0.4, size: 68 },
  { knobId: 'knobDelay', valId: 'valDelay', fxId: 'delay', def: 0.15, size: 68 },
  { knobId: 'knobReverb', valId: 'valReverb', fxId: 'reverb', def: 0.25, size: 68 },
  { knobId: 'knobFilter', valId: 'valFilter', fxId: 'filter', def: 0.12, size: 68 },
  { knobId: 'knobBass', valId: 'valBass', tone: 'bass', def: 0.5, size: 72 },
  { knobId: 'knobLow', valId: 'valLow', tone: 'low', def: 0.5, size: 72 },
  { knobId: 'knobMid', valId: 'valMid', tone: 'mid', def: 0.5, size: 72 },
  { knobId: 'knobMaster', valId: 'valMaster', tone: 'master', def: 0.82, size: 72 }
];

const values = Object.create(null);
KNOB_MAP.forEach((m) => { values[m.tone || m.fxId] = m.def; });

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

function apply(m, v01) {
  const v = Math.max(0, Math.min(1, v01));
  const key = m.tone || m.fxId;
  values[key] = v;
  try {
    core.ensureAudio?.();
    if (typeof core.setFxTone === 'function' && m.tone) {
      core.setFxTone(m.tone, v);
    } else if (m.fxId && typeof core.getFxModule === 'function') {
      const mod = core.getFxModule(m.fxId);
      const ctx = core.getAudioContext?.();
      if (mod?.setValue) {
        try { mod.setValue(v, ctx); } catch (_) { try { mod.setValue(v); } catch (__) {} }
      }
    } else if (m.tone && typeof core.setFxTone === 'function') {
      core.setFxTone(m.tone, v);
    }
  } catch (_) {}
  return v;
}

function paintAll() {
  for (const m of KNOB_MAP) {
    const el = document.getElementById(m.knobId);
    if (!el) continue;
    const canvas = el.querySelector('.knob-canvas');
    const v = values[m.tone || m.fxId];
    paintKnob(canvas, v, m.size);
    const valEl = document.getElementById(m.valId);
    if (valEl) valEl.textContent = Math.round(v * 100) + '%';
  }
}

function wireAll() {
  for (const m of KNOB_MAP) {
    const el = document.getElementById(m.knobId);
    if (!el || el.dataset.coreKnobWired === '1') continue;
    el.dataset.coreKnobWired = '1';
    el.style.touchAction = 'none';
    el.style.cursor = 'ns-resize';
    const canvas = el.querySelector('.knob-canvas') || el;
    canvas.style.touchAction = 'none';
    let dragging = false, startY = 0, startVal = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { core.ensureAudio?.(); } catch (_) {}
      dragging = true; startY = e.clientY; startVal = values[m.tone || m.fxId];
      try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const next = apply(m, startVal + (startY - e.clientY) / 120);
      paintKnob(canvas, next, m.size);
      const valEl = document.getElementById(m.valId);
      if (valEl) valEl.textContent = Math.round(next * 100) + '%';
    });
    const up = () => { dragging = false; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  paintAll();
}

if (core && typeof core.setFxTone !== 'function') {
  core.setFxTone = function (key, v) {
    const m = KNOB_MAP.find((k) => k.tone === key || k.fxId === key);
    if (m) apply(m, v);
  };
}

const origPaint = core.paintFxKnobs;
core.paintFxKnobs = function () {
  try { if (typeof origPaint === 'function') origPaint.apply(this, arguments); } catch (_) {}
  try { core.ensureAudio?.(); } catch (_) {}
  wireAll();
};

wireAll();
document.addEventListener('click', (e) => {
  if (e.target?.closest?.('#fxPanelOpen, button.fx-panel-open, #fxPanel, .fx-panel')) {
    setTimeout(wireAll, 40);
    setTimeout(wireAll, 200);
  }
}, true);
setInterval(wireAll, 2500);

export default core;
