/**
 * looper.js — multi-layer phrase looper v3 (max 8)
 * Record: arm/stop layer (pre-FX instrument bus)
 * SYNC modes (cycle button, 4 segments above record):
 *   FREE  — independent lengths
 *   LOOP  — secondary tracks snap to exact multiples of layer-1 duration
 *   BEAT  — start/stop quantized to beat grid derived from layer 1
 *   SERIAL — tracks play one after another (song sections)
 * Circles: tap play/pause · long-press layer sheet (level/pan/mute/solo/delete)
 * Clear: wipe all layers
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const MAX_LAYERS = 8;
const LONG_MS = 480;
const DEFAULT_LEVEL = 0.92;
const BEATS_PER_BAR = 4;

const SYNC_MODES = [
  { id: 'free', label: 'FREE', title: 'Free — each layer independent' },
  { id: 'loop', label: 'LOOP', title: 'Loop sync — multiples of master length' },
  { id: 'beat', label: 'BEAT', title: 'Beat sync — quantize to master grid' },
  { id: 'serial', label: 'SERIAL', title: 'Serial — sections play in sequence' }
];

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  const btn = document.getElementById('looperBtn');
  const layersEl = document.getElementById('looperLayers');
  let clearBtn = document.getElementById('looperClearBtn');
  let syncBtn = document.getElementById('looperSyncBtn');
  if (!rail || !btn || !layersEl || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  const legacyPlay = document.getElementById('looperPlayBtn');
  if (legacyPlay) {
    legacyPlay.hidden = true;
    legacyPlay.style.display = 'none';
  }

  let cluster = document.getElementById('looperRecordCluster');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.id = 'looperRecordCluster';
    cluster.className = 'looper-record-cluster';
    btn.parentElement?.insertBefore(cluster, btn);
    cluster.appendChild(btn);
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

  const oldPulse = document.getElementById('looperPulseBtn');
  if (oldPulse) oldPulse.remove();

  if (!syncBtn) {
    syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.id = 'looperSyncBtn';
  }
  syncBtn.className = 'looper-sync-dial';
  syncBtn.innerHTML =
    '<span class="looper-sync-ring" aria-hidden="true">' +
    SYNC_MODES.map((m, i) =>
      `<span class="looper-sync-seg" data-mode="${m.id}" style="--seg:${i}"></span>`
    ).join('') +
    '</span>' +
    '<span class="looper-sync-core">' +
    '<span class="looper-sync-label" id="looperSyncLabel">FREE</span>' +
    '</span>';
  if (syncBtn.parentElement !== cluster) {
    cluster.insertBefore(syncBtn, btn);
  }
  syncBtn.setAttribute('aria-label', 'Sync mode: Free');
  syncBtn.title = SYNC_MODES[0].title;

  const layers = [];
  let recording = false;
  let recChunks = null;
  let processor = null;
  let silent = null;
  let tapSource = null;
  let pressTimer = null;
  let longFired = false;
  let openSheetIndex = -1;
  let sheetEl = null;
  let syncModeIndex = 0;
  let pendingLoopStop = false;
  let progressRaf = 0;

  function syncMode() {
    return SYNC_MODES[syncModeIndex].id;
  }

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
    if (processor && tapSource && tapSource !== bus) {
      try { tapSource.disconnect(processor); } catch (_) {}
      try { bus.connect(processor); } catch (_) {}
      tapSource = bus;
      return ctx;
    }
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

  function cycleDuration() {
    if (!layers.length || !layers[0].buffer) return 0;
    return layers[0].buffer.duration || 0;
  }

  function beatDuration() {
    const d = cycleDuration();
    if (d <= 0) return 0;
    return d / BEATS_PER_BAR;
  }

  function cyclePhase(now) {
    const L0 = layers[0];
    if (!L0 || !L0.buffer) return 0;
    const dur = L0.buffer.duration || 1;
    if (L0.paused) return (L0.offset || 0) % dur;
    const ctx = getAudioContext();
    if (!ctx) return 0;
    const t = now != null ? now : ctx.currentTime;
    return ((t - (L0.startedAt || t)) % dur + dur) % dur;
  }

  function anySolo() {
    return layers.some((l) => l.solo);
  }

  function effectiveMuted(layer) {
    if (layer.muted) return true;
    if (anySolo() && !layer.solo) return true;
    return false;
  }

  function applyLayerGain(layer) {
    if (!layer?.gain) return;
    const level = effectiveMuted(layer) ? 0 : (layer.level ?? DEFAULT_LEVEL);
    try {
      layer.gain.gain.setTargetAtTime(level, getAudioContext()?.currentTime || 0, 0.02);
    } catch (_) {
      layer.gain.gain.value = level;
    }
  }

  function refreshAllGains() {
    for (const layer of layers) applyLayerGain(layer);
  }

  function setBtnState() {
    const hasLayers = layers.length > 0;
    btn.classList.toggle('is-recording', recording);
    btn.classList.toggle('has-layers', hasLayers);
    btn.classList.toggle('is-pending-stop', pendingLoopStop);
    btn.title = recording
      ? (pendingLoopStop ? 'Waiting for cycle end…' : 'Stop recording layer')
      : layers.length >= MAX_LAYERS
        ? 'Max layers (' + MAX_LAYERS + ')'
        : hasLayers
          ? 'Record next layer'
          : 'Start loop recording';
    btn.setAttribute('aria-label', btn.title);
    clearBtn.classList.toggle('has-layers', hasLayers || recording);
    clearBtn.hidden = false;

    const mode = SYNC_MODES[syncModeIndex];
    syncBtn.dataset.mode = mode.id;
    syncBtn.classList.toggle('is-active', mode.id !== 'free');
    const label = syncBtn.querySelector('.looper-sync-label');
    if (label) label.textContent = mode.label;
    syncBtn.querySelectorAll('.looper-sync-seg').forEach((seg, i) => {
      seg.classList.toggle('is-lit', i === syncModeIndex);
    });
    syncBtn.setAttribute('aria-label', 'Sync mode: ' + mode.label);
    syncBtn.title = mode.title + ' · tap to change';
  }

  function startLayerSource(layer, offset) {
    const ctx = getAudioContext();
    if (!ctx || !layer.gain || layer.paused) return;
    try { layer.source?.stop(); } catch (_) {}
    const source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = syncMode() !== 'serial';
    source.connect(layer.gain);
    const off = Math.max(0, offset || 0) % (layer.buffer.duration || 1);
    source.start(0, off);
    layer.source = source;
    layer.offset = off;
    layer.startedAt = ctx.currentTime - off;

    if (syncMode() === 'serial') {
      source.loop = false;
      source.onended = () => {
        const idx = layers.indexOf(layer);
        if (idx < 0) return;
        layer.paused = true;
        layer.source = null;
        const next = (idx + 1) % layers.length;
        if (layers[next] && !layers[next].muted) {
          layers[next].paused = false;
          startLayerSource(layers[next], 0);
        }
        renderCircles();
      };
    }
  }

  function pauseLayer(index) {
    const layer = layers[index];
    if (!layer || layer.paused) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = layer.buffer.duration || 1;
    layer.offset = ((now - (layer.startedAt || now)) % dur + dur) % dur;
    try { layer.source?.stop(); } catch (_) {}
    layer.source = null;
    layer.paused = true;
    renderCircles();
  }

  function resumeLayer(index) {
    const layer = layers[index];
    if (!layer || !layer.paused) return;
    resumeAudio();
    if (syncMode() === 'serial') {
      layers.forEach((l, i) => {
        if (i !== index && !l.paused) pauseLayer(i);
      });
    }
    layer.paused = false;
    const mode = syncMode();
    let off = layer.offset || 0;
    if ((mode === 'loop' || mode === 'beat') && layers[0] && index > 0) {
      off = cyclePhase();
    }
    startLayerSource(layer, off);
    renderCircles();
  }

  function toggleLayer(index) {
    const layer = layers[index];
    if (!layer) return;
    if (layer.paused) resumeLayer(index);
    else pauseLayer(index);
  }

  function disconnectLayer(layer) {
    try { layer.source?.stop(); } catch (_) {}
    try { layer.gain?.disconnect(); } catch (_) {}
    try { layer.panner?.disconnect(); } catch (_) {}
    layer.source = null;
  }

  function deleteLayer(index) {
    const layer = layers[index];
    if (!layer) return;
    disconnectLayer(layer);
    layers.splice(index, 1);
    if (openSheetIndex === index) closeSheet();
    else if (openSheetIndex > index) openSheetIndex -= 1;
    renderCircles();
    setBtnState();
    refreshAllGains();
  }

  function trimOrPadBuffer(ctx, buffer, targetDur) {
    if (!buffer || !targetDur || targetDur <= 0) return buffer;
    const rate = buffer.sampleRate;
    const targetFrames = Math.max(1, Math.round(targetDur * rate));
    const srcFrames = buffer.length;
    if (srcFrames === targetFrames) return buffer;
    const out = ctx.createBuffer(2, targetFrames, rate);
    for (let ch = 0; ch < 2; ch++) {
      const src = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
      const dst = out.getChannelData(ch);
      if (srcFrames >= targetFrames) dst.set(src.subarray(0, targetFrames));
      else dst.set(src);
    }
    return out;
  }

  function snapToLoopMultiple(dur) {
    const master = cycleDuration();
    if (master <= 0.05) return dur;
    const n = Math.max(1, Math.round(dur / master));
    return n * master;
  }

  function snapToBeats(dur) {
    const beat = beatDuration();
    if (beat <= 0.02) return dur;
    const n = Math.max(1, Math.round(dur / beat));
    return n * beat;
  }

  function closeSheet() {
    if (sheetEl) {
      try { sheetEl.remove(); } catch (_) {}
      sheetEl = null;
    }
    openSheetIndex = -1;
    document.querySelectorAll('.looper-circle.is-sheet-open').forEach((el) => {
      el.classList.remove('is-sheet-open');
    });
  }

  function openSheet(index, anchorEl) {
    closeSheet();
    const layer = layers[index];
    if (!layer || !anchorEl) return;
    openSheetIndex = index;
    anchorEl.classList.add('is-sheet-open');

    const sheet = document.createElement('div');
    sheet.className = 'looper-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Layer ' + (index + 1) + ' controls');

    const title = document.createElement('div');
    title.className = 'looper-sheet-title';
    title.textContent = 'Layer ' + (index + 1);

    const levelRow = document.createElement('label');
    levelRow.className = 'looper-sheet-row';
    levelRow.innerHTML = '<span>Level</span>';
    const levelInput = document.createElement('input');
    levelInput.type = 'range';
    levelInput.min = '0';
    levelInput.max = '100';
    levelInput.value = String(Math.round((layer.level ?? DEFAULT_LEVEL) * 100));
    levelInput.setAttribute('aria-label', 'Layer level');
    levelInput.addEventListener('input', () => {
      layer.level = Number(levelInput.value) / 100;
      applyLayerGain(layer);
    });
    levelRow.appendChild(levelInput);

    const panRow = document.createElement('label');
    panRow.className = 'looper-sheet-row';
    panRow.innerHTML = '<span>Pan</span>';
    const panInput = document.createElement('input');
    panInput.type = 'range';
    panInput.min = '-100';
    panInput.max = '100';
    panInput.value = String(Math.round((layer.pan ?? 0) * 100));
    panInput.setAttribute('aria-label', 'Layer pan');
    panInput.addEventListener('input', () => {
      layer.pan = Number(panInput.value) / 100;
      if (layer.panner) {
        try { layer.panner.pan.value = layer.pan; } catch (_) {}
      }
    });
    panRow.appendChild(panInput);

    const actions = document.createElement('div');
    actions.className = 'looper-sheet-actions';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'looper-sheet-btn' + (layer.muted ? ' is-active' : '');
    muteBtn.textContent = 'Mute';
    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'looper-sheet-btn' + (layer.solo ? ' is-active' : '');
    soloBtn.textContent = 'Solo';
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.muted = !layer.muted;
      if (layer.muted) layer.solo = false;
      muteBtn.classList.toggle('is-active', layer.muted);
      soloBtn.classList.toggle('is-active', layer.solo);
      applyLayerGain(layer);
      refreshAllGains();
      renderCircles();
    });
    soloBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.solo = !layer.solo;
      if (layer.solo) layer.muted = false;
      soloBtn.classList.toggle('is-active', layer.solo);
      muteBtn.classList.toggle('is-active', layer.muted);
      refreshAllGains();
      renderCircles();
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'looper-sheet-btn is-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheet();
      deleteLayer(index);
    });
    actions.appendChild(muteBtn);
    actions.appendChild(soloBtn);
    actions.appendChild(delBtn);

    sheet.appendChild(title);
    sheet.appendChild(levelRow);
    sheet.appendChild(panRow);
    sheet.appendChild(actions);
    document.body.appendChild(sheet);
    sheetEl = sheet;

    const rect = anchorEl.getBoundingClientRect();
    const sw = sheet.offsetWidth || 180;
    const sh = sheet.offsetHeight || 160;
    let left = rect.left - sw - 10;
    if (left < 8) left = rect.right + 10;
    let top = rect.top + rect.height / 2 - sh / 2;
    top = Math.max(8, Math.min(window.innerHeight - sh - 8, top));
    sheet.style.left = left + 'px';
    sheet.style.top = top + 'px';

    const onDoc = (e) => {
      if (sheet.contains(e.target) || anchorEl.contains(e.target)) return;
      closeSheet();
      document.removeEventListener('pointerdown', onDoc, true);
    };
    setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  }

  function updateProgressRings() {
    const ctx = getAudioContext();
    if (recording && pendingLoopStop && layers.length) {
      const ph = cyclePhase();
      const d = cycleDuration();
      if (d > 0 && (ph < 0.05 || ph > d - 0.04)) {
        pendingLoopStop = false;
        finishRecord();
      }
    }
    if (!ctx || !layers.length) {
      progressRaf = requestAnimationFrame(updateProgressRings);
      return;
    }
    const circles = layersEl.querySelectorAll('.looper-circle');
    layers.forEach((layer, i) => {
      const el = circles[i];
      if (!el || layer.paused || !layer.buffer) return;
      const dur = layer.buffer.duration || 1;
      const elapsed = ((ctx.currentTime - (layer.startedAt || ctx.currentTime)) % dur + dur) % dur;
      el.style.setProperty('--progress', String(elapsed / dur));
    });
    progressRaf = requestAnimationFrame(updateProgressRings);
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((layer, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'looper-circle'
        + (layer.paused ? ' is-paused' : ' is-playing')
        + (layer.muted || effectiveMuted(layer) ? ' is-muted' : '')
        + (layer.solo ? ' is-solo' : '')
        + (i === 0 ? ' is-master' : '');
      c.style.setProperty('--i', String(i));
      c.title = layer.paused
        ? 'Play layer ' + (i + 1) + ' · hold for mix'
        : 'Pause layer ' + (i + 1) + ' · hold for mix';
      c.setAttribute('aria-label', c.title);

      const ring = document.createElement('span');
      ring.className = 'looper-circle-progress';
      ring.setAttribute('aria-hidden', 'true');
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
      c.appendChild(ring);
      c.appendChild(num);
      c.appendChild(icon);

      let holdTimer = null;
      let holdArmed = false;
      const clearHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        holdArmed = false;
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
        clearHold();
        holdTimer = setTimeout(() => {
          holdArmed = true;
          openSheet(i, c);
          try {
            if (navigator.vibrate) navigator.vibrate(12);
          } catch (_) {}
        }, LONG_MS);
      });
      c.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearHold();
        try { c.releasePointerCapture(e.pointerId); } catch (_) {}
        if (holdArmed) {
          holdArmed = false;
          return;
        }
        if (openSheetIndex === i) return;
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
    if (!ctx) return;
    resumeAudio();
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    ensureTap();
    recChunks = [];
    recording = true;
    pendingLoopStop = false;
    setBtnState();
  }

  function requestStopRecord() {
    if (!recording) return;
    const mode = syncMode();
    if (mode === 'loop' && layers.length > 0 && cycleDuration() > 0.2) {
      pendingLoopStop = true;
      setBtnState();
      return;
    }
    finishRecord();
  }

  function finishRecord() {
    if (!recording && !pendingLoopStop) return;
    recording = false;
    pendingLoopStop = false;
    const ctx = getAudioContext();
    const master = getAudioMaster();
    const chunks = recChunks;
    recChunks = null;
    setBtnState();
    if (!ctx || !master || !chunks || chunks.length < 2) return;

    let frameCount = chunks.reduce((n, c) => n + c.L.length, 0);
    let buffer = ctx.createBuffer(2, frameCount, ctx.sampleRate);
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    let offset = 0;
    for (const c of chunks) {
      ch0.set(c.L, offset);
      ch1.set(c.R, offset);
      offset += c.L.length;
    }

    const mode = syncMode();
    let startOff = 0;
    const rawDur = buffer.duration;

    if (mode === 'loop' && layers.length > 0) {
      const target = snapToLoopMultiple(rawDur);
      buffer = trimOrPadBuffer(ctx, buffer, target);
      startOff = cyclePhase(ctx.currentTime);
    } else if (mode === 'beat' && layers.length > 0) {
      const target = snapToBeats(rawDur);
      buffer = trimOrPadBuffer(ctx, buffer, target);
      const beat = beatDuration();
      const ph = cyclePhase(ctx.currentTime);
      if (beat > 0) {
        startOff = Math.round(ph / beat) * beat;
        startOff = startOff % (cycleDuration() || target || 1);
      }
    } else if (mode === 'serial' && layers.length > 0) {
      layers.forEach((l, i) => {
        if (!l.paused) pauseLayer(i);
      });
    }

    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    const gain = ctx.createGain();
    gain.gain.value = DEFAULT_LEVEL;
    gain.connect(panner);
    panner.connect(master);

    const layer = {
      buffer,
      source: null,
      gain,
      panner,
      level: DEFAULT_LEVEL,
      pan: 0,
      muted: false,
      solo: false,
      startedAt: ctx.currentTime,
      offset: 0,
      paused: false
    };
    layers.push(layer);
    applyLayerGain(layer);
    startLayerSource(layer, startOff);
    renderCircles();
    setBtnState();
  }

  function clearAll() {
    recording = false;
    pendingLoopStop = false;
    recChunks = null;
    closeSheet();
    for (const layer of layers) disconnectLayer(layer);
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
    if (recording || pendingLoopStop) requestStopRecord();
    else startRecord();
  }

  function cycleSyncMode() {
    syncModeIndex = (syncModeIndex + 1) % SYNC_MODES.length;
    if (syncMode() === 'serial' && layers.length) {
      let found = false;
      layers.forEach((l, i) => {
        if (!l.paused && !found) {
          found = true;
        } else if (!l.paused) {
          pauseLayer(i);
        }
      });
    } else {
      layers.forEach((l, i) => {
        if (!l.paused) {
          const off = cyclePhase();
          startLayerSource(l, i === 0 ? (l.offset || 0) : off);
        }
      });
    }
    setBtnState();
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (_) {}
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

  syncBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cycleSyncMode();
  });

  setBtnState();
  renderCircles();
  progressRaf = requestAnimationFrame(updateProgressRings);

  return {
    clearAll,
    toggleLayer,
    deleteLayer,
    get layerCount() { return layers.length; },
    get syncMode() { return syncMode(); },
    setSyncMode(id) {
      const i = SYNC_MODES.findIndex((m) => m.id === id);
      if (i >= 0) {
        syncModeIndex = i;
        setBtnState();
      }
    },
    get cycleDuration() { return cycleDuration(); }
  };
}
