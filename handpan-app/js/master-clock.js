/**
 * Pionier master clock — shared transport for sequencer, looper, and future engines.
 * AudioContext time is the source of truth. When a looper master exists, phase is
 * derived from it; otherwise an internal BPM cycle runs (1 bar = 16 sixteenths).
 */
import { getAudioContext, resumeAudio } from './audio-core.js?v=2';
import {
  DEFAULT_BPM,
  BEATS_PER_BAR,
  clampBpm,
  beatDuration as beatDurFromBpm
} from './loop-core.js';

const STORAGE_KEY = 'pionier.masterClock.v1';
const PPQ = 4; // steps per beat → 16th notes

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch (_) {}
  return null;
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bpm: state.bpm,
      bars: state.bars,
      preferLooper: state.preferLooper
    }));
  } catch (_) {}
}

/**
 * @param {{ getLooperTransport?: () => any }} [opts]
 */
export function createMasterClock(opts = {}) {
  const saved = loadSaved();
  let bpm = clampBpm(saved?.bpm ?? DEFAULT_BPM);
  let bars = Math.max(1, Math.min(8, Number(saved?.bars) || 4));
  let preferLooper = saved?.preferLooper !== false;
  let playing = false;
  let origin = 0;
  let phaseAtPause = 0;
  let listeners = new Set();

  function ctxNow() {
    const ctx = getAudioContext();
    return ctx ? ctx.currentTime : 0;
  }

  function beatDurationSec() {
    return beatDurFromBpm(bpm);
  }

  function stepDurationSec() {
    return beatDurationSec() / PPQ;
  }

  function cycleDurationSec() {
    // One bar so a 16-step grid matches free-run 16th spacing.
    // Multi-bar cycles come from the looper when a master loop is playing.
    return beatDurationSec() * BEATS_PER_BAR;
  }

  function looperState() {
    if (!preferLooper || typeof opts.getLooperTransport !== 'function') return null;
    try {
      const t = opts.getLooperTransport();
      if (t && t.hasMaster && Number(t.duration) > 0) return t;
    } catch (_) {}
    return null;
  }

  /**
   * Transport snapshot compatible with sequencer getTransport.
   */
  function getTransportState() {
    const now = ctxNow();
    const loop = looperState();

    if (loop && !loop.paused) {
      const duration = Number(loop.duration);
      const phase = ((Number(loop.phase) || 0) % duration + duration) % duration;
      return {
        hasMaster: true,
        duration,
        phase,
        paused: false,
        cycle: Number.isFinite(loop.cycle) ? loop.cycle : 0,
        bpm: loop.bpm || bpm,
        currentTime: now,
        source: 'looper',
        stepDuration: stepDurationSec(),
        playing: true
      };
    }

    const duration = cycleDurationSec();
    if (!playing || !(duration > 0)) {
      return {
        hasMaster: true,
        duration,
        phase: duration > 0 ? phaseAtPause % duration : 0,
        paused: true,
        cycle: 0,
        bpm,
        currentTime: now,
        source: 'internal',
        stepDuration: stepDurationSec(),
        playing: false
      };
    }

    const elapsed = Math.max(0, now - origin) + phaseAtPause;
    const phase = ((elapsed % duration) + duration) % duration;
    const cycle = Math.floor(elapsed / duration);
    return {
      hasMaster: true,
      duration,
      phase,
      paused: false,
      cycle,
      bpm,
      currentTime: now,
      source: 'internal',
      stepDuration: stepDurationSec(),
      playing: true
    };
  }

  function emit() {
    const state = getTransportState();
    listeners.forEach((fn) => {
      try { fn(state); } catch (_) {}
    });
    return state;
  }

  function start({ reset = false } = {}) {
    const ctx = getAudioContext();
    if (!ctx) return false;
    resumeAudio();
    if (reset) phaseAtPause = 0;
    origin = ctx.currentTime;
    playing = true;
    emit();
    return true;
  }

  function pause() {
    if (!playing) return;
    const state = getTransportState();
    if (state.source === 'internal') phaseAtPause = state.phase;
    playing = false;
    emit();
  }

  function stop() {
    playing = false;
    phaseAtPause = 0;
    origin = 0;
    emit();
  }

  function toggle() {
    if (playing) {
      pause();
      return false;
    }
    return start({ reset: false });
  }

  function setBpm(value) {
    if (playing) {
      const state = getTransportState();
      if (state.source === 'internal') {
        phaseAtPause = state.phase;
        origin = ctxNow();
      }
    }
    bpm = clampBpm(value);
    save({ bpm, bars, preferLooper });
    emit();
    return bpm;
  }

  function setBars(value) {
    bars = Math.max(1, Math.min(8, Math.round(Number(value) || 4)));
    save({ bpm, bars, preferLooper });
    emit();
    return bars;
  }

  function setPreferLooper(value) {
    preferLooper = Boolean(value);
    save({ bpm, bars, preferLooper });
    emit();
    return preferLooper;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function snapshot() {
    return {
      ...getTransportState(),
      preferLooper,
      bars,
      ppq: PPQ
    };
  }

  return {
    start,
    pause,
    stop,
    toggle,
    setBpm,
    setBars,
    setPreferLooper,
    getTransportState,
    snapshot,
    subscribe,
    beatDurationSec,
    stepDurationSec,
    cycleDurationSec
  };
}

let singleton = null;

export function getMasterClock() {
  if (!singleton) {
    singleton = createMasterClock({
      getLooperTransport: () => {
        try {
          return window.PionierLooper?.getTransportState?.() || null;
        } catch (_) {
          return null;
        }
      }
    });
    try {
      window.PionierClock = singleton;
    } catch (_) {}
  }
  return singleton;
}

export function mountMasterClock() {
  return getMasterClock();
}
