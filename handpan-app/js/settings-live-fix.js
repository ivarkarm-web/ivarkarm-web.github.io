/**
 * settings-live-fix — ensures light mode CSS vars + live skin apply
 */
(function () {
  function enhanceApply() {
    window.addEventListener('pionier:settings', function (e) {
      const d = e.detail || {};
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
      if (window.PionierSettings && d.skin != null) {
        window.PionierSettings.skin = d.skin;
        window.PionierSettings.tonefield = d.tonefield != null ? d.tonefield : window.PionierSettings.tonefield;
        window.PionierSettings.ambient = d.ambient != null ? d.ambient : window.PionierSettings.ambient;
        window.PionierSettings.transparency = d.transparency != null ? d.transparency : window.PionierSettings.transparency;
        window.PionierSettings.lightMode = !!d.lightMode;
        if (d.led) window.PionierSettings.led = Object.assign({}, d.led);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceApply);
  else enhanceApply();
  setTimeout(enhanceApply, 400);
})();
