/**
 * TonePad loader — temporarily restore sequencer from last good commit.
 * Full inlined v37 follows in a subsequent update if CDN path is insufficient.
 */
const SOURCE =
  'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@045fac31124e75fb5fa18554b201ceadbf1b4962/handpan-app/js/tonepad.js';

export async function mountTonepad() {
  try {
    const mod = await import(/* webpackIgnore: true */ SOURCE);
    if (typeof mod.mountTonepad === 'function') {
      const api = await mod.mountTonepad();
      // Ensure toggle stays wired after layout recovery docks it
      try {
        const btn = document.getElementById('tonepadToggle');
        if (btn) {
          btn.style.visibility = 'visible';
          btn.style.display = '';
          if (!btn.dataset.tpWired && api && typeof api.toggle === 'function') {
            btn.dataset.tpWired = '1';
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              api.toggle();
            });
          }
        }
      } catch (_) {}
      return api;
    }
  } catch (err) {
    console.error('[tonepad] restore failed', err);
  }
  return null;
}
