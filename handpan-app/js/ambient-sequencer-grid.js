/**
 * Pionier Sequence — hands-on 16-step multivoice sequencer.
 * Four distinct synthesized voices share the app AudioContext/master, but never alter loop audio.
 */
import { createBus, getAudioContext, resumeAudio } from './js/audio-core.js?v=2';

const STORAGE_KEY = 'pionier.sequence.grid.v2';
const STEPS = 16;
const VOICES = [
  { id: 'mallet', name: 'Mallet', type: 'sine', partial: 2.01, gain: 0.95, decay: 1.25, color: 'gold' },
  { id: 'deep', name: 'Deep', type: 'triangle', partial: 1.5, gain: 0.82, decay: 2.6, color: 'sage' },
  { id: 'pluck', name: 'Pluck', type: 'sawtooth', partial: 2.0, gain: 0.58, decay: 0.62, color: 'clay' },
  { id: 'air', name: 'Air', type: 'sine', partial: 3.01, gain: 0.42, decay: 3.8, color: 'blue' }
];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function createInitialPattern() {
  const pattern = VOICES.map(() => Array(STEPS).fill(null));
  // A restrained starter groove that clearly demonstrates separate instrument rows.
  [[0, 8], [4, 12]].forEach((steps, row) => steps.forEach((step) => {
    pattern[row][step] = { noteIndex: row === 0 ? 0 : 2, velocity: row === 0 ? 0.68 : 0.58, active: true };
  }));
  [3, 11, 14].forEach((step) => { pattern[2][step] = { noteIndex: 4, velocity: 0.46, active: true }; });
  [7, 15].forEach((step) => { pattern[3][step] = { noteIndex: 6, velocity: 0.34, active: true }; });
  return pattern;
}

export function createAmbientSequenceEngine({ getNotes, getTransport } = {}) {
  let ctx = null;
  let bus = null;
  let playing = false;
  let density = 0.34;
  let space = 0.68;
  let level = 1;
  let freeBpm = 60;
  let freeStartTime = 0;
  let syncToLoop = true;
  let stepIndex = -1;
  let timer = 0;
  let lastCycle = -1;
  let pattern = createInitialPattern();
  let lastScheduledStep = '';
  let onStep = null;

  function notePool() {
    const notes = typeof getNotes === 'function' ? getNotes() : [];
    return (Array.isArray(notes) ? notes : [])
      .map((note, index) => ({ index, name: note.name || 'Note ' + (index + 1), freq: Number(note.freq) }))
      .filter((note) => Number.isFinite(note.freq) && note.freq > 20 && note.freq < 12000);
  }

  function snapshot() {
    return {
      playing, density, space, level, freeBpm, syncToLoop, stepIndex,
      voices: VOICES.map((voice, row) => ({
        ...voice,
        pattern: pattern[row].map((cell) => cell ? { ...cell } : null)
      }))
    };
  }

  function ensureBus() {
    ctx = getAudioContext();
    if (!ctx) return false;
    if (!bus || bus.context !== ctx) {
      bus = createBus('pionier-ambient-sequence-grid', 0.82);
      if (bus) bus.gain.value = 0.82 * level;
    }
    return !!bus;
  }

  function triggerNote(note, voiceIndex, cell, atTime, stepDuration) {
    if (!ctx || !bus || !note) return;
    const voice = VOICES[voiceIndex];
    const start = Math.max(ctx.currentTime + 0.004, atTime);
    const duration = clamp(stepDuration * (0.65 + space * voice.decay), 0.22, 5.8);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp((voiceIndex === 2 ? 2400 : 1100) + (1 - space) * 3000, 450, 7000), start);
    filter.Q.value = voiceIndex === 2 ? 1.1 : 0.35;
    osc.type = voice.type;
    osc.frequency.setValueAtTime(note.freq, start);
    overtone.type = voiceIndex === 3 ? 'triangle' : 'sine';
    overtone.frequency.setValueAtTime(Math.min(note.freq * voice.partial, 16000), start);
    overtoneGain.gain.value = voiceIndex === 3 ? 0.07 : 0.12;
    const peak = clamp((cell.velocity || 0.45) * voice.gain * 0.32 * level, 0.018, 0.38);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + (voiceIndex === 2 ? 0.009 : 0.045));
    amp.gain.setTargetAtTime(peak * (0.3 + space * 0.2), start + 0.05, 0.18 + space * 0.45);
    amp.gain.setTargetAtTime(0.0001, start + duration, 0.25 + space * 0.9);
    osc.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    osc.start(start);
    overtone.start(start);
    osc.stop(start + duration + 4);
    overtone.stop(start + duration + 4.05);
    setTimeout(() => {
      try { osc.disconnect(); overtone.disconnect(); overtoneGain.disconnect(); filter.disconnect(); amp.disconnect(); } catch (_) {}
    }, (duration + 4.2) * 1000);
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
      if (step === 0 && cycle !== lastCycle) lastCycle = cycle;
      const pool = notePool();
      VOICES.forEach((voice, row) => {
        const cell = pattern[row][step];
        if (!cell || !cell.active || !pool.length) return;
        const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];
        triggerNote(note, row, cell, now + 0.018, stepDuration);
      });
      if (typeof onStep === 'function') onStep(step, snapshot());
    }
    timer = window.setTimeout(tick, 18);
  }

  function start() {
    if (!ensureBus()) return false;
    resumeAudio();
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
  function toggleStep(row, step) {
    if (!pattern[row] || step < 0 || step >= STEPS) return;
    if (pattern[row][step]) pattern[row][step] = null;
    else {
      const pool = notePool();
      if (pool.length) pattern[row][step] = {
        noteIndex: (row * 2 + Math.floor(step / 4)) % pool.length,
        velocity: [0.68, 0.58, 0.46, 0.34][row],
        active: true
      };
    }
    return snapshot();
  }
  function clearPattern() { pattern = VOICES.map(() => Array(STEPS).fill(null)); return snapshot(); }
  function makePattern() {
    pattern = createInitialPattern();
    const pool = notePool();
    if (pool.length) pattern.forEach((row, rowIndex) => {
      row.forEach((cell, step) => {
        if (!cell && Math.random() < density * (rowIndex === 0 ? 0.18 : 0.32)) {
          row[step] = { noteIndex: Math.floor(Math.random() * pool.length), velocity: 0.3 + Math.random() * 0.35, active: true };
        }
      });
    });
    return snapshot();
  }
  function setDensity(value) { density = clamp(Number(value) || 0, 0.08, 0.8); return density; }
  function setSpace(value) { space = clamp(Number(value) || 0, 0, 1); return space; }
  function setLevel(value) {
    level = clamp(Number(value) || 0.3, 0.3, 1.5);
    if (bus && ctx) bus.gain.setTargetAtTime(0.82 * level, ctx.currentTime, 0.035);
    return level;
  }
  function setBpm(value) { freeBpm = clamp(Math.round(Number(value) || 60), 35, 110); return freeBpm; }
  function toggleSync(value) { syncToLoop = Boolean(value); freeStartTime = ctx?.currentTime || 0; lastScheduledStep = ''; return syncToLoop; }
  function setStepCallback(callback) { onStep = callback; }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === 2 && Array.isArray(saved.pattern) && saved.pattern.length === VOICES.length) {
      pattern = saved.pattern.map((row) => Array.from({ length: STEPS }, (_, i) => row[i] ? { ...row[i] } : null));
      density = clamp(Number(saved.density) || density, 0.08, 0.8);
      space = clamp(Number(saved.space) || space, 0, 1);
      level = clamp(Number(saved.level) || level, 0.3, 1.5);
      freeBpm = clamp(Number(saved.freeBpm) || freeBpm, 35, 110);
      syncToLoop = saved.syncToLoop !== false;
    }
  } catch (_) {}
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, pattern, density, space, level, freeBpm, syncToLoop })); } catch (_) {}
  }
  function destroy() { stop(); try { bus?.disconnect(); } catch (_) {} bus = null; }
  return { start, stop, snapshot, toggleStep, clearPattern, makePattern, setDensity, setSpace, setLevel, setBpm, toggleSync, setStepCallback, save, destroy };
}

