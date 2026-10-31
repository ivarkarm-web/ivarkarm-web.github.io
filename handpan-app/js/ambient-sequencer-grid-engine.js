/**
 * Pionier Sequence — upgraded 16-step multivoice sequencer.
 * Lookahead scheduling, scale-aware musical patterns, note/velocity editing,
 * swing, row mute, and warmer synthesized voices. Shares AudioContext; never
 * alters loop recordings.
 */
import { createBus, getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';
import { FxChain } from './fx.js';

const STORAGE_KEY = 'pionier.sequence.grid.v3';
const MAX_STEPS = 16;
const VOICES = [
  { id: 'mallet', name: 'Mallet', type: 'sine', partial: 2.005, gain: 1.0, decay: 1.35, color: 'gold', attack: 0.012 },
  { id: 'deep', name: 'Deep', type: 'triangle', partial: 1.498, gain: 0.88, decay: 2.85, color: 'sage', attack: 0.035 },
  { id: 'pluck', name: 'Pluck', type: 'triangle', partial: 2.02, gain: 0.62, decay: 0.55, color: 'clay', attack: 0.004 },
  { id: 'air', name: 'Air', type: 'sine', partial: 3.02, gain: 0.38, decay: 4.2, color: 'blue', attack: 0.08 }
];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const LOOKAHEAD = 0.12;
const TIMER_MS = 25;

function emptyPattern(steps = 16) {
  return VOICES.map(() => Array(steps).fill(null));
}

function createMusicalPattern(pool, steps, density) {
  const pattern = emptyPattern(steps);
  if (!pool.length) return pattern;
  const n = pool.length;
  const root = 0;
  const fifth = Math.min(n - 1, Math.round(n * 0.55));
  const third = Math.min(n - 1, Math.round(n * 0.3));
  const high = Math.min(n - 1, Math.max(0, n - 2));

  // Mallet: grounded pulse on 1 and (often) the midpoint
  pattern[0][0] = { noteIndex: root, velocity: 0.72, active: true };
  if (steps >= 8) pattern[0][Math.floor(steps / 2)] = { noteIndex: root, velocity: 0.55, active: true };
  if (density > 0.35 && steps >= 16) {
    pattern[0][Math.floor(steps * 0.25)] = { noteIndex: third, velocity: 0.42, active: true };
    pattern[0][Math.floor(steps * 0.75)] = { noteIndex: fifth, velocity: 0.4, active: true };
  }

  // Deep: slow harmonic anchors
  pattern[1][0] = { noteIndex: root, velocity: 0.58, active: true };
  if (steps >= 12) pattern[1][Math.floor(steps * 0.625)] = { noteIndex: fifth, velocity: 0.48, active: true };

  // Pluck: light rhythmic answers
  const pluckHits = density > 0.45 ? [3, 7, 11, 14] : [3, 11];
  pluckHits.forEach((s) => {
    if (s < steps) pattern[2][s] = { noteIndex: (third + Math.floor(s / 4)) % n, velocity: 0.44 + (s % 3) * 0.05, active: true };
  });

  // Air: sparse high color
  const airHits = density > 0.4 ? [steps - 1, Math.floor(steps * 0.4)] : [steps - 1];
  airHits.forEach((s) => {
    if (s >= 0 && s < steps) pattern[3][s] = { noteIndex: high, velocity: 0.32, active: true };
  });

  // Extra density sprinkle that stays musical (prefer scale tones on stronger beats)
  for (let row = 0; row < VOICES.length; row++) {
    for (let s = 0; s < steps; s++) {
      if (pattern[row][s]) continue;
      const strong = s % 4 === 0;
      const chance = density * (strong ? 0.22 : 0.1) * (row === 0 ? 0.7 : 1);
      if (Math.random() < chance) {
        const idx = strong ? [root, third, fifth][Math.floor(Math.random() * 3)] % n : Math.floor(Math.random() * n);
        pattern[row][s] = { noteIndex: idx, velocity: 0.28 + Math.random() * 0.28, active: true };
      }
    }
  }
  return pattern;
}

export function createAmbientSequenceEngine({ getNotes, getTransport } = {}) {
  let ctx = null;
  let bus = null;
  let fxSend = null;
  let fxChain = null;
  let fxEnabled = false;
  let playing = false;
  let density = 0.34;
  let space = 0.68;
  let level = 1;
  let freeBpm = 72;
  let swing = 0.12;
  let steps = 16;
  let freeStartTime = 0;
  let nextStepTime = 0;
  let currentStep = 0;
  let syncToLoop = true;
  let stepIndex = -1;
  let timer = 0;
  let lastCycle = -1;
  let pattern = emptyPattern(16);
  let patterns = [];
  let activePattern = 0;
  let muted = [false, false, false, false];
  let onStep = null;
  let scheduledIdentity = '';
  let scheduledClockSteps = new Set();
  let lastClockCycle = -1;
  let lastClockDuration = 0;
  const activeVoices = new Set();

  function notePool() {
    const notes = typeof getNotes === 'function' ? getNotes() : [];
    return (Array.isArray(notes) ? notes : [])
      .map((note, index) => ({
        index,
        name: note.name || 'Note ' + (index + 1),
        freq: Number(note.freq),
        midi: note.midi != null ? Number(note.midi) : null,
        midiExact: note.midiExact != null ? Number(note.midiExact) : null,
        microtonal: Boolean(note.microtonal)
      }))
      .filter((note) => Number.isFinite(note.freq) && note.freq > 20 && note.freq < 12000);
  }

  function snapshot() {
    return {
      playing, density, space, level, freeBpm, swing, steps, syncToLoop, stepIndex, fxEnabled,
      activePattern, patternCount: patterns.length,
      muted: muted.slice(),
      voices: VOICES.map((voice, row) => ({
        ...voice,
        muted: muted[row],
        pattern: pattern[row].map((cell) => (cell ? { ...cell } : null))
      }))
    };
  }

  function ensureBus() {
    ctx = getAudioContext();
    if (!ctx) return false;
    if (!bus || bus.context !== ctx) {
      bus = createBus('pionier-ambient-sequence-grid', 0.82);
      if (bus) {
        bus.gain.value = 0.82 * level;
        fxSend = ctx.createGain();
        fxSend.name = 'sequence-fx-send';
        fxSend.gain.value = fxEnabled ? 0.32 : 0;
        fxChain = new FxChain(ctx, getAudioMaster());
        const delayFx = fxChain.add('delay');
        delayFx?.setValue(0.18, ctx);
        if (delayFx?.dry?.gain) delayFx.dry.gain.value = 0;
        const reverbFx = fxChain.add('reverb');
        reverbFx?.setValue(0.24, ctx);
        if (reverbFx?.dry?.gain) reverbFx.dry.gain.value = 0;
        bus.connect(fxSend);
        fxSend.connect(fxChain.input);
      }
    }
    return !!bus;
  }

  function triggerSynth(note, voiceIndex, cell, atTime, stepDuration) {
    if (!ctx || !bus || !note) return;
    const voice = VOICES[voiceIndex];
    const start = Math.max(ctx.currentTime + 0.002, atTime);
    const human = (Math.random() - 0.5) * 0.012;
    const when = start + human;
    const duration = clamp(stepDuration * (0.55 + space * voice.decay), 0.18, 6.2);
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();

    filter.type = 'lowpass';
    const bright = voiceIndex === 2 ? 2800 : voiceIndex === 3 ? 1600 : 1300;
    filter.frequency.setValueAtTime(clamp(bright + (1 - space) * 2600, 400, 7200), when);
    filter.Q.value = voiceIndex === 2 ? 0.9 : 0.28;

    osc.type = voice.type;
    osc.frequency.setValueAtTime(note.freq, when);
    body.type = 'sine';
    body.frequency.setValueAtTime(note.freq * 0.5, when);
    bodyGain.gain.value = voiceIndex === 1 ? 0.22 : 0.08;
    overtone.type = voiceIndex === 3 ? 'triangle' : 'sine';
    overtone.frequency.setValueAtTime(Math.min(note.freq * voice.partial, 14000), when);
    overtoneGain.gain.value = voiceIndex === 3 ? 0.06 : 0.11;

    const peak = clamp((cell.velocity || 0.45) * voice.gain * 0.3 * level, 0.015, 0.36);
    const attack = voice.attack + (1 - (cell.velocity || 0.5)) * 0.02;
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + attack);
    amp.gain.setTargetAtTime(peak * (0.28 + space * 0.22), when + attack + 0.02, 0.16 + space * 0.4);
    amp.gain.setTargetAtTime(0.0001, when + duration, 0.22 + space * 0.95);

    osc.connect(filter);
    body.connect(bodyGain);
    bodyGain.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(amp);
    amp.connect(bus);

    osc.start(when);
    body.start(when);
    overtone.start(when);
    const stopAt = when + duration + 4.2;
    osc.stop(stopAt);
    body.stop(stopAt);
    overtone.stop(stopAt + 0.02);
    const voiceNodes = [osc, body, bodyGain, overtone, overtoneGain, filter, amp];
    const activeVoice = { nodes: voiceNodes, timer: 0, stopped: false };
    const cleanup = () => {
      if (activeVoice.stopped) return;
      activeVoice.stopped = true;
      if (activeVoice.timer) clearTimeout(activeVoice.timer);
      activeVoices.delete(activeVoice);
      voiceNodes.forEach((node) => { try { node.disconnect(); } catch (_) {} });
    };
    activeVoice.cleanup = cleanup;
    activeVoices.add(activeVoice);
    activeVoice.timer = setTimeout(cleanup, (duration + 4.5) * 1000);
  }

  function triggerNote(note, voiceIndex, cell, atTime, stepDuration) {
    // Every row stays synthesized so the sequencer remains independent of the
    // handpan sample bank while sharing its AudioContext and master bus.
    triggerSynth(note, voiceIndex, cell, atTime, stepDuration);
  }

  function transportState() {
    if (!syncToLoop || typeof getTransport !== 'function') return null;
    try {
      const state = getTransport();
      if (state && state.hasMaster && Number(state.duration) > 0) return state;
    } catch (_) {}
    return null;
  }

  function transportStepDuration(transport) {
    if (!transport || transport.paused) return 60 / freeBpm / 4;
    if (transport.source === 'looper') return Number(transport.duration) / steps;
    const duration = Number(transport.stepDuration);
    return Number.isFinite(duration) && duration > 0 ? duration : Number(transport.duration) / steps;
  }

  function stepDurationSec(transport) {
    return transportStepDuration(transport);
  }

  function swingOffset(step, stepDur) {
    if (swing <= 0.001 || step % 2 === 0) return 0;
    return stepDur * swing * 0.45;
  }

  function scheduleStep(step, when, stepDur) {
    const pool = notePool();
    VOICES.forEach((_, row) => {
      if (muted[row]) return;
      const cell = pattern[row] && pattern[row][step];
      if (!cell || !cell.active || !pool.length) return;
      const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];
      const t = when + swingOffset(step, stepDur);
      triggerNote(note, row, cell, t, stepDur);
    });
    stepIndex = step;
    if (typeof onStep === 'function') onStep(step, snapshot());
  }

  function tick() {
    if (!playing || !ctx) {
      timer = window.setTimeout(tick, 100);
      return;
    }
    if (ctx.state !== 'running') {
      timer = window.setTimeout(tick, 80);
      return;
    }

    const transport = transportState();
    if (transport && transport.paused) {
      stepIndex = -1;
      scheduledIdentity = '';
      scheduledClockSteps.clear();
      timer = window.setTimeout(tick, 80);
      return;
    }

    const now = ctx.currentTime;
    const stepDur = stepDurationSec(transport);

    if (transport && !transport.paused) {
      const duration = Number(transport.duration);
      const phase = ((Number(transport.phase) || 0) % duration + duration) % duration;
      const cycle = Number.isFinite(transport.cycle) ? transport.cycle : 0;
      if ((lastClockCycle >= 0 && cycle < lastClockCycle) || (lastClockDuration && duration !== lastClockDuration)) {
        scheduledClockSteps.clear();
      }
      lastClockCycle = cycle;
      lastClockDuration = duration;
      const cycleSteps = Math.max(1, Math.round(duration / stepDur));
      const absoluteStep = cycle * cycleSteps + phase / stepDur;
      let edgeIndex = Math.ceil(absoluteStep - 1e-7);
      const horizon = now + LOOKAHEAD;
      for (const key of scheduledClockSteps) {
        const [keyCycle, keyStep] = key.split(':').map(Number);
        if (keyCycle < cycle - 1 || keyStep < 0) scheduledClockSteps.delete(key);
      }
      let guard = 0;
      while (guard++ < 16 && now + (edgeIndex - absoluteStep) * stepDur < horizon) {
        const edgeTime = now + (edgeIndex - absoluteStep) * stepDur;
        const cycleOffset = Math.floor(edgeIndex / cycleSteps);
        const stepInCycle = ((edgeIndex % cycleSteps) + cycleSteps) % cycleSteps;
        const patternStep = ((stepInCycle % steps) + steps) % steps;
        const edgeCycle = cycle + cycleOffset;
        const id = edgeCycle + ':' + patternStep;
        if (edgeTime >= now - 0.01 && !scheduledClockSteps.has(id)) {
          scheduledClockSteps.add(id);
          scheduledIdentity = id;
          scheduleStep(patternStep, Math.max(edgeTime, now + 0.002), stepDur);
          if (patternStep === 0) lastCycle = edgeCycle;
        }
        edgeIndex++;
      }
      timer = window.setTimeout(tick, TIMER_MS);
      return;
    }

    // Free-running lookahead scheduler
    if (nextStepTime < now - 0.2) {
      nextStepTime = now + 0.04;
      currentStep = 0;
    }
    while (nextStepTime < now + LOOKAHEAD) {
      const step = currentStep % steps;
      scheduleStep(step, nextStepTime, stepDur);
      nextStepTime += stepDur;
      currentStep += 1;
      if (step === steps - 1) lastCycle += 1;
    }
    timer = window.setTimeout(tick, TIMER_MS);
  }

  function start({ reset = false } = {}) {
    if (!ensureBus()) return false;
    resumeAudio();
    playing = true;
    const clock = syncToLoop ? window.PionierClock : null;
    if (clock) {
      try { clock.setBpm(freeBpm); } catch (_) {}
      const state = clock.getTransportState?.();
      if (!state?.playing || state.paused) clock.start({ reset });
    }
    if (reset || !(nextStepTime > ctx.currentTime)) {
      freeStartTime = ctx.currentTime;
      nextStepTime = ctx.currentTime + 0.05;
      currentStep = 0;
    }
    scheduledIdentity = '';
      scheduledClockSteps.clear();
    stepIndex = -1;
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(tick, 20);
    return true;
  }

  function stop() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = 0;
    stepIndex = -1;
    scheduledIdentity = '';
    scheduledClockSteps.clear();
    if (syncToLoop) {
      try { window.PionierClock?.stop?.(); } catch (_) {}
    }
  }

  function pause() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = 0;
    scheduledIdentity = '';
    scheduledClockSteps.clear();
    if (syncToLoop) {
      try { window.PionierClock?.pause?.(); } catch (_) {}
    }
  }

  function resizePattern(newSteps) {
    newSteps = clamp(Math.round(newSteps) || 16, 8, MAX_STEPS);
    if (newSteps === steps) return snapshot();
    const next = emptyPattern(newSteps);
    for (let r = 0; r < VOICES.length; r++) {
      for (let s = 0; s < Math.min(steps, newSteps); s++) next[r][s] = pattern[r][s] ? { ...pattern[r][s] } : null;
    }
    pattern = next;
    steps = newSteps;
    scheduledIdentity = '';
    return snapshot();
  }

  function toggleStep(row, step) {
    if (!pattern[row] || step < 0 || step >= steps) return snapshot();
    if (pattern[row][step]) {
      pattern[row][step] = null;
    } else {
      const pool = notePool();
      if (pool.length) {
        pattern[row][step] = {
          noteIndex: (row * 2 + Math.floor(step / 4)) % pool.length,
          velocity: [0.68, 0.55, 0.46, 0.34][row],
          active: true
        };
      }
    }
    return snapshot();
  }

  /** Cycle note index, then velocity tiers, on an active cell. */
  function cycleCell(row, step) {
    if (!pattern[row] || step < 0 || step >= steps) return snapshot();
    const pool = notePool();
    if (!pool.length) return snapshot();
    let cell = pattern[row][step];
    if (!cell) {
      pattern[row][step] = { noteIndex: 0, velocity: 0.55, active: true };
      return snapshot();
    }
    const nextNote = (cell.noteIndex + 1) % pool.length;
    if (nextNote === 0) {
      // After full note cycle, bump velocity tier
      const tiers = [0.32, 0.5, 0.7, 0.9];
      let ti = tiers.findIndex((t) => Math.abs(t - cell.velocity) < 0.08);
      ti = (ti + 1) % tiers.length;
      pattern[row][step] = { noteIndex: 0, velocity: tiers[ti], active: true };
    } else {
      pattern[row][step] = { ...cell, noteIndex: nextNote };
    }
    return snapshot();
  }

  function setCellVelocity(row, step, velocity) {
    if (!pattern[row] || !pattern[row][step]) return snapshot();
    pattern[row][step] = { ...pattern[row][step], velocity: clamp(velocity, 0.15, 1) };
    return snapshot();
  }

  function clearRow(row) {
    if (!pattern[row]) return snapshot();
    pattern[row] = Array(steps).fill(null);
    return snapshot();
  }

  function toggleMute(row) {
    if (row < 0 || row >= muted.length) return muted.slice();
    muted[row] = !muted[row];
    return muted.slice();
  }

  function clearPattern() {
    pattern = emptyPattern(steps);
    return snapshot();
  }

  function makePattern() {
    pattern = createMusicalPattern(notePool(), steps, density);
    return snapshot();
  }

  function addPattern() {
    patterns[activePattern] = pattern.map((row) => row.map((cell) => cell ? { ...cell } : null));
    patterns.push(emptyPattern(steps));
    activePattern = patterns.length - 1;
    pattern = patterns[activePattern];
    scheduledIdentity = '';
    return snapshot();
  }

  function selectPattern(index) {
    if (!Number.isInteger(index) || index < 0 || index >= patterns.length) return snapshot();
    patterns[activePattern] = pattern.map((row) => row.map((cell) => cell ? { ...cell } : null));
    activePattern = index;
    pattern = patterns[index];
    scheduledIdentity = '';
    return snapshot();
  }

  function setDensity(value) { density = clamp(Number(value) || 0, 0.08, 0.8); return density; }
  function setSpace(value) { space = clamp(Number(value) || 0, 0, 1); return space; }
  function setLevel(value) {
    level = clamp(Number(value) || 0.3, 0.3, 1.5);
    if (bus && ctx) bus.gain.setTargetAtTime(0.82 * level, ctx.currentTime, 0.035);
    return level;
  }

  function setFxEnabled(enabled) {
    fxEnabled = !!enabled;
    if (fxSend) fxSend.gain.setTargetAtTime(fxEnabled ? 0.32 : 0, ctx?.currentTime || 0, 0.04);
    return fxEnabled;
  }
  function setBpm(value) {
    freeBpm = clamp(Math.round(Number(value) || 72), 40, 140);
    // Do not forget lookahead steps already handed to Web Audio. They cannot
    // be canceled, and clearing this set would schedule those same steps twice.
    if (syncToLoop) {
      try { window.PionierClock?.setBpm?.(freeBpm); } catch (_) {}
    } else if (playing && ctx) {
      // Free-run steps not yet submitted to Web Audio follow the new tempo
      // from the current audio time; already queued notes keep their onset.
      nextStepTime = ctx.currentTime + 60 / freeBpm / 4;
    }
    return freeBpm;
  }
  function setSwing(value) { swing = clamp(Number(value) || 0, 0, 0.55); return swing; }
  function setSteps(_value) { return resizePattern(MAX_STEPS); }
  function toggleSync(value) {
    syncToLoop = Boolean(value);
    freeStartTime = ctx?.currentTime || 0;
    nextStepTime = (ctx?.currentTime || 0) + 0.05;
    currentStep = 0;
    scheduledIdentity = '';
    scheduledClockSteps.clear();
    if (syncToLoop && playing) {
      try {
        window.PionierClock?.setBpm?.(freeBpm);
        const state = window.PionierClock?.getTransportState?.();
        if (!state?.playing || state.paused) window.PionierClock?.start?.({ reset: false });
      } catch (_) {}
    }
    return syncToLoop;
  }
  function setStepCallback(callback) { onStep = callback; }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && (saved.version === 2 || saved.version === 3 || saved.version === 4) && Array.isArray(saved.pattern)) {
      steps = MAX_STEPS;
      pattern = VOICES.map((_, r) => {
        const row = saved.pattern[r] || [];
        return Array.from({ length: steps }, (_, i) => (row[i] ? { ...row[i] } : null));
      });
      density = clamp(Number(saved.density) || density, 0.08, 0.8);
      space = clamp(Number(saved.space) || space, 0, 1);
      level = clamp(Number(saved.level) || level, 0.3, 1.5);
      freeBpm = clamp(Number(saved.freeBpm) || freeBpm, 40, 140);
      swing = clamp(Number(saved.swing) || swing, 0, 0.55);
      syncToLoop = saved.syncToLoop !== false;
      if (Array.isArray(saved.muted)) muted = VOICES.map((_, i) => Boolean(saved.muted[i]));
      const savedPatterns = Array.isArray(saved.patterns) ? saved.patterns : [saved.pattern];
      patterns = savedPatterns.map((savedPattern) => VOICES.map((_, r) =>
        Array.from({ length: steps }, (_, i) => savedPattern?.[r]?.[i] ? { ...savedPattern[r][i] } : null)
      ));
      activePattern = clamp(Number(saved.activePattern) || 0, 0, patterns.length - 1);
      pattern = patterns[activePattern] || pattern;
    }
  } catch (_) {}

  // Seed a musical pattern if empty
  if (!pattern.some((row) => row.some(Boolean))) {
    pattern = createMusicalPattern(notePool(), steps, density);
    if (!patterns.length) patterns = [pattern];
    else patterns[activePattern] = pattern;
  }

  function save() {
    try {
      patterns[activePattern] = pattern.map((row) => row.map((cell) => cell ? { ...cell } : null));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 4, pattern, patterns, activePattern, density, space, level, freeBpm, swing, steps, syncToLoop, muted
      }));
    } catch (_) {}
  }

  function destroy() {
    stop();
    for (const voice of [...activeVoices]) {
      try { voice.nodes[0].stop(ctx?.currentTime || 0); } catch (_) {}
      try { voice.nodes[1].stop(ctx?.currentTime || 0); } catch (_) {}
      try { voice.nodes[3].stop(ctx?.currentTime || 0); } catch (_) {}
      voice.cleanup();
    }
    try { bus?.disconnect(); } catch (_) {}
    bus = null;
  }

  return {
    start, pause, stop, snapshot, toggleStep, cycleCell, setCellVelocity,
    clearRow, clearPattern, makePattern, addPattern, selectPattern, toggleMute,
    setDensity, setSpace, setLevel, setFxEnabled, setBpm, setSwing, setSteps, toggleSync,
    setStepCallback, save, destroy
  };
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
      <div>
        <p class="sequence-kicker">PIONIER / SEQUENCE</p>
        <h2 id="pionierSequenceTitle">Step sequencer</h2>
      </div>
      <button type="button" class="sequence-close" aria-label="Return to handpan">×</button>
    </header>
    <p class="sequence-description">Tap to place notes · long-press to cycle pitch & velocity · build something that breathes with the pan.</p>
    <div class="sequence-toolbar">
      <label class="sequence-pattern-picker">Pattern <select class="sequence-pattern-select" aria-label="Select pattern"></select></label>
      <button type="button" class="sequence-action sequence-new-pattern" aria-label="New pattern">New pattern</button>
      <div class="sequence-length" aria-label="Pattern length"><span class="sequence-chip is-active">16 steps</span></div>
      <label class="sequence-bpm">
        <span>BPM <output data-value="bpm">72</output></span>
        <input type="range" min="40" max="140" value="72" data-control="bpm" aria-label="Tempo">
      </label>
    </div>
    <div class="sequence-grid-wrap">
      <div class="sequence-grid-head">
        <span class="sequence-grid-caption">VOICE</span>
        <div class="sequence-beat-numbers"></div>
      </div>
      <div class="sequence-rows" role="group" aria-label="Instrument step patterns"></div>
    </div>
    <div class="sequence-transport">
      <button type="button" class="sequence-play" aria-pressed="false" aria-label="Play sequence"><span>▶</span> Play</button>
      <button type="button" class="sequence-action sequence-stop" aria-label="Stop sequence">Stop</button>
      <button type="button" class="sequence-action sequence-clear">Clear</button>
      <button type="button" class="sequence-action sequence-regenerate">Inspire</button>
    </div>
    <div class="sequence-sync-row">
      <span><strong>Sync to loop</strong><small>Lock to the looper master cycle</small></span>
      <button type="button" class="sequence-switch" role="switch" aria-checked="true" aria-label="Sync to looper"><span></span></button>
    </div>
    <div class="sequence-sync-row">
      <span><strong>Sequence FX</strong><small>Independent reverb and delay send</small></span>
      <button type="button" class="sequence-fx-switch sequence-switch is-off" role="switch" aria-checked="false" aria-label="Enable sequence effects"><span></span></button>
    </div>
    <div class="sequence-controls sequence-controls-grid">
      <label class="sequence-control"><span>Density <output data-value="density">34%</output></span><input type="range" min="8" max="80" value="34" data-control="density" aria-label="Pattern density"></label>
      <label class="sequence-control"><span>Space <output data-value="space">68%</output></span><input type="range" min="0" max="100" value="68" data-control="space" aria-label="Note sustain"></label>
      <label class="sequence-control"><span>Swing <output data-value="swing">12%</output></span><input type="range" min="0" max="55" value="12" data-control="swing" aria-label="Swing amount"></label>
      <label class="sequence-control"><span>Level <output data-value="level">100%</output></span><input type="range" min="30" max="150" value="100" data-control="level" aria-label="Sequencer volume"></label>
    </div>
    <p class="sequence-footnote" role="status">4 voices · scale-aware · long-press a step to change note</p>
  `;
  document.body.appendChild(panel);

  const rowsEl = panel.querySelector('.sequence-rows');
  const beatNumbers = panel.querySelector('.sequence-beat-numbers');
  const engine = createAmbientSequenceEngine({
    getNotes: () => window.PionierCore?.handpan?.getNotes?.() || [],
    getTransport: () => {
      try { return window.PionierClock?.getTransportState?.() || null; }
      catch (_) { return null; }
    }
  });

  function renderBeatNumbers(count) {
    beatNumbers.innerHTML = Array.from({ length: count }, (_, i) =>
      '<span class="' + (i % 4 === 0 ? 'is-downbeat' : '') + '">' + (i + 1) + '</span>'
    ).join('');
  }

  function buildRows() {
    rowsEl.innerHTML = '';
    const state = engine.snapshot();
    const count = state.steps;
    renderBeatNumbers(count);
    panel.querySelector('.sequence-grid-wrap').style.setProperty('--seq-steps', String(count));

    VOICES.forEach((voice, row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'sequence-row sequence-row-' + voice.id + (state.muted[row] ? ' is-muted' : '');
      rowEl.dataset.voice = voice.id;

      const label = document.createElement('div');
      label.className = 'sequence-voice-label';
      label.innerHTML =
        '<button type="button" class="sequence-mute" data-row="' + row + '" aria-pressed="' +
        String(!!state.muted[row]) + '" title="Mute ' + voice.name + '">' +
        (state.muted[row] ? 'M' : '●') + '</button>' +
        '<span class="sequence-voice-dot"></span><span class="sequence-voice-name">' + voice.name + '</span>';
      rowEl.appendChild(label);

      const cells = document.createElement('div');
      cells.className = 'sequence-row-cells';
      cells.style.gridTemplateColumns = 'repeat(' + count + ', minmax(0, 1fr))';

      for (let step = 0; step < count; step++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sequence-step';
        button.dataset.row = String(row);
        button.dataset.step = String(step);
        button.setAttribute('aria-label', voice.name + ', step ' + (step + 1));
        button.setAttribute('aria-pressed', 'false');

        let pressTimer = 0;
        let longFired = false;
        button.addEventListener('pointerdown', (e) => {
          longFired = false;
          pressTimer = window.setTimeout(() => {
            longFired = true;
            engine.cycleCell(row, step);
            renderPattern();
            engine.save();
            status.textContent = 'Cycled note / velocity on ' + voice.name;
          }, 420);
        });
        const clearPress = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = 0; };
        button.addEventListener('pointerup', clearPress);
        button.addEventListener('pointerleave', clearPress);
        button.addEventListener('pointercancel', clearPress);
        button.addEventListener('click', (e) => {
          if (longFired) { e.preventDefault(); return; }
          engine.toggleStep(row, step);
          renderPattern();
          engine.save();
        });
        cells.appendChild(button);
      }
      rowEl.appendChild(cells);
      rowsEl.appendChild(rowEl);
    });

    rowsEl.querySelectorAll('.sequence-mute').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = Number(btn.dataset.row);
        engine.toggleMute(row);
        renderPattern();
        engine.save();
      });
    });
  }

  const playButton = panel.querySelector('.sequence-play');
  const stopButton = panel.querySelector('.sequence-stop');
  const syncButton = panel.querySelector('.sequence-switch');
  const status = panel.querySelector('.sequence-footnote');
  const patternSelect = panel.querySelector('.sequence-pattern-select');
  const initial = engine.snapshot();

  function syncControls(state) {
    panel.querySelector('[data-control="density"]').value = String(Math.round(state.density * 100));
    panel.querySelector('[data-value="density"]').textContent = Math.round(state.density * 100) + '%';
    panel.querySelector('[data-control="space"]').value = String(Math.round(state.space * 100));
    panel.querySelector('[data-value="space"]').textContent = Math.round(state.space * 100) + '%';
    panel.querySelector('[data-control="level"]').value = String(Math.round(state.level * 100));
    panel.querySelector('[data-value="level"]').textContent = Math.round(state.level * 100) + '%';
    panel.querySelector('[data-control="swing"]').value = String(Math.round(state.swing * 100));
    panel.querySelector('[data-value="swing"]').textContent = Math.round(state.swing * 100) + '%';
    panel.querySelector('[data-control="bpm"]').value = String(state.freeBpm);
    panel.querySelector('[data-value="bpm"]').textContent = String(state.freeBpm);
    syncButton.setAttribute('aria-checked', String(state.syncToLoop));
    syncButton.classList.toggle('is-off', !state.syncToLoop);
    panel.querySelectorAll('[data-steps]').forEach((chip) => {
      chip.classList.toggle('is-active', Number(chip.dataset.steps) === state.steps);
    });
  }
  syncControls(initial);
  buildRows();

  function renderPattern() {
    const state = engine.snapshot();
    patternSelect.innerHTML = Array.from({ length: state.patternCount }, (_, i) =>
      '<option value="' + i + '">Pattern ' + (i + 1) + '</option>'
    ).join('');
    patternSelect.value = String(state.activePattern);
    if (rowsEl.querySelectorAll('.sequence-row').length !== VOICES.length ||
        rowsEl.querySelectorAll('.sequence-step').length !== VOICES.length * state.steps) {
      buildRows();
    }
    state.voices.forEach((voice, row) => {
      const rowEl = rowsEl.querySelectorAll('.sequence-row')[row];
      if (!rowEl) return;
      rowEl.classList.toggle('is-muted', !!voice.muted);
      const muteBtn = rowEl.querySelector('.sequence-mute');
      if (muteBtn) {
        muteBtn.setAttribute('aria-pressed', String(!!voice.muted));
        muteBtn.textContent = voice.muted ? 'M' : '●';
      }
      rowEl.querySelectorAll('.sequence-step').forEach((button, step) => {
        const cell = voice.pattern[step];
        button.classList.toggle('is-active', !!cell);
        button.classList.toggle('is-current', step === state.stepIndex);
        button.setAttribute('aria-pressed', String(!!cell));
        if (cell) {
          button.style.setProperty('--vel', String(cell.velocity || 0.5));
          button.title = 'Note ' + ((cell.noteIndex || 0) + 1) + ' · vel ' + Math.round((cell.velocity || 0.5) * 100) + '%';
        } else {
          button.style.removeProperty('--vel');
          button.title = '';
        }
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
      engine.pause();
      playButton.innerHTML = '<span>▶</span> Play';
      playButton.setAttribute('aria-pressed', 'false');
      playButton.setAttribute('aria-label', 'Play sequence');
      status.textContent = 'Paused · press Play to continue';
    } else if (engine.start()) {
      playButton.innerHTML = '<span>Ⅱ</span> Pause';
      playButton.setAttribute('aria-pressed', 'true');
      playButton.setAttribute('aria-label', 'Pause sequence');
      status.textContent = 'Playing · close panel anytime — sequence keeps going';
    } else {
      status.textContent = 'Audio unavailable in this browser';
    }
    renderPattern();
    engine.save();
  });

  stopButton.addEventListener('click', () => {
    engine.stop();
    playButton.innerHTML = '<span>▶</span> Play';
    playButton.setAttribute('aria-pressed', 'false');
    playButton.setAttribute('aria-label', 'Play sequence');
    status.textContent = 'Stopped · pattern kept';
    renderPattern();
    engine.save();
  });

  panel.querySelector('.sequence-clear').addEventListener('click', () => {
    engine.clearPattern();
    renderPattern();
    status.textContent = 'Cleared · tap steps to write a new groove';
    engine.save();
  });

  panel.querySelector('.sequence-regenerate').addEventListener('click', () => {
    engine.makePattern();
    renderPattern();
    status.textContent = 'Fresh pattern in your current scale';
    engine.save();
  });

  panel.querySelector('.sequence-new-pattern').addEventListener('click', () => {
    engine.addPattern();
    renderPattern();
    status.textContent = 'Pattern ' + (engine.snapshot().activePattern + 1) + ' created · earlier patterns kept';
    engine.save();
  });
  patternSelect.addEventListener('change', () => {
    engine.selectPattern(Number(patternSelect.value));
    renderPattern();
    engine.save();
  });

  syncButton.addEventListener('click', () => {
    const sync = engine.toggleSync(!engine.snapshot().syncToLoop);
    syncButton.setAttribute('aria-checked', String(sync));
    syncButton.classList.toggle('is-off', !sync);
    status.textContent = sync ? 'Locked to the Pionier master clock' : 'Free-running tempo';
    engine.save();
  });

  const fxButton = panel.querySelector('.sequence-fx-switch');
  fxButton.addEventListener('click', () => {
    const enabled = engine.setFxEnabled(fxButton.getAttribute('aria-checked') !== 'true');
    fxButton.setAttribute('aria-checked', String(enabled));
    fxButton.classList.toggle('is-off', !enabled);
    status.textContent = enabled ? 'Sequence reverb and delay enabled' : 'Sequence effects off';
  });

  panel.querySelectorAll('[data-steps]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const n = Number(chip.dataset.steps);
      engine.setSteps(n);
      buildRows();
      renderPattern();
      syncControls(engine.snapshot());
      status.textContent = n + '-step pattern';
      engine.save();
    });
  });

  panel.querySelectorAll('[data-control]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const key = input.dataset.control;
      if (key === 'density') engine.setDensity(value / 100);
      if (key === 'space') engine.setSpace(value / 100);
      if (key === 'level') engine.setLevel(value / 100);
      if (key === 'swing') engine.setSwing(value / 100);
      if (key === 'bpm') engine.setBpm(value);
      const output = panel.querySelector('[data-value="' + key + '"]');
      if (output) output.textContent = key === 'bpm' ? String(value) : Math.round(value) + '%';
      engine.save();
    });
  });

  const onKey = (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
    if (event.key === ' ' && !panel.hidden && event.target === document.body) {
      event.preventDefault();
      playButton.click();
    }
  };
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
