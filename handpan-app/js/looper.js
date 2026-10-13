/**
 * looper.js — multi-layer phrase looper (max 7)
 * Record (right): arm/stop layer
 * Track circles: tap play/pause · hold for X · tap again to delete
 * Clear (left): wipe all layers — always visible
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const MAX_LAYERS = 7;
const LONG_MS = 550;

export function mountLooper({ root, getRecordSource } = {}) {
  const rail = root || document.getElementById('looperRail');
  const btn = document.getElementById('looperBtn');
  const layersEl = document.getElementById('looperLayers');
  let clearBtn = document.getElementById('looperClearBtn');
  if (!rail || !btn || !layersEl || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  const legacyPlay = document.getElementById('looperPlayBtn');
  if (legacyPlay) {
    legacyPlay.hidden = true;
    legacyPlay.style.display = 'none';
  }

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
  let tapSource = null;
  let pressTimer = null;
  let longFired = false;
  let pendingDelete = -1; // layer index armed for delete

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
    return ctx;
  }

  function stopTap() {
    try { tapSource?.disconnect(processor); } catch (_) {}
    try { processor?.disconnect(); } catch (_) {}
    try { silent?.disconnect(); } catch (_) {}
    tapSource = null;
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

  function deleteLayer(index) {
    const layer = layers[index];
    if (!layer) return;
    try { layer.source?.stop(); } catch (_) {}
    try { layer.gain.disconnect(); } catch (_) {}
    layers.splice(index, 1);
    pendingDelete = -1;
    renderCircles();
    setBtnState();
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((layer, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'looper-circle' + (layer.paused ? ' is-paused' : ' is-playing')
        + (pendingDelete === i ? ' is-deleting' : '');
      c.style.setProperty('--i', String(i));
      if (pendingDelete === i) {
        c.title = 'Tap again to delete layer ' + (i + 1);
      } else {
        c.title = layer.paused
          ? 'Play layer ' + (i + 1) + ' · hold to delete'
          : 'Pause layer ' + (i + 1) + ' · hold to delete';
      }
      c.setAttribute('aria-label', c.title);

      const num = document.createElement('span');
      num.className = 'looper-circle-num';
      num.textContent = String(i + 1);

      const icon = document.createElement('span');
      icon.className = 'looper-circle-icon ' + (layer.paused ? 'is-play' : 'is-pause');
      icon.setAttribute('aria-hidden', 'true');
      if (layer.paused) {
        icon.innerHTML = '<span class="looper-glyph-play"></span>';
      } else {
        icon.innerHTML = '<span class="looper-glyph-pause"><i></i><i></i></span>';
      }

      const del = document.createElement('span');
      del.className = 'looper-circle-delete';
      del.setAttribute('aria-hidden', 'true');
      del.innerHTML = '<span class="looper-circle-x"></span>';

      c.appendChild(num);
      c.appendChild(icon);
      c.appendChild(del);

      let holdTimer = null;
      let holdArmed = false;

      const clearHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      const armDelete = () => {
        holdArmed = true;
        pendingDelete = i;
        c.classList.add('is-deleting');
        c.title = 'Tap again to delete layer ' + (i + 1);
        c.setAttribute('aria-label', c.title);
        layersEl.querySelectorAll('.looper-circle.is-deleting').forEach((el) => {
          if (el !== c) el.classList.remove('is-deleting');
        });
        try {
          if (navigator.vibrate) navigator.vibrate(18);
        } catch (_) {}
      };

      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        holdArmed = false;
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
        clearHold();
        // Already showing X — second press will confirm; no new hold timer
        if (pendingDelete === i) return;
        holdTimer = setTimeout(armDelete, LONG_MS);
      });

      c.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearHold();
        try { c.releasePointerCapture(e.pointerId); } catch (_) {}

        // Second press on armed track → delete
        if (pendingDelete === i && !holdArmed) {
          pendingDelete = -1;
          deleteLayer(i);
          return;
        }

        // Hold completed → keep X, wait for second press
        if (holdArmed) {
          holdArmed = false;
          pendingDelete = i;
          return;
        }

        // Short tap elsewhere cancels pending delete
        if (pendingDelete !== -1 && pendingDelete !== i) {
          pendingDelete = -1;
          renderCircles();
        }

        toggleLayer(i);
      });

      c.addEventListener('pointercancel', () => {
        clearHold();
        holdArmed = false;
      });

      c.addEventListener('pointerleave', () => {
        if (!holdArmed) clearHold();
      });

      c.addEventListener('contextmenu', (e) => e.preventDefault());

      c.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      layersEl.appendChild(c);
    });
  }

  function startRecord() {
    if (layers.length >= MAX_LAYERS) return;
    const ctx = ensureTap();
    const source = typeof getRecordSource === 'function' ? getRecordSource() : getAudioMaster();
    if (!ctx || !source || !processor || !silent) return;
    stopTap();
    try {
      source.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);
      tapSource = source;
    } catch (err) {
      stopTap();
      console.warn('[looper] could not connect record tap', err);
      return;
    }
    resumeAudio();
    recChunks = [];
    recording = true;
    setBtnState();
  }

  function stopRecordAndPlay() {
    if (!recording) return;
    recording = false;
    stopTap();
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
    stopTap();
    recChunks = null;
    pendingDelete = -1;
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
    if (recording) stopRecordAndPlay();
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
    deleteLayer,
    get layerCount() { return layers.length; }
  };
}
