/**
 * handpan-scales.js — curated handpan scale library with metadata.
 *
 * Single source of truth for the handpan scale list. Used by
 * `instruments/handpan.js` (HandpanInstrument) and `js/scale-selector.js`.
 *
 * Each scale entry:
 *   id              stable machine id (unique)
 *   label           display name
 *   short           short display name for the toggle
 *   family          one of the five scale families (data-driven; UI reads this)
 *   mood            mood tag (separate from family)
 *   character       short prose describing the sound
 *   description     human-readable description (no manufacturer-tuning claims)
 *   tags            search/filter keywords
 *   tuning          '12-TET' (all entries are 12-TET approximations)
 *   intervals       semitone steps from the root, ascending, intervals[0] === 0
 *   rootMidi        MIDI note of the root (drives setScaleIndex root mapping)
 *   rootPc          pitch class of the root (0 = C ... 11 = B)
 *   noteCount       recommended number of tonefields
 *   octaveRange     [low, high] playable octave guidance
 *   isExperimental  true for representative/less-standard layouts; excluded from
 *                   randomisation by default
 *   instrumentCompatibility instrument families this scale suits
 *
 * Musical accuracy notes:
 *   - Intervals are 12-TET semitone approximations of each scale's pitch-class
 *     set, laid out root-low / fifth-up in typical handpan fashion.
 *   - Handpan tunings vary by maker; no entry claims to be a specific
 *     manufacturer's tuning. Entries marked isExperimental are representative
 *     layouts rather than verified production tunings.
 *   - Family and mood are kept separate and stored here once, so the UI reads
 *     them from this file instead of hardcoding categories.
 */
function semiToCents(s) { return s * 100; }

const PC = { C: 0, CS: 1, D: 2, DS: 3, E: 4, F: 5, FS: 6, G: 7, GS: 8, A: 9, AS: 10, B: 11 };

// Build ascending handpan-style intervals from a pitch-class set:
// root (0), fifth (7), octave root (12), then scale degrees above the octave,
// then a second octave, truncated to noteCount. intervals[0] is always 0.
function handpanIntervals(pcs, count = 9) {
  const set = new Set(pcs);
  const out = [0, 7, 12];
  for (let oct = 1; oct <= 3 && out.length < count; oct++) {
    for (const pc of [...set].sort((a, b) => a - b)) {
      if (pc === 0 || pc === 7) continue;
      const c = oct * 12 + pc;
      if (c > 12 && !out.includes(c)) out.push(c);
      if (out.length >= count) break;
    }
  }
  // Always keep root at 0 and ascending; trim/pad to count.
  while (out.length < count) out.push(out[out.length - 1] + 12);
  return out.slice(0, count);
}

const minor = [0, 2, 3, 5, 7, 8, 10];      // natural minor / aeolian pcs
const hijaz = [0, 1, 4, 5, 7, 8, 10];      // hijaz / double-harmonic-ish pcs
const sabye = [0, 2, 4, 5, 7, 9, 11];      // lydian-flavoured major pcs
const pygmy = [0, 3, 5, 7, 10];            // pygmy (minor pentatonic + b7) pcs
const akebono = [0, 1, 5, 7, 8];           // japanese akebono pcs
const dorian = [0, 2, 3, 5, 7, 9, 10];
const mixolydian = [0, 2, 4, 5, 7, 9, 10];
const harmonicMinor = [0, 2, 3, 5, 7, 8, 11];
const doubleHarmonic = [0, 1, 4, 5, 7, 8, 11];
const phrygian = [0, 1, 3, 5, 7, 8, 10];
const melodicMinor = [0, 2, 3, 5, 7, 9, 11];
const lydian = [0, 2, 4, 6, 7, 9, 11];
const major = [0, 2, 4, 5, 7, 9, 11];

