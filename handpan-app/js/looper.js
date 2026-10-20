/**
 * looper.js — minimal working looper (community upload removed).
 * Record / play / clear up to 4 layers from instrumentBus (pre-FX).
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const MAX_LAYERS = 4;
const DEFAULT_LEVEL = 0.92;

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  if (!rail || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  let btn = document.getElementById('looperBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'looperBtn';
    rail.appendChild(btn);
  }
  btn.className = 'looper-btn looper-record';
  btn.setAttribute('aria-label', 'Record loop');
  btn.title = 'Record loop';
  if (!btn.querySelector('.looper-btn-core')) {
    btn.innerHTML =
      '<span class="looper-btn-ring" aria-hidden="true"></span>' +
      '<span class="looper-btn-core" aria-hidden="true"></span>';
  }

  let layersEl = document.getElementById('looperLayers');
  if (!layersEl) {
    layersEl = document.createElement('div');
    layersEl.id = 'looperLayers';
    layersEl.className = 'looper-layers';
    layersEl.setAttribute('aria-label', 'Loop layers');
    rail.appendChild(layersEl);
  }

  let clearBtn = document.getElementById('looperClearBtn');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'looperClearBtn';
    clearBtn.className = 'looper-clear-btn';
    clearBtn.setAttribute('aria-label', 'Clear all loops');
    clearBtn.title = 'Clear all loops';
    rail.insertBefore(clearBtn, rail.firstChild);
  }
  clearBtn.innerHTML =
    '<span class="looper-clear-ring" aria-hidden="true"></span>' +
    '<span class="looper-clear-core" aria-hidden="true"><span class="looper-clear-x"></span></span>';

  const layers = [];
  let recording = false;
  let recChunks = null;
  let processor = null;
  let silent = null;
  let tapSource = null;

  function getRecordBus() {
    try {
      const bus = window.PionierCore?.getInstrumentBus?.();
      if (bus) return bus;
    } catch (_) {}
    return getAudioMaster();
  }

  function ensureTap() {
    const ctx = getAudioContext();
    const bus = getRecordBus();
    if (!ctx || !bus) return null;
    if (processor) return ctx;
    processor = ctx.createScriptProcessor(4096, 2, 2);
    silent = ctx.createGain();
    silent.gain.value = 0;
    processor.onaudioprocess = (e) => {
      if (!recording || !recChunks) return;
      const L = e.inputBuffer.getChannelData(0);
      const R =
        e.inputBuffer.numberOfChannels > 1
          ? e.inputBuffer.getChannelData(1)
          : L;
      recChunks.push({ L: new Float32Array(L), R: new Float32Array(R) });
      e.outputBuffer.getChannelData(0).fill(0);
      if (e.outputBuffer.numberOfChannels > 1) e.outputBuffer.getChannelData(1).fill(0);
    };
    try {
      bus.connect(processor);
      tapSource = bus;
    } catch (_) {
      const master = getAudioMaster();
      if (master) {
        master.connect(processor);
        tapSource = master;
      }
    }
    processor.connect(silent);
    silent.connect(ctx.destination);
    return ctx;
  }

  function chunksToBuffer(ctx, chunks) {
    if (!chunks.length) return null;
    const frames = chunks.reduce((n, c) => n + c.L.length, 0);
    if (frames < 128) return null;
    const buf = ctx.createBuffer(2, frames, ctx.sampleRate);
    let offset = 0;
    for (const c of chunks) {
      buf.getChannelData(0).set(c.L, offset);
      buf.getChannelData(1).set(c.R, offset);
      offset += c.L.length;
    }
    return buf;
  }

  function startLayerSource(layer) {
    const ctx = getAudioContext();
    if (!ctx || !layer.buffer || layer.paused) return;
    try {
      layer.source?.stop();
    } catch (_) {}
    const source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    source.connect(layer.gain);
    source.start(0);
    layer.source = source;
    layer.startedAt = ctx.currentTime;
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((layer, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'looper-layer' + (layer.paused ? '' : ' is-playing');
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', layer.paused ? 'Play layer ' + (i + 1) : 'Pause layer ' + (i + 1));
      b.addEventListener('click', () => {
        if (layer.paused) {
          layer.paused = false;
          startLayerSource(layer);
        } else {
          layer.paused = true;
          try {
            layer.source?.stop();
          } catch (_) {}
          layer.source = null;
        }
        renderCircles();
        setBtnState();
      });
      layersEl.appendChild(b);
    });
  }

  function setBtnState() {
    const hasLayers = layers.length > 0;
    btn.classList.toggle('is-recording', recording);
    btn.classList.toggle('has-layers', hasLayers);
    btn.title = recording
      ? 'Stop recording layer'
      : layers.length >= MAX_LAYERS
        ? 'Max layers (' + MAX_LAYERS + ')'
        : hasLayers
          ? 'Record next layer'
          : 'Start loop recording';
    btn.setAttribute('aria-label', btn.title);
    clearBtn.classList.toggle('has-layers', hasLayers || recording);
  }

  function startRecording() {
    if (layers.length >= MAX_LAYERS || recording) return;
    resumeAudio();
    const ctx = ensureTap();
    if (!ctx) return;
    recChunks = [];
    recording = true;
    setBtnState();
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    const ctx = getAudioContext();
    const buffer = ctx && recChunks ? chunksToBuffer(ctx, recChunks) : null;
    recChunks = null;
    if (buffer && ctx) {
      const gain = ctx.createGain();
      gain.gain.value = DEFAULT_LEVEL;
      try {
        gain.connect(getAudioMaster());
      } catch (_) {}
      const layer = {
        buffer,
        gain,
        source: null,
        paused: false,
        level: DEFAULT_LEVEL
      };
      layers.push(layer);
      startLayerSource(layer);
      renderCircles();
    }
    setBtnState();
  }

  function clearAll() {
    if (recording) stopRecording();
    for (const layer of layers) {
      try {
        layer.source?.stop();
      } catch (_) {}
      try {
        layer.gain?.disconnect();
      } catch (_) {}
    }
    layers.length = 0;
    renderCircles();
    setBtnState();
  }

  btn.addEventListener('click', () => {
    if (recording) stopRecording();
    else startRecording();
  });
  clearBtn.addEventListener('click', () => clearAll());

  const api = {
    clearAll,
    layers,
    openTrackPanel() {},
    closeTrackPanel() {},
    setBpm() {},
    setMetronome() {},
    getTimingState: () => ({
      bpm: 90,
      metronomeOn: false,
      countInEnabled: false,
      countInBars: 1,
      beatsPerBar: 4,
      clickType: 'woodblock'
    }),
    getState: () => ({
      maxLayers: MAX_LAYERS,
      layerCount: layers.length,
      recording,
      pendingLoopStop: false
    })
  };
  window.PionierLooper = api;
  setBtnState();
  return api;
}
