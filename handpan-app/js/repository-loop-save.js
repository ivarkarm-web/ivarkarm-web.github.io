/**
 * Direct-to-repository loop capture for the static GitHub Pages app.
 *
 * No credential is embedded in the app or stored in browser storage. The user
 * supplies a fine-grained GitHub token for this save operation only.
 */
const OWNER = 'ivarkarm-web';
const REPO = 'ivarkarm-web.github.io';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

function safeSlug(value) {
  return String(value || 'loop')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54) || 'loop';
}

function base64FromBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function putRepoFile(path, content, token, message) {
  const response = await fetch(`${API}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content,
      branch: 'main'
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('GitHub rejected the token. Check that it belongs to this repository and has Contents: Read and write permission.');
    }
    if (response.status === 409 || response.status === 422) {
      throw new Error('GitHub could not create this file (possible filename conflict). Try saving again with a different name.');
    }
    throw new Error(payload.message || `GitHub upload failed (${response.status}).`);
  }
  return payload;
}

/**
 * Upload the rendered loop and a JSON sidecar to the repository's lesson-source folder.
 * Audio and metadata are separate GitHub commits; if the sidecar fails, the audio
 * still exists and its repository URL is included in the thrown error.
 */
export async function uploadLoopToRepository({ blob, title, duration, token }) {
  if (!token || !token.trim()) throw new Error('Enter a GitHub token to save this recording to the repository.');
  if (!(blob instanceof Blob) || blob.size < 44) throw new Error('The rendered loop audio is empty.');
  if (blob.size > 25 * 1024 * 1024) throw new Error('This WAV is over 25 MB, which may exceed browser memory limits during upload. Record a shorter loop.');
  const cleanTitle = String(title || '').trim().slice(0, 80) || 'Saved loop';
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const basePath = `handpan-app/lesson-source/${safeSlug(cleanTitle)}-${stamp}`;
  const audioPath = `${basePath}.wav`;
  const metadataPath = `${basePath}.json`;
  const audioBase64 = base64FromBytes(new Uint8Array(await blob.arrayBuffer()));

  const audioResult = await putRepoFile(
    audioPath,
    audioBase64,
    token,
    `Add loop recording: ${cleanTitle}`
  );
  const metadata = {
    title: cleanTitle,
    audioFile: audioPath.split('/').pop(),
    format: 'wav',
    durationSeconds: Math.round((Number(duration) || 0) * 1000) / 1000,
    createdAt: now.toISOString(),
    source: 'Pionier Looper',
    purpose: 'Raw source recording for future lesson creation; lesson annotations not yet added.'
  };

  try {
    await putRepoFile(
      metadataPath,
      btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 2) + '\n'))),
      token,
      `Add loop metadata: ${cleanTitle}`
    );
  } catch (error) {
    error.message = `Audio uploaded to ${audioPath}, but its metadata file failed: ${error.message}`;
    throw error;
  }

  return {
    audioPath,
    metadataPath,
    audioUrl: audioResult.content?.html_url || `https://github.com/${OWNER}/${REPO}/blob/main/${audioPath}`
  };
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
