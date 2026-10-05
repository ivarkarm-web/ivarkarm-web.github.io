/**
 * content.js
 * Static world content, section narrative data, resonant stones,
 * vegetation builders, stars, horizon lights, background assets,
 * and world constants.
 * Depends on: utilities.js (rand, biomeForWorldX, poissonScatter)
 */
const resonantStones = [
  {
    id: 'summit',
    x: -650,
    title: 'Baltic Edge',
    meta: 'Early Life · Eastern Estonia',
    text: 'After the Soviet collapse, a restless kid with pots, a harmonica, and a torn djembe. Abandoned factories, the Baltic beach, first hitchhikes at ten. The seed of the handpan arrived on YouTube during home schooling.',
    noteIdx: 0,
    triggered: false
  },
  {
    id: 'djembe-seed',
    x: 900,
    title: 'The €30 Drum',
    meta: 'Way to Music · Berlin',
    text: 'Kreuzberg thrift shop. A cheap African djembe. The street became the classroom — not a conservatory.',
    noteIdx: 2,
    triggered: false
  },
  {
    id: 'berlin',
    x: 1800,
    title: 'Warschauer Straße',
    meta: 'Way to Music · Berlin',
    text: 'Six to nine hours a day in the underground. Sixty or seventy euros a good weekend on Warschauer Straße. The handpan was still a rumour on a screen.',
    noteIdx: 1,
    triggered: false
  },
  {
    id: 'spacedrum',
    x: 3000,
    title: 'First Steel',
    meta: 'Instruments · Spacedrum',
    text: 'A C major pentatonic Spacedrum — the one everyone wanted after Yuki Koshimoto. Practiced like a djembe until the steel taught its own language.',
    noteIdx: 3,
    triggered: false
  },
  {
    id: 'road',
    x: 4200,
    title: 'The Stolen Steel',
    meta: 'The Road · Tallinn',
    text: 'A locked staircase. An empty case. The lowest point on the road — and the start of asking for help.',
    noteIdx: 4,
    triggered: false
  },
  {
    id: 'godan-gift',
    x: 5200,
    title: 'The Hague',
    meta: 'Makers · Godan',
    text: 'A short walk and talk with a maker. Later, a message: a brand new handpan, free of charge. Still the nicest thing anyone has done on this road.',
    noteIdx: 5,
    triggered: false
  },
  {
    id: 'tallinn-dog',
    x: 6400,
    title: 'Case & Companion',
    meta: 'Tallinn streets',
    text: 'Busking Tallinn with a dog in the case. The street does not pay on time, but nobody tells you when to stop.',
    noteIdx: 7,
    triggered: false
  },
  {
    id: 'greece',
    x: 8000,
    title: 'Ermou Street',
    meta: 'Greece · Athens',
    text: 'Samos did not last. Athens did. Notes left in the case, open stage, the road continuing.',
    noteIdx: 6,
    triggered: false
  },
  {
    id: 'bedroom',
    x: 9200,
    title: 'Bedroom Sessions',
    meta: 'Recordings · Archive',
    text: 'Eight raw handpan improvisations. No studio polish — kept as they were. Listen on the road or from the vault.',
    noteIdx: 8,
    triggered: false
  },
  {
    id: 'archive',
    x: 10500,
    title: 'The Threshold',
    meta: 'Deep Archive · The Rabbit Hole',
    text: 'Where the public road ends and the full story begins. Makers, sessions, instruments, and the notes figured out the hard way.',
    noteIdx: 9,
    triggered: false
  }
];

// ===== END OF ROAD (after Contact) =====
const CONTACT_X = 11000;
// Fade / portal start further past Contact so the ceremony isn't on top of it
const END_FADE_START_X = 11700;
const WORLD_END_X = 12500;

let endOfRoadState = {
  fading: false,
  fade: 1,
  archiveShown: false,
  rabbitHoleShown: false,
  transitionT: 0,
  screenFade: 0
};

const STAR_COUNT_FAR = 70;
const STAR_COUNT_MID = 38;
const STAR_COUNT_NEAR = 18;
const starsFar = [];
const starsMid = [];
const starsNear = [];
const STAR_WORLD_WIDTH = 17000;

