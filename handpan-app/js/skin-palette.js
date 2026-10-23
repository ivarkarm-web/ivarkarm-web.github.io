/**
 * skin-palette.js — Phase 2: single neutral handpan finish (dark / light variants).
 * Legacy multi-skin catalog removed.
 */
(function () {
  const neutralDark = {
    body: ['#2a2c30', '#18191c', '#0c0d0f'],
    rim: [200, 205, 212],
    pad: [[70, 74, 82], [36, 38, 44], [18, 19, 22]],
    lip: [160, 165, 175],
    stroke: [190, 195, 205],
    glow: [[230, 235, 245], [140, 150, 170]],
    sheen: 0.18,
  };
  const neutralLight = {
    body: ['#d8d6d1', '#b8b5ae', '#8a8780'],
    rim: [60, 62, 68],
    pad: [[210, 208, 202], [160, 158, 152], [100, 98, 94]],
    lip: [90, 92, 98],
    stroke: [50, 52, 58],
    glow: [[80, 85, 95], [40, 45, 55]],
    sheen: 0.2,
  };
  window.PionierSkinPalette = {
    neutral: neutralDark,
    classic: neutralDark,
    light: neutralLight,
  };
})();
