/**
 * skin-palette.js — Phase 2: single neutral handpan finish (dark / light variants).
 * Legacy multi-skin catalog removed. ES module.
 *
 * classic/neutral always mirror the active theme so canvas drawing
 * (which prefers palette.classic) picks the correct finish.
 */

export const neutralDark = {
  body: ['#2a2c30', '#18191c', '#0c0d0f'],
  rim: [200, 205, 212],
  pad: [
    [70, 74, 82],
    [36, 38, 44],
    [18, 19, 22],
  ],
  lip: [160, 165, 175],
  stroke: [190, 195, 205],
  glow: [
    [230, 235, 245],
    [140, 150, 170],
  ],
  sheen: 0.18,
};

export const neutralLight = {
  body: ['#d8d6d1', '#b8b5ae', '#8a8780'],
  rim: [60, 62, 68],
  pad: [
    [210, 208, 202],
    [160, 158, 152],
    [100, 98, 94],
  ],
  lip: [90, 92, 98],
  stroke: [50, 52, 58],
  glow: [
    [80, 85, 95],
    [40, 45, 55],
  ],
  sheen: 0.2,
};

export function isLight() {
  try {
    if (window.PionierSettings && window.PionierSettings.lightMode === true) {
      return true;
    }
    if (window.PionierSettings && window.PionierSettings.lightMode === false) {
      return false;
    }
  } catch (_) {}
  return !!(document.documentElement && document.documentElement.classList.contains('theme-light'));
}

export function applyPalette() {
  const light = isLight();
  const active = light ? neutralLight : neutralDark;
  window.PionierSkinPalette = {
    neutral: active,
    classic: active,
    light: neutralLight,
    dark: neutralDark,
  };
}

applyPalette();

window.addEventListener('pionier:settings', () => {
  applyPalette();
  try {
    window.PionierCore?.draw?.();
  } catch (_) {}
});

// Catch theme toggles that only flip the class.
try {
  const obs = new MutationObserver(() => {
    applyPalette();
    try {
      window.PionierCore?.draw?.();
    } catch (_) {}
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
} catch (_) {}
