import {
  saveComposition,
  listCompositions,
  getComposition,
  renameComposition,
  deleteComposition,
  createWav,
  formatDuration,
} from './library-store.js';
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const panel = document.getElementById('libraryPanel');
const list = document.getElementById('libraryList');
const status = document.getElementById('libraryStatus');
let source = null;
let playbackId = 0;
let restoreFocus = null;
let inertState = [];

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}
function download(record) {
  const blob = createWav(record),
    url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.name || 'Pionier composition'}.wav`.replace(/[\\/:*?"<>|]+/g, '-');
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Accessible in-app dialogs replacing window.prompt/window.confirm. */
function createDialog(id, html) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('dialog');
    el.id = id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.className = 'library-dialog';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  return el;
}

function trapFocus(el) {
  const focusables = el.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      el.close();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        last?.focus({ preventScroll: true });
      } else {
        first?.focus({ preventScroll: true });
      }
    }
  };
  el.addEventListener('keydown', onKey);
  return () => el.removeEventListener('keydown', onKey);
}

async function promptRename(currentName) {
  const id = 'library-rename-dialog';
  const el = createDialog(
    id,
    `<form method="dialog">
      <div class="library-dialog-header">
        <h3 id="library-rename-title">Rename composition</h3>
        <button type="button" class="library-dialog-close" aria-label="Close">×</button>
      </div>
      <label for="library-rename-input">New name</label>
      <input type="text" id="library-rename-input" value="${currentName.replace(
        /"/g,
        '&quot;'
      )}" required />
      <div class="library-dialog-actions">
        <button type="button" class="library-dialog-cancel">Cancel</button>
        <button type="submit" class="library-dialog-save">Save</button>
      </div>
    </form>`
  );
  const input = el.querySelector('#library-rename-input');
  const cancel = el.querySelector('.library-dialog-cancel');
  const closeBtn = el.querySelector('.library-dialog-close');
  const cleanup = trapFocus(el);
  el.querySelector('.library-dialog-close')?.addEventListener('click', () => el.close());
  cancel?.addEventListener('click', () => el.close());
  return new Promise((resolve) => {
    el.addEventListener(
      'close',
      () => {
        cleanup();
        const value = input.value.trim();
        resolve(value === '' ? null : value);
      },
      { once: true }
    );
    input.focus();
    el.showModal();
  });
}

async function confirmDelete(name) {
  const id = 'library-delete-dialog';
  const el = createDialog(
    id,
    `<form method="dialog">
      <div class="library-dialog-header">
        <h3 id="library-delete-title">Delete composition</h3>
        <button type="button" class="library-dialog-close" aria-label="Close">×</button>
      </div>
      <p id="library-delete-message">Delete “${name.replace(/"/g, '&quot;')}” from this browser? This cannot be undone.</p>
      <div class="library-dialog-actions">
        <button type="button" class="library-dialog-cancel">Keep</button>
        <button type="submit" class="library-dialog-delete">Delete</button>
      </div>
    </form>`
  );
  const cancel = el.querySelector('.library-dialog-cancel');
  const closeBtn = el.querySelector('.library-dialog-close');
  const cleanup = trapFocus(el);
  el.querySelector('.library-dialog-close')?.addEventListener('click', () => el.close());
  cancel?.addEventListener('click', () => el.close());
  return new Promise((resolve) => {
    el.addEventListener(
      'close',
      () => {
        cleanup();
        const form = el.querySelector('form');
        resolve(form?.returnValue === 'delete');
      },
      { once: true }
    );
    cancel?.focus();
    el.showModal();
  });
}
function playRecord(record) {
  const ctx = getAudioContext(),
    master = getAudioMaster();
  if (!ctx || !master) {
    throw new Error('Audio is not ready yet. Try again.');
  }
  stopPlayback();
  const duration = Math.max(
    0.1,
    ...record.layers.map(
      (layer) => (layer.offset || 0) + layer.channels[0].length / layer.sampleRate
    )
  );
  const mixed = ctx.createBuffer(2, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const l = mixed.getChannelData(0),
    r = mixed.getChannelData(1);
  const hasSolo = record.layers.some((layer) => layer.solo);
  record.layers.forEach((layer) => {
    if (layer.muted || (hasSolo && !layer.solo)) {
      return;
    }
    const [left, right = left] = layer.channels,
      offset = Math.round((layer.offset || 0) * ctx.sampleRate);
    const level = layer.level ?? 0.92,
      pan = layer.pan || 0;
    const rate = layer.sampleRate || ctx.sampleRate,
      end = Math.min(l.length, offset + Math.ceil((left.length * ctx.sampleRate) / rate));
    for (let target = offset; target < end; target++) {
      const pos = ((target - offset) * rate) / ctx.sampleRate,
        index = Math.floor(pos),
        fraction = pos - index;
      const lv = (left[index] || 0) * (1 - fraction) + (left[index + 1] || 0) * fraction;
      const rv = (right[index] || 0) * (1 - fraction) + (right[index + 1] || 0) * fraction;
      l[target] += lv * level * (pan > 0 ? 1 - pan : 1);
      r[target] += rv * level * (pan < 0 ? 1 + pan : 1);
    }
  });
  const thisPlayback = ++playbackId;
  source = ctx.createBufferSource();
  source.buffer = mixed;
  source.connect(master);
  source.start();
  setStatus(`Playing ${record.name}`);
  const active = source;
  source.onended = () => {
    active.disconnect();
    if (playbackId === thisPlayback && source === active) {
      source = null;
      setStatus('');
    }
  };
}
function stopPlayback() {
  const old = source;
  source = null;
  playbackId++;
  if (old) {
    old.onended = null;
    try {
      old.stop();
    } catch {}
    try {
      old.disconnect();
    } catch {}
  }
}
function focusables() {
  return [
    ...panel.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.hidden && el.getClientRects().length);
}
function openPanel(trigger) {
  restoreFocus = trigger || document.activeElement;
  inertState = [...document.body.children]
    .filter((node) => node !== panel && node.tagName !== 'SCRIPT')
    .map((node) => [node, node.inert]);
  inertState.forEach(([node]) => {
    node.inert = true;
  });
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('aria-modal', 'true');
  document.getElementById('closeLibrary')?.focus({ preventScroll: true });
}
function closePanel() {
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  inertState.forEach(([node, wasInert]) => {
    node.inert = wasInert;
  });
  inertState = [];
  stopPlayback();
  setStatus('');
  if (restoreFocus?.isConnected) {
    restoreFocus.focus({ preventScroll: true });
  } else {
    document.getElementById('openLibrary')?.focus({ preventScroll: true });
  }
  restoreFocus = null;
}
function safeRecord(record) {
  if (
    !record ||
    typeof record.id !== 'string' ||
    !Array.isArray(record.layers) ||
    !record.layers.length ||
    record.layers.some((layer) => !Array.isArray(layer?.channels) || !layer.channels[0]?.length)
  ) {
    throw new Error('This recording is damaged and cannot be played or exported.');
  }
}
async function render() {
  if (!list) {
    return;
  }
  list.replaceChildren();
  try {
    const records = await listCompositions();
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = 'Your next idea can live here. Save a loop when it feels ready.';
      list.append(empty);
    }
    records.forEach((record) => {
      if (!record || typeof record !== 'object') {
        return;
      }
      const row = document.createElement('article');
      row.className = 'library-record';
      row.dataset.id = record.id;
      const info = document.createElement('div');
      info.className = 'library-record-info';
      const title = document.createElement('h3');
      title.textContent = record.name || 'Untitled composition';
      const meta = document.createElement('p');
      const damaged =
        !Array.isArray(record.layers) ||
        !record.layers.length ||
        record.layers.some(
          (layer) => !Array.isArray(layer?.channels) || !layer.channels[0]?.length
        );
      meta.textContent = damaged
        ? 'Recording data is damaged · remove this item or restore from an exported WAV.'
        : `${new Date(record.createdAt).toLocaleDateString()} · ${formatDuration(record.duration)} · ${record.layers.length} layers`;
      if (damaged) {
        row.classList.add('is-damaged');
      }
      const wave = document.createElement('span');
      wave.className = 'library-wave';
      wave.setAttribute('aria-hidden', 'true');
      wave.textContent = '▂ ▄ ▆ ▃ ▇ ▄ ▂ ▅ ▃ ▆ ▂';
      info.append(title, meta, wave);
      const actions = document.createElement('div');
      actions.className = 'library-actions';
      [
        ['Play', 'play'],
        ['Rename', 'rename'],
        ['WAV', 'export'],
        ['Delete', 'delete'],
      ].forEach(([label, action]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.id = record.id;
        actions.append(button);
      });
      row.append(info, actions);
      list.append(row);
    });
    if (navigator.storage?.estimate) {
      const usage = await navigator.storage.estimate();
      const bytes = Number(usage.usage || 0);
      const usageNode = document.getElementById('libraryUsage');
      const persistence = usageNode.dataset.persistence;
      const persistenceLabel =
        persistence === 'granted'
          ? 'Persistent storage granted'
          : persistence === 'unavailable'
            ? 'Persistent storage unavailable'
            : 'Persistent storage not supported';
      usageNode.textContent = `${persistenceLabel} · Browser storage in use: ${bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`}`;
    } else {
      document.getElementById('libraryUsage').textContent =
        'Persistent storage status unavailable · Storage usage is unavailable in this browser.';
    }
  } catch (error) {
    setStatus(error.message || 'Could not read your local library.');
  }
}

