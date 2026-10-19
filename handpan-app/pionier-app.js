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
    await import(new URL('./pionier-core.js?v=67', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  try {
    await import(new URL('./js/fx-editor.js?v=9', BASE).href);
  } catch (err) {
    console.warn('[fx-editor] detailed effect editor failed to load', err);
    degraded.push('effect editor');
  }

  // Keep the app usable when browser capabilities are restricted, but explain
  // why audio or saved preferences may be unavailable instead of hiding status.
  const coreHealth = window.PionierCore?.health?.();
  if (coreHealth && !coreHealth.audioAvailable) degraded.push('audio output');
  if (coreHealth && !coreHealth.storageAvailable) degraded.push('saved settings');

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
    await import(new URL('./js/soundscapes.js?v=10', BASE).href);
  } catch (err) {
    console.error('[soundscapes] module failed to initialize', err);
    degraded.push('soundscapes');
  }

  try {
    let HANDPAN_SCALES;
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=11', BASE).href));
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
    const { mountLooper } = await import(new URL('./js/looper.js?v=221', BASE).href);
    mountLooper();
  } catch (err) {
    console.warn('[looper] mount failed', err);
    degraded.push('looper');
  }

  try {
    const { mountScaleSelector } = await import(new URL('./js/scale-selector.js?v=12', BASE).href);
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


  // Dice: jump to a random registered instrument and a random scale.
  document.getElementById('randomizeSetup')?.addEventListener('click', async () => {
    const dice = document.getElementById('randomizeSetup');
    if (dice?.dataset.rolling === '1') return;
    if (dice) { dice.dataset.rolling = '1'; dice.classList.add('is-rolling'); }
    try {
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
      // Randomize the layout too: always choose from the complete 8–13 note range.
      const randomNoteCount = 8 + Math.floor(Math.random() * 6);
      window.PionierCore?.setNoteCount?.(randomNoteCount);
    } catch (err) { console.warn('[randomize] setup selection failed', err); }
    finally {
      if (dice) { delete dice.dataset.rolling; dice.classList.remove('is-rolling'); }
    }
  });

  if (degraded.length) {
    const labels = degraded.map(name => ({ soundscapes: 'Soundscapes', 'note-plus': 'note controls', looper: 'Loop Studio', 'scale-selector': 'scale selector', arpeggiators: 'arpeggiators' }[name] || name));
    setBootStatus('degraded', 'Some features unavailable: ' + labels.join(', '), true);
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
