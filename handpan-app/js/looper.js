/**
 * looper.js — multi-layer phrase looper (max 5)
 * Click: arm/stop-record layer · Long-press: clear all
 * Records the main mix so instrument/scale changes only affect live play.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const MAX_LAYERS = 5;
const LONG_MS = 550;

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  const btn = document.getElementById('looperBtn');
  const layersEl = document.getElementById('looperLayers');
  if (!rail || !btn || !layersEl || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

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
  }

  function renderCircles() {
    layersEl.replaceChildren();
    layers.forEach((_, i) => {
      const c = document.createElement('span');
      c.className = 'looper-circle';
      c.style.setProperty('--i', String(i));
      c.title = 'Layer ' + (i + 1);
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

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    layers.push({ buffer, source, gain });
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

  setBtnState();
  renderCircles();

  return { clearAll, get layerCount() { return layers.length; } };
}
