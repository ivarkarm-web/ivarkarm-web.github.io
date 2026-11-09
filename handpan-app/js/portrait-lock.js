/**
 * portrait-lock.js — Phase 3: portrait lock removed.
 *
 * The app now supports both portrait and landscape. This module is kept for
 * the module graph but no longer requests a portrait orientation lock.
 * Orientation-specific layout is handled by CSS (see pionier-base.css and
 * pionier-controls.css) using @media (orientation: landscape) and
 * aspect-ratio queries.
 */

export function tryLock() {
  // Intentionally no-op: do not lock orientation. Let the user choose
  // portrait or landscape; the UI adapts via CSS media queries.
}

export function releaseLock() {
  // Intentionally no-op.
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryLock);
} else {
  tryLock();
}
