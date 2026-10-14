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
    await import(new URL('./pionier-core.js?v=20', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  const core = window.PionierCore;
  if (!core) {
    setBootStatus('failed', 'Pionier core did not initialize. Retry.', true);
    return false;
  }

  try {
    await core.boot?.();
  } catch (err) {
    console.error('[pionier] core.boot failed', err);
    setBootStatus('failed', 'Pionier could not start audio. Retry.', true);
    return false;
  }

  const canvas = document.getElementById('pan');
  killCanvasGhosts(canvas);

  const scaleLabel = document.getElementById('scaleLabel');
  const scaleMenu = document.getElementById('scaleMenu');
  if (scaleLabel && scaleMenu && core.getScales) {
    const scales = core.getScales();
    const renderMenu = () => {
      scaleMenu.innerHTML = '';
      scales.forEach((scale, idx) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'menuitem';
        button.className = 'scale-menu-item';
        button.textContent = scale.label;
        button.addEventListener('click', () => {
          const inst = core.getInstrument?.();
          if (inst?.handpan?.setScaleIndex) {
            inst.handpan.setScaleIndex(idx);
            core.refreshPitch?.();
          }
          scaleLabel.textContent = scale.label + ' ▾';
          scaleMenu.hidden = true;
          scaleLabel.setAttribute('aria-expanded', 'false');
        });
        scaleMenu.appendChild(button);
      });
    };
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
  }

  try {
    const { mountNotePlus } = await import(new URL('./js/note-plus.js?v=3', BASE).href);
    mountNotePlus();
  } catch (err) {
    console.warn('[note-plus] mount failed', err);
    degraded.push('note-count controls');
  }

  try {
    const { mountLooper } = await import(new URL('./js/looper.js?v=201', BASE).href);
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
