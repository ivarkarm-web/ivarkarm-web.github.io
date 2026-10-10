/**
 * controls-ui.js — Unified Controls panel controller
 * One open/closed state, four effect modules + four tone knobs.
 */
import {
  AMBIENCE_FX, ROOM_FX, COMP_FX, EFFECTS_FX
} from './fx-engine.js';

const CATALOGUES = {
  ambience: AMBIENCE_FX,
  room: ROOM_FX,
  comp: COMP_FX,
  effects: EFFECTS_FX
};

function drawKnob(canvas, value, gold = '#c9a227') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 72;
  const w = size * dpr;
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = w;
  }
  const r = w / 2;
  ctx.clearRect(0, 0, w, w);
  ctx.beginPath();
  ctx.arc(r, r, r * 0.78, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = r * 0.1;
  ctx.stroke();
  const start = -Math.PI * 0.75;
  const end = start + Math.PI * 1.5 * Math.max(0.001, value);
  ctx.beginPath();
  ctx.arc(r, r, r * 0.78, start, end);
  ctx.strokeStyle = gold;
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.stroke();
  const a = start + Math.PI * 1.5 * value;
  const ix = r + Math.cos(a) * r * 0.52;
  const iy = r + Math.sin(a) * r * 0.52;
  ctx.beginPath();
  ctx.arc(ix, iy, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e6e3';
  ctx.fill();
}

function bindKnob(el, initial, onChange) {
  if (!el) return { set: () => {} };
  const canvas = el.querySelector('.knob-canvas');
  const valEl = el.querySelector('.knob-value');
  let value = initial;
  let dragging = false;
  let lastY = 0;
  function paint() {
    drawKnob(canvas, value);
    if (valEl) valEl.textContent = Math.round(value * 100);
    el.setAttribute('aria-valuenow', Math.round(value * 100));
  }
  function set(v) {
    value = Math.max(0, Math.min(1, v));
    paint();
  }
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    dragging = true;
    lastY = e.clientY;
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = lastY - e.clientY;
    lastY = e.clientY;
    value = Math.max(0, Math.min(1, value + dy * 0.005));
    paint();
    onChange(value);
  });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('pointercancel', () => { dragging = false; });
  el.addEventListener('keydown', (e) => {
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = 0.02;
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -0.02;
    if (!delta) return;
    e.preventDefault();
    value = Math.max(0, Math.min(1, value + delta));
    paint();
    onChange(value);
  });
  paint();
  return { set, get: () => value };
}

