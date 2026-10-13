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
  { id: 'celtic-minor', label: 'D Kurd (Celtic Minor)', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19], description: 'Owner-sampled D Kurd handpan. Nine notes on D3.' }
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

export function buildNotesFromScale(scale, baseMidi = transpose.baseMidi) {
  const root = baseMidi + transpose.octaveOffset * 12;
  return (scale.intervals || []).map((semi, i) => {
    const midi = root + semi;
    return {
      index: i,
      midi,
      midiExact: midi,
      name: midiToName(midi),
      freq: mtof(midi),
      isDing: i === 0
    };
  });
}

export function setScaleIndex(idx) {
  if (idx < 0) idx = SCALES.length - 1;
  if (idx >= SCALES.length) idx = 0;
  transpose.scaleIndex = idx;
  return SCALES[idx];
}

export function cycleScale(dir = 1) {
  return setScaleIndex(transpose.scaleIndex + dir);
}

export function currentScale() {
  return SCALES[transpose.scaleIndex] || SCALES[0];
}

export function currentNotes() {
  return buildNotesFromScale(currentScale());
}
