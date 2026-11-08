const DB_NAME = 'pionier-library';
const DB_VERSION = 1;
const STORE = 'compositions';

export function openLibraryDB(factory = globalThis.indexedDB) {
  if (!factory) {
    return Promise.reject(new Error('Local library storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error || new Error('Could not open local library storage.'));
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error('Close other Pionier tabs to update the local library.'));
      }
    };
  });
}

function requestValue(db, mode, action) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () =>
        reject(request.error || tx.error || new Error('Local library request failed.'));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Local library transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Local library transaction was aborted.'));
    } catch (error) {
      reject(error);
    }
  });
}

export async function saveComposition(record) {
  const db = await openLibraryDB();
  try {
    await requestValue(db, 'readwrite', (store) => store.put(record));
    return record;
  } finally {
    db.close();
  }
}
export async function listCompositions() {
  const db = await openLibraryDB();
  try {
    return (await requestValue(db, 'readonly', (store) => store.getAll())).sort(
      (a, b) => (b?.createdAt || 0) - (a?.createdAt || 0)
    );
  } finally {
    db.close();
  }
}
export async function getComposition(id) {
  const db = await openLibraryDB();
  try {
    return await requestValue(db, 'readonly', (store) => store.get(id));
  } finally {
    db.close();
  }
}
export async function renameComposition(id, name) {
  const record = await getComposition(id);
  if (!record) {
    throw new Error('This recording is no longer in your library.');
  }
  record.name = String(name).trim().slice(0, 100) || 'Untitled composition';
  return saveComposition(record);
}
export async function deleteComposition(id) {
  const db = await openLibraryDB();
  try {
    await requestValue(db, 'readwrite', (store) => store.delete(id));
  } finally {
    db.close();
  }
}

export function createWav(record) {
  const allLayers = (record.layers || []).filter((layer) => layer.channels?.length);
  const hasSolo = allLayers.some((layer) => layer.solo);
  const layers = allLayers.filter((layer) => !layer.muted && (!hasSolo || layer.solo));
  if (!layers.length) {
    throw new Error('This recording contains no playable layers.');
  }
  const sampleRate = layers[0].sampleRate || 44100;
  const frames = Math.max(
    ...layers.map(
      (layer) =>
        Math.round((layer.offset || 0) * sampleRate) +
        Math.ceil((layer.channels[0].length * sampleRate) / (layer.sampleRate || sampleRate))
    )
  );
  if (!Number.isSafeInteger(frames) || frames < 0 || frames > Math.floor((0xffffffff - 36) / 4)) {
    throw new Error(
      'This recording is too large for WAV export (4 GB limit). Save a shorter recording or export sections separately.'
    );
  }
  const bytes = new ArrayBuffer(44 + frames * 4),
    view = new DataView(bytes);
  const write = (at, str) =>
    [...str].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, frames * 4, true);
  const chunkSize = 32768;
  for (let start = 0; start < frames; start += chunkSize) {
    const count = Math.min(chunkSize, frames - start),
      leftMix = new Float32Array(count),
      rightMix = new Float32Array(count);
    for (const layer of layers) {
      const [left, right = left] = layer.channels,
        offset = Math.round((layer.offset || 0) * sampleRate);
      const level = Math.max(0, Math.min(2, layer.level ?? 0.92)),
        pan = Math.max(-1, Math.min(1, layer.pan || 0));
      const sourceRate = layer.sampleRate || sampleRate;
      const from = Math.max(start, offset),
        to = Math.min(start + count, offset + Math.ceil((left.length * sampleRate) / sourceRate));
      for (let frame = from; frame < to; frame++) {
        const position = ((frame - offset) * sourceRate) / sampleRate,
          source = Math.floor(position),
          fraction = position - source,
          target = frame - start;
        const l = (left[source] || 0) * (1 - fraction) + (left[source + 1] || 0) * fraction;
        const r = (right[source] || 0) * (1 - fraction) + (right[source + 1] || 0) * fraction;
        leftMix[target] += l * level * (pan > 0 ? 1 - pan : 1);
        rightMix[target] += r * level * (pan < 0 ? 1 + pan : 1);
      }
    }
    for (let i = 0; i < count; i++) {
      const byte = 44 + (start + i) * 4;
      view.setInt16(byte, Math.round(Math.max(-1, Math.min(1, leftMix[i])) * 32767), true);
      view.setInt16(byte + 2, Math.round(Math.max(-1, Math.min(1, rightMix[i])) * 32767), true);
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
