/**
 * looper/timing.mjs — Count-in, metronome, BPM, and sync-mode logic.
 *
 * Imports shared state from ./state.mjs. Audio functions are imported
 * from audio-core.js.
 */

import { getAudioContext, getAudioMaster, resumeAudio } from '../audio-core.js';
import { state } from './state.mjs';

const CLICK_TYPES = [
  { id: 'woodblock', label: 'Woodblock', wave: 'triangle', frequency: 1450, duration: 0.045 },
  { id: 'soft-wood', label: 'Soft Wood', wave: 'sine', frequency: 950, duration: 0.055 },
  { id: 'rim-click', label: 'Rim Click', wave: 'square', frequency: 2100, duration: 0.022 },
  { id: 'handpan-tap', label: 'Handpan Tap', wave: 'sine', frequency: 520, duration: 0.11 },
  { id: 'bell', label: 'Bell', wave: 'sine', frequency: 1760, duration: 0.16 },
  { id: 'shaker', label: 'Shaker', wave: 'sawtooth', frequency: 4200, duration: 0.018 },
  { id: 'tick', label: 'Soft Tick', wave: 'square', frequency: 1200, duration: 0.012 },
  { id: 'clave', label: 'Clave', wave: 'triangle', frequency: 2500, duration: 0.03 },
  { id: 'low-pulse', label: 'Low Pulse', wave: 'sine', frequency: 180, duration: 0.08 },
  { id: 'digital', label: 'Digital Click', wave: 'square', frequency: 3000, duration: 0.018 },
];

const SYNC_MODES = [
  { id: 'free', label: 'FREE', title: 'Free — each layer independent' },
  { id: 'loop', label: 'LOOP', title: 'Loop sync — multiples of master length' },
  { id: 'beat', label: 'BEAT', title: 'Beat sync — quantize to master grid' },
  { id: 'serial', label: 'SERIAL', title: 'Serial — sections play in sequence' },
];

export function syncMode() {
  return SYNC_MODES[state.syncModeIndex].id;
}

export function playClick(beatIndex = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const click = CLICK_TYPES.find((c) => c.id === state.clickType) || CLICK_TYPES[0];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = click.wave;
  osc.frequency.value = click.frequency;
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + click.duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + click.duration);
}

export function cancelCountIn() {
  if (state.countInTimer) {
    clearTimeout(state.countInTimer);
    state.countInTimer = null;
  }
  state.countInPending = false;
  state.countInCurrent = 0;
}

export function runCountIn(generation = state.recordStartGeneration) {
  if (state.countInPending && generation !== state.recordStartGeneration) return;
  state.countInPending = true;
  state.countInCurrent = 0;

  const next = () => {
    if (!state.countInPending || generation !== state.recordStartGeneration) return;
    state.countInCurrent++;
    if (state.countInCurrent > state.countInBars * 4) {
      state.countInPending = false;
      return;
    }
    playClick(state.countInCurrent % 4 || 4);
    state.countInTimer = setTimeout(next, (60 / state.bpm) * 1000);
  };
  next();
}

export function setMetronome(enabled) {
  state.metronomeOn = enabled;
  if (enabled && !state.metronomeTimer) {
    const tick = () => {
      if (!state.metronomeOn) return;
      playClick();
      state.metronomeTimer = setTimeout(tick, (60 / state.bpm) * 1000);
    };
    state.metronomeTimer = setTimeout(tick, (60 / state.bpm) * 1000);
  } else if (!enabled && state.metronomeTimer) {
    clearTimeout(state.metronomeTimer);
    state.metronomeTimer = null;
  }
}

export function setBpm(value) {
  state.bpm = value;
  if (state.metronomeOn) {
    setMetronome(false);
    setMetronome(true);
  }
}

export function closeTimingMenu() {
  if (state.timingMenu) {
    state.timingMenu.hidden = true;
    state.timingMenu = null;
  }
  state.timingMenuType = null;
}

export function showTimingMenu(type, anchor) {
  closeTimingMenu();
  state.timingMenuType = type;
  // Menu creation is handled by the UI module; this sets the state.
}

export function wireTimingToggle(control, type) {
  control.addEventListener('click', () => {
    showTimingMenu(type, control);
  });
}

export function cycleSyncMode() {
  state.syncModeIndex = (state.syncModeIndex + 1) % SYNC_MODES.length;
  if (state.syncBtn) {
    state.syncBtn.setAttribute('aria-label', 'Sync mode: ' + SYNC_MODES[state.syncModeIndex].label);
    state.syncBtn.title = SYNC_MODES[state.syncModeIndex].title;
  }
}
