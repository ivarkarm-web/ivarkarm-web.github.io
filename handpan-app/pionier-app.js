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

/** Unlock Web Audio inside a user-gesture stack (iOS Safari). */
function unlockAudioFromGesture() {
  try {
    const HA = window.HandpanAudio;
    const ctx = HA?.getAudioContext?.() || null;
    if (ctx && ctx.state !== 'running') {
      try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_) {}
    }
    HA?.resumeAudio?.();
    window.PionierCore?.getAudioContext?.();
  } catch (_) {}
}

window.addEventListener('pionier:user-enter', () => {
  unlockAudioFromGesture();
});

const deferred = {
  looper: null,
  fxEditor: null,
  arps: null,
  notePlus: null,
  soundscapes: null,
};

function loadModule(key, loader) {
  if (deferred[key]) return deferred[key];
  deferred[key] = Promise.resolve()
    .then(loader)
    .catch((err) => {
      console.warn('[pionier] deferred module failed:', key, err);
      deferred[key] = null;
      throw err;
    });
  return deferred[key];
}

function loadLooper() {
  return loadModule('looper', async () => {
    const { mountLooper } = await import(new URL('./js/looper.js?v=222', BASE).href);
    mountLooper();
  });
}

function loadFxEditor() {
  return loadModule('fxEditor', async () => {
    await import(new URL('./js/fx-editor.js?v=9', BASE).href);
  });
}

function loadArps() {
  return loadModule('arps', async () => {
    const { createArpInstruments } = await import(new URL('./js/instruments/arp-family.js?v=3', BASE).href);
    const { InstrumentRegistry } = await import(new URL('./js/instrument.js', BASE).href);
    for (const inst of createArpInstruments()) {
      try { InstrumentRegistry.register(inst); } catch (e) { console.warn('[arp] register', inst?.id, e); }
    }
    try { window.PionierCore?.syncWorldPitch?.(); } catch (_) {}
  });
}

function loadNotePlus() {
  return loadModule('notePlus', async () => {
    const { mountNotePlus } = await import(new URL('./js/note-plus.js?v=3', BASE).href);
    mountNotePlus();
  });
}

function loadSoundscapes() {
  return loadModule('soundscapes', async () => {
    await import(new URL('./js/soundscapes.js?v=11', BASE).href);
  });
}

function scheduleDeferredFeatures() {
  const idle = typeof requestIdleCallback === 'function'
    ? (fn) => requestIdleCallback(fn, { timeout: 2500 })
    : (fn) => setTimeout(fn, 500);

  idle(() => {
    loadArps().catch(() => {});
    loadNotePlus().catch(() => {});
    loadLooper().catch(() => {});
  });

  const rail = document.getElementById('looperRail');
  rail?.addEventListener('pointerdown', () => { loadLooper().catch(() => {}); }, { once: true, capture: true });
  document.getElementById('looperBtn')?.addEventListener('pointerdown', () => { loadLooper().catch(() => {}); }, { once: true, capture: true });

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('[data-fx-editor-open]')) loadFxEditor().catch(() => {});
  }, true);
  window.addEventListener('pionier:fx-editor-open', () => { loadFxEditor().catch(() => {}); });

  document.getElementById('openSoundscapes')?.addEventListener('click', () => {
    loadSoundscapes().catch(() => {});
  }, { capture: true });
}

async function boot() {
  setBootStatus('loading', 'Starting Pionier…');
  const degraded = [];

  try {
    await import(new URL('./pionier-core.js?v=70', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  const coreHealth = window.PionierCore?.health?.();
  if (coreHealth && !coreHealth.audioAvailable) degraded.push('audio output');
  if (coreHealth && !coreHealth.storageAvailable) degraded.push('saved settings');

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
      const randomNoteCount = 8 + Math.floor(Math.random() * 6);
      window.PionierCore?.setNoteCount?.(randomNoteCount);
    } catch (err) { console.warn('[randomize] setup selection failed', err); }
    finally {
      if (dice) { delete dice.dataset.rolling; dice.classList.remove('is-rolling'); }
    }
  });

  scheduleDeferredFeatures();

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
