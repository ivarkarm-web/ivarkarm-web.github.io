import {
  MAX_LAYERS, DEFAULT_BPM, DEFAULT_BARS, clampBpm, clampBars,
  loopDuration, countInDuration, quantizeTime, normalizeLayer, phaseAt, eventsBetween
} from './loop-core.js';

const button = document.getElementById('loopRecord');
const label = document.getElementById('loopOrbLabel');
const countEl = document.getElementById('loopLayerCount');
const playBtn = document.getElementById('loopPlay');
const pauseBtn = document.getElementById('loopPause');
const clearBtn = document.getElementById('loopClear');
const orbit = document.getElementById('loopOrbit');
const bpmInput = document.getElementById('loopBpm');
const barsInput = document.getElementById('loopBars');
const configNote = document.getElementById('loopConfigNote');

const state = {
  mode: 'empty',
  layers: [],
  current: [],
  bpm: DEFAULT_BPM,
  bars: DEFAULT_BARS,
  countInStart: 0,
  recordStart: 0,
  loopStart: 0,
  loopDuration: loopDuration(DEFAULT_BPM, DEFAULT_BARS),
  lastPos: 0,
  paused: false,
  raf: null,
  countInBeat: 0
};

function now() { return performance.now() / 1000; }
function stopClock() {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
}
function refreshDuration() {
  state.loopDuration = loopDuration(state.bpm, state.bars);
}
function configLocked() { return state.layers.length > 0; }

function setConfig() {
  if (configLocked() || state.mode !== 'empty') return;
  state.bpm = clampBpm(bpmInput?.value);
  state.bars = clampBars(barsInput?.value);
  if (bpmInput) bpmInput.value = String(state.bpm);
  if (barsInput) barsInput.value = String(state.bars);
  refreshDuration();
  paint();
}

function paintOrbit() {
  if (!orbit) return;
  orbit.innerHTML = '';
  state.layers.forEach((layer, i) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'loop-orbit-node' + (state.paused ? ' is-paused' : '') + (state.mode === 'playing' && !state.paused ? ' is-playing' : '');
    node.style.setProperty('--orbit-i', i);
    node.setAttribute('aria-label', state.paused ? 'Play loop' : 'Pause loop');
    node.innerHTML = '<span></span><b>' + (i + 1) + '</b>';
    node.addEventListener('click', () => { state.paused ? play() : pause(); });
    orbit.appendChild(node);
  });
}

function paint() {
  if (!button) return;
  const countIn = state.mode === 'count-in';
  const recording = state.mode === 'recording' || state.mode === 'overdub';
  button.classList.toggle('is-recording', recording || countIn);
  button.classList.toggle('is-playing', state.mode === 'playing' && !state.paused);
  if (countEl) countEl.textContent = state.layers.length + '/' + MAX_LAYERS;
  if (label) {
    if (countIn) label.textContent = state.countInBeat ? 'COUNT-IN · ' + state.countInBeat : 'COUNT-IN';
    else if (state.mode === 'recording') label.textContent = 'RECORDING';
    else if (state.mode === 'overdub') label.textContent = 'OVERDUB';
    else label.textContent = state.layers.length ? 'ADD LAYER' : 'RECORD';
  }
  button.setAttribute('aria-label',
    countIn ? 'Counting in' :
    recording ? 'Finish recording layer' :
    state.layers.length ? 'Record another layer' : 'Record a loop');
  if (bpmInput) bpmInput.disabled = configLocked() || state.mode !== 'empty';
  if (barsInput) barsInput.disabled = configLocked() || state.mode !== 'empty';
  if (configNote) configNote.textContent = configLocked()
    ? 'Tempo and bars locked until Clear.'
    : '1 bar count-in · 4 bars default';
  paintOrbit();
}

function playEvent(event) {
  if (window.HandpanGame?.strike) {
    try { window.HandpanGame.strike(event.n, event.v, null, 'loop'); } catch (error) {}
  }
}

function updateProgress(pos) {
  if (!orbit || !state.loopDuration) return;
  const progress = pos / state.loopDuration;
  orbit.querySelectorAll('.loop-orbit-node')
    .forEach((node) => node.style.setProperty('--loop-progress', progress));
}

function startClock(loopStart = now()) {
  stopClock();
  state.loopStart = loopStart;
  state.lastPos = phaseAt(now() - state.loopStart, state.loopDuration);
  state.paused = false;
  state.raf = requestAnimationFrame(tick);
  paint();
}

