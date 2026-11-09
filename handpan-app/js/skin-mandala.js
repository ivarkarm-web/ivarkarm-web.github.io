/** skin-mandala.js — Phase 2: mandala aura removed. */
(function () {
  var el = document.getElementById('skinMandalaCanvas');
<<<<<<< HEAD
  if (el) el.remove();
=======
  if (el) {
    el.remove();
  }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
  window.PionierMandala = { setFromSettings: function () {}, resize: function () {} };
})();
