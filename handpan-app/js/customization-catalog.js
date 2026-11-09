/**
 * Customization catalog — Phase 2: skins/auras removed; ambients kept.
 */
(function catalog() {
  const SKINS = [];
  const AURAS = [];
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
  window.PionierCatalog = { SKINS, AMBIENTS, AURAS };
})();