export function mountAmbientSequencer() {
  if (document.getElementById('pionierSequence')) return window.PionierSequence || null;
  const edge = document.createElement('button');
  edge.type = 'button';
  edge.id = 'pionierSequenceEdge';
  edge.className = 'pionier-sequence-edge';
  edge.setAttribute('aria-label', 'Open step sequencer');
  edge.title = 'Sequence';
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
      <div><p class="sequence-kicker">PIONIER / SEQUENCE PLAYGROUND</p><h2 id="pionierSequenceTitle">Step sequencer</h2></div>
      <button type="button" class="sequence-close" aria-label="Return to handpan">×</button>
    </header>
    <p class="sequence-description">Tap squares to program each instrument. The pattern repeats until you stop it.</p>
    <div class="sequence-grid-wrap">
      <div class="sequence-grid-head"><span class="sequence-grid-caption">INSTRUMENT</span><div class="sequence-beat-numbers">${Array.from({ length: STEPS }, (_, i) => '<span>' + (i + 1) + '</span>').join('')}</div></div>
      <div class="sequence-rows" role="group" aria-label="Instrument step patterns"></div>
    </div>
    <div class="sequence-transport">
      <button type="button" class="sequence-play" aria-pressed="false"><span>▶</span> Play sequence</button>
      <button type="button" class="sequence-action sequence-clear">Clear all</button>
      <button type="button" class="sequence-action sequence-regenerate">New pattern</button>
    </div>
    <div class="sequence-sync-row">
      <span><strong>Sync to loop</strong><small>Follow the looper's master cycle</small></span>
      <button type="button" class="sequence-switch" role="switch" aria-checked="true" aria-label="Sync to looper"><span></span></button>
    </div>
    <div class="sequence-controls sequence-controls-grid">
      <label class="sequence-control"><span>Density <output data-value="density">34%</output></span><input type="range" min="8" max="80" value="34" data-control="density" aria-label="Pattern density"></label>
      <label class="sequence-control"><span>Space <output data-value="space">68%</output></span><input type="range" min="0" max="100" value="68" data-control="space" aria-label="Note space and sustain"></label>
      <label class="sequence-control"><span>Level <output data-value="level">100%</output></span><input type="range" min="30" max="150" value="100" data-control="level" aria-label="Sequencer volume"></label>
    </div>
    <p class="sequence-footnote" role="status">4 sound voices · 16 steps · tap any square to edit</p>
  `;
  document.body.appendChild(panel);

  const rowsEl = panel.querySelector('.sequence-rows');
  const engine = createAmbientSequenceEngine({
    getNotes: () => window.PionierCore?.handpan?.getNotes?.() || [],
    getTransport: () => window.PionierLooper?.getTransportState?.() || null
  });
  VOICES.forEach((voice, row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'sequence-row sequence-row-' + voice.id;
    rowEl.dataset.voice = voice.id;
    const label = document.createElement('div');
    label.className = 'sequence-voice-label';
    label.innerHTML = '<span class="sequence-voice-dot"></span><span>' + voice.name + '</span>';
    rowEl.appendChild(label);
    const cells = document.createElement('div');
    cells.className = 'sequence-row-cells';
    for (let step = 0; step < STEPS; step++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sequence-step';
      button.dataset.row = String(row);
      button.dataset.step = String(step);
      button.setAttribute('aria-label', voice.name + ', step ' + (step + 1));
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        engine.toggleStep(row, step);
        renderPattern();
        engine.save();
      });
      cells.appendChild(button);
    }
    rowEl.appendChild(cells);
    rowsEl.appendChild(rowEl);
  });

  const playButton = panel.querySelector('.sequence-play');
  const syncButton = panel.querySelector('.sequence-switch');
  const status = panel.querySelector('.sequence-footnote');
  const initial = engine.snapshot();
  panel.querySelector('[data-control="density"]').value = String(Math.round(initial.density * 100));
  panel.querySelector('[data-value="density"]').textContent = Math.round(initial.density * 100) + '%';
  panel.querySelector('[data-control="space"]').value = String(Math.round(initial.space * 100));
  panel.querySelector('[data-value="space"]').textContent = Math.round(initial.space * 100) + '%';
  panel.querySelector('[data-control="level"]').value = String(Math.round(initial.level * 100));
  panel.querySelector('[data-value="level"]').textContent = Math.round(initial.level * 100) + '%';
  syncButton.setAttribute('aria-checked', String(initial.syncToLoop));
  syncButton.classList.toggle('is-off', !initial.syncToLoop);

  function renderPattern() {
    const state = engine.snapshot();
    state.voices.forEach((voice, row) => {
      const rowEl = rowsEl.querySelectorAll('.sequence-row')[row];
      rowEl.querySelectorAll('.sequence-step').forEach((button, step) => {
        const cell = voice.pattern[step];
        button.classList.toggle('is-active', !!cell);
        button.classList.toggle('is-current', step === state.stepIndex);
        button.setAttribute('aria-pressed', String(!!cell));
      });
    });
  }
  engine.setStepCallback(() => renderPattern());
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
      playButton.innerHTML = '<span>▶</span> Play sequence';
      playButton.setAttribute('aria-pressed', 'false');
      status.textContent = 'Stopped · your patterns are preserved';
    } else if (engine.start()) {
      playButton.innerHTML = '<span>Ⅱ</span> Stop sequence';
      playButton.setAttribute('aria-pressed', 'true');
      status.textContent = 'Playing · close this panel to return to handpan';
    } else status.textContent = 'Audio is unavailable in this browser';
    renderPattern();
    engine.save();
  });
  panel.querySelector('.sequence-clear').addEventListener('click', () => {
    engine.clearPattern();
    renderPattern();
    status.textContent = 'All rows cleared · tap squares to build your rhythm';
    engine.save();
  });
  panel.querySelector('.sequence-regenerate').addEventListener('click', () => {
    engine.makePattern();
    renderPattern();
    status.textContent = 'Starter pattern created · edit any square';
    engine.save();
  });
  syncButton.addEventListener('click', () => {
    const sync = engine.toggleSync(!engine.snapshot().syncToLoop);
    syncButton.setAttribute('aria-checked', String(sync));
    syncButton.classList.toggle('is-off', !sync);
    status.textContent = sync ? 'Sync follows the master loop when one exists' : 'Free-running sequence';
    engine.save();
  });
  panel.querySelectorAll('[data-control]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const key = input.dataset.control;
      if (key === 'density') engine.setDensity(value / 100);
      if (key === 'space') engine.setSpace(value / 100);
      if (key === 'level') engine.setLevel(value / 100);
      const output = panel.querySelector('[data-value="' + key + '"]');
      if (output) output.textContent = Math.round(value) + '%';
      engine.save();
    });
  });
  const onKey = (event) => { if (event.key === 'Escape' && !panel.hidden) close(); };
  document.addEventListener('keydown', onKey);
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
