/**
 * looper/mixer.mjs — Layer playback, gain, and mixing logic.
 *
 * Imports shared state from ./state.mjs. Audio functions are imported
 * from audio-core.js.
 */

import { getAudioContext, getAudioMaster, resumeAudio } from '../audio-core.js';
import { state } from './state.mjs';

const BEATS_PER_BAR = 4;
const MAX_LAYERS = 7;

export function cycleDuration() {
  // Layer 1 duration defines the loop length
  const layer0 = state.layers[0];
  if (!layer0 || !layer0.buffer) return 0;
  return layer0.buffer.duration;
}

export function beatDuration() {
  return 60 / state.bpm / 4;
}

export function cyclePhase(now) {
  const dur = cycleDuration();
  if (!dur) return 0;
  return (((now - (state.layers[0]?.startedAt || now)) % dur) + dur) % dur;
}

export function anySolo() {
  return state.layers.some((l) => l.solo);
}

export function effectiveMuted(layer) {
  if (layer.muted) return true;
  if (anySolo() && !layer.solo) return true;
  return false;
}

export function applyLayerGain(layer) {
  if (!layer.gainNode) return;
  const v = effectiveMuted(layer) ? 0 : layer.level;
  layer.gainNode.gain.setValueAtTime(v, getAudioContext().currentTime);
}

export function refreshAllGains() {
  for (const layer of state.layers) {
    applyLayerGain(layer);
  }
}

export function startLayerSource(layer, offset, delaySeconds = 0) {
  const ctx = getAudioContext();
  if (!ctx || !layer.buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = layer.buffer;
  const gain = ctx.createGain();
  gain.gain.value = effectiveMuted(layer) ? 0 : layer.level;
  src.connect(gain);
  gain.connect(getAudioMaster());
  src.start(ctx.currentTime + delaySeconds, offset);
  layer.gainNode = gain;
  layer.source = src;
}

export function pauseLayer(index) {
  const layer = state.layers[index];
  if (!layer) return;
  try {
    layer.source?.stop();
  } catch (_) {}
  layer.source = null;
}

export function quantizeWait(layer) {
  // Quantize start to the nearest beat boundary of layer 1
  const dur = cycleDuration();
  if (!dur) return 0;
  const now = getAudioContext().currentTime;
  const phase = cyclePhase(now);
  return dur - phase;
}

export function resumeLayer(index) {
  const layer = state.layers[index];
  if (!layer) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dur = cycleDuration();
  const phase = cyclePhase(ctx.currentTime);
  const offset = phase % dur;
  startLayerSource(layer, offset);
}

export function toggleLayer(index) {
  const layer = state.layers[index];
  if (!layer) return;
  if (layer.source) {
    pauseLayer(index);
  } else {
    resumeLayer(index);
  }
}

export function disconnectLayer(layer) {
  try {
    layer.source?.disconnect();
  } catch (_) {}
  try {
    layer.gainNode?.disconnect();
  } catch (_) {}
}

export function deleteLayer(index) {
  const layer = state.layers[index];
  if (!layer) return;
  disconnectLayer(layer);
  state.layers.splice(index, 1);
  // Re-index
  state.layers.forEach((l, i) => {
    l.index = i;
  });
}

export function trimOrPadBuffer(ctx, buffer, targetDur) {
  // Trim or pad an AudioBuffer to target duration
  const targetLen = Math.round(targetDur * ctx.sampleRate);
  const currentLen = buffer.length;
  if (currentLen === targetLen) return buffer;
  if (currentLen > targetLen) {
    return buffer.slice(0, targetLen);
  }
  const padded = ctx.createBuffer(1, targetLen, ctx.sampleRate);
  padded.copyToBuffer(buffer, 0);
  return padded;
}
