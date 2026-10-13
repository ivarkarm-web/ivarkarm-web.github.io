/** handpan-scales.js — owner-sampled instruments only */
function semiToCents(s) { return s * 100; }

/** Each entry is one extracted handpan from the owner library (or sequential take). */
export const HANDPAN_SCALES = [
  {
    id: 'd3-kurd',
    label: 'D3 Kurd',
    tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'owner-notes-9',
    sampleCount: 9,
  },
  {
    id: 'd3-aeolian',
    label: 'D3 Aeolian',
    tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'd3-aeolian',
    sampleCount: 8,
  },
  {
    id: 'd3-mixolydian',
    label: 'D3 Mixolydian',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'd3-mixolydian',
    sampleCount: 8,
  },
  {
    id: 'b2-lasirena',
    label: 'B2 LaSirena',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21],
    rootMidi: 47,
    rootPc: 11,
    sampleDir: 'b2-lasirena',
    sampleCount: 8,
  },
  {
    id: 'f3-amara',
    label: 'F3 Amara',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22],
    rootMidi: 53,
    rootPc: 5,
    sampleDir: 'f3-amara',
    sampleCount: 7,
  },
  {
    id: 'f3-mixolydian',
    label: 'F3 Mixolydian',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22],
    rootMidi: 53,
    rootPc: 5,
    sampleDir: 'f3-mixolydian',
    sampleCount: 7,
  },
  {
    id: 'c3-hijaz',
    label: 'C3 Hijaz',
    tuning: '12-TET',
    intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19],
    rootMidi: 48,
    rootPc: 0,
    sampleDir: 'c3-hijaz',
    sampleCount: 7,
  },
  {
    id: 'd3-dorian',
    label: 'D3 Dorian',
    tuning: '12-TET',
    intervals: [0, 7, 9, 10, 12, 14, 16, 17, 19],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'd3-dorian',
    sampleCount: 7,
  },
  {
    id: 'd3-amara',
    label: 'D3 Amara',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'd3-amara',
    sampleCount: 7,
  },
  {
    id: 'd3-lasirena',
    label: 'D3 LaSirena',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21],
    rootMidi: 50,
    rootPc: 2,
    sampleDir: 'd3-lasirena',
    sampleCount: 7,
  },
  {
    id: 'g3-lasirena',
    label: 'G3 LaSirena',
    tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21],
    rootMidi: 55,
    rootPc: 7,
    sampleDir: 'g3-lasirena',
    sampleCount: 7,
  },
  {
    id: 'c4-dorian',
    label: 'C4 Dorian',
    tuning: '12-TET',
    intervals: [0, 7, 9, 10, 12, 14, 16, 17, 19],
    rootMidi: 60,
    rootPc: 0,
    sampleDir: 'c4-dorian',
    sampleCount: 7,
  },
];

export function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice(0, 9);
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.slice(0, 9).map(semiToCents);
}
