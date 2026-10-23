/**
 * fx-knobs-wire.js — make FX panel knobs draggable (vertical drag).
 */
(function () {
  if (window.__pionierFxKnobsWireV2) return;
  window.__pionierFxKnobsWireV2 = true;

  const MAP = [
    { knobId: 'knobCompress', valId: 'valCompress', fxId: 'compressor', def: 0.4, size: 68 },
    { knobId: 'knobDelay', valId: 'valDelay', fxId: 'delay', def: 0.15, size: 68 },
    { knobId: 'knobReverb', valId: 'valReverb', fxId: 'reverb', def: 0.25, size: 68 },
    { knobId: 'knobFilter', valId: 'valFilter', fxId: 'filter', def: 0.12, size: 68 },
    { knobId: 'knobBass', valId: 'valBass', tone: 'bass', def: 0.5, size: 72 },
    { knobId: 'knobLow', valId: 'valLow', tone: 'low', def: 0.5, size: 72 },
    { knobId: 'knobMid', valId: 'valMid', tone: 'mid', def: 0.5, size: 72 },
    { knobId: 'knobMaster', valId: 'valMaster', tone: 'master', def: 0.82, size: 72 }
  ];

  const store = Object.create(null);
  MAP.forEach(function (m) { store[m.tone || m.fxId] = m.def; });

  function paintKnob(canvasEl, value01, size) {
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

  function applyAudio(m, v) {
    const core = window.PionierCore;
    if (!core) return;
    try { core.ensureAudio?.(); } catch (_) {}
    const ctx = core.getAudioContext?.();
    // Effect modules
    if (m.fxId && typeof core.getFxModule === 'function') {
      const mod = core.getFxModule(m.fxId);
      if (mod && typeof mod.setValue === 'function') {
        try { mod.setValue(v, ctx); } catch (_) { try { mod.setValue(v); } catch (__) {} }
      }
    }
    // Tone / master via public paintFxKnobs side-channel if core exposes setters later
    if (typeof core.setFxTone === 'function') {
      try { core.setFxTone(m.tone || m.fxId, v); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('pionier:fx-knob', { detail: { tone: m.tone, fxId: m.fxId, value: v } }));
  }

  function apply(m, v01) {
    const v = Math.max(0, Math.min(1, v01));
    store[m.tone || m.fxId] = v;
    applyAudio(m, v);
    return v;
  }

  function paintAll() {
    MAP.forEach(function (m) {
      const el = document.getElementById(m.knobId);
      if (!el) return;
      const canvas = el.querySelector('.knob-canvas');
      const v = store[m.tone || m.fxId];
      paintKnob(canvas, v, m.size);
      const valEl = document.getElementById(m.valId);
      if (valEl) valEl.textContent = Math.round(v * 100) + '%';
    });
  }

  function wireOne(m) {
    const el = document.getElementById(m.knobId);
    if (!el || el.dataset.fxKnobWired === '1') return;
    el.dataset.fxKnobWired = '1';
    el.style.touchAction = 'none';
    el.style.cursor = 'ns-resize';
    const canvas = el.querySelector('.knob-canvas') || el;
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'ns-resize';

    let dragging = false, startY = 0, startVal = 0;
    const onDown = function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
      dragging = true;
      startY = e.clientY;
      startVal = store[m.tone || m.fxId];
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    };
    const onMove = function (e) {
      if (!dragging) return;
      e.preventDefault();
      const next = apply(m, startVal + (startY - e.clientY) / 120);
      paintKnob(canvas, next, m.size);
      const valEl = document.getElementById(m.valId);
      if (valEl) valEl.textContent = Math.round(next * 100) + '%';
    };
    const onUp = function () { dragging = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }

  function wireAll() {
    MAP.forEach(wireOne);
    paintAll();
  }

  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#fxPanelOpen, button.fx-panel-open')) {
      setTimeout(function () {
        try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
        wireAll();
      }, 60);
    }
  }, true);

  function boot() { wireAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(wireAll, 2500);
})();
