/**
 * layout-boot.js — minimal shell. Old looper-rail / FX-drawer reparenting removed
 * so the screenshot UI (sidebars + transport) stays authoritative.
 */
(function () {
  'use strict';
  function hideLegacy() {
    const legacyIds = [
      'looperRail',
      'looperRecordCluster',
      'looperLayers',
      'looperClearBtn',
      'fxPanelOpen',
      'settingsOpenBtn',
      'settingsSheet',
      'settingsSheetBackdrop',
      'stageScaleBar',
    ];
    for (const id of legacyIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'display:none!important;visibility:hidden!important;pointer-events:none!important;';
    }
    // Hide any injected settings open button
    document.querySelectorAll('.settings-open-btn, button.fx-panel-open').forEach((el) => {
      el.hidden = true;
      el.style.cssText = 'display:none!important;visibility:hidden!important;';
    });
  }

  function bindMobileDrawer() {
    const toggle = document.getElementById('mobileControlsToggle');
    const panel = document.getElementById('mobileControlPanel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(() => {
    hideLegacy();
    bindMobileDrawer();
    // Re-hide after other scripts may inject UI
    setTimeout(hideLegacy, 50);
    setTimeout(hideLegacy, 400);
    setTimeout(hideLegacy, 1500);
  });
})();
