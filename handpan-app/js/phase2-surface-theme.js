/**
 * Phase 2: force neutral palette + disable mandala after modules load.
 * Works alongside pionier-surface by overriding PionierSkinPalette and settings.
 */
(function () {
  if (window.__pionierPhase2Surface) return;
  window.__pionierPhase2Surface = true;

  var neutralDark = {
    body: ['#2a2c30', '#18191c', '#0c0d0f'],
    rim: [200, 205, 212],
    pad: [[70, 74, 82], [36, 38, 44], [18, 19, 22]],
    lip: [160, 165, 175],
    stroke: [190, 195, 205],
    glow: [[230, 235, 245], [140, 150, 170]],
    sheen: 0.18
  };
  var neutralLight = {
    body: ['#d8d6d1', '#b8b5ae', '#8a8780'],
    rim: [60, 62, 68],
    pad: [[210, 208, 202], [160, 158, 152], [100, 98, 94]],
    lip: [90, 92, 98],
    stroke: [50, 52, 58],
    glow: [[80, 85, 95], [40, 45, 55]],
    sheen: 0.2
  };

  function applyPalette() {
    var light = document.documentElement.classList.contains('theme-light');
    var skin = light ? neutralLight : neutralDark;
    window.PionierSkinPalette = {
      neutral: neutralDark,
      classic: skin,
      light: neutralLight,
      bronze: skin, steel: skin, obsidian: skin, copper: skin,
      silver: skin, gold: skin, rose: skin, jade: skin, emerald: skin,
      sand: skin, terracotta: skin, indigo: skin, aurora: skin,
      twilight: skin, lavender: skin, ink: skin, void: skin, pearl: skin, opal: skin
    };
    if (window.PionierSettings) {
      window.PionierSettings.mandala = false;
      window.PionierSettings.skin = light ? 'light' : 'classic';
      window.PionierSettings.auraStyle = 'none';
    }
    var canvas = document.getElementById('skinMandalaCanvas');
    if (canvas) canvas.remove();
  }

  applyPalette();
  window.addEventListener('pionier:settings', applyPalette);
  setInterval(applyPalette, 1500);
})();
