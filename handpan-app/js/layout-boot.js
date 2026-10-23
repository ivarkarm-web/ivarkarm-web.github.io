/**
 * Stable Pionier layout boot.
 *
 * Important: do NOT load the legacy layout-boot from an old CDN commit.
 * That script hides .topbar, moves the mobile drawer into a fixed top dock,
 * and pins Soundscapes / FX / Customize to the top center. Those actions
 * directly conflict with pionier-control-layout.js and the requested layout.
 *
 * This file only maintains pan sizing and the record-button chrome. The
 * control-layout script owns selector placement; the original shell owns DOM
 * structure and the looper remains in #looperRail.
 */
(function stableLayoutBoot() {
  'use strict';
  if (window.__pionierStableLayoutBootV1) return;
  window.__pionierStableLayoutBootV1 = true;

  function centerPan() {
    var root = document.documentElement;
    var topbar = document.querySelector('#app > .topbar');
    var rail = document.getElementById('looperRail');
    var topH = topbar ? topbar.getBoundingClientRect().bottom : 0;
    var botH = rail ? Math.max(0, window.innerHeight - rail.getBoundingClientRect().top) : 0;
    root.style.setProperty('--chrome-top', Math.round(topH) + 'px');
    root.style.setProperty('--chrome-bottom', Math.round(botH) + 'px');
    root.style.setProperty('--pan-bottom-gap', '12px');
    root.style.setProperty('--viewport-h', window.innerHeight + 'px');

    var pan = document.getElementById('pan');
    if (pan) {
      ['position','left','right','top','bottom','transform','margin','z-index'].forEach(function (prop) {
        pan.style.removeProperty(prop);
      });
    }
    window.__pionierCenterPan = centerPan;
  }

  function ensureLooperChrome() {
    var btn = document.getElementById('looperBtn');
    if (!btn) return;
    if (!btn.querySelector('.looper-btn-core')) {
      btn.className = 'looper-btn looper-record';
      btn.innerHTML = '<span class="looper-btn-ring" aria-hidden="true"></span><span class="looper-btn-core" aria-hidden="true"></span>';
    }
    btn.style.setProperty('width', '52px', 'important');
    btn.style.setProperty('height', '52px', 'important');
    btn.style.setProperty('min-width', '52px', 'important');
    btn.style.setProperty('min-height', '52px', 'important');
    btn.style.setProperty('pointer-events', 'auto', 'important');
  }

  function boot() {
    centerPan();
    ensureLooperChrome();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('resize', centerPan, { passive: true });
  window.addEventListener('orientationchange', function () { requestAnimationFrame(centerPan); }, { passive: true });
  setTimeout(boot, 200);
  setTimeout(boot, 800);
})();