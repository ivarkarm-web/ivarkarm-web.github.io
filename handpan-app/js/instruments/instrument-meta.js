/**
 * instrument-meta.js — data-driven metadata for every registered instrument.
 *
 * Single source of truth for instrument family classification and capability
 * advertising. Read by `instruments/library-family.js` when building each
 * LibraryInstrument, and by the instrument selector UI for category headings.
 *
 * Families (primary):
 *   HANDPAN & TUNED PERCUSSION   handpan, tongue drum, kalimba, marimba,
 *                                gamelan, metallophones, tuned percussion
 *   PERCUSSION                   frame drums, tabla, singing bowls, gongs,
 *                                world percussion
 *   WIND                         flutes, bansuri, shakuhachi, ney, pan flute,
 *                                whistles, breath-based instruments
 *   STRINGS                      koto, harp, guqin, lyres, zithers, bowed
 *                                strings, dulcimer
 *   DRONES & ATMOSPHERIC         sustained pads, drones, bowls, choir, ambient
 *   ELECTRONIC & SYNTH           tine piano, music box, chimes, textures
 *
 * Capabilities reflect the actual audio implementation (pre-rendered procedural
 * voices via the shared SoundLibrary), not assumptions. A voice with a fixed
 * pre-rendered tail is not advertised as having genuine sustained note release
 * unless it is a held voice that fades on finger release.
 */
const ALL_SCALE_FAMILIES = [
  'CLASSIC HANDPAN',
  'PYGMY & PENTATONIC',
  'EASTERN & EXOTIC',
  'ATMOSPHERIC & MODERN',
  'WESTERN & MODAL'
];

// Voices that sustain while the finger is down and fade on release.
const HELD = new Set([
  'bowl', 'tibetan', 'breath', 'choir', 'drone', 'cloud',
  'mist_drone', 'aether', 'aurora', 'celestial_bow', 'sub_hum',
  'ambient_cello', 'sitar_air', 'silk_violin',
  'shakuhachi', 'duduk', 'native_flute', 'dizi', 'xun', 'bone_flute'
]);

function entry({
  id, name, family, subcategory, mood, description = '', tags = [],
  isTonal = true, isPercussive = false, isSustained = false,
  supportsPitchBend = true, supportsExpression = true, supportsPolyphony = true,
  supportsScaleMapping = true, supportsNoteRelease = isSustained,
  compatibleScales = ALL_SCALE_FAMILIES
} = {}) {
  return {
    id, name, family, subcategory, mood, description, tags,
    isTonal, isPercussive, isSustained,
    supportsPitchBend, supportsExpression, supportsPolyphony,
    supportsScaleMapping, supportsNoteRelease, compatibleScales
  };
}

export const INSTRUMENT_FAMILIES = [
  'HANDPAN & TUNED PERCUSSION',
  'PERCUSSION',
  'WIND',
  'STRINGS',
  'DRONES & ATMOSPHERIC',
  'ELECTRONIC & SYNTH'
];