(function initStars() {
  for (let i = 0; i < STAR_COUNT_FAR; i++) {
    starsFar.push({
      wx: Math.random() * STAR_WORLD_WIDTH,
      y: Math.random() * 0.6,
      r: 0.6 + Math.random() * 0.6,
      tw: Math.random() * Math.PI * 2
    });
  }
  for (let i = 0; i < STAR_COUNT_MID; i++) {
    starsMid.push({
      wx: Math.random() * STAR_WORLD_WIDTH,
      y: Math.random() * 0.58,
      r: 1.0 + Math.random() * 0.9,
      tw: Math.random() * Math.PI * 2
    });
  }
  for (let i = 0; i < STAR_COUNT_NEAR; i++) {
    starsNear.push({
      wx: Math.random() * STAR_WORLD_WIDTH,
      y: Math.random() * 0.56,
      r: 1.6 + Math.random() * 1.6,
      tw: Math.random() * Math.PI * 2
    });
  }
})();

const horizonLights = [
  { x: 600, hue: 'warm', size: 1.0, intensity: 1.0 },
  { x: 900, hue: 'warm', size: 0.8, intensity: 0.8 },
  { x: 1300, hue: 'warm', size: 1.1, intensity: 1.1 },
  { x: 1800, hue: 'berlin', size: 1.2, intensity: 1.2 },
  { x: 2100, hue: 'berlin', size: 0.9, intensity: 1.0 },
  { x: 2400, hue: 'berlin', size: 1.3, intensity: 1.3 },
  { x: 2800, hue: 'berlin', size: 1.0, intensity: 1.0 },
  { x: 3200, hue: 'berlin', size: 1.1, intensity: 1.1 },
  { x: 3600, hue: 'warm', size: 0.85, intensity: 0.9 },
  { x: 4100, hue: 'travel', size: 1.0, intensity: 1.0 },
  { x: 4700, hue: 'travel', size: 1.15, intensity: 1.15 },
  { x: 5100, hue: 'travel', size: 0.9, intensity: 0.95 },
  { x: 5500, hue: 'travel', size: 1.05, intensity: 1.05 },
  { x: 5900, hue: 'travel', size: 1.2, intensity: 1.2 },
  { x: 6400, hue: 'travel', size: 0.95, intensity: 0.95 },
  { x: 6900, hue: 'travel', size: 1.0, intensity: 1.0 },
  { x: 7300, hue: 'greece', size: 1.1, intensity: 1.1 },
  { x: 7800, hue: 'greece', size: 1.3, intensity: 1.3 },
  { x: 8300, hue: 'greece', size: 1.0, intensity: 1.0 },
  { x: 8800, hue: 'greece', size: 1.15, intensity: 1.15 },
  { x: 9300, hue: 'greece', size: 0.95, intensity: 0.95 },
  { x: 9700, hue: 'greece', size: 1.2, intensity: 1.2 }
];

const HUE_PALETTE = {
  warm:   { core: [255, 222, 150], glow: [212, 175, 55] },
  berlin: { core: [255, 214, 128], glow: [220, 160, 50] },
  travel: { core: [255, 200, 132], glow: [200, 138, 42] },
  greece: { core: [214, 228, 245], glow: [164, 190, 215] }
};

const resonanceParticles = [];
const PARTICLE_MAX = 120;
let resonanceTimer = 0;
let wasOnGround = false;

function spawnResonanceParticle() {
  const maxP = (typeof AppCore !== 'undefined' && AppCore.getSettings) ? (AppCore.getSettings().particleMax || PARTICLE_MAX) : PARTICLE_MAX;
  if (resonanceParticles.length >= maxP) return;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
  const speed = 0.25 + Math.random() * 0.7;
  const golden = Math.random() < 0.75;
  const wx = x + (Math.random() - 0.5) * 18;
  const wy = y - ballRadius * 0.2 + (Math.random() - 0.5) * 8;
  resonanceParticles.push({
    wx, wy,
    pwx: wx, pwy: wy,
    vx: Math.cos(angle) * speed * 0.4 + vx * 0.05,
    vy: Math.sin(angle) * speed - 0.2 - Math.random() * 0.3,
    life: 1,
    r0: 1.2 + Math.random() * 1.8,
    golden,
    seed: Math.random() * Math.PI * 2,
    twinkleSpeed: 4 + Math.random() * 5,
    sparkle: golden && Math.random() < 0.16
  });
}

