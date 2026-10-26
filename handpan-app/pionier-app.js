/**
 * Pionier app shell: load the vendored local core and optional UI modules.
 * Critical path: core + scales + scale selector.
 * Deferred: looper, FX editor, arps, note-plus, soundscapes (idle or first use).
 */
const BASE = new URL('.', import.meta.url).href;
const statusEl = document.getElementById('appStatus');
const statusMessage = document.getElementById('appStatusMessage');
const statusRetry = document.getElementById('appStatusRetry');

function setBootStatus(state, message = '', retry = false) {
  window.PionierBootState = state;
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
    const { mountLooper } = await import(new URL('./js/looper.js?v=239', BASE).href);
    if (typeof mountLooper === 'function') mountLooper();
  } catch (e) {
    console.warn('[boot] looper', e);
  }
}

async function loadFxEditor() {
  try {
    await import(new URL('./js/fx-editor.js?v=9', BASE).href);
  } catch (e) {
    console.warn('[boot] fx-editor', e);
  }
}

async function loadArps() {
  try {
    const { createArpInstruments } = await import(new URL('./js/instruments/arp-family.js?v=3', BASE).href);
    if (typeof createArpInstruments !== 'function') return;
    const arps = createArpInstruments() || [];
    if (typeof window.PionierCore?.registerInstrument === 'function') {
      arps.forEach((a) => {
        try { window.PionierCore.registerInstrument(a); } catch (_) {}
      });
      return;
    }
    const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
    arps.forEach((a) => {
      try { InstrumentRegistry.register?.(a); } catch (_) {}
    });
  } catch (e) {
    console.warn('[boot] arps', e);
  }
}

async function loadNotePlus() {
  try {
    const { mountNotePlus } = await import(new URL('./js/note-plus.js?v=3', BASE).href);
    if (typeof mountNotePlus === 'function') mountNotePlus();
  } catch (e) {
    console.warn('[boot] note-plus', e);
  }
}

async function loadSoundscapes() {
  try {
    await import(new URL('./js/soundscapes.js?v=11', BASE).href);
  } catch (e) {
    console.warn('[boot] soundscapes', e);
    if (window.PionierBootState !== 'failed') {
      setBootStatus('degraded', 'Soundscapes could not load. The instrument is still available; reload to retry.', true);
    }
  }
}

async function loadAmbientSequencer() {
  try {
    const { mountAmbientSequencer } = await import(new URL('./js/ambient-sequencer-grid.js?v=8', BASE).href);
    if (typeof mountAmbientSequencer === 'function') await mountAmbientSequencer();
  } catch (e) {
    console.warn('[boot] ambient sequencer', e);
  }
}

function scheduleDeferredFeatures() {
  if (deferredStarted) return;
  deferredStarted = true;
  const run = () => {
    loadMasterClock().then(() => {
      loadLooper();
      loadAmbientSequencer();
    });
    loadFxEditor();
    loadArps();
    loadNotePlus();
    loadSoundscapes();
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
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=12', BASE).href));
    window.HANDPAN_SCALES = HANDPAN_SCALES;
  } catch (e) {
    console.warn('[boot] handpan scales', e);
  }

  try {
    const { mountScaleSelector } = await import(new URL('./js/scale-selector.js?v=14', BASE).href);
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
        const result = await core.randomizeSetup();
        if (result && result.instrumentCount === 0) {
          console.warn('[randomize] no instruments in registry');
        }
      } else {
        const steps = 1 + Math.floor(Math.random() * 6);
        for (let i = 0; i < steps; i++) document.getElementById('voiceNext')?.click();
        const scales = window.HANDPAN_SCALES || [];
        const handpan = core?.handpan;
        if (handpan && scales.length > 1) {
          const next = Math.floor(Math.random() * scales.length);
          if (typeof core.setScaleIndex === 'function') core.setScaleIndex(next);
          else { handpan.setScaleIndex(next); core?.refreshPitch?.(); }
          const label = document.getElementById('scaleLabel');
          const scale = scales[next];
          if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' \u25be';
          core?.draw?.();
        }
      }
    } catch (err) { console.warn('[randomize] setup selection failed', err); }
    finally {
      if (dice) { delete dice.dataset.rolling; dice.classList.remove('is-rolling'); }
    }
  });

  scheduleDeferredFeatures();
  setBootStatus('ready');
  return true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot().catch(console.error); });
} else {
  boot().catch(console.error);
}
