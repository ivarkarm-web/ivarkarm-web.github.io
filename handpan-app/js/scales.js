/**
 * scales.js — interval-based 9-note handpan scale system + transposition
 * Only owner-sampled instruments from the multi-handpan recording.
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
  { id: 'd3-kurd', label: 'D3 Kurd', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19], description: 'Owner-sampled D3 Kurd (primary).' },
  { id: 'd3-aeolian', label: 'D3 Aeolian', intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19], description: 'Owner-sampled D3 Aeolian.' },
  { id: 'd3-mixolydian', label: 'D3 Mixolydian', intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22], description: 'Owner-sampled D3 Mixolydian.' },
  { id: 'b2-lasirena', label: 'B2 LaSirena', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21], description: 'Owner-sampled B2 LaSirena.' },
  { id: 'f3-amara', label: 'F3 Amara', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22], description: 'Owner-sampled F3 Amara.' },
  { id: 'f3-mixolydian', label: 'F3 Mixolydian', intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22], description: 'Owner-sampled F3 Mixolydian.' },
  { id: 'c3-hijaz', label: 'C3 Hijaz', intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19], description: 'Owner-sampled C3 Hijaz.' },
  { id: 'd3-dorian', label: 'D3 Dorian', intervals: [0, 7, 9, 10, 12, 14, 16, 17, 19], description: 'Owner-sampled D3 Dorian.' },
  { id: 'd3-amara', label: 'D3 Amara', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22], description: 'Owner-sampled D3 Amara.' },
  { id: 'd3-lasirena', label: 'D3 LaSirena', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21], description: 'Owner-sampled D3 LaSirena.' },
  { id: 'g3-lasirena', label: 'G3 LaSirena', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21], description: 'Owner-sampled G3 LaSirena.' },
  { id: 'c4-dorian', label: 'C4 Dorian', intervals: [0, 7, 9, 10, 12, 14, 16, 17, 19], description: 'Owner-sampled C4 Dorian.' }
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
