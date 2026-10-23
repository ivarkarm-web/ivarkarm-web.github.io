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

async function loadLooper() {
  try {
    const { mountLooper } = await import(new URL('./js/looper.js?v=224', BASE).href);
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
    const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
    if (typeof createArpInstruments === 'function') {
      const arps = createArpInstruments();
      (arps || []).forEach((a) => {
        try { InstrumentRegistry.register?.(a); } catch (_) {}
      });
    }
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
  }
}

function scheduleDeferredFeatures() {
  if (deferredStarted) return;
  deferredStarted = true;
  const run = () => {
    loadLooper();
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
    await import(new URL('./pionier-core.js?v=72', BASE).href);
  } catch (e) {
    console.error('[boot] core', e);
    setBootStatus('failed', 'Core failed to load. Check your connection and retry.', true);
    return false;
  }

  try {
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=11', BASE).href));
    window.HANDPAN_SCALES = HANDPAN_SCALES;
  } catch (e) {
    console.warn('[boot] handpan scales', e);
  }

  try {
    const { mountScaleSelector } = await import(new URL('./js/scale-selector.js?v=13', BASE).href);
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
      await loadArps().catch(() => {});
      const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
      const instruments = InstrumentRegistry.list().filter((item) => item?.id);
      const scales = window.HANDPAN_SCALES || [];
      const currentId = window.PionierCore?.activeInstrument?.()?.id;
      const choices = instruments.filter((item) => item.id !== currentId);
      const instrument = (choices.length ? choices : instruments)[Math.floor(Math.random() * Math.max(1, (choices.length || instruments.length)))];
      if (instrument?.id) await window.PionierCore?.setInstrument?.(instrument.id);
      const handpan = window.PionierCore?.handpan;
      if (handpan && scales.length > 1) {
        const next = Math.floor(Math.random() * scales.length);
        handpan.setScaleIndex(next);
        window.PionierCore?.refreshPitch?.();
        window.PionierCore?.draw?.();
        const label = document.getElementById('scaleLabel');
        const scale = scales[next];
        if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' ▾';
      }
      // Phase 1: note count is scale-driven only — do not randomize pad count.
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
