const KEY = 'ivar-karm-handpan:v1';

const DEFAULTS = {
  settings: {
    scale: 0,
    voice: 'steel',
    backingVolume: 0.22,
    natureVolume: 0.24,
    backing: 'off',
    nature: 'off',
    bpm: 80,
    bars: 4
  },
  loop: { bpm: 80, bars: 4, layers: [] },
  learn: { completed: {} },
  firstRunComplete: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}) },
      loop: { ...DEFAULTS.loop, ...(saved.loop || {}), layers: Array.isArray(saved.loop?.layers) ? saved.loop.layers : [] },
      learn: { ...DEFAULTS.learn, ...(saved.learn || {}), completed: saved.learn?.completed || {} },
      firstRunComplete: !!saved.firstRunComplete
    };
  } catch {
    return clone(DEFAULTS);
  }
}

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function loadAppState() {
  return read();
}

export function saveSettings(patch) {
  const state = read();
  state.settings = { ...state.settings, ...patch };
  write(state);
  return state.settings;
}

export function saveLoop(loop) {
  const state = read();
  const layers = (loop.layers || []).slice(0, 7).map((layer) => layer.map((event) => ({
    t: Number(event.t),
    n: Number(event.n),
    v: Number(event.v)
  })));
  state.loop = {
    bpm: Number(loop.bpm) || 80,
    bars: Number(loop.bars) || 4,
    layers
  };
  state.settings.bpm = state.loop.bpm;
  state.settings.bars = state.loop.bars;
  write(state);
}

export function markLessonComplete(id, result = {}) {
  const state = read();
  state.learn.completed[id] = {
    score: Number(result.score) || 0,
    accuracy: Number(result.accuracy) || 0,
    completedAt: Date.now()
  };
  write(state);
}

export function completeFirstRun() {
  const state = read();
  state.firstRunComplete = true;
  write(state);
}

export function resetAppState() {
  try { localStorage.removeItem(KEY); } catch {}
}

export const STORAGE_KEY = KEY;
