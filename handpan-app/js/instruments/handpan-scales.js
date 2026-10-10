/** handpan-scales.js — scale definitions */
/** Semitones → cents. */
function semiToCents(s) { return s * 100; }

/** Just-intonation ratio → cents. */
function ratioToCents(num, den) {
  return 1200 * Math.log2(num / den);
}

export const HANDPAN_SCALES = [
  { id: 'celtic-minor', label: 'Celtic Minor', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'kurdan-integral', label: 'Kurdan / Integral', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'hijaz', label: 'Hijaz', tuning: '12-TET',
    intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19] },
  { id: 'pygmy', label: 'Pygmy', tuning: '12-TET',
    intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24] },
  { id: 'amara', label: 'Amara', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22] },
  { id: 'akebono', label: 'AkeBono', tuning: '12-TET',
    intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24] },
  { id: 'equinox', label: 'Equinox', tuning: '12-TET',
    intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24] },
  { id: 'mixolydian', label: 'Mixolydian', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22] },
  { id: 'aeolian', label: 'Aeolian', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19] },
  { id: 'major-sabye', label: 'Major / Sabye', tuning: '12-TET',
    intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23] },
  { id: 'dorian', label: 'Dorian', tuning: '12-TET',
    intervals: [0, 7, 9, 10, 12, 14, 16, 17, 19] },
  { id: 'phrygian', label: 'Phrygian', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19] },
  { id: 'lydian', label: 'Lydian', tuning: '12-TET',
    intervals: [0, 7, 11, 12, 14, 16, 18, 19, 23] },
  { id: 'harmonic-minor', label: 'Harmonic Minor', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 13, 16, 17, 19] },
  { id: 'hungarian-minor', label: 'Hungarian Minor', tuning: '12-TET',
    intervals: [0, 7, 8, 11, 12, 13, 16, 17, 19] },
  { id: 'romanian', label: 'Romanian / Ukrainian', tuning: '12-TET',
    intervals: [0, 7, 9, 10, 12, 14, 15, 17, 19] },
  { id: 'la-sirena', label: 'La Sirena', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 15, 17, 19, 21] },
  { id: 'annaziska', label: 'Annaziska', tuning: '12-TET',
    intervals: [0, 7, 9, 12, 14, 16, 17, 19, 21] },
  { id: 'oxalis', label: 'Oxalis', tuning: '12-TET',
    intervals: [0, 5, 7, 10, 12, 14, 17, 19, 22] },
  { id: 'ashakiran', label: 'Ashakiran', tuning: '12-TET',
    intervals: [0, 5, 7, 10, 12, 15, 17, 19, 22] },
  { id: 'mystic', label: 'Mystic', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 14, 15, 17, 19, 22] },
  { id: 'ursa-minor', label: 'Ursa Minor', tuning: '12-TET',
    intervals: [0, 7, 8, 10, 12, 14, 17, 19, 22] },
  { id: 'aegean', label: 'Aegean', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 16, 17, 19, 21] },
  { id: 'yshayra', label: 'YshaYra', tuning: '12-TET',
    intervals: [0, 5, 8, 10, 12, 15, 17, 19, 22] },
  { id: 'blues-minor', label: 'Blues Minor', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 13, 15, 17, 19, 22] },
  { id: 'raga-desya-todi', label: 'Raga Desya Todi', tuning: '12-TET',
    intervals: [0, 6, 8, 11, 12, 15, 17, 18, 23] },
  { id: 'melog-selisir', label: 'Melog / Selisir', tuning: '12-TET',
    intervals: [0, 4, 7, 11, 12, 16, 19, 23, 24] },
  { id: 'magic-voyage', label: 'Magic Voyage', tuning: '12-TET',
    intervals: [0, 7, 9, 12, 14, 16, 17, 19, 21] },
  { id: 'high-pyramid', label: 'High Pyramid', tuning: '12-TET',
    intervals: [0, 5, 7, 10, 12, 14, 15, 17, 19] },
  { id: 'low-pyramid', label: 'Low Pyramid', tuning: '12-TET',
    intervals: [0, 5, 7, 8, 10, 12, 14, 15, 17] },
  { id: 'pentatonic-minor', label: 'Pentatonic Minor+', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 15, 17, 19, 22, 24] },
  { id: 'pentatonic-major', label: 'Pentatonic Major+', tuning: '12-TET',
    intervals: [0, 7, 9, 12, 14, 16, 19, 21, 24] },
  { id: 'whole-tone', label: 'Whole Tone', tuning: '12-TET',
    intervals: [0, 6, 8, 10, 12, 14, 16, 18, 20] },
  { id: 'chromatic-cluster', label: 'Chromatic Cluster', tuning: '12-TET',
    intervals: [0, 7, 8, 9, 10, 11, 12, 13, 14] },
  { id: 'suspended', label: 'Suspended (Sus4)', tuning: '12-TET',
    intervals: [0, 7, 10, 12, 14, 17, 19, 22, 24] },
  { id: 'shang', label: 'Shang (Chinese)', tuning: '12-TET',
    intervals: [0, 7, 9, 12, 14, 16, 19, 21, 24] },
  { id: 'gong', label: 'Gong (Chinese)', tuning: '12-TET',
    intervals: [0, 7, 9, 11, 12, 14, 16, 19, 21] },
  { id: 'just-celtic', label: 'Just Celtic', tuning: 'Just (5-limit)',
    cents: [0, ratioToCents(3, 2), ratioToCents(8, 5), ratioToCents(5, 3), ratioToCents(2, 1), ratioToCents(9, 4), ratioToCents(8, 5) + 1200, ratioToCents(15, 8) + 1200, ratioToCents(3, 1)] },
  { id: 'just-major', label: 'Just Major', tuning: 'Just (5-limit)',
    cents: [0, ratioToCents(3, 2), ratioToCents(5, 3), ratioToCents(15, 8), ratioToCents(2, 1), ratioToCents(9, 4), ratioToCents(5, 2), ratioToCents(8, 3), ratioToCents(3, 1)] },
  { id: 'just-minor', label: 'Just Minor', tuning: 'Just (5-limit)',
    cents: [0, ratioToCents(3, 2), ratioToCents(8, 5), ratioToCents(9, 5), ratioToCents(2, 1), ratioToCents(9, 4), ratioToCents(6, 5) + 1200, ratioToCents(9, 5) + 1200, ratioToCents(3, 1)] },
  { id: 'pythagorean', label: 'Pythagorean', tuning: 'Just (3-limit)',
    cents: (() => {
      const pyth = { 0: 0, 1: 90.225, 2: 203.910, 3: 294.135, 4: 407.820, 5: 498.045, 6: 611.730, 7: 701.955, 8: 792.180, 9: 905.865, 10: 996.090, 11: 1109.775, 12: 1200 };
      return [0, 7, 8, 10, 12, 14, 15, 17, 19].map((d) => pyth[d % 12] + Math.floor(d / 12) * 1200);
    })() },
  { id: 'harmonic-series', label: 'Harmonic Series', tuning: 'Just (harmonics)',
    cents: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => 1200 * Math.log2(h / 2)) },
  { id: 'hijaz-24', label: 'Hijaz ¼-tone', tuning: '24-TET',
    cents: [0, 700, 800, 1050, 1200, 1400, 1500, 1700, 1900] },
  { id: 'rast', label: 'Rast (maqam)', tuning: '24-TET / maqam',
    cents: [0, 200, 350, 500, 700, 900, 1050, 1200, 1400] },
  { id: 'bayati', label: 'Bayati (maqam)', tuning: '24-TET / maqam',
    cents: [0, 150, 300, 500, 700, 800, 1000, 1200, 1350] },
  { id: 'saba', label: 'Saba (maqam)', tuning: '24-TET / maqam',
    cents: [0, 150, 300, 400, 700, 800, 1000, 1200, 1350] },
  { id: 'sikah', label: 'Sikah (maqam)', tuning: '24-TET / maqam',
    cents: [0, 150, 350, 500, 700, 850, 1050, 1200, 1350] },
  { id: 'hijaz-kar', label: 'Hijaz Kar', tuning: '24-TET / maqam',
    cents: [0, 100, 400, 500, 700, 800, 1100, 1200, 1300] },
  { id: 'nahawand', label: 'Nahawand', tuning: '24-TET / maqam',
    cents: [0, 200, 300, 500, 700, 800, 1100, 1200, 1400] },
  { id: 'kurd-maqam', label: 'Kurd (maqam)', tuning: '24-TET / maqam',
    cents: [0, 100, 300, 500, 700, 800, 1000, 1200, 1300] },
  { id: 'pelog-approx', label: 'Pelog (approx)', tuning: 'Slendro/Pelog-ish',
    cents: [0, 120, 400, 660, 780, 1100, 1220, 1480, 1720] },
  { id: 'slendro-approx', label: 'Slendro (approx)', tuning: 'Slendro/Pelog-ish',
    cents: [0, 240, 480, 720, 960, 1200, 1440, 1680, 1920] },
  { id: '19tet-celtic', label: '19-TET Celtic', tuning: '19-TET',
    cents: (() => { const step = 1200 / 19; return [0, 11, 13, 16, 19, 22, 24, 27, 30].map((d) => d * step); })() },
  { id: '22tet-subset', label: '22-TET Subset', tuning: '22-TET',
    cents: (() => { const step = 1200 / 22; return [0, 13, 15, 18, 22, 26, 28, 31, 35].map((d) => d * step); })() },
  { id: '31tet-meantone', label: '31-TET Meantone', tuning: '31-TET',
    cents: (() => { const step = 1200 / 31; return [0, 18, 20, 25, 31, 36, 38, 44, 49].map((d) => d * step); })() },
  { id: 'bohlen-pierce', label: 'Bohlen–Pierce (subset)', tuning: '13-TET tritave',
    cents: [1, 3, 5, 7, 9, 11, 13, 15, 17].map((n) => (1200 * Math.log2(3)) * Math.log(n) / Math.log(3)) },
  { id: 'quarter-comma', label: '¼-comma Meantone', tuning: 'Meantone',
    cents: (() => {
      const mt = { 0: 0, 1: 76.05, 2: 193.16, 3: 310.26, 4: 386.31, 5: 503.42, 6: 579.47, 7: 696.58, 8: 772.63, 9: 889.74, 10: 1006.84, 11: 1082.89, 12: 1200 };
      return [0, 7, 8, 10, 12, 14, 15, 17, 19].map((d) => mt[d % 12] + Math.floor(d / 12) * 1200);
    })() },
  { id: 'werckmeister-iii', label: 'Werckmeister III', tuning: 'Well temperament',
    cents: (() => {
      const w = [0, 90, 192, 294, 390, 498, 588, 696, 792, 888, 996, 1092];
      return [0, 7, 8, 10, 12, 14, 15, 17, 19].map((d) => w[d % 12] + Math.floor(d / 12) * 1200);
    })() },
  { id: 'pure-fifths-stack', label: 'Pure Fifths Stack', tuning: 'Just (3-limit)',
    cents: (() => {
      let c = 0; const out = [0];
      for (let k = 0; k < 8; k++) { c += ratioToCents(3, 2); out.push(c); }
      return out;
    })() }
];

export function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice(0, 9);
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.slice(0, 9).map(semiToCents);
}
