/**
 * Pionier app shell: load the vendored local core and optional UI modules.
 */
const BASE = import.meta.url;

async function loadCore() {
  const degraded = [];

  try {
    await import(new URL('./pionier-core.js?v=23', BASE).href);
  } catch (err) {
    console.error('[pionier] required core failed to load', err);
    setBootStatus('failed', 'Pionier could not start. Check your connection and retry.', true);
    return false;
  }

  try {
    const { createArpInstruments } = await import(new URL('./js/instruments/arp-family.js?v=3', BASE).href);
  } catch (_) {}

  try {
    await import(new URL('./js/soundscapes.js?v=5', BASE).href);
  } catch (_) {}

  try {
    let HANDPAN_SCALES;
    ({ HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=5', BASE).href));
  } catch (_) {}

  return true;
}

function setBootStatus(state, message, showRetry) {
  const el = document.getElementById('appStatus');
  const msg = document.getElementById('appStatusMessage');
  const retry = document.getElementById('appStatusRetry');
  if (el) el.dataset.state = state || '';
  if (msg && message) msg.textContent = message;
  if (retry) retry.hidden = !showRetry;
}

loadCore().then((ok) => {
  if (ok) setBootStatus('ready', '', false);
}).catch((e) => {
  console.error(e);
  setBootStatus('failed', 'Pionier failed to start.', true);
});

document.getElementById('appStatusRetry')?.addEventListener('click', () => location.reload());
