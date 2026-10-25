/**
 * Pionier Sequence — standalone ambient generative backing instrument.
 * Uses the shared AudioContext/master bus; does not alter handpan or loop recordings.
 */
import { createBus, getAudioContext, resumeAudio } from './audio-core.js?v=2';

const STORAGE_KEY = 'pionier.sequence.v1';
const STEPS = 16;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function createAmbientSequenceEngine({ getNotes, getTransport } = {}) {
  let ctx = null;
  let bus = null;
  let playing = false;
  let frozen = false;
  let density = 0.28;
  let evolution = 0.16;
  let space = 0.72;
  let level = 1;
  let freeBpm = 60;
  let freeStartTime = 0;
  let syncToLoop = true;
  let stepIndex = -1;
  let timer = 0;
  let lastCycle = -1;
  let pattern = [];
  let lastScheduledStep = '';
  let generation = 0;

  function notePool() {
    const notes = typeof getNotes === 'function' ? getNotes() : [];
    return (Array.isArray(notes) ? notes : [])
      .map((note, index) => ({ index, name: note.name || 'Note ' + (index + 1), freq: Number(note.freq) }))
      .filter((note) => Number.isFinite(note.freq) && note.freq > 20 && note.freq < 12000);
  }

  function makePattern() {
    const pool = notePool();
    pattern = Array.from({ length: STEPS }, (_, i) => {
      if (Math.random() > density) return null;
      const bias = i === 0 || i === 8 ? 0.2 : 0;
      const chosen = Math.random() < 0.32 + bias ? 0 : Math.floor(Math.random() * pool.length);
      return pool.length ? { noteIndex: chosen, velocity: 0.32 + Math.random() * 0.45, active: true } : null;
    });
    if (pool.length && pattern.filter(Boolean).length < 2) {
      [2, 10].forEach((i) => { pattern[i] = { noteIndex: Math.floor(Math.random() * pool.length), velocity: 0.42, active: true }; });
    }
    generation++;
    lastCycle = -1;
    return snapshot();
  }

  function snapshot() {
    return { playing, frozen, density, evolution, space, level, freeBpm, syncToLoop, stepIndex, generation,
      pattern: pattern.map((cell) => cell ? { ...cell } : null) };
  }

  function ensureBus() {
    ctx = getAudioContext();
    if (!ctx) return false;
    if (!bus || bus.context !== ctx) {
      bus = createBus('pionier-ambient-sequence', 0.82);
      if (bus) bus.gain.value = 0.82 * level;
    }
    return !!bus;
  }

  function triggerNote(note, velocity, atTime, stepDuration) {
    if (!ctx || !bus || !note) return;
    const start = Math.max(ctx.currentTime + 0.004, atTime);
    const duration = clamp(stepDuration * (0.65 + space * 3.2), 0.5, 5.8);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(1100 + (1 - space) * 2400, 500, 5000), start);
    filter.Q.value = 0.35;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, start);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(Math.min(note.freq * 2.01, 16000), start);
    overtoneGain.gain.value = 0.11;
    const peak = clamp(velocity * 0.24 * level, 0.025, 0.24);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.055);
    amp.gain.setTargetAtTime(peak * (0.36 + space * 0.18), start + 0.055, 0.24 + space * 0.4);
    amp.gain.setTargetAtTime(0.0001, start + duration, 0.45 + space * 1.1);
    osc.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    osc.start(start);
    overtone.start(start);
    osc.stop(start + duration + 5);
    overtone.stop(start + duration + 5.05);
    const cleanupAt = (duration + 5.2) * 1000;
    setTimeout(() => {
      try { osc.disconnect(); overtone.disconnect(); overtoneGain.disconnect(); filter.disconnect(); amp.disconnect(); } catch (_) {}
    }, cleanupAt);
  }

  function transportState() {
    if (!syncToLoop || typeof getTransport !== 'function') return null;
    try {
      const state = getTransport();
      if (state && state.hasMaster && Number(state.duration) > 0) return state;
    } catch (_) {}
    return null;
  }

  function tick() {
    if (!playing || !ctx || ctx.state !== 'running') {
      timer = window.setTimeout(tick, 120);
      return;
    }
    const now = ctx.currentTime;
    const transport = transportState();
    let phase, cycle, stepDuration;
    if (transport && transport.paused) {
      stepIndex = -1;
      timer = window.setTimeout(tick, 90);
      return;
    }
    if (transport && !transport.paused) {
      cycle = Number.isFinite(transport.cycle) ? transport.cycle : 0;
      phase = ((transport.phase || 0) % transport.duration + transport.duration) % transport.duration;
      stepDuration = transport.duration / STEPS;
    } else {
      stepDuration = 60 / freeBpm / 4;
      const elapsed = Math.max(0, now - freeStartTime);
      phase = elapsed % (stepDuration * STEPS);
      cycle = Math.floor(elapsed / (stepDuration * STEPS));
    }
    const step = Math.min(STEPS - 1, Math.floor(phase / stepDuration));
    const identity = (transport && !transport.paused ? 'loop' : 'free') + ':' + cycle + ':' + step;
    if (identity !== lastScheduledStep) {
      lastScheduledStep = identity;
      stepIndex = step;
      if (!frozen && step === 0 && cycle !== lastCycle) {
        lastCycle = cycle;
        if (Math.random() < evolution) {
          const changes = Math.max(1, Math.round(evolution * 5));
          for (let n = 0; n < changes; n++) {
            const index = Math.floor(Math.random() * STEPS);
            if (Math.random() < density) {
              const pool = notePool();
              pattern[index] = pool.length ? { noteIndex: Math.floor(Math.random() * pool.length), velocity: 0.28 + Math.random() * 0.48, active: true } : null;
            } else pattern[index] = null;
          }
        }
      }
      const cell = pattern[step];
      const pool = notePool();
      const note = cell && cell.active && pool.length ? pool[clamp(cell.noteIndex, 0, pool.length - 1)] : null;
      if (note) triggerNote(note, cell.velocity || 0.45, now + 0.018, stepDuration);
      if (typeof onStep === 'function') onStep(step, snapshot());
    }
    timer = window.setTimeout(tick, 22);
  }

  let onStep = null;
  function start() {
    if (!ensureBus()) return false;
    resumeAudio();
    if (!pattern.length) makePattern();
    playing = true;
    freeStartTime = ctx.currentTime;
    lastScheduledStep = '';
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(tick, 20);
    return true;
  }
  function stop() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = 0;
    stepIndex = -1;
    lastScheduledStep = '';
  }
  function setDensity(value) {
    density = clamp(Number(value) || 0, 0.08, 0.8);
    return density;
  }
  function setEvolution(value) { evolution = clamp(Number(value) || 0, 0, 0.65); return evolution; }
  function setSpace(value) { space = clamp(Number(value) || 0, 0, 1); return space; }
  function setLevel(value) { level = clamp(Number(value) || 0, 0.3, 1.5); if (bus && ctx) bus.gain.setTargetAtTime(0.82 * level, ctx.currentTime, 0.035); return level; }
  function setBpm(value) { freeBpm = clamp(Math.round(Number(value) || 60), 35, 110); return freeBpm; }
  function toggleSync(value) { syncToLoop = Boolean(value); freeStartTime = ctx?.currentTime || 0; lastScheduledStep = ''; return syncToLoop; }
  function toggleFreeze(value) { frozen = typeof value === 'boolean' ? value : !frozen; return frozen; }
  function toggleStep(index) {
    if (index < 0 || index >= STEPS) return;
    const pool = notePool();
    if (pattern[index]) pattern[index] = null;
    else if (pool.length) pattern[index] = { noteIndex: Math.floor(Math.random() * pool.length), velocity: 0.42, active: true };
    return snapshot();
  }
  function setStepCallback(callback) { onStep = callback; }
  function destroy() { stop(); try { bus?.disconnect(); } catch (_) {} bus = null; }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === 1) {
      density = clamp(Number(saved.density) || density, 0.08, 0.8);
      evolution = clamp(Number(saved.evolution) || evolution, 0, 0.65);
      space = clamp(Number(saved.space) || space, 0, 1);
      level = clamp(Number(saved.level) || level, 0.3, 1.5);
      freeBpm = clamp(Number(saved.freeBpm) || freeBpm, 35, 110);
      syncToLoop = saved.syncToLoop !== false;
      if (Array.isArray(saved.pattern) && saved.pattern.length === STEPS) pattern = saved.pattern;
    }
  } catch (_) {}

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, density, evolution, space, level, freeBpm, syncToLoop, pattern })); } catch (_) {}
  }
  return { start, stop, makePattern, snapshot, setDensity, setEvolution, setSpace, setLevel, setBpm, toggleSync, toggleFreeze, toggleStep, setStepCallback, save, destroy };
}

