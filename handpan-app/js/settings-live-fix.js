/**
 * settings-live-fix — light mode CSS vars, live skin, Controls label
 */
(function () {
  function syncControlsLabel() {
    const drawer = document.getElementById('mobileControlDrawer');
    const toggle = document.getElementById('mobileControlsToggle');
    if (!toggle) return;
    const open = !!(drawer && drawer.classList.contains('is-open'));
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  }

  function onSettings(e) {
    const d = (e && e.detail) || {};
    const root = document.documentElement;
    if (d.lightMode) {
      root.classList.add('theme-light');
      root.classList.remove('dark');
      root.style.setProperty('--bg', '#e8e6e1');
      root.style.setProperty('--bg-elevated', '#f2f0eb');
      root.style.setProperty('--text', '#1a1a1c');
    } else if (d.lightMode === false) {
      root.classList.remove('theme-light');
      root.classList.add('dark');
      root.style.setProperty('--bg', '#070708');
      root.style.setProperty('--bg-elevated', '#0e0e10');
      root.style.removeProperty('--text');
    }
    if (window.PionierSettings) {
      if (d.skin != null) window.PionierSettings.skin = d.skin;
      if (d.tonefield != null) window.PionierSettings.tonefield = d.tonefield;
      if (d.ambient != null) window.PionierSettings.ambient = d.ambient;
      if (d.transparency != null) window.PionierSettings.transparency = d.transparency;
      if (d.mandala != null) window.PionierSettings.mandala = d.mandala;
      if (d.lightMode != null) window.PionierSettings.lightMode = !!d.lightMode;
      if (d.led) window.PionierSettings.led = Object.assign({}, d.led);
    }
    if (d.skin != null) root.dataset.skin = d.skin;
    if (d.tonefield != null) root.dataset.tonefield = d.tonefield;
    if (d.ambient != null) root.dataset.ambient = d.ambient;
    syncControlsLabel();
  }

  window.addEventListener('pionier:settings', onSettings);
  setInterval(syncControlsLabel, 800);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncControlsLabel);
  } else {
    syncControlsLabel();
  }
})();
