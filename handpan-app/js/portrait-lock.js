/**
 * Prefer portrait. Browsers often ignore lock() unless installed as PWA;
 * the CSS gate still blocks phone landscape UI either way.
 */
(function portraitLock() {
  function tryLock() {
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
})();

/* Load ui-hotfix for looper icons + light-mode selector visibility */
(function loadUiHotfix() {
  if (document.querySelector('link[href*="ui-hotfix.css"]')) return;
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = './ui-hotfix.css?v=1';
  document.head.appendChild(l);
})();

/* Android: force scrollable scale / instrument pickers + ensure overlay v24 */
(function loadAndroidPickerScroll() {
  if (!document.querySelector('link[href*="android-picker-scroll.css"]')) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = './android-picker-scroll.css?v=1';
    document.head.appendChild(l);
  }
  // Upgrade overlay-controller to the Android-scroll build if still on v23.
  var scripts = document.querySelectorAll('script[src*="overlay-controller.js"]');
  scripts.forEach(function (s) {
    var src = s.getAttribute('src') || '';
    if (src.indexOf('v=24') !== -1) return;
    var next = document.createElement('script');
    next.src = './js/overlay-controller.js?v=24';
    next.async = false;
    s.parentNode.insertBefore(next, s.nextSibling);
  });
})();
