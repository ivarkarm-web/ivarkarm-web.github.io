/**
 * fx-knobs-wire.js — ensure FX panel knobs are interactive.
 * Primary wiring lives in pionier-core wireKnobs(); this file re-triggers
 * ensureAudio + paint when the FX panel opens (core may boot after first paint).
 */
(function () {
  if (window.__pionierFxKnobsWireV2) return;
  window.__pionierFxKnobsWireV2 = true;

  function kick() {
    try {
      const core = window.PionierCore;
      if (!core) return;
      core.ensureAudio?.();
      core.paintFxKnobs?.();
    } catch (_) {}
  }

  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#fxPanelOpen, button.fx-panel-open, #fxPanel, .fx-panel')) {
      setTimeout(kick, 30);
      setTimeout(kick, 200);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(kick, 100); });
  } else {
    setTimeout(kick, 100);
  }
  setInterval(kick, 3000);
})();