function tick() {
  state.raf = null;
  const currentTime = now();

  if (state.mode === 'count-in') {
    const elapsed = currentTime - state.countInStart;
    const beat = Math.min(4, Math.floor(elapsed / (60 / state.bpm)) + 1);
    if (beat !== state.countInBeat) {
      state.countInBeat = beat;
      paint();
    }
    if (elapsed >= countInDuration(state.bpm)) {
      state.mode = 'recording';
      state.recordStart = state.countInStart + countInDuration(state.bpm);
      state.countInBeat = 0;
      paint();
    }
  } else if (state.mode === 'recording') {
    if (currentTime - state.recordStart >= state.loopDuration) {
      commitPrimary();
      return;
    }
  } else if ((state.mode === 'playing' || state.mode === 'overdub') && !state.paused) {
    const pos = phaseAt(currentTime - state.loopStart, state.loopDuration);
    eventsBetween(state.layers.flat(), state.lastPos, pos, state.loopDuration).forEach(playEvent);
    state.lastPos = pos;
    updateProgress(pos);
  }

  if (!state.paused && state.mode !== 'empty') state.raf = requestAnimationFrame(tick);
}

function beginRecord() {
  stopClock();
  refreshDuration();
  state.current = [];
  state.mode = 'count-in';
  state.countInStart = now();
  state.recordStart = state.countInStart + countInDuration(state.bpm);
  state.countInBeat = 1;
  state.paused = false;
  paint();
  state.raf = requestAnimationFrame(tick);
}

function beginOverdub() {
  if (state.layers.length >= MAX_LAYERS || !state.loopDuration) return;
  state.current = [];
  state.mode = 'overdub';
  state.paused = false;
  paint();
  if (!state.raf) state.raf = requestAnimationFrame(tick);
}

function commitPrimary() {
  const layer = normalizeLayer(state.current, state.loopDuration, state.bpm);
  if (!layer.length) {
    clear();
    return;
  }
  state.layers = [layer];
  state.current = [];
  state.mode = 'playing';
  startClock(state.recordStart);
}

function commitOverdub() {
  const layer = normalizeLayer(state.current, state.loopDuration, state.bpm);
  state.current = [];
  if (layer.length) state.layers.push(layer);
  state.mode = 'playing';
  paint();
  if (!state.raf) state.raf = requestAnimationFrame(tick);
}

function clickOrb() {
  if (state.mode === 'empty') beginRecord();
  else if (state.mode === 'count-in') return;
  else if (state.mode === 'recording') commitPrimary();
  else if (state.mode === 'overdub') commitOverdub();
  else if (state.mode === 'playing') beginOverdub();
}

function play() {
  if (!state.layers.length) return;
  if (state.paused) {
    state.loopStart = now() - state.lastPos;
    state.paused = false;
    state.mode = 'playing';
    state.raf = requestAnimationFrame(tick);
  } else if (state.mode === 'playing') {
    startClock(now());
  }
  paint();
}

function pause() {
  if (!state.layers.length) return;
  state.paused = true;
  stopClock();
  paint();
}

function clear() {
  stopClock();
  state.mode = 'empty';
  state.layers = [];
  state.current = [];
  state.countInStart = 0;
  state.recordStart = 0;
  state.loopStart = 0;
  state.lastPos = 0;
  state.paused = false;
  state.countInBeat = 0;
  refreshDuration();
  paint();
}

function noteHandler(event) {
  if (state.mode !== 'recording' && state.mode !== 'overdub') return;
  const detail = event.detail || {};
  if (detail.source && detail.source !== 'user') return;
  if (!Number.isInteger(detail.noteIndex)) return;
  const raw = state.mode === 'recording'
    ? now() - state.recordStart
    : phaseAt(now() - state.loopStart, state.loopDuration);
  state.current.push({
    t: Math.min(raw, Math.max(0, state.loopDuration - 0.001)),
    n: detail.noteIndex,
    v: detail.velocity || 0.8
  });
}

bpmInput?.addEventListener('change', setConfig);
barsInput?.addEventListener('change', setConfig);
button?.addEventListener('click', clickOrb);
playBtn?.addEventListener('click', play);
pauseBtn?.addEventListener('click', pause);
clearBtn?.addEventListener('click', clear);
window.addEventListener('handpan:note', noteHandler);

window.HandpanLooper = {
  state,
  record: () => state.mode === 'empty' ? beginRecord() : beginOverdub(),
  play,
  pause,
  stop: clear,
  clear,
  setTempo: (bpm) => {
    if (!configLocked() && state.mode === 'empty') {
      state.bpm = clampBpm(bpm);
      if (bpmInput) bpmInput.value = state.bpm;
      refreshDuration();
      paint();
    }
  },
  setBars: (bars) => {
    if (!configLocked() && state.mode === 'empty') {
      state.bars = clampBars(bars);
      if (barsInput) barsInput.value = state.bars;
      refreshDuration();
      paint();
    }
  },
  quantize: (seconds) => quantizeTime(seconds, state.bpm)
};

paint();