function spawnLandingDust() {
  const count = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const maxP2 = (typeof AppCore !== 'undefined' && AppCore.getSettings) ? (AppCore.getSettings().particleMax || PARTICLE_MAX) : PARTICLE_MAX;
    if (resonanceParticles.length >= maxP2) break;
    const side = Math.random() < 0.5 ? -1 : 1;
    const speed = 0.4 + Math.random() * 1.0;
    const up = 0.2 + Math.random() * 0.6;
    const dwx = x + side * Math.random() * ballRadius * 0.7;
    const dwy = getGround(x) - ballRadius + 2;
    resonanceParticles.push({
      wx: dwx, wy: dwy,
      pwx: dwx, pwy: dwy,
      vx: side * speed * (0.5 + Math.random()),
      vy: -up,
      life: 1,
      r0: 1.0 + Math.random() * 1.4,
      golden: Math.random() < 0.4,
      seed: Math.random() * Math.PI * 2,
      twinkleSpeed: 4 + Math.random() * 5,
      sparkle: false
    });
  }
}

const soundRings = [];
const RING_MAX = 12;

function spawnSoundRing(worldX, worldY) {
  if (soundRings.length >= RING_MAX) soundRings.shift();
  soundRings.push({ wx: worldX, wy: worldY, t: 0, life: 1 });
}

function poissonScatter(width, minDist, rngFn) {
  const cell = minDist / Math.SQRT2;
  const cols = Math.ceil(width / cell);
  const grid = new Array(cols).fill(-1);
  const points = [];
  function accept(px) {
    const ci = Math.floor(px / cell);
    for (let i = Math.max(0, ci - 2); i <= Math.min(cols - 1, ci + 2); i++) {
      if (grid[i] < 0) continue;
      if (Math.abs(px - points[grid[i]]) < minDist) return false;
    }
    return true;
  }
  for (let attempt = 0; attempt < width * 40; attempt++) {
    const px = rngFn() * width;
    if (!accept(px)) continue;
    points.push(px);
    grid[Math.floor(px / cell)] = points.length - 1;
    if (points.length > 350) break;
  }
  return points;
}

function buildVegSet(densityScale, minDist, rng, sizeRange, typeWeights) {
  const worldEnd = 10500;
  const points = poissonScatter(worldEnd, minDist, rng);
  const list = [];
  for (let i = 0; i < points.length; i++) {
    const wx = points[i];
    const biome = biomeForWorldX(wx);
    const biomeScale = (
      biome === 'berlin' ? densityScale * 1.05 :
      biome === 'travel' ? densityScale * 0.58 :
      biome === 'greece' ? densityScale * 0.95 :
      densityScale * 0.45
    );
    if (rng() > biomeScale) continue;
    const sMin = sizeRange[0];
    const sMax = sizeRange[1];
    const size = sMin + rng() * (sMax - sMin);
    let type = 'grass';
    const w = typeWeights;
    const r = rng();
    let acc = 0;
    for (const key in w) {
      acc += w[key];
      if (r < acc) { type = key; break; }
    }
    list.push({
      wx: wx,
      size: size,
      seed: Math.floor(rng() * 1e7),
      type: type,
      biome: biome
    });
  }
  return list;
}

const rngFar = rand(918273);
const rngMid = rand(445566);
const rngNear = rand(1234567);
const rngGlow = rand(778899);
const rngFore = rand(3141592);

const vegFar = buildVegSet(0.82, 55, rngFar, [0.25, 0.55], { slap: 1.0 });
const vegMid = buildVegSet(0.62, 85, rngMid, [0.55, 1.15], {
  cypress: 0.22,
  olive: 0.24,
  pine: 0.24,
  birch: 0.15,
  bush: 0.15
});
const vegNear = buildVegSet(0.70, 52, rngNear, [0.85, 1.55], {
  grass: 0.36,
  reed: 0.10,
  bush: 0.14,
  olivetree: 0.12,
  cypress: 0.08,
  pine: 0.12,
  birch: 0.08
});
const vegFore = buildVegSet(0.16, 320, rngFore, [1.3, 2.2], { cypress: 0.35, olivetree: 0.35, pine: 0.30 });
// updateVegGlobalScale() deferred to engine resize (script.js) — do not call before it exists

