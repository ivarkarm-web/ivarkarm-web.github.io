/**
 * looper.js — four-layer phrase looper v3
 * Record: arm/stop layer (pre-FX instrument bus)
 * Recording uses optional count-in, metronome and tempo controls:
 *   FREE  — independent lengths
 *   LOOP  — secondary tracks snap to exact multiples of layer-1 duration
 *   BEAT  — start/stop quantized to beat grid derived from layer 1
 *   SERIAL — tracks play one after another (song sections)
 * Circles: tap play/pause · double-tap opens track controls · hold asks to confirm delete
 * Clear: wipe all layers
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const MAX_LAYERS = 4;
const LONG_MS = 480;
const DEFAULT_LEVEL = 0.92;
const BEATS_PER_BAR = 4;
const CLICK_TYPES = [
  { id:'woodblock', label:'Woodblock', wave:'triangle', frequency:1450, duration:.045 },
  { id:'soft-wood', label:'Soft Wood', wave:'sine', frequency:950, duration:.055 },
  { id:'rim-click', label:'Rim Click', wave:'square', frequency:2100, duration:.022 },
  { id:'handpan-tap', label:'Handpan Tap', wave:'sine', frequency:520, duration:.11 },
  { id:'bell', label:'Bell', wave:'sine', frequency:1760, duration:.16 },
  { id:'shaker', label:'Shaker', wave:'sawtooth', frequency:4200, duration:.018 },
  { id:'tick', label:'Soft Tick', wave:'square', frequency:1200, duration:.012 },
  { id:'clave', label:'Clave', wave:'triangle', frequency:2500, duration:.03 },
  { id:'low-pulse', label:'Low Pulse', wave:'sine', frequency:180, duration:.08 },
  { id:'digital', label:'Digital Click', wave:'square', frequency:3000, duration:.018 },
];

const SYNC_MODES = [
  { id: 'free', label: 'FREE', title: 'Free — each layer independent' },
  { id: 'loop', label: 'LOOP', title: 'Loop sync — multiples of master length' },
  { id: 'beat', label: 'BEAT', title: 'Beat sync — quantize to master grid' },
  { id: 'serial', label: 'SERIAL', title: 'Serial — sections play in sequence' }
];

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  if (!rail || rail.dataset.mounted === '1') return null;

  // Ensure required controls exist (shell may only ship the rail + clear).
  let btn = document.getElementById('looperBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'looperBtn';
    rail.appendChild(btn);
  }
  // Always restore record chrome — shell may ship an empty <button id="looperBtn">.
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
  let syncBtn = document.getElementById('looperSyncBtn');
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
  }
  if (clearBtn.parentElement !== rail) rail.insertBefore(clearBtn, rail.firstChild);
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
  // Retain the internal FREE sync state for legacy recorded tracks, but replace
  // the visible sync dial with the Count-in control requested for this workflow.
  syncBtn.className = 'looper-sync-dial';
  syncBtn.hidden = true;
  syncBtn.setAttribute('aria-hidden', 'true');
  syncBtn.innerHTML = '<span class="looper-sync-label">FREE</span>';
  if (syncBtn.parentElement !== cluster) cluster.insertBefore(syncBtn, btn);

  function ensureTimingButton(id, className, aria, html) {
    let control = document.getElementById(id);
    if (!control) { control = document.createElement('button'); control.type = 'button'; control.id = id; }
    control.className = 'looper-timing-btn ' + className;
    control.hidden = false;
    control.removeAttribute('hidden');
    control.style.removeProperty('display');
    control.setAttribute('aria-label', aria);
    control.title = aria;
    control.innerHTML = html;
    return control;
  }
  const countInBtn = ensureTimingButton('looperCountInBtn','looper-count-in-btn','Toggle count-in','<svg class="looper-icon looper-countin-icon" viewBox="0 0 18 16" aria-hidden="true"><path d="M2 12V8M6.7 12V4M11.3 12V6M16 12V2.5" /><path d="M1 14.2H17" /></svg><span class="looper-timing-main">1·2·3·4</span>');
  const metronomeBtn = ensureTimingButton('looperMetronomeBtn','looper-metronome-btn','Toggle metronome','<svg class="looper-icon looper-metronome-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 15.5 7.2 2.5h3.6L13 15.5Z"/><path d="M9 4.3 12.1 7.1M9 4.3 8 10.4"/><circle cx="8" cy="10.4" r="1.15" /></svg><span class="looper-timing-led" aria-hidden="true"></span>');
  const bpmBtn = ensureTimingButton('looperBpmBtn','looper-bpm-btn','Tempo settings','<svg class="looper-icon looper-tempo-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.1 12.8a7 7 0 1 1 11.8 0"/><path d="M9 9 12.3 5.8"/><circle cx="9" cy="9" r="1.1"/><path d="M4.7 12.8h8.6"/></svg><span class="looper-bpm-value">90</span><span class="looper-bpm-unit">BPM</span>');
  // Keep every transport control in the same flex row. The previous version
  // placed timing/save buttons outside the cluster, so the sizing/layout rules
  // missed them and the row wrapped on mobile.
  let utilityGroup = document.getElementById('looperUtilityControls');
  if (!utilityGroup) {
    utilityGroup = document.createElement('div');
    utilityGroup.id = 'looperUtilityControls';
    utilityGroup.className = 'looper-utility-controls';
  }
  if (utilityGroup.parentElement !== rail) rail.insertBefore(utilityGroup, cluster.parentElement === rail ? cluster : null);
  [countInBtn, metronomeBtn, bpmBtn].forEach((control) => utilityGroup.appendChild(control));
  if (btn.parentElement !== cluster) cluster.appendChild(btn);
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
  let pendingTap = null;
  let trackPanelEl = null;
  let trackPanelKeyHandler = null;
  let trackPanelProgressTimer = null;
  let openSheetIndex = -1;
  let sheetEl = null;
  let sheetPointerHandler = null;
  let sheetKeyHandler = null;
  // LOOP is the default: the first recorded phrase becomes the master clock.
  let syncModeIndex = 1;
  let pendingLoopStop = false;
  let progressRaf = 0;
  let countInEnabled = false;
  let countInBars = 1;
  let countInPending = false;
  let countInCurrent = 0;
  let countInTimer = null;
  let metronomeOn = false;
  let metronomeTimer = null;
  let bpm = 90;
  let beatsPerBar = 4;
  let clickType = 'woodblock';
  let lastTapTimes = [];
  let timingMenu = null;
  let timingMenuType = null;
  let timingPressTimer = null;
  let timingLongFired = false;
  let bpmPointer = null;

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
    countInBtn.classList.toggle('is-active', countInEnabled);
    countInBtn.classList.toggle('is-counting', countInPending);
    const countLabel = countInBtn.querySelector('.looper-timing-main');
    if (countLabel) countLabel.textContent = countInPending ? String(countInCurrent || '•') : '1·2·3·4';
    countInBtn.setAttribute('aria-pressed', String(countInEnabled));
    countInBtn.title = countInEnabled ? 'Count-in on · hold for settings' : 'Count-in off · hold for settings';
    metronomeBtn.classList.toggle('is-active', metronomeOn);
    metronomeBtn.setAttribute('aria-pressed', String(metronomeOn));
    metronomeBtn.title = metronomeOn ? 'Metronome on · hold for click sounds' : 'Metronome off · hold for click sounds';
    const bpmValue = bpmBtn.querySelector('.looper-bpm-value');
    if (bpmValue) bpmValue.textContent = String(Math.round(bpm));
    bpmBtn.title = 'Tempo ' + Math.round(bpm) + ' BPM · drag to adjust, hold for settings';
  }

  function startLayerSource(layer, offset, delaySeconds = 0) {
    const ctx = getAudioContext();
    if (!ctx || !layer.gain || layer.paused) return;
    try { layer.source?.stop(); } catch (_) {}
    const source = ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = syncMode() !== 'serial';
    source.connect(layer.gain);
    const off = Math.max(0, offset || 0) % (layer.buffer.duration || 1);
    const startAt = ctx.currentTime + Math.max(0, delaySeconds || 0);
    source.start(startAt, off);
    layer.source = source;
    layer.offset = off;
    layer.startedAt = startAt - off;

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
    layer.offset = layer.startedAt > now ? 0 : ((now - (layer.startedAt || now)) % dur + dur) % dur;
    try { layer.source?.stop(); } catch (_) {}
    layer.source = null;
    layer.paused = true;
    renderCircles();
  }

  function quantizeWait(layer) {
    const ctx = getAudioContext();
    const mode = layer?.quantize || 'off';
    if (!ctx || mode === 'off' || !layers[0] || cycleDuration() <= 0) return 0;
    const beat = beatDuration();
    const grid = mode === 'beat' ? beat : mode === 'eighth' ? beat / 2 : beat / 4;
    if (!grid || grid <= 0.01) return 0;
    const phase = cyclePhase(ctx.currentTime);
    return (grid - (phase % grid)) % grid;
  }

  function resumeLayer(index) {
    const layer = layers[index];
    if (!layer || !layer.paused) return;
    resumeAudio();
    if (syncMode() === 'serial') {
      layers.forEach((l, i) => { if (i !== index && !l.paused) pauseLayer(i); });
    }
    layer.paused = false;
    const mode = syncMode();
    let off = layer.offset || 0;
    if ((mode === 'loop' || mode === 'beat') && layers[0] && index > 0) off = cyclePhase();
    startLayerSource(layer, off, quantizeWait(layer));
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
    for (const node of [layer.gain, layer.filter, layer.delay, layer.feedback, layer.delayWet, layer.panner]) {
      try { node?.disconnect(); } catch (_) {}
    }
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

  function formatLoopTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(safe / 60) + ':' + String(safe % 60).padStart(2, '0');
  }

  function closeTrackPanel() {
    if (trackPanelKeyHandler) {
      document.removeEventListener('keydown', trackPanelKeyHandler);
      trackPanelKeyHandler = null;
    }
    if (trackPanelProgressTimer) { clearInterval(trackPanelProgressTimer); trackPanelProgressTimer = null; }
    if (trackPanelEl) {
      window.removeEventListener('resize', trackPanelEl._placePanel);
      window.removeEventListener('scroll', trackPanelEl._placePanel, true);
      trackPanelEl.remove();
      trackPanelEl = null;
    }
  }

  function openTrackPanel(index, anchor = null) {
    const layer = layers[index];
    if (!layer) return;
    closeSheet();
    closeTrackPanel();
    const overlay = document.createElement('div');
    overlay.className = 'looper-track-overlay is-floating';
    overlay.innerHTML = `
      <section class="looper-track-panel" role="dialog" aria-modal="false" aria-label="Track ${index + 1} controls">
        <header class="looper-track-header">
          <div><div class="looper-track-eyebrow">PIONIER · LOOP MIXER</div><h2>Track ${index + 1}</h2><p>${(layer.buffer.duration || 0).toFixed(1)} sec loop</p></div>
          <button type="button" class="looper-track-close" aria-label="Close track controls">×</button>
        </header>
        <div class="looper-track-transport"><button type="button" class="looper-track-play"></button><span class="looper-track-status"></span></div>
        <div class="looper-waveform-wrap">
          <canvas class="looper-waveform" aria-label="Recorded audio waveform" role="img"></canvas>
          <div class="looper-waveform-scrub"><input data-control="position" aria-label="Track playback position" type="range" min="0" max="${Math.max(0.01, layer.buffer.duration || 0.01)}" step="0.01"></div>
          <div class="looper-track-position"><output class="looper-track-elapsed">0:00</output><span>/</span><span class="looper-track-duration">${formatLoopTime(layer.buffer.duration || 0)}</span></div>
          <button type="button" class="looper-crop-toggle" aria-expanded="false">Crop</button>
          <div class="looper-crop-editor" hidden>
            <p class="looper-crop-hint">Drag either edge to trim the beginning or end</p>
            <div class="looper-crop-range">
              <input data-control="crop-start" aria-label="Crop beginning" type="range" min="0" max="${Math.max(0.01, layer.buffer.duration || 0.01)}" step="0.01" value="0">
              <input data-control="crop-end" aria-label="Crop end" type="range" min="0" max="${Math.max(0.01, layer.buffer.duration || 0.01)}" step="0.01" value="${Math.max(0.01, layer.buffer.duration || 0.01)}">
            </div>
            <div class="looper-crop-times"><span>In <output data-output="crop-start">0:00</output></span><span>Out <output data-output="crop-end">${formatLoopTime(layer.buffer.duration || 0)}</output></span></div>
            <div class="looper-crop-actions"><button type="button" data-action="crop-cancel">Cancel</button><button type="button" data-action="crop-apply">Apply crop</button></div>
          </div>
        </div>
        <div class="looper-knob-grid">
          <div class="looper-knob-control"><span class="looper-knob-label">Track level</span><button type="button" class="looper-knob" data-control="level" role="slider" aria-label="Track level" aria-valuemin="0" aria-valuemax="1"><span class="looper-knob-face"><i></i></span></button><output class="looper-knob-value" data-output="level"></output></div>
          <div class="looper-knob-control"><span class="looper-knob-label">Master output</span><button type="button" class="looper-knob" data-control="master" role="slider" aria-label="Master output" aria-valuemin="0" aria-valuemax="1.5"><span class="looper-knob-face"><i></i></span></button><output class="looper-knob-value" data-output="master"></output></div>
          <div class="looper-knob-control"><span class="looper-knob-label">Delay send</span><button type="button" class="looper-knob" data-control="delay" role="slider" aria-label="Delay send" aria-valuemin="0" aria-valuemax="0.75"><span class="looper-knob-face"><i></i></span></button><output class="looper-knob-value" data-output="delay"></output></div>
          <div class="looper-knob-control"><span class="looper-knob-label">Low-pass cut</span><button type="button" class="looper-knob" data-control="cut" role="slider" aria-label="Low-pass cutoff" aria-valuemin="300" aria-valuemax="20000"><span class="looper-knob-face"><i></i></span></button><output class="looper-knob-value" data-output="cut"></output></div>
        </div>
        <div class="looper-track-control looper-track-quantize"><label for="track-quantize-${index}"><span>Quantize on resume</span></label><select id="track-quantize-${index}" data-control="quantize"><option value="off">Off</option><option value="beat">Beat</option><option value="eighth">1/8 note</option><option value="sixteenth">1/16 note</option></select></div>
        <footer class="looper-track-footer"><button type="button" class="looper-track-mute"></button><button type="button" class="looper-track-delete">Delete track</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    trackPanelEl = overlay;
    const panel = overlay.querySelector('.looper-track-panel');
    const close = () => closeTrackPanel();
    const placePanel = () => {
      const target = anchor?.isConnected ? anchor : document.querySelectorAll('.looper-circle')[index];
      if (!target || !panel) return;
      const rect = target.getBoundingClientRect();
      const margin = 10;
      const width = Math.min(320, window.innerWidth - margin * 2);
      panel.style.width = width + 'px';
      panel.style.maxHeight = Math.max(180, window.innerHeight - margin * 2) + 'px';
      const panelHeight = Math.min(panel.scrollHeight || 420, window.innerHeight - margin * 2);
      let left = rect.right + 10;
      if (left + width > window.innerWidth - margin) left = rect.left - width - 10;
      if (left < margin) left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left + rect.width / 2 - width / 2));
      let top = rect.top + rect.height / 2 - panelHeight / 2;
      top = Math.max(margin, Math.min(window.innerHeight - panelHeight - margin, top));
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    };
    placePanel();
    requestAnimationFrame(placePanel);
    overlay._placePanel = placePanel;
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    overlay.addEventListener('pointerdown', event => { if (event.target === overlay) close(); });
    const trackCloseButton = overlay.querySelector('.looper-track-close');
    trackCloseButton.style.pointerEvents = 'auto';
    trackCloseButton.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); closeTrackPanel(); }, { capture: true });
    trackCloseButton.addEventListener('pointerup', event => { event.preventDefault(); event.stopPropagation(); closeTrackPanel(); });
    trackCloseButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); close(); });
    const play = overlay.querySelector('.looper-track-play');
    const status = overlay.querySelector('.looper-track-status');
    const updateTransport = () => {
      const current = layers[index];
      if (!current) return;
      play.textContent = current.paused ? '▶  Play track' : 'Ⅱ  Pause track';
      status.textContent = current.paused ? 'PAUSED' : 'PLAYING';
    };
    play.addEventListener('click', () => { toggleLayer(index); updateTransport(); });
    const position = panel.querySelector('[data-control="position"]');
    const elapsed = panel.querySelector('.looper-track-elapsed');
    const waveform = panel.querySelector('.looper-waveform');
    let duration = Math.max(0.01, layer.buffer.duration || 0.01);
    let waveformPeaks = [];
    let waveformPeakWidth = 0;
    let cropStart = 0;
    let cropEnd = duration;
    const drawWaveform = (playhead = 0) => {
      if (!waveform) return;
      const rect = waveform.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (waveform.width !== width || waveform.height !== height) { waveform.width = width; waveform.height = height; }
      const ctx2d = waveform.getContext('2d');
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, width, height);
      const mid = height / 2;
      ctx2d.strokeStyle = 'rgba(232,220,177,.12)';
      ctx2d.lineWidth = 1 * dpr;
      ctx2d.beginPath(); ctx2d.moveTo(0, mid); ctx2d.lineTo(width, mid); ctx2d.stroke();
      const samples = layer.buffer.getChannelData(0);
      const bins = Math.max(1, Math.floor(width / (2 * dpr)));
      if (waveformPeakWidth !== bins || waveformPeaks.length !== bins) {
        waveformPeaks = new Array(bins);
        const step = Math.max(1, Math.floor(samples.length / bins));
        for (let x = 0; x < bins; x++) {
          let peak = 0;
          const start = x * step;
          const end = Math.min(samples.length, start + step);
          for (let n = start; n < end; n++) peak = Math.max(peak, Math.abs(samples[n]));
          waveformPeaks[x] = peak;
        }
        waveformPeakWidth = bins;
      }
      for (let x = 0; x < bins; x++) {
        const bar = Math.max(1.2 * dpr, waveformPeaks[x] * height * .78);
        const px = x * width / bins;
        const t = (x / bins) * duration;
        const insideCrop = t >= cropStart && t <= cropEnd;
        ctx2d.fillStyle = insideCrop
          ? (px <= (playhead / duration) * width ? 'rgba(246,218,132,.98)' : 'rgba(210,190,125,.72)')
          : 'rgba(15,15,18,.48)';
        ctx2d.fillRect(px, mid - bar / 2, Math.max(1, width / bins * .58), bar);
      }
      if (panel.classList.contains('is-cropping')) {
        ctx2d.fillStyle = 'rgba(4,5,8,.52)';
        ctx2d.fillRect(0, 0, cropStart / duration * width, height);
        ctx2d.fillRect(cropEnd / duration * width, 0, width - cropEnd / duration * width, height);
        ctx2d.fillStyle = '#ffe7a1';
        ctx2d.fillRect(cropStart / duration * width - dpr, 0, 2 * dpr, height);
        ctx2d.fillRect(cropEnd / duration * width - dpr, 0, 2 * dpr, height);
      }
      const headX = Math.max(0, Math.min(width, (playhead / duration) * width));
      ctx2d.fillStyle = '#fff2bd';
      ctx2d.fillRect(headX - dpr, 0, 2 * dpr, height);
    };
    const updatePosition = () => {
      const ctx = getAudioContext();
      const value = layer.paused || !ctx ? (layer.offset || 0) : layer.startedAt > ctx.currentTime ? 0 : ((ctx.currentTime - layer.startedAt) % duration + duration) % duration;
      if (document.activeElement !== position) position.value = String(Math.min(duration, value));
      elapsed.textContent = formatLoopTime(value);
      drawWaveform(value);
      updateTransport();
    };
    position.addEventListener('input', () => { elapsed.textContent = formatLoopTime(Number(position.value)); drawWaveform(Number(position.value)); });
    position.addEventListener('change', () => {
      layer.offset = Math.min(duration, Math.max(0, Number(position.value) || 0));
      if (!layer.paused) startLayerSource(layer, layer.offset);
      updatePosition();
    });
    const cropToggle = panel.querySelector('.looper-crop-toggle');
    const cropEditor = panel.querySelector('.looper-crop-editor');
    const cropStartInput = panel.querySelector('[data-control="crop-start"]');
    const cropEndInput = panel.querySelector('[data-control="crop-end"]');
    const cropStartOutput = panel.querySelector('[data-output="crop-start"]');
    const cropEndOutput = panel.querySelector('[data-output="crop-end"]');
    const updateCropPreview = () => {
      cropStart = Math.max(0, Math.min(duration, Number(cropStartInput.value) || 0));
      cropEnd = Math.max(0, Math.min(duration, Number(cropEndInput.value) || duration));
      if (cropEnd - cropStart < 0.1) {
        if (document.activeElement === cropStartInput) {
          cropStart = Math.max(0, cropEnd - 0.1);
          cropStartInput.value = String(cropStart);
        } else {
          cropEnd = Math.min(duration, cropStart + 0.1);
          cropEndInput.value = String(cropEnd);
        }
      }
      cropStartOutput.textContent = formatLoopTime(cropStart);
      cropEndOutput.textContent = formatLoopTime(cropEnd);
      drawWaveform(0);
    };
    const setCropMode = enabled => {
      panel.classList.toggle('is-cropping', enabled);
      cropEditor.hidden = !enabled;
      cropToggle.setAttribute('aria-expanded', String(enabled));
      cropToggle.classList.toggle('is-active', enabled);
      cropToggle.textContent = enabled ? 'Close crop' : 'Crop';
      if (!enabled) { cropStart = 0; cropEnd = duration; drawWaveform(0); }
    };
    cropToggle.addEventListener('click', () => {
      if (cropEditor.hidden) {
        cropStartInput.value = '0';
        cropEndInput.value = String(duration);
        updateCropPreview();
        setCropMode(true);
      } else setCropMode(false);
    });
    cropStartInput.addEventListener('input', updateCropPreview);
    cropEndInput.addEventListener('input', updateCropPreview);
    panel.querySelector('[data-action="crop-cancel"]').addEventListener('click', () => setCropMode(false));
    panel.querySelector('[data-action="crop-apply"]').addEventListener('click', () => {
      const ctx = getAudioContext();
      if (!ctx || !layer.buffer) return;
      const start = Math.max(0, Math.min(duration, cropStart));
      const end = Math.max(start + 0.1, Math.min(duration, cropEnd));
      const startFrame = Math.min(layer.buffer.length - 1, Math.floor(start * layer.buffer.sampleRate));
      const endFrame = Math.max(startFrame + 1, Math.min(layer.buffer.length, Math.floor(end * layer.buffer.sampleRate)));
      const nextBuffer = ctx.createBuffer(layer.buffer.numberOfChannels, endFrame - startFrame, layer.buffer.sampleRate);
      for (let channel = 0; channel < layer.buffer.numberOfChannels; channel++) {
        nextBuffer.copyToChannel(layer.buffer.getChannelData(channel).subarray(startFrame, endFrame), channel);
      }
      const wasPlaying = !layer.paused;
      if (wasPlaying) pauseLayer(index);
      layer.buffer = nextBuffer;
      layer.offset = 0;
      const nextDuration = Math.max(0.01, nextBuffer.duration || 0.01);
      duration = nextDuration;
      const titleDuration = panel.querySelector('.looper-track-header p');
      if (titleDuration) titleDuration.textContent = nextBuffer.duration.toFixed(1) + ' sec loop';
      panel.querySelector('.looper-track-duration').textContent = formatLoopTime(nextDuration);
      position.max = String(nextDuration);
      cropStartInput.max = String(nextDuration);
      cropEndInput.max = String(nextDuration);
      waveformPeaks = [];
      waveformPeakWidth = 0;
      cropStart = 0;
      cropEnd = nextDuration;
      if (wasPlaying) { layer.paused = false; startLayerSource(layer, 0); }
      setCropMode(false);
      updatePosition();
      renderCircles();
    });
    const addKnob = (name, value, min, max, format, apply, scale = 1) => {
      const knob = panel.querySelector(`[data-control="${name}"]`);
      const output = panel.querySelector(`[data-output="${name}"]`);
      const set = raw => {
        const next = Math.max(min, Math.min(max, Number(raw)));
        knob.dataset.value = String(next);
        knob.style.setProperty('--knob-angle', `${-135 + ((next - min) / (max - min)) * 270}deg`);
        knob.setAttribute('aria-valuenow', String(next));
        knob.setAttribute('aria-valuetext', format(next));
        output.textContent = format(next);
        apply(next);
      };
      set(value);
      let dragY = 0, dragValue = value;
      knob.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        dragY = event.clientY;
        dragValue = Number(knob.dataset.value);
        knob.setPointerCapture?.(event.pointerId);
      });
      knob.addEventListener('pointermove', event => {
        if (!knob.hasPointerCapture?.(event.pointerId)) return;
        set(dragValue + (dragY - event.clientY) * (max - min) / (140 * scale));
      });
      knob.addEventListener('keydown', event => {
        let next = Number(knob.dataset.value);
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next += (max - min) / 100;
        else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next -= (max - min) / 100;
        else if (event.key === 'Home') next = min;
        else if (event.key === 'End') next = max;
        else return;
        event.preventDefault(); set(next);
      });
    };
    trackPanelProgressTimer = setInterval(updatePosition, 120);
    const master = getAudioMaster();
    addKnob('level', layer.level ?? DEFAULT_LEVEL, 0, 1, v => `${Math.round(v * 100)}%`, v => { layer.level = v; applyLayerGain(layer); });
    addKnob('master', master?.gain?.value ?? 1.15, 0, 1.5, v => `${Math.round(v * 100)}%`, v => { if (master) master.gain.setTargetAtTime(v, getAudioContext()?.currentTime || 0, 0.025); });
    addKnob('delay', layer.delayAmount ?? 0, 0, 0.75, v => `${Math.round(v * 100)}%`, v => {
      layer.delayAmount = v;
      if (layer.delayWet?.gain) layer.delayWet.gain.setTargetAtTime(v, getAudioContext()?.currentTime || 0, 0.025);
    });
    addKnob('cut', layer.cutoff ?? 20000, 300, 20000, v => v >= 19990 ? 'Open' : `${Math.round(v)} Hz`, v => {
      layer.cutoff = v;
      if (layer.filter?.frequency) layer.filter.frequency.setTargetAtTime(v, getAudioContext()?.currentTime || 0, 0.025);
    }, 1.5);
    const quantize = panel.querySelector('[data-control="quantize"]');
    quantize.value = layer.quantize || 'off';
    quantize.addEventListener('change', () => { layer.quantize = quantize.value; });
    const mute = overlay.querySelector('.looper-track-mute');
    const updateMute = () => { mute.textContent = layer.muted ? 'Unmute track' : 'Cut / mute track'; mute.classList.toggle('is-active', layer.muted); };
    mute.addEventListener('click', () => { layer.muted = !layer.muted; applyLayerGain(layer); updateMute(); renderCircles(); });
    overlay.querySelector('.looper-track-delete').addEventListener('click', () => { deleteLayer(index); closeTrackPanel(); });
    updateTransport();
    updateMute();
    trackPanelKeyHandler = event => { if (event.key === 'Escape') closeTrackPanel(); };
    document.addEventListener('keydown', trackPanelKeyHandler);
    overlay.querySelector('.looper-track-close').focus({ preventScroll: true });
  }

  function closeSheet() {
    if (sheetPointerHandler) { document.removeEventListener('pointerdown', sheetPointerHandler, true); sheetPointerHandler = null; }
    if (sheetKeyHandler) { document.removeEventListener('keydown', sheetKeyHandler); sheetKeyHandler = null; }
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
    sheet.innerHTML = '<header class="looper-sheet-header"><div class="looper-sheet-title">Layer ' + (index + 1) + '</div><button type="button" class="looper-menu-close" aria-label="Close layer controls">×</button></header>';
    const sheetCloseButton = sheet.querySelector('.looper-menu-close');
    sheetCloseButton.style.pointerEvents = 'auto';
    sheetCloseButton.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); closeSheet(); }, { capture: true });
    sheetCloseButton.addEventListener('pointerup', event => { event.preventDefault(); event.stopPropagation(); closeSheet(); });
    sheetCloseButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeSheet(); });
    document.body.appendChild(sheet);
    sheetEl = sheet;

    const level = document.createElement('input');
    level.type = 'range'; level.min = '0'; level.max = '1'; level.step = '0.01';
    level.value = String(layer.level ?? DEFAULT_LEVEL);
    level.addEventListener('input', () => {
      layer.level = Number(level.value);
      applyLayerGain(layer);
    });
    sheet.appendChild(level);

    const pan = document.createElement('input');
    pan.type = 'range'; pan.min = '-1'; pan.max = '1'; pan.step = '0.01';
    pan.value = String(layer.pan ?? 0);
    pan.addEventListener('input', () => {
      layer.pan = Number(pan.value);
      try { layer.panner.pan.value = layer.pan; } catch (_) {}
    });
    sheet.appendChild(pan);

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.textContent = layer.muted ? 'Unmute' : 'Mute';
    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      layer.muted = !layer.muted;
      muteBtn.textContent = layer.muted ? 'Unmute' : 'Mute';
      applyLayerGain(layer);
      renderCircles();
    });
    sheet.appendChild(muteBtn);

    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.textContent = layer.solo ? 'Unsolo' : 'Solo';
    soloBtn.addEventListener('click', (e) => {
      e.preventDefault();
      layer.solo = !layer.solo;
      soloBtn.textContent = layer.solo ? 'Unsolo' : 'Solo';
      refreshAllGains();
      renderCircles();
    });
    sheet.appendChild(soloBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      deleteLayer(index);
    });
    sheet.appendChild(delBtn);

    const rect = anchorEl.getBoundingClientRect();
    sheet.style.position = 'fixed';
    sheet.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
    sheet.style.top = Math.max(8, rect.top - 120) + 'px';
    sheet.style.zIndex = '5000';

    const onDoc = (ev) => {
      if (!sheet.contains(ev.target) && ev.target !== anchorEl) closeSheet();
    };
    const onKey = (ev) => { if (ev.key === 'Escape') closeSheet(); };
    sheetPointerHandler = onDoc;
    sheetKeyHandler = onKey;
    setTimeout(() => { if (sheetEl === sheet) document.addEventListener('pointerdown', onDoc, true); }, 0);
    document.addEventListener('keydown', onKey);
  }

  function confirmDeleteLayer(index) {
    const layer = layers[index];
    if (!layer) return;
    document.getElementById('looperDeleteDialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'looperDeleteDialog';
    dialog.className = 'looper-save-dialog looper-delete-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="looper-save-form">
        <p class="looper-save-eyebrow">PIONIER · LOOP</p>
        <h2>Delete track ${index + 1}?</h2>
        <p class="looper-save-copy">This removes the recorded track. This cannot be undone.</p>
        <div class="looper-save-actions">
          <button type="button" class="looper-save-cancel">Keep track</button>
          <button type="button" class="looper-save-confirm">Delete track</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.looper-save-cancel').addEventListener('click', () => dialog.close());
    dialog.querySelector('.looper-save-confirm').addEventListener('click', () => {
      if (layers[index] === layer) deleteLayer(index);
      dialog.close();
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('.looper-save-cancel').focus({ preventScroll: true });
  }

  function renderCircles() {
    layersEl.innerHTML = '';
    layers.forEach((layer, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'looper-circle' + (layer.paused ? ' is-paused' : ' is-playing') + (layer.muted ? ' is-muted' : '') + (layer.solo ? ' is-solo' : '');
      c.setAttribute('aria-label', 'Layer ' + (i + 1));
      c.innerHTML = '<span class="looper-circle-core">' + (i + 1) + '</span>';
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        longFired = false;
        pressTimer = setTimeout(() => {
          longFired = true;
          if (pendingTap) { clearTimeout(pendingTap.timer); pendingTap = null; }
          openTrackPanel(i, c);
        }, LONG_MS);
      });
      const end = (e) => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (longFired || e.type !== 'pointerup') return;
        if (pendingTap) { clearTimeout(pendingTap.timer); pendingTap = null; }
        toggleLayer(i);
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
      layersEl.appendChild(c);
    });
  }


  function beginRecording() {
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

  function playClick(beatIndex = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const spec = CLICK_TYPES.find((item) => item.id === clickType) || CLICK_TYPES[0];
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const accent = beatIndex % Math.max(1, beatsPerBar) === 0;
      osc.type = spec.wave;
      osc.frequency.setValueAtTime(spec.frequency * (accent ? 1.12 : 1), now);
      gain.gain.setValueAtTime(accent ? 0.14 : 0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + spec.duration + 0.01);
    } catch (_) {}
  }

  function cancelCountIn() {
    countInPending = false;
    countInCurrent = 0;
    if (countInTimer) clearTimeout(countInTimer);
    countInTimer = null;
    setBtnState();
  }

  function runCountIn() {
    if (countInPending) return;
    countInPending = true;
    countInCurrent = 0;
    const total = Math.max(1, countInBars * beatsPerBar);
    const beatMs = 60000 / bpm;
    const tick = () => {
      if (!countInPending) return;
      countInCurrent += 1;
      playClick(countInCurrent - 1);
      setBtnState();
      if (countInCurrent >= total) {
        countInTimer = setTimeout(() => {
          if (!countInPending) return;
          countInPending = false; countInCurrent = 0; countInTimer = null;
          setBtnState(); beginRecording();
        }, beatMs);
      } else countInTimer = setTimeout(tick, beatMs);
    };
    tick();
  }

  function startRecord() {
    if (layers.length >= MAX_LAYERS || recording || pendingLoopStop || countInPending) return;
    const ctx = ensureTap();
    if (!ctx) return;
    resumeAudio();
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    ensureTap();
    if (countInEnabled) { runCountIn(); return; }
    beginRecording();
  }

  function setMetronome(enabled) {
    metronomeOn = !!enabled;
    if (metronomeTimer) clearTimeout(metronomeTimer);
    metronomeTimer = null;
    if (metronomeOn) {
      resumeAudio();
      let beat = 0;
      const tick = () => {
        if (!metronomeOn) return;
        playClick(beat++);
        metronomeTimer = setTimeout(tick, 60000 / bpm);
      };
      tick();
    }
    setBtnState();
  }

  function setBpm(value) {
    bpm = Math.max(40, Math.min(200, Math.round(Number(value) || 90)));
    setBtnState();
    if (metronomeOn) setMetronome(true);
  }

  function closeTimingMenu() {
    const menu = timingMenu || document.querySelector('.looper-timing-menu');
    if (menu) {
      menu.classList.remove('is-open');
      menu.remove();
    }
    timingMenu = null;
    timingMenuType = null;
  }

  function showTimingMenu(type, anchor) {
    closeTimingMenu();
    timingMenuType = type;
    const menu = document.createElement('div');
    menu.className = 'looper-timing-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', type === 'metronome' ? 'Metronome settings' : type === 'countin' ? 'Count-in settings' : 'Tempo settings');
    const header = document.createElement('div'); header.className = 'looper-timing-menu-header';
    const title = document.createElement('div'); title.className = 'looper-timing-menu-title';
    title.textContent = type === 'metronome' ? 'Metronome' : type === 'countin' ? 'Count-in' : 'Tempo';
    const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'looper-menu-close'; closeButton.setAttribute('aria-label', 'Close menu'); closeButton.textContent = '×';
    closeButton.style.cssText += ';position:relative;z-index:9999;pointer-events:auto;touch-action:manipulation;min-width:36px;min-height:36px;flex-shrink:0';
    const closeFromButton = event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      closeTimingMenu();
    };
    // Touch and mouse paths are handled separately because some mobile browsers
    // suppress click after a popup changes during pointerdown.
    closeButton.addEventListener('touchend', closeFromButton, { passive: false });
    closeButton.addEventListener('pointerup', closeFromButton, true);
    closeButton.addEventListener('click', closeFromButton, true);
    header.append(title, closeButton); menu.appendChild(header);
    const addSelect = (labelText, values, selected, onChange) => {
      const label = document.createElement('label'); label.className = 'looper-timing-field';
      const text = document.createElement('span'); text.textContent = labelText; label.appendChild(text);
      const select = document.createElement('select'); select.className = 'looper-timing-select';
      values.forEach((entry) => { const option = document.createElement('option'); option.value = entry.value; option.textContent = entry.label; select.appendChild(option); });
      select.value = String(selected); select.addEventListener('change', () => onChange(select.value)); label.appendChild(select); menu.appendChild(label);
    };
    if (type === 'metronome') {
      const options = document.createElement('div'); options.className = 'looper-click-options';
      CLICK_TYPES.forEach((spec) => {
        const option = document.createElement('button'); option.type = 'button'; option.className = 'looper-timing-option' + (spec.id === clickType ? ' is-active' : '');
        option.textContent = spec.label; option.addEventListener('click', () => { clickType = spec.id; closeTimingMenu(); showTimingMenu(type, anchor); });
        options.appendChild(option);
      });
      menu.appendChild(options);
      addSelect('Time signature', [{value:3,label:'3 / 4'},{value:4,label:'4 / 4'},{value:5,label:'5 / 4'},{value:6,label:'6 / 8'}], beatsPerBar, (v) => { beatsPerBar = Number(v); setBtnState(); });
    } else if (type === 'countin') {
      addSelect('Count-in length', [{value:1,label:'1 bar'},{value:2,label:'2 bars'},{value:3,label:'3 bars'}], countInBars, (v) => { countInBars = Number(v); setBtnState(); });
      addSelect('Click sound', CLICK_TYPES.map((item) => ({value:item.id,label:item.label})), clickType, (v) => { clickType = v; });
      addSelect('Time signature', [{value:3,label:'3 / 4'},{value:4,label:'4 / 4'},{value:5,label:'5 / 4'},{value:6,label:'6 / 8'}], beatsPerBar, (v) => { beatsPerBar = Number(v); setBtnState(); });
    } else {
      const value = document.createElement('div'); value.className = 'looper-bpm-editor-value'; value.textContent = Math.round(bpm) + ' BPM'; menu.appendChild(value);
      const range = document.createElement('input'); range.type = 'range'; range.min = '40'; range.max = '200'; range.step = '1'; range.value = String(Math.round(bpm)); range.className = 'looper-bpm-range'; range.setAttribute('aria-label','Tempo in beats per minute');
      range.addEventListener('input', () => { setBpm(range.value); value.textContent = Math.round(bpm) + ' BPM'; }); menu.appendChild(range);
      const row = document.createElement('div'); row.className = 'looper-timing-menu-row';
      for (const [label, delta] of [['−5',-5],['−1',-1],['+1',1],['+5',5]]) { const b = document.createElement('button'); b.type='button'; b.className='looper-timing-option'; b.textContent=label; b.addEventListener('click',()=>{setBpm(bpm+delta);value.textContent=Math.round(bpm)+' BPM';range.value=String(Math.round(bpm));}); row.appendChild(b); }
      menu.appendChild(row);
      addSelect('Time signature', [{value:3,label:'3 / 4'},{value:4,label:'4 / 4'},{value:5,label:'5 / 4'},{value:6,label:'6 / 8'}], beatsPerBar, (v) => { beatsPerBar = Number(v); });
      const close = document.createElement('button'); close.type='button'; close.className='looper-timing-option'; close.textContent='Done'; close.addEventListener('click',closeTimingMenu); menu.appendChild(close);
    }
    timingMenu = menu;
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    menu.style.width = width + 'px';
    menu.style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12)) + 'px';
    menu.style.top = 'auto';
    menu.style.bottom = Math.max(12, window.innerHeight - rect.top + 8) + 'px';
    menu.style.maxHeight = Math.max(120, Math.min(420, rect.top - 20)) + 'px';
    menu.querySelector('button,select,input')?.focus({preventScroll:true});
    requestAnimationFrame(() => menu.classList.add('is-open'));
  }

  // Route close-button touches at document capture phase. This remains reliable on
  // mobile even when popup-level handlers or nested touch targets interfere.
  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const close = target?.closest('.looper-menu-close, .looper-track-close');
    if (!close) return;
    event.preventDefault();
    event.stopPropagation();
    if (close.classList.contains('looper-track-close')) closeTrackPanel();
    else if (close.closest('.looper-sheet')) closeSheet();
    else if (close.closest('.looper-timing-menu')) closeTimingMenu();
  }, true);

  function wireTimingToggle(control, type) {
    let holdTimer = null, held = false;
    control.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); held = false;
      holdTimer = setTimeout(() => { held = true; timingLongFired = true; showTimingMenu(type, control); }, LONG_MS);
    });
    const finish = (e) => {
      e?.preventDefault?.(); e?.stopPropagation?.();
      if (holdTimer) clearTimeout(holdTimer); holdTimer = null;
      if (held) return;
      if (type === 'countin') { countInEnabled = !countInEnabled; setBtnState(); }
      else setMetronome(!metronomeOn);
    };
    control.addEventListener('pointerup', finish);
    control.addEventListener('pointercancel', () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; });
    control.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  wireTimingToggle(countInBtn, 'countin');
  wireTimingToggle(metronomeBtn, 'metronome');

  let bpmDownX = 0, bpmStart = 90, bpmMoved = false, bpmHeld = false, bpmHoldTimer = null;
  bpmBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); bpmDownX = e.clientX; bpmStart = bpm; bpmMoved = false; bpmHeld = false;
    bpmBtn.setPointerCapture?.(e.pointerId);
    bpmHoldTimer = setTimeout(() => { bpmHeld = true; showTimingMenu('bpm', bpmBtn); }, LONG_MS);
  });
  bpmBtn.addEventListener('pointermove', (e) => {
    if (e.buttons === 0 || !Number.isFinite(e.clientX)) return;
    const delta = e.clientX - bpmDownX;
    if (Math.abs(delta) > 4) { bpmMoved = true; if (bpmHoldTimer) clearTimeout(bpmHoldTimer); bpmHoldTimer = null; setBpm(bpmStart + delta * .65); }
  });
  const endBpm = (e) => {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (bpmHoldTimer) clearTimeout(bpmHoldTimer); bpmHoldTimer = null;
    if (!bpmMoved && !bpmHeld) {
      const now = Date.now(); lastTapTimes.push(now); lastTapTimes = lastTapTimes.filter(t => now-t < 2500).slice(-5);
      if (lastTapTimes.length >= 2) { const intervals = lastTapTimes.slice(1).map((t,i)=>t-lastTapTimes[i]).filter(d=>d>0); if(intervals.length) setBpm(60000/(intervals.reduce((a,b)=>a+b,0)/intervals.length)); }
    }
    bpmPointer = null;
  };
  bpmBtn.addEventListener('pointerup', endBpm);
  bpmBtn.addEventListener('pointercancel', endBpm);
  bpmBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerdown', (e) => { if (timingMenu && !timingMenu.contains(e.target) && !e.target.closest('.looper-timing-btn')) closeTimingMenu(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTimingMenu(); });

  function requestStopRecord() {
    if (countInPending) { cancelCountIn(); return; }
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
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0;
    gain.connect(filter);
    filter.connect(panner);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(panner);
    panner.connect(master);

    const layer = {
      buffer, source: null, gain, panner, filter, delay, feedback, delayWet,
      level: DEFAULT_LEVEL, pan: 0, muted: false, solo: false,
      delayAmount: 0, cutoff: 20000, quantize: 'off',
      startedAt: ctx.currentTime, offset: 0, paused: false
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
    if (countInPending) cancelCountIn();
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
        if (!l.paused && !found) found = true;
        else if (!l.paused) pauseLayer(i);
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
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {}
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

  // Sync modes remain internal for legacy layer timing; the visible control is Count-in.

  setBtnState();
  renderCircles();
  const api = { clearAll, layers, openTrackPanel, closeTrackPanel, setBpm, setMetronome, getTimingState: () => ({ bpm, metronomeOn, countInEnabled, countInBars, beatsPerBar, clickType }), getState: () => ({ maxLayers: MAX_LAYERS, layerCount: layers.length, recording, pendingLoopStop }) };
  // Keep a stable debug/test handle so browser checks and support diagnostics can
  // inspect the mounted loop engine without reaching into module internals.
  window.PionierLooper = api;
  return api;
}
