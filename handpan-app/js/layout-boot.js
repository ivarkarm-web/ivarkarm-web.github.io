/**
 * Stable Pionier layout boot. ES module.
 *
 * Maintains pan sizing and the record-button chrome. The control-layout
 * script owns selector placement; the original shell owns DOM structure
 * and the looper remains in #looperRail.
 */

let layoutObserver = null;
let dockResizeObserver = null;
let observedDock = null;
let resizeScheduled = false;

export function scheduleCenterPan() {
  const currentDock = document.getElementById('pionierBottomDock');
  if (currentDock && currentDock !== observedDock && 'ResizeObserver' in window) {
    if (!dockResizeObserver) {
      dockResizeObserver = new ResizeObserver(scheduleCenterPan);
    }
    observedDock = currentDock;
    dockResizeObserver.observe(currentDock);
  }
  if (resizeScheduled) {
    return;
  }
  resizeScheduled = true;
  requestAnimationFrame(() => {
    resizeScheduled = false;
    centerPan();
  });
}

export function centerPan() {
  const root = document.documentElement;
  const chrome = document.getElementById('pionierChrome');
  const topbar = document.querySelector('#app > .topbar');
  const rail = document.getElementById('looperRail');
  const dock = document.getElementById('pionierBottomDock');
  let topH = 8;
  let botH = 160;
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

  const pan = document.getElementById('pan');
  if (pan) {
    ['position', 'left', 'right', 'top', 'bottom', 'margin', 'z-index'].forEach((prop) => {
      pan.style.removeProperty(prop);
    });
  }
  window.__pionierCenterPan = centerPan;
}

export function ensureLooperChrome() {
  const btn = document.getElementById('looperBtn');
  if (!btn) {
    return;
  }
  if (!btn.querySelector('.looper-btn-core')) {
    btn.className = 'looper-btn looper-record';
    btn.innerHTML =
      '<span class="looper-btn-ring" aria-hidden="true"></span><span class="looper-btn-core" aria-hidden="true"></span>';
  }
  btn.style.setProperty('width', '52px', 'important');
  btn.style.setProperty('height', '52px', 'important');
  btn.style.setProperty('min-width', '52px', 'important');
  btn.style.setProperty('min-height', '52px', 'important');
  btn.style.setProperty('pointer-events', 'auto', 'important');
}

export function boot() {
  centerPan();
  ensureLooperChrome();
  if (!layoutObserver && document.body) {
    layoutObserver = new MutationObserver(scheduleCenterPan);
    layoutObserver.observe(document.body, { childList: true, subtree: true });
  }
  const dock = document.getElementById('pionierBottomDock');
  if (dock) {
    scheduleCenterPan();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
window.addEventListener('resize', centerPan, { passive: true });
window.addEventListener('orientationchange', () => {
  setTimeout(centerPan, 100);
  setTimeout(centerPan, 400);
});
document.addEventListener('pionier:welcome-closed', () => {
  setTimeout(centerPan, 50);
  setTimeout(centerPan, 300);
});
