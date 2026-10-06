import { VOICE_PRESETS } from './voice-presets.js';

function encodeWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const interleaved = new Float32Array(length * channels);
  let p = 0;
  for (let i = 0; i < length; i++) for (let ch = 0; ch < channels; ch++) interleaved[p++] = audioBuffer.getChannelData(ch)[i];

  const buffer = new ArrayBuffer(44 + interleaved.length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0,'RIFF'); view.setUint32(4,36 + interleaved.length * 2,true); text(8,'WAVE'); text(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*channels*2,true); view.setUint16(32,channels*2,true); view.setUint16(34,16,true);
  text(36,'data'); view.setUint32(40,interleaved.length*2,true);
  for(let i=0;i<interleaved.length;i++) view.setInt16(44+i*2,Math.max(-1,Math.min(1,interleaved[i]))*32767,true);
  return new Uint8Array(buffer);
}

export async function exportLoopWav({ layers, duration, notes, voiceIndex = 0, fileName = 'handpan-loop.wav' }) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) throw new Error('Offline audio rendering is not supported in this browser.');
  const sampleRate = 44100;
  const totalSeconds = Math.max(0.5, duration + 1.25);
  const ctx = new Offline(1, Math.ceil(totalSeconds * sampleRate), sampleRate);
  const output = ctx.createGain();
  output.gain.value = 0.72;
  output.connect(ctx.destination);
  const preset = VOICE_PRESETS[voiceIndex] || VOICE_PRESETS[0];

  for (const event of layers.flat()) {
    const note = notes[event.n];
    if (!note) continue;
    const f = note.freq;
    const t = Math.max(0, event.t);
    const vel = Math.max(0.2, Math.min(1, event.v || 0.8));
    const T0 = Math.max(1.8, 6.2 - 1.1 * Math.log(f / 164.81) / Math.LN2);
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(output);
    preset.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = preset.wave || 'sine';
      osc.frequency.value = f * ratio;
      const g = ctx.createGain();
      const peak = (0.2 + 0.14 * vel) * ([0.5,0.32,0.18,0.095,0.045][i] || 0.03);
      const dec = T0 * (preset.decay / 6.2) * (1 - i * 0.07);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(peak,t+0.0035);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dec);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t+dec+0.1);
    });
  }

  const rendered = await ctx.startRendering();
  const blob = new Blob([encodeWav(rendered)], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
}
