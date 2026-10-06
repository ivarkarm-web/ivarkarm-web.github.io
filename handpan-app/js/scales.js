/**
 * scales.js — interval-based 9-note handpan scale system + transposition
 */
export const KEYS = [
  { key: 'q', code: 'KeyQ' },
  { key: 'w', code: 'KeyW' },
  { key: 'e', code: 'KeyE' },
  { key: 'r', code: 'KeyR' },
  { key: 't', code: 'KeyT' },
  { key: 'y', code: 'KeyY' },
  { key: 'u', code: 'KeyU' },
  { key: 'i', code: 'KeyI' },
  { key: 'o', code: 'KeyO' }
];

export const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];

export const SHAPE = {
  ding: { dist: 0,    rx: 0.195, ry: 0.195 },
  ring: { dist: 0.58, rx: 0.168, ry: 0.148 }
};

export const SCALES = [
  { id: 'celtic-minor', label: 'Celtic Minor', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19], description: 'Enigmatic, deeply emotional, and popular among modern players.' },
  { id: 'kurdan-integral', label: 'Kurdan / Integral', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19], description: 'A minor scale with a deep, traditional European handpan voice.' },
  { id: 'hijaz', label: 'Hijaz', intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19], description: 'Middle Eastern character with an exotic, dark, and tension-filled layout.' },
  { id: 'pygmy', label: 'Pygmy', intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24], description: 'An African-inspired scale, deeply meditative, grounding, and rhythmic.' },
  { id: 'amara', label: 'Amara', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22], description: 'Open, highly resonant minor scale allowing for continuous melody flow.' },
  { id: 'akebono', label: 'AkeBono', intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24], description: 'Traditional Japanese pentatonic scale, deeply spiritual and calming.' },
  { id: 'equinox', label: 'Equinox', intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24], description: 'A highly balanced scale mixing major and minor emotional states.' },
  { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22], description: 'Bright, uplifting, and bluesy; excellent for high-energy looping.' },
  { id: 'aeolian', label: 'Aeolian', intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19], description: 'Natural minor scale providing melancholic, cinematic atmospheres.' },
  { id: 'major-sabye', label: 'Major / Sabye', intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23], description: 'Joyful, bright, and strictly harmonious; zero dissonance.' }
];

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function midiToName(midi) {
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const oct = Math.floor(m / 12) - 1;
  return NOTE_NAMES[pc] + oct;
}

/** Mutable transposition state */
export const transpose = {
  baseMidi: 50,      // D3
  octaveOffset: 0, // -1 | 0 | +1
  scaleIndex: 0
};

export function currentRootName() {
  return midiToName(transpose.baseMidi + transpose.octaveOffset * 12);
}

export function buildNotes() {
  const scale = SCALES[transpose.scaleIndex];
  const list = [];
  for (let i = 0; i < 9; i++) {
    const midi = transpose.baseMidi + scale.intervals[i] + (transpose.octaveOffset * 12);
    const isDing = i === 0;
    const angle = isDing ? 0 : RING_ANGLES[i - 1];
    list.push({
      key: KEYS[i].key,
      code: KEYS[i].code,
      name: midiToName(midi),
      midi,
      interval: scale.intervals[i],
      kind: isDing ? 'ding' : 'ring',
      a: angle,
      freq: mtof(midi),
      pan: isDing ? 0 : Math.max(-0.6, Math.min(0.6, Math.sin(angle * Math.PI / 180) * 0.55))
    });
  }
  return list;
}

export function shiftRoot(delta) {
  transpose.baseMidi = Math.max(36, Math.min(72, transpose.baseMidi + delta));
}

export function shiftOctave(delta) {
  transpose.octaveOffset = Math.max(-1, Math.min(1, transpose.octaveOffset + delta));
}

export function setScaleIndex(idx) {
  if (idx < 0) idx = SCALES.length - 1;
  if (idx >= SCALES.length) idx = 0;
  transpose.scaleIndex = idx;
}
