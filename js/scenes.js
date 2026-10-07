/**
 * scenes.js — bootstrap: load last known-good scenes, then enhancements
 */
(function () {
  function loadScript(src, onload) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload || function () {};
    s.onerror = function () { console.error('[scenes] failed', src); };
    document.head.appendChild(s);
  }
  // Full module from last known-good commit (avoids broken intermediate pushes)
  loadScript(
    'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@b009ac11/js/scenes.js',
    function () {
      console.info('[scenes] core restored');
      // Enhancements: spawn hint + richer section reveals
      loadScript('./js/scenes-enhance.js?v=1');
    }
  );
})();
