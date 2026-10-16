/**
 * Pionier app shell: load the vendored local core and optional UI modules.
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
    setBootStatus('degraded', 'A feature could not finish starting. The instrument may still work; reload to retry.', true);
  }
});

function killCanvasGhosts(canvas) {
  if (!canvas || canvas.dataset.ghostKill === '1') return;
  canvas.dataset.ghostKill = '1';
  canvas.draggable = false;
  canvas.setAttribute('draggable', 'false');
  try {
    canvas.style.webkitUserDrag = 'none';
    canvas.style.userDrag = 'none';
    canvas.style.webkitTouchCallout = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.touchAction = 'none';
  } catch (_) {}
  const block = (e) => { e.preventDefault(); };
  canvas.addEventListener('dragstart', block, true);
  canvas.addEventListener('drag', block, true);
  canvas.addEventListener('selectstart', block, true);
  canvas.addEventListener('contextmenu', block, true);
}

async function boot() {
  setBootStatus('loading', 'Starting Pionier…');
  const degraded = [];

  try {
    await import(new URL('./pionier-core.js?v=47', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  try {
    const { createArpInstruments } = await import(new URL('./js/instruments/arp-family.js?v=3', BASE).href);
    const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
    for (const inst of createArpInstruments()) {
      try { InstrumentRegistry.register(inst); } catch (e) { console.warn('[arp] register', inst?.id, e); }
    }
    try { window.PionierCore?.syncWorldPitch?.(); } catch (_) {}
  } catch (err) {
    console.warn('[arp] failed to load arpeggiators', err);
    degraded.push('arpeggiators');
  }

  try {
    await import(new URL('./js/soundscapes.js?v=7', BASE).href);
  } catch (err) {
    console.error('[soundscapes] module failed to initialize', err);
    degraded.push('soundscapes');
  }

  try {
    let HANDPAN_SCALES;
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=7', BASE).href));
    window.HANDPAN_SCALES = HANDPAN_SCALES;
  } catch (err) {
    console.warn('[handpan] scales module', err);
  }

  try {
    const canvas = document.getElementById('pan');
    if (canvas) killCanvasGhosts(canvas);
  } catch (_) {}

  try {
    const { mountNotePlus } = await import(new URL('./js/note-plus.js?v=3', BASE).href);
    mountNotePlus();
  } catch (err) {
    console.warn('[note-plus] mount failed', err);
    degraded.push('note-plus');
  }

  try {
    const { mountLooper } = await import(new URL('./js/looper.js?v=207', BASE).href);
    mountLooper();
  } catch (err) {
    console.warn('[looper] mount failed', err);
    degraded.push('looper');
  }

  try {
    const { mountScaleSelector } = await import(new URL('./js/scale-selector.js?v=5', BASE).href);
    mountScaleSelector({
      getHandpan: () => window.PionierCore?.handpan,
      onScaleChange: () => {
        try { window.PionierCore?.refreshPitch?.(); } catch (_) {}
        try { window.PionierCore?.draw?.(); } catch (_) {}
        try {
          const root = document.getElementById('rootLabel');
          const hp = window.PionierCore?.handpan;
          if (root && hp?.rootLabel) root.textContent = hp.rootLabel;
        } catch (_) {}
      },
    });
  } catch (err) {
    console.warn('[scale-selector] mount failed', err);
    degraded.push('scale-selector');
  }

  if (degraded.length) {
    setBootStatus('degraded', 'Some features unavailable: ' + degraded.join(', '), true);
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
