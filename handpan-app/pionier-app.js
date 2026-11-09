/**
 * Pionier app shell: load the vendored local core and optional UI modules.
 */
import { startAmbient, setAmbientLevel, stopAmbient, getAmbientMode } from './js/generative-ambient.js?v=2';

const BASE = new URL('.', import.meta.url).href;
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
  setBootStatus('degraded', 'A feature encountered an error. The instrument may still work; reload to retry.', true);
});
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error('[pionier] unhandled async error', event.reason);
  if (window.PionierBootState !== 'failed') {
    setBootStatus('degraded', 'A feature failed to load. The instrument may still work; reload to retry.', true);
  }
});

function unlockAudioFromGesture() {
  try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
}

// Procedural nature beds (rain, storm, forest, birds, wind, water) share the
// app's single AudioContext and master bus. Exposed for the classic settings
// panel, which cannot import ES modules directly.
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
    const { getMasterClock } = await import(new URL('./js/master-clock.js?v=1', BASE).href);
    getMasterClock();
  } catch (e) {
    console.warn('[boot] master clock', e);
  }
}

async function loadLooper() {
  try {
    const { mountLooper } = await import(new URL('./js/looper.js?v=241', BASE).href);
    if (typeof mountLooper === 'function') mountLooper();
  } catch (e) {
    console.warn('[boot] looper', e);
  }
}

let fxEditorReady = false;
let fxEditorLoadPromise = null;
let pendingFxEditorId = null;

function loadFxEditor() {
  if (!fxEditorLoadPromise) {
    fxEditorLoadPromise = import(new URL('./js/fx-editor.js?v=9', BASE).href)
      .then(() => {
        fxEditorReady = true;
        if (pendingFxEditorId != null) {
          const id = pendingFxEditorId;
          pendingFxEditorId = null;
          window.dispatchEvent(new CustomEvent('pionier:fx-editor-open', { detail: { id } }));
        }
      })
      .catch((e) => {
        console.warn('[boot] fx-editor', e);
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
document.addEventListener('click', (e) => {
  if (fxEditorReady) return;
  const shortcut = e.target?.closest?.('.fx-settings-shortcut[data-fx-editor-open]');
  if (!shortcut) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  pendingFxEditorId = shortcut.dataset.fxEditorOpen || pendingFxEditorId;
  loadFxEditor();
}, true);
window.addEventListener('pionier:fx-editor-open', (e) => {
  if (fxEditorReady) return;
  pendingFxEditorId = e.detail?.id ?? pendingFxEditorId;
  loadFxEditor();
}, true);

async function loadArps() {
  try {
    const { createArpInstruments } = await import(new URL('./js/instruments/arp-family.js?v=3', BASE).href);
    if (typeof createArpInstruments === 'function') createArpInstruments();
  } catch (e) {
    console.warn('[boot] arps', e);
  }
}

async function loadNotePlus() {
  try {
    await import(new URL('./js/note-plus.js?v=3', BASE).href);
  } catch (e) {
    console.warn('[boot] note-plus', e);
  }
}

async function loadLibrary() {
  try {
    await import(new URL('./js/library.js?v=1', BASE).href);
  } catch (e) {
    console.warn('[boot] library', e);
  }
}

async function loadAmbientSequencer() {
  try {
    const { mountTonepad } = await import(new URL('./js/tonepad.js?v=55', BASE).href);
    if (typeof mountTonepad === 'function') await mountTonepad();
  } catch (e) {
    console.warn('[boot] tonepad', e);
  }
}

function scheduleDeferredFeatures() {
  if (deferredStarted) return;
  deferredStarted = true;
  const run = () => {
    loadMasterClock().then(() => {
      loadAmbientSequencer();
    });
    loadFxEditor();
    loadArps();
    loadNotePlus();
    loadLibrary();
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 400);
  }
}

async function boot() {
  setBootStatus('loading', 'Starting Pionier…');
  try {
    await import(new URL('./pionier-core.js?v=82', BASE).href);
  } catch (e) {
    console.error('[boot] core', e);
    setBootStatus('failed', 'Core failed to load. Check your connection and retry.', true);
    return false;
  }

  try {
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=13', BASE).href));
    window.HANDPAN_SCALES = HANDPAN_SCALES;
  } catch (e) {
    console.warn('[boot] handpan scales', e);
  }

  // The looper is optional. Let the core reach ready even if its module load
  // stalls, and arrange the dock as soon as the looper finishes mounting.
  loadLooper().then(() => {
    try { window.__pionierArrangeLayout?.(); } catch (_) {}
  });

  try {
    const { mountScaleSelector } = await import(new URL('./js/scale-selector.js?v=15', BASE).href);
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
    if (dice) { dice.dataset.rolling = '1'; dice.classList.add('is-rolling'); }
    try {
      unlockAudioFromGesture();
      const core = window.PionierCore;
      if (typeof core?.randomizeSetup === 'function') {
        await core.randomizeSetup();
      }
    } catch (err) { console.warn('[randomize]', err); }
    finally {
      if (dice) { delete dice.dataset.rolling; dice.classList.remove('is-rolling'); }
    }
  });

  scheduleDeferredFeatures();
  const health = window.PionierCore?.health?.();
  if (health?.audioAvailable === false) {
    setBootStatus('degraded', 'Audio output is unavailable. You can still explore the app; reload to retry audio.', true);
  } else if (health?.storageAvailable === false) {
    setBootStatus('degraded', 'Saved settings are unavailable because browser storage is blocked. Handpan remains available.', true);
  } else {
    setBootStatus('ready');
  }
  return true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot().catch(console.error); });
} else {
  boot().catch(console.error);
}
