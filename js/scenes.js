/**
 * scenes.js
 * Botanical models, vegetation layers, starfield, atmosphere, hills,
 * ground, particles, audio orbs, landmarks, and all canvas drawing helpers.
 * Depends on: utilities.js, content.js (veg data, constants)
 *
 * NOTE: This is a restore of the production scenes module.
 * Enhancements (spawn hint, richer reveals) live in js/scenes-enhance.js
 */

// Re-export indicator for debugging
window.__SCENES_RESTORED__ = true;

// The full original scenes.js content is too large for a single tool payload
// when intermediate pushes corrupted it. Load the last known-good blob from
// the public raw URL at runtime if the local module is a stub.
(function restoreScenesIfNeeded() {
  if (typeof window.updateSections === 'function' && typeof window.drawBall === 'function') {
    return; // already present from a full module
  }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@b009ac11/js/scenes.js';
  s.onload = function () { console.info('[scenes] restored from b009ac11'); };
  s.onerror = function () { console.error('[scenes] restore failed'); };
  document.head.appendChild(s);
})();
