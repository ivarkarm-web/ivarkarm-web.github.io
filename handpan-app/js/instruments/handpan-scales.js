/** handpan-scales.js — scale definitions */
/** Semitones → cents. */
function semiToCents(s) { return s * 100; }

/**
 * Only the sampled instrument is listed.
 * Owner one-shots (owner-notes-9) are D Kurd / Celtic Minor on D3.
 * Extra library-v1 pitches fill nearby MIDI; other theoretical scales were removed
 * so the menu matches what you can actually play with samples.
 */
export const HANDPAN_SCALES = [
  {
    id: 'celtic-minor',
    label: 'D Kurd (Celtic Minor)',
    tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19]
  }
];

export function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice(0, 9);
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.slice(0, 9).map(semiToCents);
}