export function mountAmbientSequencer() {
  if (document.getElementById('pionierSequence')) return window.PionierSequence || null;
  const edge = document.createElement('button');
  edge.type = 'button';
  edge.id = 'pionierSequenceEdge';
  edge.className = 'pionier-sequence-edge';
  edge.setAttribute('aria-label', 'Open ambient sequence');
  edge.title = 'Ambient sequence';
  edge.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
  document.body.appendChild(edge);

  const panel = document.createElement('section');
  panel.id = 'pionierSequence';
  panel.className = 'pionier-sequence';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'pionierSequenceTitle');
  panel.innerHTML = `
    <header class="sequence-header">
      <div><p class="sequence-kicker">PIONIER / SEQUENCE PLAYGROUND</p><h2 id="pionierSequenceTitle">Sequence</h2></div>
      <button type="button" class="sequence-close" aria-label="Return to handpan">×</button>
    </header>
    <p class="sequence-description">A living pattern to play inside.</p>
    <div class="sequence-visual" aria-label="Sixteen-step ambient pattern">
      <div class="sequence-orbit" aria-hidden="true"></div>
      <div class="sequence-steps" role="group" aria-label="Pattern steps"></div>
      <div class="sequence-playhead" aria-hidden="true"></div>
    </div>
    <div class="sequence-transport">
      <button type="button" class="sequence-play" aria-pressed="false"><span>▶</span> Play backing</button>
      <button type="button" class="sequence-action sequence-freeze" aria-pressed="false">Freeze</button>
      <button type="button" class="sequence-action sequence-regenerate">Regenerate</button>
    </div>
    <div class="sequence-sync-row">
      <span><strong>Sync to loop</strong><small>Follow the looper's master cycle</small></span>
      <button type="button" class="sequence-switch" role="switch" aria-checked="true" aria-label="Sync to looper"><span></span></button>
    </div>
    <div class="sequence-controls">
      <label class="sequence-control"><span>Density</span><output data-value="density">28%</output><input type="range" min="8" max="80" value="28" data-control="density" aria-label="Note density"></label>
      <label class="sequence-control"><span>Evolution</span><output data-value="evolution">16%</output><input type="range" min="0" max="65" value="16" data-control="evolution" aria-label="Pattern evolution"></label>
      <label class="sequence-control"><span>Space</span><output data-value="space">72%</output><input type="range" min="0" max="100" value="72" data-control="space" aria-label="Note space and sustain"></label>
      <label class="sequence-control"><span>Level</span><output data-value="level">100%</output><input type="range" min="30" max="150" value="100" data-control="level" aria-label="Sequencer volume"></label>
    </div>
    <p class="sequence-footnote" role="status">Scale-aware · slow and spacious · keeps playing when closed</p>
  `;
  document.body.appendChild(panel);

  const stepsEl = panel.querySelector('.sequence-steps');
  for (let i = 0; i < STEPS; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sequence-step';
    button.dataset.step = String(i);
    button.setAttribute('aria-label', 'Step ' + (i + 1));
    button.addEventListener('click', () => {
      engine.toggleStep(i);
      renderPattern();
      engine.save();
    });
    stepsEl.appendChild(button);
  }

  const engine = createAmbientSequenceEngine({
    getNotes: () => window.PionierCore?.handpan?.getNotes?.() || [],
    getTransport: () => window.PionierLooper?.getTransportState?.() || null
  });
  if (!engine.snapshot().pattern.length) engine.makePattern();
  const playButton = panel.querySelector('.sequence-play');
  const freezeButton = panel.querySelector('.sequence-freeze');
  const syncButton = panel.querySelector('.sequence-switch');
  const status = panel.querySelector('.sequence-footnote');
  const initial = engine.snapshot();
  panel.querySelector('[data-control="density"]').value = String(Math.round(initial.density * 100));
  panel.querySelector('[data-value="density"]').textContent = Math.round(initial.density * 100) + '%';
  panel.querySelector('[data-control="evolution"]').value = String(Math.round(initial.evolution * 100));
  panel.querySelector('[data-value="evolution"]').textContent = Math.round(initial.evolution * 100) + '%';
  panel.querySelector('[data-control="space"]').value = String(Math.round(initial.space * 100));
  panel.querySelector('[data-value="space"]').textContent = Math.round(initial.space * 100) + '%';
  panel.querySelector('[data-control="level"]').value = String(Math.round(initial.level * 100));
  panel.querySelector('[data-value="level"]').textContent = Math.round(initial.level * 100) + '%';
  syncButton.setAttribute('aria-checked', String(initial.syncToLoop));
  syncButton.classList.toggle('is-off', !initial.syncToLoop);
  let currentStep = -1;

  function renderPattern() {
    const state = engine.snapshot();
    stepsEl.querySelectorAll('.sequence-step').forEach((button, index) => {
      const cell = state.pattern[index];
      button.classList.toggle('is-active', !!cell);
      button.classList.toggle('is-current', index === state.stepIndex);
      button.setAttribute('aria-pressed', String(!!cell));
      button.style.setProperty('--note-level', cell ? String(cell.velocity || 0.4) : '0');
    });
    panel.style.setProperty('--sequence-progress', String(Math.max(0, state.stepIndex) / STEPS));
    const playhead = panel.querySelector('.sequence-playhead');
    if (playhead) playhead.style.transform = 'rotate(' + (Math.max(0, state.stepIndex) / STEPS * 360) + 'deg)';
  }

  engine.setStepCallback((step) => {
    currentStep = step;
    renderPattern();
  });
  function open() {
    panel.hidden = false;
    panel.classList.add('is-open');
    edge.hidden = true;
    document.body.classList.add('pionier-sequence-open');
    renderPattern();
  }
  function close() {
    panel.classList.remove('is-open');
    panel.hidden = true;
    edge.hidden = false;
    document.body.classList.remove('pionier-sequence-open');
  }
  edge.addEventListener('click', open);
  panel.querySelector('.sequence-close').addEventListener('click', close);
  playButton.addEventListener('click', () => {
    if (engine.snapshot().playing) {
      engine.stop();
      playButton.innerHTML = '<span>▶</span> Play backing';
      playButton.setAttribute('aria-pressed', 'false');
      status.textContent = 'Stopped · your pattern is preserved';
    } else {
      if (engine.start()) {
        playButton.innerHTML = '<span>Ⅱ</span> Stop backing';
        playButton.setAttribute('aria-pressed', 'true');
        status.textContent = 'Playing · continues when you return to the handpan';
      } else status.textContent = 'Audio is unavailable in this browser';
    }
    renderPattern();
    engine.save();
  });
  freezeButton.addEventListener('click', () => {
    const frozen = engine.toggleFreeze();
    freezeButton.classList.toggle('is-active', frozen);
    freezeButton.setAttribute('aria-pressed', String(frozen));
    freezeButton.textContent = frozen ? 'Unfreeze' : 'Freeze';
    status.textContent = frozen ? 'Pattern frozen · no automatic changes' : 'Gentle evolution enabled';
    engine.save();
  });
  panel.querySelector('.sequence-regenerate').addEventListener('click', () => {
    engine.makePattern();
    renderPattern();
    status.textContent = 'A new pattern, in your current handpan scale';
    engine.save();
  });
  syncButton.addEventListener('click', () => {
    const sync = engine.toggleSync(!engine.snapshot().syncToLoop);
    syncButton.setAttribute('aria-checked', String(sync));
    syncButton.classList.toggle('is-off', !sync);
    status.textContent = sync ? 'Sync follows the master loop when one exists' : 'Free-running ambient sequence';
    engine.save();
  });
  panel.querySelectorAll('[data-control]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const key = input.dataset.control;
      if (key === 'density') engine.setDensity(value / 100);
      if (key === 'evolution') engine.setEvolution(value / 100);
      if (key === 'space') engine.setSpace(value / 100);
      if (key === 'level') engine.setLevel(value / 100);
      const output = panel.querySelector('[data-value="' + key + '"]');
      if (output) output.textContent = Math.round(value) + '%';
      engine.save();
    });
  });
  const onKey = (event) => { if (event.key === 'Escape' && !panel.hidden) close(); };
  document.addEventListener('keydown', onKey);

  // Edge swipe: only claim a gesture that begins at the far right and moves left.
  let gesture = null;
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.clientX > window.innerWidth - 24) gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
    else gesture = null;
  }, true);
  document.addEventListener('pointerup', (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 90) {
      if (dx < 0 && panel.hidden) open();
      else if (dx > 0 && !panel.hidden) close();
    }
    gesture = null;
  }, true);
  document.addEventListener('pointercancel', () => { gesture = null; }, true);

  const api = { open, close, engine, getState: () => engine.snapshot() };
  window.PionierSequence = api;
  renderPattern();
  return api;
}