export const HANDPAN_SCALES = [
  /* ================= CLASSIC HANDPAN ================= */
  {
    id: 'dkurd', label: 'D Kurd', short: 'D Kurd',
    family: 'CLASSIC HANDPAN', mood: 'Meditative',
    character: 'Grounded, introspective minor with a warm minor-sixth colour.',
    description: 'D-centered minor layout. A widely used handpan minor scale; intervals are a 12-TET approximation, not a specific maker tuning.',
    tags: ['minor', 'kurd', 'meditative', 'grounded'],
    tuning: '12-TET', intervals: handpanIntervals([0, 3, 5, 7, 8, 10], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba', 'marimba']
  },
  {
    id: 'dcelticminor', label: 'D Celtic Minor', short: 'D Celtic',
    family: 'CLASSIC HANDPAN', mood: 'Peaceful',
    character: 'Open, airy minor; peaceful and resonant.',
    description: 'D Celtic minor — pentatonic-leaning minor with a soft, open character.',
    tags: ['minor', 'celtic', 'peaceful', 'open'],
    tuning: '12-TET', intervals: handpanIntervals([0, 3, 5, 7, 10], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'dintegral', label: 'D Integral', short: 'D Integral',
    family: 'CLASSIC HANDPAN', mood: 'Mysterious',
    character: 'Minor with an added major second; dark and curious.',
    description: 'D Integral minor — natural minor with a raised second for a slightly brighter, mysterious edge.',
    tags: ['minor', 'integral', 'mysterious'],
    tuning: '12-TET', intervals: handpanIntervals([0, 3, 5, 7, 9, 10], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'eamara', label: 'E Amara', short: 'E Amara',
    family: 'CLASSIC HANDPAN', mood: 'Melancholic',
    character: 'Sweet, sad minor; the classic handpan "Amara" flavour.',
    description: 'E Amara — minor pentatonic-leaning layout centred on E. 12-TET approximation.',
    tags: ['minor', 'amara', 'melancholic', 'sweet'],
    tuning: '12-TET', intervals: handpanIntervals([0, 3, 5, 7, 10], 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'damara', label: 'D Amara', short: 'D Amara',
    family: 'CLASSIC HANDPAN', mood: 'Melancholic',
    character: 'Amara minor centred on D; warm and plaintive.',
    description: 'D Amara — minor layout on D, 12-TET approximation.',
    tags: ['minor', 'amara', 'melancholic'],
    tuning: '12-TET', intervals: handpanIntervals([0, 3, 5, 7, 10], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'esabye', label: 'E Sabye', short: 'E Sabye',
    family: 'CLASSIC HANDPAN', mood: 'Dreamy',
    character: 'Major with a raised fourth; bright, dreamy, uplifting.',
    description: 'E Sabye — lydian-flavoured major scale. 12-TET approximation.',
    tags: ['major', 'sabye', 'dreamy', 'bright'],
    tuning: '12-TET', intervals: handpanIntervals(sabye, 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba', 'harp']
  },
  {
    id: 'elasirena', label: 'E La Sirena', short: 'E La Sirena',
    family: 'CLASSIC HANDPAN', mood: 'Mysterious',
    character: 'Minor with a flat second; exotic and haunting.',
    description: 'E La Sirena — minor with a flat second degree, 12-TET approximation.',
    tags: ['minor', 'lasirena', 'mysterious', 'exotic'],
    tuning: '12-TET', intervals: handpanIntervals([0, 1, 3, 7, 8, 10], 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'dminor', label: 'D Minor', short: 'D Minor',
    family: 'CLASSIC HANDPAN', mood: 'Melancholic',
    character: 'Straight natural minor; clear and plaintive.',
    description: 'D natural minor (aeolian) handpan layout, 12-TET.',
    tags: ['minor', 'aeolian', 'melancholic'],
    tuning: '12-TET', intervals: handpanIntervals(minor, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },

  /* ================= PYGMY & PENTATONIC ================= */
  {
    id: 'apygmy', label: 'A Pygmy', short: 'A Pygmy',
    family: 'PYGMY & PENTATONIC', mood: 'Peaceful',
    character: 'Open minor pentatonic feel; spacious and gentle.',
    description: 'A Pygmy — pentatonic-leaning minor layout on A.',
    tags: ['pentatonic', 'pygmy', 'peaceful', 'spacious'],
    tuning: '12-TET', intervals: handpanIntervals(pygmy, 9),
    rootMidi: 45, rootPc: PC.A, noteCount: 8, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'cspygmy', label: 'C♯ Pygmy', short: 'C♯ Pygmy',
    family: 'PYGMY & PENTATONIC', mood: 'Peaceful',
    character: 'Pygmy minor centred on C♯; warm low register.',
    description: 'C♯ Pygmy — pentatonic minor on C♯.',
    tags: ['pentatonic', 'pygmy', 'peaceful'],
    tuning: '12-TET', intervals: handpanIntervals(pygmy, 9),
    rootMidi: 49, rootPc: PC.CS, noteCount: 8, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },
  {
    id: 'flowpygmy', label: 'F Low Pygmy', short: 'F Low Pygmy',
    family: 'PYGMY & PENTATONIC', mood: 'Meditative',
    character: 'Deep, resonant low pygmy on F.',
    description: 'F Low Pygmy — low-register pentatonic minor. 12-TET approximation.',
    tags: ['pentatonic', 'pygmy', 'meditative', 'deep'],
    tuning: '12-TET', intervals: handpanIntervals(pygmy, 8),
    rootMidi: 41, rootPc: PC.F, noteCount: 8, octaveRange: [1, 3],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'fsharppygmy', label: 'F♯ Pygmy', short: 'F♯ Pygmy',
    family: 'PYGMY & PENTATONIC', mood: 'Meditative',
    character: 'Pygmy minor on F♯; focused and resonant.',
    description: 'F♯ Pygmy — pentatonic minor on F♯.',
    tags: ['pentatonic', 'pygmy', 'meditative'],
    tuning: '12-TET', intervals: handpanIntervals(pygmy, 8),
    rootMidi: 42, rootPc: PC.FS, noteCount: 8, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'gakebono', label: 'G Akebono', short: 'G Akebono',
    family: 'PYGMY & PENTATONIC', mood: 'Mysterious',
    character: 'Japanese pentatonic with flat second; meditative stillness.',
    description: 'G Akebono — Japanese pentatonic scale, 12-TET approximation.',
    tags: ['pentatonic', 'akebono', 'japanese', 'mysterious'],
    tuning: '12-TET', intervals: handpanIntervals(akebono, 9),
    rootMidi: 55, rootPc: PC.G, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'shakuhachi', 'koto']
  },
  {
    id: 'dakebono', label: 'D Akebono', short: 'D Akebono',
    family: 'PYGMY & PENTATONIC', mood: 'Mysterious',
    character: 'Akebono pentatonic centred on D.',
    description: 'D Akebono — Japanese pentatonic on D.',
    tags: ['pentatonic', 'akebono', 'japanese'],
    tuning: '12-TET', intervals: handpanIntervals(akebono, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'shakuhachi', 'koto']
  },
  {
    id: 'dmystic', label: 'D Mystic', short: 'D Mystic',
    family: 'PYGMY & PENTATONIC', mood: 'Mysterious',
    character: 'Lydian-flavoured bright minor; open and curious.',
    description: 'D Mystic — bright, raised-fourth minor colour (representative layout).',
    tags: ['mystic', 'lydian', 'mysterious', 'bright'],
    tuning: '12-TET', intervals: handpanIntervals(lydian, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },

  /* ================= EASTERN & EXOTIC ================= */
  {
    id: 'daegean', label: 'D Aegean', short: 'D Aegean',
    family: 'EASTERN & EXOTIC', mood: 'Mysterious',
    character: 'Minor with a flat second and flat sixth; evocative.',
    description: 'D Aegean — exotic minor flavour (representative layout).',
    tags: ['exotic', 'aegean', 'mysterious', 'minor'],
    tuning: '12-TET', intervals: handpanIntervals([0, 1, 3, 5, 7, 8], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'duduk', 'ney']
  },
  {
    id: 'ahijaz', label: 'A Hijaz', short: 'A Hijaz',
    family: 'EASTERN & EXOTIC', mood: 'Dark',
    character: 'Hijaz minor with flat second; dramatic and tense.',
    description: 'A Hijaz — dark minor with a flat second, 12-TET approximation.',
    tags: ['hijaz', 'exotic', 'dark', 'dramatic'],
    tuning: '12-TET', intervals: handpanIntervals(hijaz, 9),
    rootMidi: 57, rootPc: PC.A, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'duduk', 'frame_drum']
  },
  {
    id: 'dhijaz', label: 'D Hijaz', short: 'D Hijaz',
    family: 'EASTERN & EXOTIC', mood: 'Dark',
    character: 'Hijaz minor on D; tense, driving minor.',
    description: 'D Hijaz — hijaz minor on D.',
    tags: ['hijaz', 'exotic', 'dark'],
    tuning: '12-TET', intervals: handpanIntervals(hijaz, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'duduk', 'frame_drum']
  },
  {
    id: 'cshijaz', label: 'C♯ Hijaz', short: 'C♯ Hijaz',
    family: 'EASTERN & EXOTIC', mood: 'Dark',
    character: 'Hijaz minor on C♯; low and brooding.',
    description: 'C♯ Hijaz — hijaz minor on C♯.',
    tags: ['hijaz', 'exotic', 'dark'],
    tuning: '12-TET', intervals: handpanIntervals(hijaz, 9),
    rootMidi: 49, rootPc: PC.CS, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'duduk', 'frame_drum']
  },
  {
    id: 'dsaladin', label: 'D Saladin', short: 'D Saladin',
    family: 'EASTERN & EXOTIC', mood: 'Mysterious',
    character: 'Minor with flat second and natural seventh; story-telling quality.',
    description: 'D Saladin — exotic minor (representative layout).',
    tags: ['saladin', 'exotic', 'mysterious'],
    tuning: '12-TET', intervals: handpanIntervals([0, 1, 3, 5, 7, 8, 10], 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'duduk']
  },
  {
    id: 'fshromanianhijaz', label: 'F♯ Romanian Hijaz', short: 'F♯ Rom. Hijaz',
    family: 'EASTERN & EXOTIC', mood: 'Dark',
    character: 'Romanian hijaz with augmented second; colourful and dark.',
    description: 'F♯ Romanian Hijaz — hijaz variant, 12-TET approximation.',
    tags: ['hijaz', 'romanian', 'exotic', 'dark'],
    tuning: '12-TET', intervals: handpanIntervals([0, 2, 3, 6, 7, 8, 10], 9),
    rootMidi: 54, rootPc: PC.FS, noteCount: 9, octaveRange: [3, 5],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'duduk', 'frame_drum']
  },
  {
    id: 'dashakiran', label: 'D Ashakiran', short: 'D Ashakiran',
    family: 'EASTERN & EXOTIC', mood: 'Spiritual',
    character: 'Major-leaning bright scale; uplifting and open.',
    description: 'D Ashakiran — bright major colour (representative layout).',
    tags: ['ashakiran', 'major', 'spiritual', 'bright'],
    tuning: '12-TET', intervals: handpanIntervals(sabye, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'harp', 'kalimba']
  },
  {
    id: 'cstanaziska', label: 'C♯ Anaziska', short: 'C♯ Anaziska',
    family: 'EASTERN & EXOTIC', mood: 'Melancholic',
    character: 'Minor with flat second and minor sixth; bittersweet.',
    description: 'C♯ Anaziska — exotic minor (representative layout).',
    tags: ['anaziska', 'exotic', 'melancholic'],
    tuning: '12-TET', intervals: handpanIntervals([0, 1, 3, 5, 7, 8, 10], 9),
    rootMidi: 49, rootPc: PC.CS, noteCount: 9, octaveRange: [2, 4],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'duduk']
  },

  /* ================= ATMOSPHERIC & MODERN ================= */
  {
    id: 'emilkyway', label: 'E Milky Way', short: 'E Milky Way',
    family: 'ATMOSPHERIC & MODERN', mood: 'Dreamy',
    character: 'Lydian bright major; wide and spacious.',
    description: 'E Milky Way — bright, open major colour.',
    tags: ['major', 'lydian', 'dreamy', 'spacious'],
    tuning: '12-TET', intervals: handpanIntervals(lydian, 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'harp', 'celestial_bow']
  },
  {
    id: 'fequinox', label: 'F Equinox', short: 'F Equinox',
    family: 'ATMOSPHERIC & MODERN', mood: 'Peaceful',
    character: 'Mixolydian major; balanced, calm, grounded.',
    description: 'F Equinox — calm major/mixolydian colour.',
    tags: ['major', 'mixolydian', 'peaceful', 'balanced'],
    tuning: '12-TET', intervals: handpanIntervals(mixolydian, 9),
    rootMidi: 53, rootPc: PC.F, noteCount: 9, octaveRange: [3, 5],
    isExperimental: true,
    instrumentCompatibility: ['handpan', 'harp', 'ambient_cello']
  },
  {
    id: 'esabyeextended', label: 'E Sabye Extended', short: 'E Sabye Ext',
    family: 'ATMOSPHERIC & MODERN', mood: 'Dreamy',
    character: 'E Sabye with an extended high note; more headroom.',
    description: 'E Sabye extended layout — one extra upper tonefield.',
    tags: ['sabye', 'dreamy', 'extended'],
    tuning: '12-TET', intervals: handpanIntervals(sabye, 10),
    rootMidi: 52, rootPc: PC.E, noteCount: 10, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum', 'kalimba']
  },

  /* ================= WESTERN & MODAL ================= */
  {
    id: 'fmajor', label: 'F Major', short: 'F Major',
    family: 'WESTERN & MODAL', mood: 'Bright',
    character: 'Pure Ionian major; clear and happy.',
    description: 'F Ionian major scale — theoretical modal layout, 12-TET.',
    tags: ['major', 'ionian', 'bright', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(major, 9),
    rootMidi: 53, rootPc: PC.F, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'glockenspiel', 'marimba']
  },
  {
    id: 'gminor', label: 'G Minor', short: 'G Minor',
    family: 'WESTERN & MODAL', mood: 'Melancholic',
    character: 'G natural minor; plaintive and clear.',
    description: 'G aeolian (natural minor) — theoretical modal layout, 12-TET.',
    tags: ['minor', 'aeolian', 'melancholic', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(minor, 9),
    rootMidi: 55, rootPc: PC.G, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'aminor', label: 'A Minor', short: 'A Minor',
    family: 'WESTERN & MODAL', mood: 'Melancholic',
    character: 'A natural minor; the relative of C major.',
    description: 'A aeolian (natural minor) — theoretical modal layout, 12-TET.',
    tags: ['minor', 'aeolian', 'melancholic', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(minor, 9),
    rootMidi: 45, rootPc: PC.A, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'eaeolian', label: 'E Aeolian', short: 'E Aeolian',
    family: 'WESTERN & MODAL', mood: 'Dark',
    character: 'E natural minor; dark and resonant.',
    description: 'E aeolian — theoretical modal layout, 12-TET.',
    tags: ['minor', 'aeolian', 'dark', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(minor, 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'ddorian', label: 'D Dorian', short: 'D Dorian',
    family: 'WESTERN & MODAL', mood: 'Playful',
    character: 'Minor with a raised sixth; bright minor, playful.',
    description: 'D dorian — theoretical modal layout, 12-TET.',
    tags: ['minor', 'dorian', 'playful', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(dorian, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'marimba', 'glockenspiel']
  },
  {
    id: 'gmixolydian', label: 'G Mixolydian', short: 'G Mixolydian',
    family: 'WESTERN & MODAL', mood: 'Energetic',
    character: 'Major with a flat seventh; bluesy and energetic.',
    description: 'G mixolydian — theoretical modal layout, 12-TET.',
    tags: ['major', 'mixolydian', 'energetic', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(mixolydian, 9),
    rootMidi: 55, rootPc: PC.G, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'glockenspiel', 'marimba']
  },
  {
    id: 'dharmonicminor', label: 'D Harmonic Minor', short: 'D Harmonic',
    family: 'WESTERN & MODAL', mood: 'Dark',
    character: 'Minor with raised seventh; classical, tense.',
    description: 'D harmonic minor — theoretical modal layout, 12-TET.',
    tags: ['minor', 'harmonic', 'dark', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(harmonicMinor, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'tongue_drum']
  },
  {
    id: 'cdoubleharmonic', label: 'C♯ Double Harmonic', short: 'C♯ Dbl Harm.',
    family: 'WESTERN & MODAL', mood: 'Dark',
    character: 'Double harmonic (Byzantine); two augmented seconds, exotic.',
    description: 'C♯ double harmonic — theoretical modal layout, 12-TET.',
    tags: ['exotic', 'double-harmonic', 'dark', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(doubleHarmonic, 9),
    rootMidi: 49, rootPc: PC.CS, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'duduk']
  },
  {
    id: 'ephrygian', label: 'E Phrygian', short: 'E Phrygian',
    family: 'WESTERN & MODAL', mood: 'Dark',
    character: 'Minor with flat second; Spanish, dark flavour.',
    description: 'E phrygian — theoretical modal layout, 12-TET.',
    tags: ['minor', 'phrygian', 'dark', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(phrygian, 9),
    rootMidi: 52, rootPc: PC.E, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'duduk']
  },
  {
    id: 'amelodicminor', label: 'A Melodic Minor', short: 'A Melodic',
    family: 'WESTERN & MODAL', mood: 'Bright',
    character: 'Ascending melodic minor; bright minor with raised sixth/seventh.',
    description: 'A melodic minor (ascending) — theoretical modal layout, 12-TET.',
    tags: ['minor', 'melodic', 'bright', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(melodicMinor, 9),
    rootMidi: 57, rootPc: PC.A, noteCount: 9, octaveRange: [3, 5],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'harp', 'marimba']
  },
  {
    id: 'dlydian', label: 'D Lydian', short: 'D Lydian',
    family: 'WESTERN & MODAL', mood: 'Dreamy',
    character: 'Major with raised fourth; bright, floating, dreamy.',
    description: 'D lydian — theoretical modal layout, 12-TET.',
    tags: ['major', 'lydian', 'dreamy', 'modal'],
    tuning: '12-TET', intervals: handpanIntervals(lydian, 9),
    rootMidi: 50, rootPc: PC.D, noteCount: 9, octaveRange: [2, 4],
    isExperimental: false,
    instrumentCompatibility: ['handpan', 'harp', 'celestial_bow']
  }
];

export function scaleToCents(scale) {
  if (Array.isArray(scale.cents) && scale.cents.length) {
    return scale.cents.slice();
  }
  const iv = scale.intervals || [0, 7, 8, 10, 12, 14, 15, 17, 19];
  return iv.map(semiToCents);
}

/** Scale family headings (kept in sync with HANDPAN_SCALES[].family). */
export const SCALE_FAMILIES = [
  'CLASSIC HANDPAN',
  'PYGMY & PENTATONIC',
  'EASTERN & EXOTIC',
  'ATMOSPHERIC & MODERN',
  'WESTERN & MODAL'
];

export function scalesByFamily() {
  const map = new Map();
  for (const fam of SCALE_FAMILIES) map.set(fam, []);
  for (const s of HANDPAN_SCALES) {
    const list = map.get(s.family) || [];
    list.push(s);
    map.set(s.family, list);
  }
  return map;
}

export function nonExperimentalScales() {
  return HANDPAN_SCALES.filter((s) => !s.isExperimental);
}

export function findScaleById(id) {
  return HANDPAN_SCALES.find((s) => s.id === id) || null;
}

export function scaleIds() {
  return HANDPAN_SCALES.map((s) => s.id);
}

export function scaleCount() {
  return HANDPAN_SCALES.length;
}

/** Pick a valid scale index. By default excludes experimental presets. */
export function randomScaleIndex({ excludeExperimental = true } = {}) {
  const pool = excludeExperimental ? nonExperimentalScales() : HANDPAN_SCALES.slice();
  if (!pool.length) return 0;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return HANDPAN_SCALES.indexOf(pick);
}
