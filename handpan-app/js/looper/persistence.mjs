/**
 * looper/persistence.mjs — Library snapshot and WAV export.
 *
 * Imports shared state from ../state.mjs. Audio functions are imported
 * from audio-core.js.
 */

import { getAudioContext, getAudioMaster, resumeAudio } from '../audio-core.js';
import { state } from './state.mjs';

export function createLibrarySnapshot() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  const layers = state.layers.map((l) => ({
    muted: l.muted,
    solo: l.solo,
    level: l.level,
    buffer: l.buffer,
  }));
  return { layers, bpm: state.bpm, syncMode: state.syncModeIndex };
}

export function exportWav() {
  const ctx = getAudioContext();
  if (!ctx || !state.recording || !state.recChunks) return;

  const master = getAudioMaster();
  if (!master) return;

  // Combine all layer chunks into a single WAV
  const allChunks = [];
  for (const layer of state.layers) {
    if (layer.buffer) {
      allChunks.push(layer.buffer.getChannelData(0));
    }
  }
  if (allChunks.length === 0) return;

  const len = allChunks.reduce((a, b) => a + b.length, 0);
  const combined = new Float32Array(len);
  let offset = 0;
  for (const ch of allChunks) {
    combined.set(ch, offset);
    offset += ch.length;
  }

  // Downmix to mono if needed, normalize
  const max = Math.max(...combined.map(Math.abs));
  if (max > 1) {
    for (let i = 0; i < combined.length; i++) {
      combined[i] /= max;
    }
  }

  const wav = encodeWAV(combined, 44100);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pionier-loop-${Date.now()}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494642, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, false);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, false); // chunk size
  view.setUint16(20, 1, false); // PCM
  view.setUint16(22, 1, false); // channels
  view.setUint32(24, sampleRate, false); // sample rate
  view.setUint32(28, sampleRate * 2, false); // byte rate
  view.setUint16(32, 2, false); // block align
  view.setUint16(34, 16, false); // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, false);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(42 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, false);
  }

  return buffer;
}
