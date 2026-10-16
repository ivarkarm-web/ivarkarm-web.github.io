const DB_NAME = 'pionier-loop-library';
const DB_VERSION = 1;
const STORE = 'loops';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Local loop storage is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open loop library.'));
  });
}

async function withStore(mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try { result = operation(store); }
    catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result?.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Loop library operation failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Loop library operation was cancelled.')); };
  });
}

export function saveLoop(blob, title, duration) {
  const cleanTitle = String(title || '').trim().slice(0, 80) || 'Saved loop';
  return withStore('readwrite', (store) => store.add({
    title: cleanTitle,
    duration: Math.max(0, Number(duration) || 0),
    createdAt: Date.now(),
    mimeType: blob.type || 'audio/wav',
    blob
  }));
}

export async function listSavedLoops() {
  return withStore('readonly', (store) => store.getAll());
}

export async function getSavedLoop(id) {
  return withStore('readonly', (store) => store.get(Number(id)));
}

export async function deleteSavedLoop(id) {
  return withStore('readwrite', (store) => store.delete(Number(id)));
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
      const j = i % srcFrames;
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
