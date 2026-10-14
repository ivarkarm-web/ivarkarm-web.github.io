/**
 * Customization catalog — skins, ambients, tonefields.
 * Premium editorial palette; IDs consumed by settings, surface, ambient-fx, mandala.
 */
(function catalog() {
  const SKINS = [
    { id: 'classic', label: 'Classic Steel', group: 'Metal', mandala: 'orbit', hue: 210 },
    { id: 'bronze', label: 'Warm Bronze', group: 'Metal', mandala: 'petal', hue: 32 },
    { id: 'steel', label: 'Arctic Steel', group: 'Metal', mandala: 'rings', hue: 200 },
    { id: 'obsidian', label: 'Obsidian', group: 'Metal', mandala: 'star', hue: 280 },
    { id: 'copper', label: 'Aged Copper', group: 'Metal', mandala: 'spiral', hue: 18 },
    { id: 'silver', label: 'Moon Silver', group: 'Metal', mandala: 'orbit', hue: 220 },
    { id: 'gold', label: 'Soft Gold', group: 'Metal', mandala: 'petal', hue: 42 },
    { id: 'rose', label: 'Rose Alloy', group: 'Metal', mandala: 'bloom', hue: 350 },
    { id: 'jade', label: 'Jade Mist', group: 'Earth', mandala: 'rings', hue: 150 },
    { id: 'emerald', label: 'Deep Emerald', group: 'Earth', mandala: 'spiral', hue: 160 },
    { id: 'sand', label: 'Desert Sand', group: 'Earth', mandala: 'wave', hue: 38 },
    { id: 'terracotta', label: 'Terracotta', group: 'Earth', mandala: 'bloom', hue: 12 },
    { id: 'indigo', label: 'Indigo Night', group: 'Sky', mandala: 'star', hue: 245 },
    { id: 'aurora', label: 'Aurora', group: 'Sky', mandala: 'wave', hue: 170 },
    { id: 'twilight', label: 'Twilight', group: 'Sky', mandala: 'orbit', hue: 265 },
    { id: 'lavender', label: 'Lavender Dusk', group: 'Sky', mandala: 'petal', hue: 270 },
    { id: 'ink', label: 'Ink Black', group: 'Dark', mandala: 'rings', hue: 230 },
    { id: 'void', label: 'Void', group: 'Dark', mandala: 'star', hue: 260 },
    { id: 'pearl', label: 'Pearl', group: 'Light', mandala: 'bloom', hue: 40 },
    { id: 'opal', label: 'Opal Shift', group: 'Light', mandala: 'wave', hue: 190 },
  ];

  const AMBIENTS = [
    { id: 'none', label: 'None', group: 'Off' },
    { id: 'rain', label: 'Soft Rain', group: 'Weather' },
    { id: 'drizzle', label: 'Drizzle', group: 'Weather' },
    { id: 'mist', label: 'Morning Mist', group: 'Weather' },
    { id: 'snow', label: 'Quiet Snow', group: 'Weather' },
    { id: 'fire', label: 'Ember Glow', group: 'Fire' },
    { id: 'candles', label: 'Candlelight', group: 'Fire' },
    { id: 'embers', label: 'Floating Embers', group: 'Fire' },
    { id: 'forest', label: 'Forest Floor', group: 'Nature' },
    { id: 'leaves', label: 'Falling Leaves', group: 'Nature' },
    { id: 'pollen', label: 'Pollen Drift', group: 'Nature' },
    { id: 'fireflies', label: 'Fireflies', group: 'Nature' },
    { id: 'night', label: 'Starfield', group: 'Cosmos' },
    { id: 'nebula', label: 'Soft Nebula', group: 'Cosmos' },
    { id: 'aurora', label: 'Northern Lights', group: 'Cosmos' },
    { id: 'meteors', label: 'Slow Meteors', group: 'Cosmos' },
    { id: 'ocean', label: 'Deep Ocean', group: 'Water' },
    { id: 'bubbles', label: 'Rising Bubbles', group: 'Water' },
    { id: 'dust', label: 'Golden Dust', group: 'Light' },
    { id: 'bokeh', label: 'Soft Bokeh', group: 'Light' },
    { id: 'pulse', label: 'Breath Pulse', group: 'Light' },
    { id: 'haze', label: 'Warm Haze', group: 'Light' },
  ];

  const TONEFIELDS = [
    { id: 'classic', label: 'Classic Oval' },
    { id: 'round', label: 'Soft Round' },
    { id: 'petal', label: 'Petal' },
    { id: 'diamond', label: 'Soft Diamond' },
    { id: 'hex', label: 'Gentle Hex' },
    { id: 'teardrop', label: 'Teardrop' },
    { id: 'wave', label: 'Wave Edge' },
    { id: 'crescent', label: 'Crescent' },
    { id: 'seed', label: 'Seed' },
    { id: 'halo', label: 'Halo Ring' },
  ];

  window.PionierCatalog = { SKINS, AMBIENTS, TONEFIELDS };
})();
