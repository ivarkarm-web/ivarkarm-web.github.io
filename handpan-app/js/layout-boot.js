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
  var layoutObserver = null;
  var dockResizeObserver = null;
  var observedDock = null;
  var resizeScheduled = false;
  function scheduleCenterPan() {
    var currentDock = document.getElementById('pionierBottomDock');
    if (currentDock && currentDock !== observedDock && 'ResizeObserver' in window) {
      if (!dockResizeObserver) dockResizeObserver = new ResizeObserver(scheduleCenterPan);
      observedDock = currentDock;
      dockResizeObserver.observe(currentDock);
    }
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(function () { resizeScheduled = false; centerPan(); });
  }

  function centerPan() {
    var root = document.documentElement;
    var chrome = document.getElementById('pionierChrome');
    var topbar = document.querySelector('#app > .topbar');
    var rail = document.getElementById('looperRail');
    var dock = document.getElementById('pionierBottomDock');
    var topH = 8;
    var botH = 160;
    if (dock && dock.getBoundingClientRect().height > 0) {
      botH = Math.max(120, Math.ceil(dock.getBoundingClientRect().height + 12));
    } else if (chrome) {
      botH = Math.max(120, Math.ceil(window.innerHeight - chrome.getBoundingClientRect().top));
    } else if (rail && rail.getBoundingClientRect().height > 0) {
      botH = Math.max(0, Math.ceil(window.innerHeight - rail.getBoundingClientRect().top));
    } else if (topbar) {
      topH = Math.round(topbar.getBoundingClientRect().bottom);
    }
    root.style.setProperty('--chrome-top', topH + 'px');
    root.style.setProperty('--chrome-bottom', botH + 'px');
    root.style.setProperty('--pan-bottom-gap', '12px');
    root.style.setProperty('--viewport-h', window.innerHeight + 'px');

    var pan = document.getElementById('pan');
    if (pan) {
      ['position','left','right','top','bottom','margin','z-index'].forEach(function (prop) {
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
    if (!layoutObserver && document.body) {
      layoutObserver = new MutationObserver(scheduleCenterPan);
      layoutObserver.observe(document.body, { childList: true, subtree: true });
    }
    var dock = document.getElementById('pionierBottomDock');
    if (dock) scheduleCenterPan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('resize', centerPan, { passive: true });
  window.addEventListener('orientationchange', function () {
    setTimeout(centerPan, 100);
    setTimeout(centerPan, 400);
  });
  document.addEventListener('pionier:welcome-closed', function () {
    setTimeout(centerPan, 50);
    setTimeout(centerPan, 300);
  });
})();
