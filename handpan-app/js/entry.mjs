/**
 * Pionier entry module — single ES-module entry point for the app.
 *
 * All modules are imported statically here so Vite can bundle them into
 * hashed, minified chunks. index.html loads only this entry (plus an
 * optional inline boot flag); there are no classic <script> tags.
 *
 * Import order matters: modules self-initialize on import (they call
 * boot() / wire() at module level). Core audio modules load first, then
 * the merged core, then the app boot, then UI modules.
 */

// ── Core audio / instrument graph ─────────────────────────────────────
import './audio-core.js';
import './instrument.js';
import './gesture.js';
import './instruments/handpan.js';
import './instruments/library-family.js';
import './fx.js';
import './debug.js';
import './pionier-surface.js';

// ── Merged core (pionier-core-base.js + pionier-core.js) ──────────────
import '../pionier-core-base.js';
import '../pionier-core.js';

// ── App boot ──────────────────────────────────────────────────────────
import { boot as bootApp } from '../pionier-app.js';

// ── UI / shell modules (self-initializing on import) ──────────────────
import './skin-palette.js';
import './customization-catalog.js';
import './overlay-controller.js';
import './layout-boot.js';
import '../pionier-control-layout.js';
import '../looper-side-menus.js';
import '../looper-circle-progress.js';
import './settings-panel.js';
import './favorites.js';
import './about-window.js';
import './ambient-fx.js';
import './skin-mandala.js';
import '../welcome-screen.js';
import './portrait-lock.js';

// ── Service worker ────────────────────────────────────────────────────
import '../registerSW.js';

// ── Run the app boot ──────────────────────────────────────────────────
bootApp().catch((err) => {
  console.error('[pionier] boot failed', err);
  const statusEl = document.getElementById('appStatus');
  if (statusEl) {
    statusEl.dataset.state = 'failed';
    statusEl.hidden = false;
    statusEl.setAttribute('role', 'alert');
    const msg = statusEl.querySelector('#appStatusMessage');
    if (msg) msg.textContent = 'Core failed to load. Check your connection and retry.';
    const retry = statusEl.querySelector('#appStatusRetry');
    if (retry) {
      retry.hidden = false;
      retry.addEventListener('click', () => window.location.reload());
    }
  }
});