export async function saveCurrentComposition(snapshot) {
  try {
    if (!snapshot?.layers?.length) {
      throw new Error('Record at least one loop layer before saving.');
    }
    const now = new Date();
    const instrument =
      document
        .getElementById('instrumentDropdownToggle')
        ?.textContent?.replace(/\s*▾\s*$/, '')
        .trim() || 'Pionier';
    const scale = document
      .getElementById('scaleLabel')
      ?.textContent?.replace(/\s*▾\s*$/, '')
      .trim();
    const record = {
      ...snapshot,
      schemaVersion: 1,
      id: crypto.randomUUID(),
      name: `${instrument}${scale ? ` · ${scale}` : ''} · ${snapshot.timing?.bpm || 90} BPM`,
      createdAt: now.getTime(),
    };
    await saveComposition(record);
    await render();
    setStatus('Saved to this browser. Export a WAV copy to keep it permanently.');
    openPanel(document.activeElement);
  } catch (error) {
    setStatus(
      /quota/i.test(`${error.name} ${error.message}`)
        ? 'Browser storage is full. Export existing recordings and free space, then try again.'
        : error.message || 'Could not save this recording.'
    );
  }
}

if (panel) {
  document.getElementById('openLibrary')?.addEventListener('click', async () => {
    window.PionierOverlay?.closeAll?.('library');
    openPanel(document.getElementById('openLibrary'));
    await render();
  });
  const close = closePanel;
  document.getElementById('closeLibrary')?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (panel.hidden) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  list?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    try {
      const record = await getComposition(button.dataset.id);
      if (!record) {
        throw new Error('This recording is no longer in your library.');
      }
      safeRecord(record);
      if (button.dataset.action === 'play') {
        await resumeAudio();
        playRecord(record);
      }
      if (button.dataset.action === 'export') {
        download(record);
      }
      if (button.dataset.action === 'rename') {
        const name = await promptRename(record.name);
        if (name) {
          await renameComposition(record.id, name);
          await render();
        }
      }
      if (button.dataset.action === 'delete') {
        const ok = await confirmDelete(record.name);
        if (ok) {
          await deleteComposition(record.id);
          await render();
        }
      }
    } catch (error) {
      setStatus(error.message || 'That library action failed.');
    }
  });
  (async () => {
    try {
      const granted = navigator.storage?.persist ? await navigator.storage.persist() : null;
      const usageNode = document.getElementById('libraryUsage');
      if (usageNode) {
        usageNode.dataset.persistence =
          granted === true ? 'granted' : granted === false ? 'unavailable' : 'unsupported';
      }
      await listCompositions();
    } catch (error) {
      const usageNode = document.getElementById('libraryUsage');
      if (usageNode) {
        usageNode.dataset.persistence = 'unavailable';
        usageNode.textContent =
          'Persistent storage is unavailable; browser recordings may be reclaimed.';
      }
      setStatus(
        `${error.message || 'Local library storage is unavailable.'} You can still use Pionier without saving.`
      );
    }
  })();
}
window.PionierLibrary = { save: saveCurrentComposition, refresh: render };