export const INSTRUMENT_META = {
  /* ---- handpan ---- */
  handpan: entry({
    id: 'handpan', name: 'Handpan',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Handpan',
    mood: 'Meditative',
    description: 'Radial steel handpan with scale-fixed tonefields, aftertouch and MPE pitch bend.',
    tags: ['handpan', 'steel', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),

  /* ---- HANDPAN & TUNED PERCUSSION ---- */
  tongue: entry({
    id: 'tongue', name: 'Steel Tongue Drum',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Tongue Drum',
    mood: 'Meditative',
    description: 'Boxier handpan cousin with shorter decay.',
    tags: ['tongue', 'steel', 'meditative'],
    isPercussive: true
  }),
  kalimba: entry({
    id: 'kalimba', name: 'Kalimba',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Thumb Piano',
    mood: 'Playful',
    description: 'Cantilever tine with sharp partials.',
    tags: ['kalimba', 'tine', 'plucked'],
    isPercussive: true
  }),
  crystal_kalimba: entry({
    id: 'crystal_kalimba', name: 'Crystal Kalimba',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Kalimba',
    mood: 'Dreamy',
    description: 'Pure glassy tine pluck.',
    tags: ['kalimba', 'glass', 'dreamy'],
    isPercussive: true
  }),
  marimba: entry({
    id: 'marimba', name: 'Marimba',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Xylophone',
    mood: 'Rhythmic',
    description: 'Wooden bar mallet strike, warm fundamental, short woody decay.',
    tags: ['marimba', 'xylophone', 'rhythmic'],
    isPercussive: true
  }),
  gamelan: entry({
    id: 'gamelan', name: 'Gamelan',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Metallophone',
    mood: 'Rhythmic',
    description: 'Indonesian metallophone, bright inharmonic bar, shimmering sustain.',
    tags: ['gamelan', 'metallophone', 'rhythmic'],
    isPercussive: true
  }),
  glockenspiel: entry({
    id: 'glockenspiel', name: 'Glockenspiel',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Bell',
    mood: 'Bright',
    description: 'Bright metal bars, short clear chime.',
    tags: ['glockenspiel', 'bell', 'bright'],
    isPercussive: true
  }),
  balafon: entry({
    id: 'balafon', name: 'Balafon',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Xylophone',
    mood: 'Rhythmic',
    description: 'Wooden bars with a buzzing gourd-membrane layer.',
    tags: ['balafon', 'xylophone', 'rhythmic'],
    isPercussive: true
  }),
  amadinda: entry({
    id: 'amadinda', name: 'Amadinda',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Log Xylophone',
    mood: 'Rhythmic',
    description: 'Dry hollow-log xylophone, short and woody.',
    tags: ['amadinda', 'log', 'rhythmic'],
    isPercussive: true
  }),
  slit_drum: entry({
    id: 'slit_drum', name: 'Slit Drum',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Slit Drum',
    mood: 'Rhythmic',
    description: 'Hollow wood slit drum: low thunk with a pitched knock.',
    tags: ['slit', 'drum', 'rhythmic'],
    isPercussive: true
  }),
  mbira: entry({
    id: 'mbira', name: 'Mbira',
    family: 'HANDPAN & TUNED PERCUSSION', subcategory: 'Thumb Piano',
    mood: 'Spiritual',
    description: 'Shona thumb piano, metallic tine pluck with buzzing overtones.',
    tags: ['mbira', 'thumb', 'spiritual'],
    isPercussive: true
  }),
  kulintang: entry({
    id: 'kulintang', name: 'Kulintang',
    family: 'PERCUSSION', subcategory: 'Gong',
    mood: 'Spiritual',
    description: 'Small bossed gongs, shimmery sustain.',
    tags: ['kulintang', 'gong', 'shimmery'],
    isPercussive: true
  }),
  tube_drum: entry({
    id: 'tube_drum', name: 'Tube Drums',
    family: 'PERCUSSION', subcategory: 'Tube Drum',
    mood: 'Meditative',
    description: 'Low hollow struck-tube tones with odd partials and a dark body.',
    tags: ['tube', 'drum', 'meditative'],
    isPercussive: true
  }),

  /* ---- PERCUSSION ---- */
  frame_drum: entry({
    id: 'frame_drum', name: 'Frame Drum',
    family: 'PERCUSSION', subcategory: 'Frame Drum',
    mood: 'Rhythmic',
    description: 'Hand frame drum, skin thud on low notes, rim ring on high tones.',
    tags: ['frame', 'drum', 'rhythmic'],
    isPercussive: true
  }),
  tabla: entry({
    id: 'tabla', name: 'Tabla',
    family: 'PERCUSSION', subcategory: 'Tabla',
    mood: 'Rhythmic',
    description: 'North Indian tabla, bayan thud and dayan ring.',
    tags: ['tabla', 'drum', 'rhythmic'],
    isPercussive: true
  }),
  bowl: entry({
    id: 'bowl', name: 'Singing Bowl',
    family: 'PERCUSSION', subcategory: 'Singing Bowl',
    mood: 'Meditative',
    description: 'Bronze bowl with inharmonic beating partials.',
    tags: ['bowl', 'meditative'],
    isPercussive: true, isSustained: true, supportsNoteRelease: true
  }),
  tibetan: entry({
    id: 'tibetan', name: 'Tibetan Singing Bowl',
    family: 'PERCUSSION', subcategory: 'Singing Bowl',
    mood: 'Meditative',
    description: 'Deep bronze bowl with inharmonic beating partials.',
    tags: ['tibetan', 'bowl', 'meditative'],
    isPercussive: true, isSustained: true, supportsNoteRelease: true
  }),

  /* ---- WIND ---- */
  breath: entry({
    id: 'breath', name: 'Breath Flute',
    family: 'WIND', subcategory: 'Flute',
    mood: 'Meditative',
    description: 'Closed-pipe flute driven by shaped breath noise.',
    tags: ['flute', 'breath', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  shakuhachi: entry({
    id: 'shakuhachi', name: 'Shakuhachi',
    family: 'WIND', subcategory: 'Flute',
    mood: 'Meditative',
    description: 'Japanese bamboo flute, breathy hollow pipe.',
    tags: ['shakuhachi', 'flute', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  duduk: entry({
    id: 'duduk', name: 'Duduk',
    family: 'WIND', subcategory: 'Reed',
    mood: 'Meditative',
    description: 'Armenian double-reed, nasal mid warmth.',
    tags: ['duduk', 'reed', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  native_flute: entry({
    id: 'native_flute', name: 'Native Flute',
    family: 'WIND', subcategory: 'Flute',
    mood: 'Peaceful',
    description: 'Open flute, pure tone with airy chiff.',
    tags: ['flute', 'peaceful'],
    isSustained: true, supportsNoteRelease: true
  }),
  ocarina: entry({
    id: 'ocarina', name: 'Ocarina',
    family: 'WIND', subcategory: 'Ocarina',
    mood: 'Peaceful',
    description: 'Ceramic whistle, pure sine-led with soft chiff.',
    tags: ['ocarina', 'whistle', 'peaceful'],
    isPercussive: false
  }),
  pan_pipes: entry({
    id: 'pan_pipes', name: 'Pan Pipes',
    family: 'WIND', subcategory: 'Pan Flute',
    mood: 'Playful',
    description: 'Andean pan flute, detuned ranks, bright chiff.',
    tags: ['pan', 'flute', 'playful'],
    isPercussive: false
  }),
  dizi: entry({
    id: 'dizi', name: 'Dizi',
    family: 'WIND', subcategory: 'Flute',
    mood: 'Meditative',
    description: 'Bright bamboo flute with buzzing membrane.',
    tags: ['dizi', 'flute', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  xun: entry({
    id: 'xun', name: 'Xun',
    family: 'WIND', subcategory: 'Vessel Flute',
    mood: 'Meditative',
    description: 'Round hollow clay-vessel flute, pure and dark.',
    tags: ['xun', 'vessel', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  bone_flute: entry({
    id: 'bone_flute', name: 'Vulture Bone Flute',
    family: 'WIND', subcategory: 'Flute',
    mood: 'Mysterious',
    description: 'Raw, airy primitive flute.',
    tags: ['bone', 'flute', 'primitive'],
    isSustained: true, supportsNoteRelease: true
  }),

  /* ---- STRINGS ---- */
  koto: entry({
    id: 'koto', name: 'Koto',
    family: 'STRINGS', subcategory: 'Zither',
    mood: 'Meditative',
    description: 'Plucked string with hard tsume attack.',
    tags: ['koto', 'zither', 'plucked'],
    isPercussive: true
  }),
  harp: entry({
    id: 'harp', name: 'Harp',
    family: 'STRINGS', subcategory: 'Harp',
    mood: 'Peaceful',
    description: 'Softer rounder string, longer sustain.',
    tags: ['harp', 'peaceful'],
    isPercussive: true
  }),
  guqin: entry({
    id: 'guqin', name: 'Guqin',
    family: 'STRINGS', subcategory: 'Zither',
    mood: 'Meditative',
    description: 'Slow deep pluck, soft attack, long decay, subtle pitch glide.',
    tags: ['guqin', 'zither', 'meditative'],
    isPercussive: true
  }),
  begena: entry({
    id: 'begena', name: 'Begena',
    family: 'STRINGS', subcategory: 'Lyre',
    mood: 'Spiritual',
    description: 'Low buzzing lyre, meditative, sympathetic buzz.',
    tags: ['begen', 'lyre', 'spiritual'],
    isPercussive: true
  }),
  valiha: entry({
    id: 'valiha', name: 'Valiha',
    family: 'STRINGS', subcategory: 'Tube Zither',
    mood: 'Bright',
    description: 'Bright bamboo-tube zither, short harmonics.',
    tags: ['valiha', 'zither', 'bright'],
    isPercussive: true
  }),
  krar: entry({
    id: 'krar', name: 'Krar',
    family: 'STRINGS', subcategory: 'Lyre',
    mood: 'Playful',
    description: 'Twangy nasal bowl lyre.',
    tags: ['krar', 'lyre', 'playful'],
    isPercussive: true
  }),
  bolon: entry({
    id: 'bolon', name: 'Bolon',
    family: 'STRINGS', subcategory: 'Harp',
    mood: 'Meditative',
    description: 'Deep calabash harp, thumping low plucks, resonant body.',
    tags: ['bolon', 'harp', 'meditative'],
    isPercussive: true
  }),
  donso_ngoni: entry({
    id: 'donso_ngoni', name: 'Donso Ngoni',
    family: 'STRINGS', subcategory: 'Harp',
    mood: 'Rhythmic',
    description: "Hunter's harp with a rattling, buzzing bridge.",
    tags: ['donso', 'ngoni', 'harp', 'rhythmic'],
    isPercussive: true
  }),
  guzheng: entry({
    id: 'guzheng', name: 'Guzheng',
    family: 'STRINGS', subcategory: 'Zither',
    mood: 'Bright',
    description: 'Chinese zither, bright attack, silvery bloom.',
    tags: ['guzheng', 'zither', 'bright'],
    isPercussive: true
  }),
  sitar_air: entry({
    id: 'sitar_air', name: 'Sitar Air',
    family: 'STRINGS', subcategory: 'Sitar',
    mood: 'Meditative',
    description: 'Sympathetic buzz under sustained sitar fundamental.',
    tags: ['sitar', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  silk_violin: entry({
    id: 'silk_violin', name: 'Silk Violin',
    family: 'STRINGS', subcategory: 'Violin',
    mood: 'Dreamy',
    description: 'Soft high string pad with silk-smooth bow.',
    tags: ['violin', 'dreamy'],
    isSustained: true, supportsNoteRelease: true
  }),
  ambient_cello: entry({
    id: 'ambient_cello', name: 'Ambient Cello',
    family: 'STRINGS', subcategory: 'Cello',
    mood: 'Melancholic',
    description: 'Dark sustained cello pad with soft bow grain.',
    tags: ['cello', 'melancholic'],
    isSustained: true, supportsNoteRelease: true
  }),
  pizzicato: entry({
    id: 'pizzicato', name: 'Pizzicato Dream',
    family: 'STRINGS', subcategory: 'Pizzicato',
    mood: 'Playful',
    description: 'Soft plucked string with woody body.',
    tags: ['pizzicato', 'plucked', 'playful'],
    isPercussive: true
  }),

  /* ---- DRONES & ATMOSPHERIC ---- */
  drone: entry({
    id: 'drone', name: 'Open-Fifth Drone',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Drone',
    mood: 'Meditative',
    description: 'Root and fifth as slowly breathing detuned partials.',
    tags: ['drone', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  cloud: entry({
    id: 'cloud', name: 'Grain Cloud',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Grain',
    mood: 'Dreamy',
    description: 'Swarm of tiny sine grains around the note.',
    tags: ['cloud', 'grain', 'dreamy'],
    isSustained: true, supportsNoteRelease: true
  }),
  mist_drone: entry({
    id: 'mist_drone', name: 'Mist Drone',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Drone',
    mood: 'Meditative',
    description: 'Deep undulating sub-bass pad.',
    tags: ['mist', 'drone', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  aether: entry({
    id: 'aether', name: 'Aether Shimmer',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Pad',
    mood: 'Dreamy',
    description: 'High glassy detuned pad.',
    tags: ['aether', 'pad', 'dreamy'],
    isSustained: true, supportsNoteRelease: true
  }),
  aurora: entry({
    id: 'aurora', name: 'Aurora Borealis',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Pad',
    mood: 'Dreamy',
    description: 'Warm shifting triangle pad.',
    tags: ['aurora', 'pad', 'dreamy'],
    isSustained: true, supportsNoteRelease: true
  }),
  celestial_bow: entry({
    id: 'celestial_bow', name: 'Celestial Bow',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Bow',
    mood: 'Meditative',
    description: 'Slowly evolving bow swell.',
    tags: ['bow', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  sub_hum: entry({
    id: 'sub_hum', name: 'Subterranean Hum',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Sub',
    mood: 'Meditative',
    description: 'Ultra-low sine drone.',
    tags: ['sub', 'drone', 'meditative'],
    isSustained: true, supportsNoteRelease: true
  }),
  choir: entry({
    id: 'choir', name: 'Choir',
    family: 'DRONES & ATMOSPHERIC', subcategory: 'Choir',
    mood: 'Spiritual',
    description: 'Three detuned voices from a formant envelope.',
    tags: ['choir', 'spiritual'],
    isSustained: true, supportsNoteRelease: true
  }),

  /* ---- ELECTRONIC & SYNTH ---- */
  tine: entry({
    id: 'tine', name: 'Tine Piano',
    family: 'ELECTRONIC & SYNTH', subcategory: 'Electric Piano',
    mood: 'Playful',
    description: 'FM electric-piano tine with short metallic bark.',
    tags: ['tine', 'epiano', 'playful']
  }),
  musicbox: entry({
    id: 'musicbox', name: 'Music Box',
    family: 'ELECTRONIC & SYNTH', subcategory: 'Music Box',
    mood: 'Playful',
    description: 'Free-free bar partials, bit-crushed for nostalgic sparkle.',
    tags: ['musicbox', 'bitcrushed', 'playful']
  }),
  ice_chime: entry({
    id: 'ice_chime', name: 'Ice Chime',
    family: 'ELECTRONIC & SYNTH', subcategory: 'Chime',
    mood: 'Bright',
    description: 'Fragile glass-like strike.',
    tags: ['chime', 'ice', 'bright']
  }),
  windchimes: entry({
    id: 'windchimes', name: 'Zen Windchimes',
    family: 'ELECTRONIC & SYNTH', subcategory: 'Windchimes',
    mood: 'Dreamy',
    description: 'Primary pitch plus scattered ultra-high metallic transients.',
    tags: ['windchimes', 'metallic', 'dreamy']
  })
};

export function instrumentMeta(id) {
  return INSTRUMENT_META[id] || null;
}

export function instrumentIds() {
  return Object.keys(INSTRUMENT_META);
}

export function instrumentsByFamily() {
  const map = new Map();
  for (const fam of INSTRUMENT_FAMILIES) map.set(fam, []);
  for (const id of instrumentIds()) {
    const m = INSTRUMENT_META[id];
    (map.get(m.family) || []).push(m);
  }
  return map;
}

export function instrumentsInFamily(family) {
  return (instrumentsByFamily().get(family) || []).slice();
}

/** Pick a random registered instrument id, optionally within one family. */
export function randomInstrumentId({ family, excludeIds = [] } = {}) {
  let pool = instrumentIds();
  if (family) pool = pool.filter((id) => INSTRUMENT_META[id]?.family === family);
  pool = pool.filter((id) => !excludeIds.includes(id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Pick a random instrument within a family. */
export function randomInstrumentInFamily(family) {
  return randomInstrumentId({ family });
}
