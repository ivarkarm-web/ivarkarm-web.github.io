/**
 * Prefer portrait. Browsers often ignore lock() unless installed as PWA;
 * the CSS gate still blocks phone landscape UI either way.
 */
(function portraitLock() {
  function tryLock() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('portrait').catch(function () {});
      }
    } catch (_) {}
  }

  function updateGate() {
    var gate = document.getElementById('portraitLock');
    if (!gate) return;
    var portrait = window.matchMedia('(orientation: portrait)').matches;
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    // Only gate phones / small tablets in landscape
    var shouldBlock = !portrait && narrow;
    if (shouldBlock) {
      gate.hidden = false;
      gate.removeAttribute('hidden');
    } else {
      gate.hidden = true;
      gate.setAttribute('hidden', '');
    }
  }

  function onChange() {
    tryLock();
    updateGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onChange);
  } else {
    onChange();
  }
  window.addEventListener('orientationchange', onChange);
  window.addEventListener('resize', onChange);
  try {
    window.matchMedia('(orientation: portrait)').addEventListener('change', onChange);
  } catch (_) {}
})();

/* Load ui-hotfix for looper icons + light-mode selector visibility */
(function loadUiHotfix() {
  if (document.querySelector('link[href*="ui-hotfix.css"]')) return;
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = './ui-hotfix.css?v=1';
  document.head.appendChild(l);
})();
