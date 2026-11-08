/**
 * Pionier app shell: boot, optional modules, scale selector.
 * ES module — imported by js/entry.mjs. Exports boot() for the entry point.
 */
import {
  startAmbient,
  setAmbientLevel,
  stopAmbient,
  getAmbientMode,
} from './js/generative-ambient.js';

import { mountLooper } from './js/looper.js';
import { mountScaleSelector } from './js/scale-selector.js';
import { mountTonepad } from './js/tonepad.js';
import { createArpInstruments } from './js/instruments/arp-family.js';

const statusEl = document.getElementById('appStatus');
const statusMessage = document.getElementById('appStatusMessage');
const statusRetry = document.getElementById('appStatusRetry');

function setBootStatus(state, message = '', retry = false) {
  window.PionierBootState = state;
  document.documentElement.classList.toggle('pionier-boot-failed', state === 'failed');
  if (!statusEl) return;
  statusEl.dataset.state = state;
  statusEl.hidden = state === 'ready';
  statusEl.setAttribute('role', state === 'failed' ? 'alert' : 'status');
  if (statusMessage) statusMessage.textContent = message;
  if (statusRetry) statusRetry.hidden = !retry;
}

statusRetry?.addEventListener('click', () => window.location.reload());
window.addEventListener('error', (event) => {
  if (!event.message || window.PionierBootState === 'failed') return;
  console.error('[pionier] runtime error', event.error || event.message);
  setBootStatus(
    'degraded',
    'A feature encountered an error. The instrument may still work; reload to retry.',
    true
  );
});
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error('[pionier] unhandled async error', event.reason);
  if (window.PionierBootState !== 'failed') {
    setBootStatus(
      'degraded',
      'A feature failed to load. The instrument may still work; reload to retry.',
      true
    );
  }
});

function unlockAudioFromGesture() {
  try {
    window.PionierCore?.ensureAudio?.();
  } catch (_) {}
}

// Procedural nature beds share the app's single AudioContext and master bus.
// Exposed for the classic settings panel, which cannot import ES modules directly.
window.PionierAmbientBeds = {
  start: startAmbient,
  setLevel: setAmbientLevel,
  stop: stopAmbient,
  getMode: getAmbientMode,
};

let HANDPAN_SCALES = [];
let deferredStarted = false;

async function loadMasterClock() {
  try {
    const { getMasterClock } = await import('./js/master-clock.js');
    getMasterClock();
  } catch (e) {
    console.warn('[boot] master clock', e);
  }
}

let fxEditorReady = false;
let fxEditorLoadPromise = null;
let pendingFxEditorId = null;

function loadFxEditor() {
  if (!fxEditorLoadPromise) {
    fxEditorLoadPromise = import('./js/fx-editor.js').then(() => {
      fxEditorReady = true;
      if (pendingFxEditorId !== null) {
        const id = pendingFxEditorId;
        pendingFxEditorId = null;
        window.dispatchEvent(new CustomEvent('pionier:fx-editor-open', { detail: { id } }));
      }
    });
  }
  return fxEditorLoadPromise;
}

function primeFxEditorLoader(target) {
  if (fxEditorReady) return;
  const trigger = target?.closest?.('#fxPanelOpen, .fx-settings-shortcut[data-fx-editor-open]');
  if (!trigger) return;
  const id = trigger.dataset?.fxEditorOpen;
  if (id) pendingFxEditorId = id;
  loadFxEditor();
}

// The FX editor module is deferred. Start loading it as soon as the user reaches
// for the FX panel or one of its settings shortcuts, and replay one tap that
// happened before the module (and its listeners) finished loading.
document.addEventListener('pointerdown', (e) => primeFxEditorLoader(e.target), true);
document.addEventListener(
  'click',
  (e) => {
    if (fxEditorReady) return;
    const shortcut = e.target?.closest?.('.fx-settings-shortcut[data-fx-editor-open]');
    if (!shortcut) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pendingFxEditorId = shortcut.dataset.fxEditorOpen || pendingFxEditorId;
    loadFxEditor();
  },
  true
);
window.addEventListener(
  'pionier:fx-editor-open',
  (e) => {
    if (fxEditorReady) return;
    pendingFxEditorId = e.detail?.id ?? pendingFxEditorId;
    loadFxEditor();
  },
  true
);

async function loadNotePlus() {
  try {
    await import('./js/note-plus.js');
  } catch (e) {
    console.warn('[boot] note-plus', e);
  }
}

async function loadLibrary() {
  try {
    await import('./js/library.js');
  } catch (e) {
    console.warn('[boot] library', e);
  }
}

function scheduleDeferredFeatures() {
  if (deferredStarted) return;
  deferredStarted = true;
  const run = () => {
    loadMasterClock().then(() => {
      mountTonepad();
    });
    loadFxEditor();
    createArpInstruments();
    loadNotePlus();
    loadLibrary();
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 400);
  }
}

export async function boot() {
  setBootStatus('loading', 'Starting Pionier…');

  try {
    // pionier-core is statically imported by js/entry.mjs; PionierCore is on window.
    if (!window.PionierCore) {
      throw new Error('PionierCore not available');
    }
  } catch (e) {
    console.error('[boot] core', e);
    setBootStatus('failed', 'Core failed to load. Check your connection and retry.', true);
    return false;
  }

  try {
    ({ HANDPAN_SCALES } = await import('./js/instruments/handpan.js'));
    window.HANDPAN_SCALES = HANDPAN_SCALES;
  } catch (e) {
    console.warn('[boot] handpan scales', e);
  }

  // The looper is optional. Let the core reach ready even if its module load
  // stalls, and arrange the dock as soon as the looper finishes mounting.
  try {
    mountLooper();
    try {
      window.__pionierArrangeLayout?.();
    } catch (_) {}
  } catch (e) {
    console.warn('[boot] looper', e);
  }

  try {
    mountScaleSelector({
      getHandpan: () => window.PionierCore?.handpan || null,
      onScaleChange: () => {
        try {
          window.PionierCore?.refreshPitch?.();
          window.PionierCore?.draw?.();
        } catch (_) {}
      },
    });
  } catch (err) {
    console.warn('[scale-selector] mount failed', err);
  }

  document.getElementById('randomizeSetup')?.addEventListener('click', async () => {
    const dice = document.getElementById('randomizeSetup');
    if (dice?.dataset.rolling === '1') return;
    if (dice) {
      dice.dataset.rolling = '1';
      dice.classList.add('is-rolling');
    }
    try {
      unlockAudioFromGesture();
      const core = window.PionierCore;
      if (typeof core?.randomizeSetup === 'function') {
        await core.randomizeSetup();
      }
    } catch (err) {
      console.warn('[randomize]', err);
    } finally {
      if (dice) {
        delete dice.dataset.rolling;
        dice.classList.remove('is-rolling');
      }
    }
  });

  scheduleDeferredFeatures();
  const health = window.PionierCore?.health?.();
  if (health?.audioAvailable === false) {
    setBootStatus(
      'degraded',
      'Audio output is unavailable. You can still explore the app; reload to retry audio.',
      true
    );
  } else if (health?.storageAvailable === false) {
    setBootStatus(
      'degraded',
      'Saved settings are unavailable because browser storage is blocked. Handpan remains available.',
      true
    );
  } else {
    setBootStatus('ready');
  }
  return true;
}
