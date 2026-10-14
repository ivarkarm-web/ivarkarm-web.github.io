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

async function bootApp() {
  setBootStatus('loading', 'Starting handpan…');
  try {
    const canvas = document.getElementById('handpanCanvas') || document.querySelector('canvas#surface') || document.querySelector('canvas');
    if (canvas) killCanvasGhosts(canvas);
    await import(new URL('./pionier-core.js?v=24', BASE).href);
    try { window.PionierCore?.syncWorldPitch?.(); } catch (_) {}
    setBootStatus('ready');
  } catch (err) {
    console.error('[pionier] boot failed', err);
    setBootStatus('failed', 'Could not start the instrument. Check your connection and reload.', true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
