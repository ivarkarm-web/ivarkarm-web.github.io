/**
 * looper.js — multi-layer phrase looper (max 5)
 * Record (right): arm/stop layer
 * Track circles: play/pause that layer only
 * Clear (left): wipe all layers — always visible
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const MAX_LAYERS = 5;
const LONG_MS = 550;

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  const btn = document.getElementById('looperBtn');
  const layersEl = document.getElementById('looperLayers');
  let clearBtn = document.getElementById('looperClearBtn');
  if (!rail || !btn || !layersEl || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  // Hide legacy global play/pause if present
  const legacyPlay = document.getElementById('looperPlayBtn');
  if (legacyPlay) {
    legacyPlay.hidden = true;
    legacyPlay.style.display = 'none';
  }

  // Clear lives on the left side of the screen (outside the right rail)
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'looperClearBtn';
    clearBtn.className = 'looper-clear-btn';
    clearBtn.setAttribute('aria-label', 'Clear all loops');
    clearBtn.title = 'Clear all loops';
    document.body.appendChild(clearBtn);
  } else if (clearBtn.parentElement === rail) {
    document.body.appendChild(clearBtn);
  }
  clearBtn.className = 'looper-clear-btn';
  clearBtn.innerHTML =
    '<span class="looper-clear-ring" aria-hidden="true"></span>' +
    '<span class="looper-clear-core" aria-hidden="true">' +
    '<span class="looper-clear-x"></span>' +
    '</span>';
  clearBtn.hidden = false;
  clearBtn.disabled = false;

  const layers = [];
  let recording = false;
  let recChunks = null;
  let processor = null;
  let silent = null;
  let pressTimer = null;
  let longFired = false;

  function ensureTap() {
    const ctx = getAudioContext();
    const master = getAudioMaster();
    if (!ctx || !master) return null;
    if (processor) return ctx;
    processor = ctx.createScriptProcessor(4096, 2, 2);
    silent = ctx.createGain();
    silent.gain.value = 0;
    processor.onaudioprocess = (e) => {
      if (!recording || !recChunks) return;
      const L = e.inputBuffer.getChannelData(0);
      const R = e.inputBuffer.numberOfChannels > 1
        ? e.inputBuffer.getChannelData(1)
        : L;
      recChunks.push({
        L: new Float32Array(L),
        R: new Float32Array(R)
      });
      e.outputBuffer.getChannelData(0).fill(0);
      if (e.outputBuffer.numberOfChannels > 1) e.outputBuffer.getChannelData(1).fill(0);
    };
    master.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);
    return ctx;
  }

  function setBtnState() {
    const hasLayers = layers.length > 0;
    btn.classList.toggle('is-recording', recording);
    btn.classList.toggle('has-layers', hasLayers);
    btn.setAttribute(
      'aria-label',
      recording
        ? 'Stop recording layer'
        : layers.length >= MAX_LAYERS
          ? 'Looper full'
          : hasLayers
            ? 'Record next layer'
            : 'Start loop recording'
    );
    clearBtn.classList.toggle('has-layers', hasLayers || recording);
    clearBtn.hidden = false;
  }

  function startLayerSource(layer, offset) {
    const ctx = getAudioContext();
    if (!ctx || !layer.gain || layer.paused) return;
    try { layer.source?.stop(); } catch (_) {}
    const source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    source.connect(layer.gain);
    const off = Math.max(0, offset || 0) % (layer.buffer.duration || 1);
    source.start(0, off);
    layer.source = source;
    layer.offset = off;
    layer.startedAt = ctx.currentTime - off;
  }

  function pauseLayer(index) {
    const layer = layers[index];
    if (!layer || layer.paused) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = layer.buffer.duration || 1;
    const elapsed = ((now - (layer.startedAt || now)) % dur + dur) % dur;
    layer.offset = elapsed;
    try { layer.source?.stop(); } catch (_) {}
    layer.source = null;
    layer.paused = true;
    renderCircles();
  }

  function resumeLayer(index) {
    const layer = layers[index];
    if (!layer || !layer.paused) return;
    resumeAudio();
    layer.paused = false;
    startLayerSource(layer, layer.offset || 0);
    renderCircles();
  }

  function toggleLayer(index) {
    const layer = layers[index];
    if (!layer) return;
    if (layer.paused) resumeLayer(index);
    else pauseLayer(index);
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((layer, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'looper-circle' + (layer.paused ? ' is-paused' : ' is-playing');
      c.style.setProperty('--i', String(i));
      c.title = layer.paused
        ? 'Play layer ' + (i + 1)
        : 'Pause layer ' + (i + 1);
      c.setAttribute('aria-label', c.title);

      // Number + CSS-drawn play/pause (no emoji)
      const num = document.createElement('span');
      num.className = 'looper-circle-num';
      num.textContent = String(i + 1);

      const icon = document.createElement('span');
      icon.className = 'looper-circle-icon ' + (layer.paused ? 'is-play' : 'is-pause');
      icon.setAttribute('aria-hidden', 'true');
      if (layer.paused) {
        // triangle play
        icon.innerHTML = '<span class="looper-glyph-play"></span>';
      } else {
        // two bars pause
        icon.innerHTML =
          '<span class="looper-glyph-pause"><i></i><i></i></span>';
      }

      c.appendChild(num);
      c.appendChild(icon);

      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      c.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLayer(i);
      });
      c.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLayer(i);
      });
      layersEl.appendChild(c);
    });
  }

  function startRecord() {
    if (layers.length >= MAX_LAYERS) return;
    const ctx = ensureTap();
    if (!ctx) return;
    resumeAudio();
    recChunks = [];
    recording = true;
    setBtnState();
  }

  function stopRecordAndPlay() {
    if (!recording) return;
    recording = false;
    const ctx = getAudioContext();
    const master = getAudioMaster();
    const chunks = recChunks;
    recChunks = null;
    setBtnState();
    if (!ctx || !master || !chunks || chunks.length < 2) return;

    const frameCount = chunks.reduce((n, c) => n + c.L.length, 0);
    const buffer = ctx.createBuffer(2, frameCount, ctx.sampleRate);
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    let offset = 0;
    for (const c of chunks) {
      ch0.set(c.L, offset);
      ch1.set(c.R, offset);
      offset += c.L.length;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0.92;
    gain.connect(master);

    const layer = {
      buffer,
      source: null,
      gain,
      startedAt: ctx.currentTime,
      offset: 0,
      paused: false
    };
    layers.push(layer);
    startLayerSource(layer, 0);

    renderCircles();
    setBtnState();
  }

  function clearAll() {
    recording = false;
    recChunks = null;
    for (const layer of layers) {
      try { layer.source?.stop(); } catch (_) {}
      try { layer.gain.disconnect(); } catch (_) {}
    }
    layers.length = 0;
    renderCircles();
    setBtnState();
  }

  function onClear(e) {
    e.preventDefault();
    e.stopPropagation();
    clearAll();
    clearBtn.classList.add('is-fired');
    setTimeout(() => clearBtn.classList.remove('is-fired'), 220);
  }

  function onPressStart(e) {
    e.preventDefault();
    e.stopPropagation();
    longFired = false;
    pressTimer = setTimeout(() => {
      longFired = true;
      clearAll();
      btn.classList.add('is-cleared');
      setTimeout(() => btn.classList.remove('is-cleared'), 280);
    }, LONG_MS);
  }

  function onPressEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (longFired) return;
    if (recording) stopRecordAndPlay();
    else startRecord();
  }

  btn.addEventListener('pointerdown', onPressStart);
  btn.addEventListener('pointerup', onPressEnd);
  btn.addEventListener('pointercancel', () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  clearBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  clearBtn.addEventListener('pointerup', onClear);
  clearBtn.addEventListener('click', onClear);

  setBtnState();
  renderCircles();

  return {
    clearAll,
    toggleLayer,
    get layerCount() { return layers.length; }
  };
}