// Populate Baltic Pine & Spruce Forest ONLY on top of the hill (summit plateau: wx: -655 down to -790)
function populateBalticForest() {
  const rngBaltic = rand(584920);
  // 1. Near layer: Baltic Spruces, Scots Pines, Silver Birches on top of the hill
  for (let wx = -655; wx >= -785; wx -= (28 + rngBaltic() * 22)) {
    const r = rngBaltic();
    const type = r < 0.36 ? 'balticSpruce' : (r < 0.68 ? 'balticPine' : (r < 0.86 ? 'birch' : 'balticShrub'));
    const size = 0.85 + rngBaltic() * 0.65;
    vegNear.push({
      wx: wx,
      size: size,
      seed: Math.floor(rngBaltic() * 1e7),
      type: type,
      biome: 'baltic'
    });
  }
  // 2. Mid layer: Stately ridge trees on top of the summit
  for (let wx = -650; wx >= -790; wx -= (25 + rngBaltic() * 20)) {
    const r = rngBaltic();
    const type = r < 0.44 ? 'balticSpruce' : (r < 0.76 ? 'balticPine' : 'birch');
    const size = 0.60 + rngBaltic() * 0.55;
    vegMid.push({
      wx: wx,
      size: size,
      seed: Math.floor(rngBaltic() * 1e7),
      type: type,
      biome: 'baltic'
    });
  }
  // 3. Far layer: Distant forest canopy silhouetted on the summit horizon
  for (let wx = -650; wx >= -800; wx -= (20 + rngBaltic() * 18)) {
    const r = rngBaltic();
    const size = 0.35 + rngBaltic() * 0.38;
    vegFar.push({
      wx: wx,
      size: size,
      seed: Math.floor(rngBaltic() * 1e7),
      type: r < 0.6 ? 'balticSpruce' : 'balticPine',
      biome: 'baltic'
    });
  }
  vegNear.sort((a, b) => a.wx - b.wx);
  vegMid.sort((a, b) => a.wx - b.wx);
  vegFar.sort((a, b) => a.wx - b.wx);
}
populateBalticForest();

const glowFlowers = [];
(function buildGlowFlowers() {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const wx = 7200 + rngGlow() * 3000;
    glowFlowers.push({
      wx: wx,
      size: 0.7 + rngGlow() * 0.7,
      phase: rngGlow() * Math.PI * 2
    });
  }
})();

const LEFT_HILL_BASE_X = 100;
const LEFT_HILL_TOP_X = -650;
const LEFT_HILL_END_X = -820;
const LEFT_HILL_BLEND = 220;
const LEFT_REVEAL_X = -620;

const leftSecretState = { alpha: 0 };
const endSecretState = { alpha: 0 };


function leftHillOffset(worldX, totalRise, exponent, noiseSalt) {
  const hillP = Math.min(1, Math.max(0, (LEFT_HILL_BASE_X - worldX) / (LEFT_HILL_BASE_X - LEFT_HILL_TOP_X)));
  const riseCurve = Math.pow(hillP, exponent) * 0.94 + (1 - Math.cos(hillP * Math.PI)) * 0.5 * 0.06;
  const noise = noiseSalt ? fbm(worldX, noiseSalt, 2.1, 0.48, 3) * 6 : 0;
  return -riseCurve * totalRise + noise;
}

function withLeftHill(worldX, flatValFn, totalRise, exponent, noiseSalt) {
  if (worldX >= LEFT_HILL_BASE_X + LEFT_HILL_BLEND) return flatValFn(worldX);
  const seam = flatValFn(LEFT_HILL_BASE_X + LEFT_HILL_BLEND);
  const hillSide = seam + leftHillOffset(worldX, totalRise, exponent, noiseSalt);
  if (worldX <= LEFT_HILL_BASE_X - LEFT_HILL_BLEND) return hillSide;
  const t = (worldX - (LEFT_HILL_BASE_X - LEFT_HILL_BLEND)) / (LEFT_HILL_BLEND * 2);
  const s = t * t * (3 - 2 * t);
  const flatSide = flatValFn(worldX);
  return flatSide * s + hillSide * (1 - s);
}

function getSteepHillHeight(worldX) {
  const base = canvas ? viewH * 0.65 : 400;
  const flatVal = (wx) => Math.sin(wx * 0.0008) * 80 + Math.cos(wx * 0.002) * 35;
  return base + withLeftHill(worldX, flatVal, 620, 1.6, 31.5);
}

function getGround(worldX) {
  return getSteepHillHeight(worldX);
}

function hillClimbHeightMid(worldX) {
  const flatVal = (wx) => Math.sin(wx * 0.00055 + 2.3) * 68 + Math.cos(wx * 0.0014) * 28;
  return withLeftHill(worldX, flatVal, 590, 1.5, 41.2);
}

function getGroundMid(worldX) {
  const base = canvas ? viewH * 0.61 : 380;
  return base + hillClimbHeightMid(worldX);
}

