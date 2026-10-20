/**
 * app-state.js — single coherent state model for Pionier.
 * Instrument, scale, root, noteCount, FX snapshot, ambient, loop metadata.
 * Soft persistence; subscribers for UI sync.
 */

const STORAGE_KEY = 'pionier.appState.v1';

const defaultState = () => ({
  instrumentId: 'handpan',
  scaleIndex: 0,
  rootIndex: 0,
  noteCount: 9,
  fx: null,
  ambient: { playing: false, trackIndex: 0, volume: 0.85 },
  loop: { layerCount: 0, recording: false, bpm: 90 },
  version: 1
});

let state = defaultState();
const listeners = new Set();

function safeParse(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? safeParse(raw) : null;
    if (data) {
      state = {
        ...defaultState(),
        ...data,
        ambient: { ...defaultState().ambient, ...(data.ambient || {}) },
        loop: { ...defaultState().loop, ...(data.loop || {}) }
      };
    }
  } catch {
    /* storage blocked — keep defaults */
  }
  return getAppState();
}

export function getAppState() {
  return {
    ...state,
    ambient: { ...state.ambient },
    loop: { ...state.loop },
    fx: state.fx ? { ...state.fx } : null
  };
}

export function patchAppState(partial = {}) {
  const next = {
    ...state,
    ...partial,
    ambient: partial.ambient
      ? { ...state.ambient, ...partial.ambient }
      : state.ambient,
    loop: partial.loop ? { ...state.loop, ...partial.loop } : state.loop,
    fx: partial.fx !== undefined ? partial.fx : state.fx
  };
  state = next;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        instrumentId: state.instrumentId,
        scaleIndex: state.scaleIndex,
        rootIndex: state.rootIndex,
        noteCount: state.noteCount,
        ambient: state.ambient,
        loop: { bpm: state.loop.bpm, layerCount: state.loop.layerCount },
        version: state.version
      })
    );
  } catch {
    /* ignore */
  }
  for (const fn of listeners) {
    try {
      fn(getAppState());
    } catch (_) {}
  }
  return getAppState();
}

export function subscribeAppState(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetAppState() {
  state = defaultState();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) {
    try {
      fn(getAppState());
    } catch (_) {}
  }
  return getAppState();
}

if (typeof window !== 'undefined') {
  window.PionierAppState = {
    get: getAppState,
    patch: patchAppState,
    subscribe: subscribeAppState,
    load: loadAppState,
    reset: resetAppState
  };
}
