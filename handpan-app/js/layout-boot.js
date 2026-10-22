/**
 * Temporary loader: restore layout-boot from last known-good commit,
 * then apply landscape guards once the core script is present.
 */
(function restoreLayoutBoot() {
  var DONE = false;
  function applyGuards() {
    if (DONE) return;
    if (typeof window.__pionierCenterPan !== 'function') return;
    DONE = true;
    // Landscape-aware wrappers around existing helpers
    var _centerTop = window.__pionierCenterTopChrome;
    window.__pionierRelayoutPortrait = function () {
      try {
        if (document.body.classList.contains('pionier-landscape')) return;
        if (typeof window.__pionierEnsureBottomBar === 'function') window.__pionierEnsureBottomBar();
        if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
      } catch (e) {
        console.warn('[layout-boot] relayoutPortrait', e);
      }
    };
  }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@ed103754b0ecc5ac7e2dd97b2a8020a3dd8d87e1/handpan-app/js/layout-boot.js';
  s.onload = function () {
    applyGuards();
    setTimeout(applyGuards, 100);
    setTimeout(applyGuards, 500);
  };
  s.onerror = function () {
    console.error('[layout-boot] failed to load restored core');
  };
  document.head.appendChild(s);
})();