function hillClimbHeightFar(worldX) {
  const flatVal = (wx) => Math.sin(wx * 0.00035 + 1.1) * 55 + Math.cos(wx * 0.0009) * 22;
  return withLeftHill(worldX, flatVal, 560, 1.45, 51.8);
}

function getGroundFar(worldX) {
  const base = canvas ? viewH * 0.56 : 360;
  return base + hillClimbHeightFar(worldX);
}

function getSlope(worldX) {
  const delta = 1;
  return (getGround(worldX + delta) - getGround(worldX - delta)) / (2 * delta);
}

const sectionPositions = [
  { x: 500, index: 0, title: "Home" },
  { x: 2000, index: 1, title: "About" },
  { x: 3800, index: 2, title: "Story" },
  { x: 5600, index: 3, title: "Manifesto" },
  { x: 7400, index: 4, title: "Improv Sessions" },
  { x: 9200, index: 5, title: "Partners" },
  { x: 11000, index: 6, title: "Contact" }
];

const NARRATIVE_ZOOM_SECTION_INDICES = [2, 3, 4, 5];
const NARRATIVE_ZOOM_LEVEL = 0.5;
const NARRATIVE_ZOOM_RANGE = 1500;

function computeNarrativeZoomFactor() {
  let closest = Infinity;
  for (let i = 0; i < NARRATIVE_ZOOM_SECTION_INDICES.length; i++) {
    const pos = sectionPositions[NARRATIVE_ZOOM_SECTION_INDICES[i]];
    if (!pos) continue;
    const d = Math.abs(x - pos.x);
    if (d < closest) closest = d;
  }
  if (closest >= NARRATIVE_ZOOM_RANGE) return 0;
  const t = 1 - closest / NARRATIVE_ZOOM_RANGE;
  return t * t * (3 - 2 * t);
}

const audioOrbs = [
  { x: 1500, audioFile: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%203.wav', collected: false }
];

let currentAudio = null;
let audioFadeInterval = null;
const parallaxSpeed = 0.3;

const backgroundImageUrls = [
  'https://i.postimg.cc/qM7chvD6/47q-V1tx5Q9WJ8PRicr-u-M-j-U4e200V.webp',
  'https://i.postimg.cc/HLtj9QVL/s0tzj4cvv-Za-Fwb-PEg-O23-Qr2XDd-Sw.webp',
  'https://i.postimg.cc/KzPXMNz6/7Dq-Ohvblw-WWER0r-VFUdl9-V5W9d-TB4.webp',
  'https://i.postimg.cc/kXhHDZsv/7Jis-ILL-a7Acebc2b1n-YY-VX0q-RBDs-%281%29.webp',
  'https://i.postimg.cc/mD8wJz6G/7cl-Jx48Nq-P4ylu-Xb9d-G-X-32ftn-BHd.webp',
  'https://i.postimg.cc/GhBWPdHz/Mw-KTVh-Nq-Hr-QOp-PQi-CYIk-P-Zx-Rs8PL1.webp',
  'https://i.postimg.cc/rFdBGMKZ/ua4GT-cov-X6-f-SSfubzz-V-ZFUt-M1ZX.webp'
];

const bgImages = [];
let bgReadyCount = 0;
backgroundImageUrls.forEach((url, idx) => {
  const img = new Image();
  img.onload = () => { bgReadyCount++; };
  img.onerror = () => {};
  img.src = url;
  bgImages[idx] = img;
});

let bgCurrentIndex = 0;
let bgNextIndex = 1;
let bgFadeProgress = 0;
const BG_FADE_DURATION = 2.5;
const BG_HOLD_DURATION = 4.0;
let bgTimer = 0;
let bgPhase = 'hold';
const BG_MAX_OPACITY = 0.92;

// Expose slideshow state on window for cross-script resilience
try {
  window.bgPhase = bgPhase;
  window.bgTimer = bgTimer;
  window.bgFadeProgress = bgFadeProgress;
  window.bgCurrentIndex = bgCurrentIndex;
  window.bgNextIndex = bgNextIndex;
  window.bgImages = bgImages;
  window.bgReadyCount = bgReadyCount;
  window.BG_FADE_DURATION = BG_FADE_DURATION;
  window.BG_HOLD_DURATION = BG_HOLD_DURATION;
  window.BG_MAX_OPACITY = BG_MAX_OPACITY;
} catch (_) {}
