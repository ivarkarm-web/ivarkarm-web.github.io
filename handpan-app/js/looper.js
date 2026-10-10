/**
 * looper.js — multi-layer phrase looper (max 5)
 * Record btn: arm/stop layer · Long-press: clear all
 * Play/pause btn: mute/resume all looping layers
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const MAX_LAYERS = 5;
const LONG_MS = 550;

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  const btn = document.getElementById('looperBtn');
  const layersEl = document.getElementById('looperLayers');
  let playBtn = document.getElementById('looperPlayBtn');
  if (!rail || !btn || !layersEl || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  // Ensure play/pause button exists (in case HTML is older)
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'looperPlayBtn';
    playBtn.className = 'looper-play-btn';
    playBtn.setAttribute('aria-label', 'Pause loops');
    playBtn.title = 'Play / pause loops';
    playBtn.innerHTML =
      '<span class="looper-play-icon" aria-hidden="true">⏸</span>';
    // Insert before the record button
    rail.insertBefore(playBtn, btn);
  }

  /** @type {{ buffer: AudioBuffer, source: AudioBufferSourceNode|null, gain: GainNode, startedAt: number, offset: number }[]} */
  const layers = [];
  let recording = false;
  let playing = true;
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
    btn.classList.toggle('is-recording', recording);
    btn.classList.toggle('has-layers', layers.length > 0);
    btn.setAttribute(
      'aria-label',
      recording
        ? 'Stop recording layer'
        : layers.length >= MAX_LAYERS
          ? 'Looper full (long-press to clear)'
          : layers.length
            ? 'Record next layer'
            : 'Start loop recording'
    );

    const hasLayers = layers.length > 0;
    playBtn.hidden = !hasLayers;
    playBtn.classList.toggle('is-paused', hasLayers && !playing);
    playBtn.classList.toggle('is-playing', hasLayers && playing);
    const icon = playBtn.querySelector('.looper-play-icon');
    if (icon) icon.textContent = playing ? '⏸' : '▶';
    playBtn.setAttribute(
      'aria-label',
      playing ? 'Pause loops' : 'Play loops'
    );
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((_, i) => {
      const c = document.createElement('span');
      c.className = 'looper-circle' + (playing ? '' : ' is-paused');
      c.style.setProperty('--i', String(i));
      c.title = 'Layer ' + (i + 1);
      layersEl.appendChild(c);
    });
  }

  function startLayerSource(layer, offset) {
    const ctx = getAudioContext();
    if (!ctx || !layer.gain) return;
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

  function pauseAll() {
    if (!playing || !layers.length) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const layer of layers) {
      const dur = layer.buffer.duration || 1;
      const elapsed = ((now - (layer.startedAt || now)) % dur + dur) % dur;
      layer.offset = elapsed;
      try { layer.source?.stop(); } catch (_) {}
      layer.source = null;
    }
    playing = false;
    setBtnState();
    renderCircles();
  }

  function resumeAll() {
    if (playing || !layers.length) return;
    resumeAudio();
    for (const layer of layers) {
      startLayerSource(layer, layer.offset || 0);
    }
    playing = true;
    setBtnState();
    renderCircles();
  }

  function togglePlayPause(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!layers.length || recording) return;
    if (playing) pauseAll();
    else resumeAll();
  }

  function startRecord() {
    if (layers.length >= MAX_LAYERS) return;
    const ctx = ensureTap();
    if (!ctx) return;
    resumeAudio();
    // Keep existing layers audible while overdubbing
    if (!playing && layers.length) resumeAll();
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
      offset: 0
    };
    layers.push(layer);

    if (playing) {
      startLayerSource(layer, 0);
    }
    // if paused, layer waits until resume

    renderCircles();
    setBtnState();
  }

  function clearAll() {
    recording = false;
    recChunks = null;
    playing = true;
    for (const layer of layers) {
      try { layer.source?.stop(); } catch (_) {}
      try { layer.gain.disconnect(); } catch (_) {}
    }
    layers.length = 0;
    renderCircles();
    setBtnState();
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

  playBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  playBtn.addEventListener('pointerup', togglePlayPause);
  playBtn.addEventListener('click', togglePlayPause);

  setBtnState();
  renderCircles();

  return {
    clearAll,
    pauseAll,
    resumeAll,
    get layerCount() { return layers.length; },
    get isPlaying() { return playing; }
  };
}
