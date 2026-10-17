/**
 * Public community song uploads go through the Cloudflare Worker.
 * Keep the repository credential server-side; never ask visitors for a GitHub token.
 */
export const COMMUNITY_SONGS_API = 'PASTE_CLOUDFLARE_WORKER_URL_HERE';

export async function fetchCommunitySongs() {
  if (!COMMUNITY_SONGS_API || COMMUNITY_SONGS_API.includes('PASTE_CLOUDFLARE')) {
    return { configured: false, songs: [] };
  }
  const response = await fetch(COMMUNITY_SONGS_API, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not load community songs.');
  return { configured: true, songs: Array.isArray(payload.songs) ? payload.songs : [] };
}

export async function uploadLoopToRepository({ blob, title, creator, duration }) {
  if (!COMMUNITY_SONGS_API || COMMUNITY_SONGS_API.includes('PASTE_CLOUDFLARE')) {
    throw new Error('Community uploads are not configured yet. The site owner needs to deploy the Cloudflare Worker and add its /songs URL.');
  }
  if (!(blob instanceof Blob) || blob.size < 44) throw new Error('The rendered loop audio is empty.');
  if (blob.size > 16 * 1024 * 1024) throw new Error('This WAV is over 16 MB. Record a shorter loop to share it.');
  const form = new FormData();
  form.append('title', String(title || '').trim().slice(0, 80));
  form.append('creator', String(creator || '').trim().slice(0, 40));
  form.append('duration', String(Math.max(0, Number(duration) || 0)));
  form.append('audio', blob, 'pionier-loop.wav');
  form.append('website', '');
  const response = await fetch(COMMUNITY_SONGS_API, { method: 'POST', body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not upload this song. Please try again.');
  return payload.song;
}

/** Bounce the currently active loop layers to stereo 16-bit PCM WAV. */
export function encodeLoopMix(layers, sampleRate, duration) {
  const sr = Math.max(8000, Math.round(sampleRate || 44100));
  const seconds = Math.max(0.05, Math.min(600, Number(duration) || 0));
  const frames = Math.max(1, Math.floor(seconds * sr));
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const hasSolo = layers.some((layer) => layer.solo && !layer.muted);

  for (const layer of layers) {
    if (!layer?.buffer || layer.muted || layer.paused || (hasSolo && !layer.solo)) continue;
    const buffer = layer.buffer;
    const srcL = buffer.getChannelData(0);
    const srcR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : srcL;
    const srcFrames = buffer.length;
    if (!srcFrames) continue;
    const level = Math.max(0, Math.min(1.5, Number(layer.level ?? 0.92)));
    const pan = Math.max(-1, Math.min(1, Number(layer.pan || 0)));
    const gainL = level * Math.cos((pan + 1) * Math.PI / 4);
    const gainR = level * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < frames; i++) {
      const phase = Math.floor(Math.max(0, Number(layer.offset) || 0) * sr) % srcFrames;
      const j = (i + phase) % srcFrames;
      left[i] += srcL[j] * gainL;
      right[i] += srcR[j] * gainR;
    }
  }

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const normalise = peak > 0.96 ? 0.96 / peak : 1;
  const dataBytes = frames * 4;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);
  const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const sample of [left[i], right[i]]) {
      const x = Math.max(-1, Math.min(1, sample * normalise));
      view.setInt16(offset, x < 0 ? x * 32768 : x * 32767, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}
