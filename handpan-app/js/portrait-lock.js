/**
 * portrait-lock.js — Prefer portrait. ES module.
 * Kept for Phase 2 module graph; Phase 3 removes the hard portrait lock
 * and provides a usable landscape layout.
 */

export function tryLock() {
  try {
    const o = screen.orientation || screen.mozOrientation || screen.msOrientation;
    if (o && typeof o.lock === 'function') {
      o.lock('portrait').catch(function () {});
      return;
    }
    if (typeof screen.lockOrientation === 'function') {
      screen.lockOrientation('portrait');
    } else if (typeof screen.mozLockOrientation === 'function') {
      screen.mozLockOrientation('portrait');
    }
  } catch (_) {}
}

function onGesture() {
  tryLock();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryLock);
} else {
  tryLock();
}

document.addEventListener('click', onGesture, { once: true, passive: true });
document.addEventListener('touchstart', onGesture, { once: true, passive: true });
window.addEventListener('orientationchange', function () {
  setTimeout(tryLock, 100);
});
