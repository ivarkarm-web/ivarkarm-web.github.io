export const VOICE_PRESETS = [
  {
    id: 'steel',
    name: 'Steel',
    wave: 'sine',
    partials: [1, 2.01, 3.99, 5.99, 8.02],
    decay: 5.9,
    release: 0.72,
    spread: 0.006,
    noiseLevel: 0.18,
    noiseDecay: 0.055,
    noiseQ: 1.1,
    noiseRatio: 3.6
  },
  {
    id: 'warm',
    name: 'Warm',
    wave: 'triangle',
    partials: [1, 1.01, 2.01, 3.02, 4.98],
    decay: 7.1,
    release: 0.95,
    spread: 0.011,
    noiseLevel: 0.12,
    noiseDecay: 0.075,
    noiseQ: 0.8,
    noiseRatio: 2.8
  },
  {
    id: 'bell',
    name: 'Bell',
    wave: 'sine',
    partials: [1, 2.02, 4.01, 6.08, 9.12],
    decay: 4.2,
    release: 0.52,
    spread: 0.004,
    noiseLevel: 0.1,
    noiseDecay: 0.045,
    noiseQ: 1.8,
    noiseRatio: 5.2
  },
  {
    id: 'soft',
    name: 'Soft',
    wave: 'sine',
    partials: [1, 1.005, 2.005, 3.01, 5.01],
    decay: 6.8,
    release: 1.1,
    spread: 0.02,
    noiseLevel: 0.07,
    noiseDecay: 0.08,
    noiseQ: 0.65,
    noiseRatio: 2.2
  },
  {
    id: 'deep',
    name: 'Deep',
    wave: 'sine',
    partials: [0.5, 1, 2, 3, 4],
    decay: 8.6,
    release: 1.45,
    spread: 0.008,
    noiseLevel: 0.13,
    noiseDecay: 0.07,
    noiseQ: 0.7,
    noiseRatio: 1.8
  }
];

const LEGACY_NAMES = new Map([
  ['Glass Bloom', 'Steel'],
  ['Soft Bells', 'Bell'],
  ['Moon Pluck', 'Warm'],
  ['Shimmer', 'Bell'],
  ['Soft Pulse', 'Soft'],
  ['Air Choir', 'Soft'],
  ['Glass Pluck', 'Bell'],
  ['Deep Resonator', 'Deep'],
  ['Drift Arp', 'Warm']
]);

export function resolveVoiceIndex(selection) {
  if (typeof selection === 'number' && Number.isFinite(selection)) {
    const legacyIndex = Math.max(0, Math.min(8, Math.floor(selection)));
    const legacyNames = ['Glass Bloom','Soft Bells','Moon Pluck','Shimmer','Soft Pulse','Air Choir','Glass Pluck','Deep Resonator','Drift Arp'];
    const migrated = LEGACY_NAMES.get(legacyNames[legacyIndex]);
    return VOICE_PRESETS.findIndex((voice) => voice.name === migrated);
  }
  const name = LEGACY_NAMES.get(String(selection)) || String(selection);
  const index = VOICE_PRESETS.findIndex((voice) => voice.name === name || voice.id === name);
  return index >= 0 ? index : 0;
}

export function migrateVoiceSelection(selection) {
  return VOICE_PRESETS[resolveVoiceIndex(selection)].id;
}