export function setupControlsUI(fxEngine) {
  const drawer = document.getElementById('mobileControlDrawer');
  const toggle = document.getElementById('mobileControlsToggle');
  if (!drawer || !toggle) return;

  let startY = null;
  let suppressClick = false;

  function setOpen(open) {
    drawer.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
    drawer.style.pointerEvents = open ? 'auto' : 'none';
    toggle.style.pointerEvents = 'auto';
    if (!open) closeAllDropdowns();
  }

  toggle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startY = e.clientY;
    suppressClick = false;
  });
  toggle.addEventListener('pointerup', (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) > 12) {
      setOpen(dy < 0);
      suppressClick = true;
    }
  });
  toggle.addEventListener('pointercancel', () => { startY = null; });
  toggle.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    setOpen(!drawer.classList.contains('is-open'));
  });
  setOpen(false);

  function fillDropdown(moduleId) {
    const key = moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
    const dd = document.getElementById('dd' + key);
    const cat = CATALOGUES[moduleId];
    if (!dd || !cat) return;
    dd.replaceChildren();
    cat.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctrl-dropdown-item' + (i === 0 ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.dataset.algo = item.id;
      btn.dataset.index = String(i);
      btn.textContent = item.name;
      btn.addEventListener('click', () => {
        fxEngine.selectAlgo(moduleId, i);
        dd.querySelectorAll('.ctrl-dropdown-item').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const nameEl = document.getElementById('algo' + key);
        if (nameEl) nameEl.textContent = item.name;
        document.querySelector('.ctrl-module[data-module="' + moduleId + '"]')?.classList.remove('is-bypassed');
        closeAllDropdowns();
      });
      dd.appendChild(btn);
    });
    const bypass = document.createElement('button');
    bypass.type = 'button';
    bypass.className = 'ctrl-dropdown-item bypass-item';
    bypass.textContent = 'Bypass / Off';
    bypass.addEventListener('click', () => {
      fxEngine.setModuleBypass(moduleId, true);
      document.querySelector('.ctrl-module[data-module="' + moduleId + '"]')?.classList.add('is-bypassed');
      closeAllDropdowns();
    });
    dd.appendChild(bypass);
  }

  ['ambience', 'room', 'comp', 'effects'].forEach(fillDropdown);

  function closeAllDropdowns() {
    document.querySelectorAll('.ctrl-dropdown').forEach((dd) => { dd.hidden = true; });
    document.querySelectorAll('.ctrl-gear').forEach((g) => { g.setAttribute('aria-expanded', 'false'); });
  }

  function positionDropdown(dd, gear) {
    const gr = gear.getBoundingClientRect();
    const margin = 8;
    dd.hidden = false;
    const dr = dd.getBoundingClientRect();
    let left = gr.left + gr.width / 2 - dr.width / 2;
    let top = gr.bottom + 6;
    if (left < margin) left = margin;
    if (left + dr.width > window.innerWidth - margin) left = window.innerWidth - margin - dr.width;
    if (top + dr.height > window.innerHeight - margin) top = gr.top - dr.height - 6;
    dd.style.left = Math.round(left) + 'px';
    dd.style.top = Math.round(top) + 'px';
  }

  document.querySelectorAll('.ctrl-gear').forEach((gear) => {
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      const ddId = gear.getAttribute('aria-controls');
      const dd = document.getElementById(ddId);
      if (!dd) return;
      const wasOpen = !dd.hidden;
      closeAllDropdowns();
      if (wasOpen) return;
      const mod = gear.closest('.ctrl-module')?.dataset.module;
      if (mod) {
        fxEngine.setModuleBypass(mod, false);
        gear.closest('.ctrl-module')?.classList.remove('is-bypassed');
      }
      gear.setAttribute('aria-expanded', 'true');
      positionDropdown(dd, gear);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctrl-dropdown') && !e.target.closest('.ctrl-gear')) closeAllDropdowns();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  const knobMap = {
    ambience: { id: 'knobAmbience', init: 0.15 },
    room: { id: 'knobRoom', init: 0.25 },
    comp: { id: 'knobComp', init: 0.4 },
    effects: { id: 'knobEffects', init: 0.5 }
  };
  for (const [mod, cfg] of Object.entries(knobMap)) {
    const el = document.getElementById(cfg.id);
    bindKnob(el, cfg.init, (v) => {
      fxEngine.setModuleValue(mod, v);
      fxEngine.setModuleBypass(mod, false);
      document.querySelector('.ctrl-module[data-module="' + mod + '"]')?.classList.remove('is-bypassed');
    });
    fxEngine.setModuleValue(mod, cfg.init);
  }

  const toneMap = {
    low: { id: 'knobLow', init: 0.5 },
    mid: { id: 'knobMid', init: 0.5 },
    bass: { id: 'knobBass', init: 0.5 },
    master: { id: 'knobMaster', init: 0.85 }
  };
  for (const [tone, cfg] of Object.entries(toneMap)) {
    const el = document.getElementById(cfg.id);
    bindKnob(el, cfg.init, (v) => fxEngine.setTone(tone, v));
    fxEngine.setTone(tone, cfg.init);
  }

  fxEngine.selectAlgo('ambience', 0);
  fxEngine.selectAlgo('room', 0);
  fxEngine.selectAlgo('comp', 0);
  fxEngine.selectAlgo('effects', 0);

  return { setOpen, closeAllDropdowns };
}
