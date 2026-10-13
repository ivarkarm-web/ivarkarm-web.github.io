/**
 * Pionier app shell: load the vendored local core and optional UI modules.
 * No CDN fetch, source rewriting, Blob module, or runtime string patches.
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

  // The core is required; if it cannot load, keep the recovery surface visible.
  try {
    await import(new URL('./pionier-core.js?v=7', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  try {
    await import(new URL('./js/soundscapes.js?v=5', BASE).href);
  } catch (err) {
    console.error('[soundscapes] module failed to initialize', err);
    degraded.push('Soundscapes');
  }

  const pan = () => document.getElementById('pan');
  killCanvasGhosts(pan());
  requestAnimationFrame(() => killCanvasGhosts(pan()));

  let HANDPAN_SCALES = null;
  try {
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=5', BASE).href));
  } catch (err) {
    console.error('[scale-picker] module failed to initialize', err);
    degraded.push('the scale picker');
  }
  const scaleLabel = document.getElementById('scaleLabel');
  const scaleMenu = document.getElementById('scaleMenu');
  if (scaleLabel && scaleMenu && HANDPAN_SCALES) {
    function renderMenu() {
      scaleMenu.replaceChildren();
      let lastTuning = null;
      HANDPAN_SCALES.forEach((scale) => {
        const tuning = scale.tuning || '12-TET';
        if (tuning !== lastTuning) {
          lastTuning = tuning;
          const head = document.createElement('div');
          head.className = 'scale-menu-group';
          head.textContent = tuning;
          scaleMenu.appendChild(head);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'scale-menu-item';
        button.setAttribute('role', 'menuitem');
        const name = document.createElement('span');
        name.textContent = scale.label;
        button.appendChild(name);
        if (tuning !== '12-TET') {
          const sub = document.createElement('span');
          sub.className = 'scale-item-tuning';
          sub.textContent = tuning;
          button.appendChild(sub);
        }
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = HANDPAN_SCALES.indexOf(scale);
          const core = window.PionierCore;
          // Prefer core.setScaleIndex so library instruments (koto, harp, …)
          // also receive the new scale via syncWorldPitch / refreshPitch.
          if (core?.setScaleIndex && idx >= 0) core.setScaleIndex(idx);
          else if (core?.handpan && idx >= 0) {
            core.handpan.setScaleIndex(idx);
            core.refreshPitch?.();
          }
          scaleLabel.textContent = scale.label + ' ▾';
          scaleMenu.hidden = true;
          scaleLabel.setAttribute('aria-expanded', 'false');
        });
        scaleMenu.appendChild(button);
      });
    }

    renderMenu();

    scaleLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      const instMenu = document.getElementById('instrumentMenu');
      if (instMenu) instMenu.hidden = true;
      const open = scaleMenu.hidden;
      scaleMenu.hidden = !open;
      scaleLabel.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (scaleMenu.hidden) return;
      if (e.target.closest('#scaleMenu') || e.target.closest('#scaleLabel')) return;
      scaleMenu.hidden = true;
      scaleLabel.setAttribute('aria-expanded', 'false');
    });

    document.getElementById('instrumentDropdownToggle')?.addEventListener('click', () => {
      scaleMenu.hidden = true;
      scaleLabel.setAttribute('aria-expanded', 'false');
    });

    const mark = () => {
      const t = scaleLabel.textContent || '';
      if (!t.includes('▾')) scaleLabel.textContent = t.trim() + ' ▾';
    };
    document.getElementById('scalePrev')?.addEventListener('click', () => setTimeout(mark, 0));
    document.getElementById('scaleNext')?.addEventListener('click', () => setTimeout(mark, 0));
    mark();
  }

  try {
    const { mountNotePlus } = await import(
      new URL('./js/note-plus.js?v=2', BASE).href
    );
    mountNotePlus();
  } catch (err) {
    console.warn('[note-plus] mount failed', err);
    degraded.push('note-count controls');
  }

  try {
    const { mountBackdropPlayer } = await import(
      new URL('./js/backdrop-player.js?v=96', BASE).href
    );
    mountBackdropPlayer();
  } catch (err) {
    console.warn('[backdrop] mount failed', err);
    degraded.push('the ambient player');
  }

  try {
    const { mountLooper } = await import(
      new URL('./js/looper.js?v=106', BASE).href
    );
    mountLooper();
  } catch (err) {
    console.warn('[looper] mount failed', err);
    degraded.push('the looper');
  }

  const health = window.PionierCore?.health?.();
  if (health && !health.audioAvailable) degraded.push('audio output');
  if (health && !health.storageAvailable) degraded.push('saved settings');
  if (degraded.length) {
    setBootStatus('degraded', `Pionier is running with limited features: ${degraded.join(', ')}. Reload to retry.`, true);
  } else {
    setBootStatus('ready', '');
  }
  return true;
}

boot().catch((err) => {
  console.error('[pionier] unexpected boot failure', err);
  setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
});
