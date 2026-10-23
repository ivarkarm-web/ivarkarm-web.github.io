/**
 * phase3-handpan-theme.js — maps CSS theme tokens → PionierSkinPalette for canvas.
 */
(function () {
  if (window.__pionierPhase3Theme) return;
  window.__pionierPhase3Theme = true;

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function parseRgbTriplet(str, fallback) {
    if (!str) return fallback;
    var parts = String(str).split(',').map(function (s) { return parseInt(s.trim(), 10); });
    if (parts.length >= 3 && parts.every(function (n) { return Number.isFinite(n); })) {
      return [parts[0], parts[1], parts[2]];
    }
    return fallback;
  }

  function buildPalette() {
    var disc0 = cssVar('--hp-disc-0', '#2e3036');
    var disc1 = cssVar('--hp-disc-1', '#1a1b1f');
    var disc2 = cssVar('--hp-disc-2', '#0e0f12');
    var pad0 = parseRgbTriplet(cssVar('--hp-pad-0', '58,60,68'), [58, 60, 68]);
    var pad1 = parseRgbTriplet(cssVar('--hp-pad-1', '36,38,44'), [36, 38, 44]);
    var pad2 = parseRgbTriplet(cssVar('--hp-pad-2', '22,23,27'), [22, 23, 27]);
    var rim = parseRgbTriplet(cssVar('--hp-rim', '220,224,232'), [220, 224, 232]);
    var lip = parseRgbTriplet(cssVar('--hp-lip', '200,204,212'), [200, 204, 212]);
    var stroke = parseRgbTriplet(cssVar('--hp-stroke', '255,255,255'), [255, 255, 255]);
    var glow0 = parseRgbTriplet(cssVar('--hp-glow-0', '230,235,245'), [230, 235, 245]);
    var glow1 = parseRgbTriplet(cssVar('--hp-glow-1', '140,150,170'), [140, 150, 170]);
    var sheen = parseFloat(cssVar('--hp-sheen', '0.12')) || 0.12;

    var skin = {
      body: [disc0, disc1, disc2],
      rim: rim,
      pad: [pad0, pad1, pad2],
      lip: lip,
      stroke: stroke,
      glow: [glow0, glow1],
      sheen: sheen
    };

    var map = { neutral: skin, classic: skin, light: skin };
    [
      'bronze', 'steel', 'obsidian', 'copper', 'silver', 'gold', 'rose',
      'jade', 'emerald', 'sand', 'terracotta', 'indigo', 'aurora',
      'twilight', 'lavender', 'ink', 'void', 'pearl', 'opal'
    ].forEach(function (id) { map[id] = skin; });

    window.PionierSkinPalette = map;

    if (window.PionierSettings) {
      window.PionierSettings.mandala = false;
      window.PionierSettings.auraStyle = 'none';
      window.PionierSettings.skin = 'neutral';
    }

    var el = document.getElementById('skinMandalaCanvas');
    if (el) el.remove();

    var accent = parseRgbTriplet(cssVar('--hp-accent', '201,162,39'), [201, 162, 39]);
    try {
      document.documentElement.style.setProperty(
        '--led-color',
        'rgb(' + accent[0] + ',' + accent[1] + ',' + accent[2] + ')'
      );
    } catch (_) {}
  }

  function apply() {
    buildPalette();
    try {
      if (window.PionierCore && typeof window.PionierCore.draw === 'function') {
        window.PionierCore.draw();
      }
    } catch (_) {}
  }

  apply();
  window.addEventListener('pionier:settings', apply);
  try {
    var obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (_) {}
  setTimeout(apply, 200);
  setTimeout(apply, 800);
  setTimeout(apply, 2000);
})();
