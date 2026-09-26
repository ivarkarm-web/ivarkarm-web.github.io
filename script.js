// Canvas setup
const canvas = document.getElementById("game");
if (!canvas) {
  console.error("Canvas element 'game' not found!");
}
const ctx = canvas ? canvas.getContext("2d") : null;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Physics variables
let x = 100;
let y = canvas ? canvas.height / 2 : 300;
let vx = 0;
let vy = 0;
let rotation = 0;
const gravity = 0.6;
const jumpForce = 18;
const moveAccel = 0.8;
const maxSpeed = 15;
const airResist = 0.985;
const groundFriction = 0.92;
let onGround = false;
const ballRadius = 34;

let keys = {};
let currentSection = -1;
let contactIconsAnimated = false;

let cameraY = 0;
let _cameraVel = 0;
const SECRET_SEQUENCE = {
  NONE: 0,
  SPLASH_INTRO: 1,
  LAUNCHED: 2
};
let secretSequence = SECRET_SEQUENCE.NONE;

let zoomLevel = 1;
let _zoomTarget = 1;

const vanishingPlatforms = []; // kept for compatibility but no longer spawned in secret area
const _VP_MAX = 220;
let _vpLastSpawnX = 0;

// ===== VIDEO PLACEHOLDERS =====
const VIDEO_PLACEHOLDER_COUNT = 3;
const VIDEO_PLACEHOLDER_SPACING = 620; // world units between each
const VIDEO_FIRST_X = 10480;          // first placeholder after SECRET_START_X

const videoPlaceholders = [];
// Example titles – replace videoSrc or vimeoId with real media
const VIDEO_META = [
  { title: '', videoSrc: null, vimeoId: '1186591049' },
  { title: '', videoSrc: null, vimeoId: '1186059928' },
  { title: '', videoSrc: null, vimeoId: '1186056126' }
];
for (let i = 0; i < VIDEO_PLACEHOLDER_COUNT; i++) {
  const meta = VIDEO_META[i] || {};
  videoPlaceholders.push({
    wx: VIDEO_FIRST_X + i * VIDEO_PLACEHOLDER_SPACING,
    index: i,
    revealed: false,
    revealProgress: 0,
    played: false,
    title: meta.title || ('Performance ' + (i + 1)),
    videoSrc: meta.videoSrc || null,   // e.g. 'videos/berlin.mp4'
    vimeoId: meta.vimeoId || null      // e.g. '76979871'
  });
}

// After the 5th placeholder the ground becomes an unclimbable wall
const VIDEO_DEAD_END_X = VIDEO_FIRST_X + (VIDEO_PLACEHOLDER_COUNT - 1) * VIDEO_PLACEHOLDER_SPACING + 420;
// Hint shown slightly after Contact section (9200), before secret start (10200)
const VIDEOS_AHEAD_X = 9650;

// Player fade / lock state while rolling past current reveal
let videoGateState = {
  active: false,          // true when player is past the current revealed placeholder
  fade: 1,                // 1 = fully visible, 0 = fully faded
  lockedUntilNext: false  // stops movement until next placeholder reveals
};

const STAR_COUNT_FAR = 70;
const STAR_COUNT_MID = 38;
const STAR_COUNT_NEAR = 18;
const starsFar = [];
const starsMid = [];
const starsNear = [];
const STAR_WORLD_WIDTH = 12000;

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
  if (resonanceParticles.length >= PARTICLE_MAX) return;
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
    if (resonanceParticles.length >= PARTICLE_MAX) break;
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

(function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})(133731337);

function rand(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function biomeForWorldX(wx) {
  if (wx < 1400) return 'home';
  if (wx < 3600) return 'berlin';
  if (wx < 5800) return 'travel';
  return 'greece';
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

const vegFar = buildVegSet(0.82, 55, rngFar, [0.25, 0.55], { slap: 1.0 });
const vegMid = buildVegSet(0.62, 90, rngMid, [0.55, 1.15], { cypress: 0.30, olive: 0.40, bush: 0.30 });
const vegNear = buildVegSet(0.70, 55, rngNear, [0.85, 1.55], {
  grass: 0.44, reed: 0.16, bush: 0.18, olivetree: 0.14, cypress: 0.08
});

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

const SECRET_START_X = 10200;
const HILL_BASE_X = 9200;
const SLOPE_START_X = 9700;
const PENTATONIC = [293.66, 349.23, 392.00, 440.00, 523.25];

const LEFT_HILL_BASE_X = 100;
const LEFT_HILL_TOP_X = -650;
const LEFT_HILL_END_X = -820;
const LEFT_HILL_BLEND = 220;
const LEFT_REVEAL_X = -620;

const leftSecretState = { alpha: 0 };

// Mirror of the left hill, placed after the last video placeholder: instead of
// a hard, unclimbable wall, the ground rises into a final cliff that the
// handpan can roll up and over the top of, fading away just like it does
// on the hill at the very start of the journey.
const RIGHT_HILL_BASE_X = VIDEO_DEAD_END_X;
const RIGHT_HILL_TOP_X = VIDEO_DEAD_END_X + 750;
const RIGHT_HILL_END_X = VIDEO_DEAD_END_X + 920;
const RIGHT_HILL_BLEND = 220;
const RIGHT_REVEAL_X = VIDEO_DEAD_END_X + 720;

const endSecretState = { alpha: 0 };

const ENDLESS_BASE_ANGLE_DEG = 4.8;

_vpLastSpawnX = SECRET_START_X;

const secretState = {
  unlocked: false,
  triggeredSplash: false,
  splashAlpha: 0,
  splashT: 0,
  notesCollected: 0,
  orbsSpawnedUpToX: SECRET_START_X,
  noteOrbs: [],
  maxNoteOrbs: 400,
  screenShakeT: 0,
  HUDVisible: false,
  hudAlpha: 0,
  lastOrbSpawnX: SECRET_START_X,
  synthCtx: null,
  masterGain: null,
  reverbNode: null,
  floatingTexts: [],
  warpBanner: null,
  ghostReeds: new Map(),
  cachedGhostReedSeed: 0
};

function hash2(wx, salt) {
  const s = Math.sin(wx * 0.013 + salt * 17.23) * 43758.5453;
  return s - Math.floor(s);
}

function fbm(wx, salt, lac, gain, oct) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const phase = hash2(Math.floor(wx * freq / 50) + salt * 101, i + 1) * 1000;
    sum += amp * Math.sin(wx * freq * 0.0041 + phase);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / Math.max(0.001, norm);
}

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

function rightHillOffset(worldX, totalRise, exponent, noiseSalt) {
  const hillP = Math.min(1, Math.max(0, (worldX - RIGHT_HILL_BASE_X) / (RIGHT_HILL_TOP_X - RIGHT_HILL_BASE_X)));
  const riseCurve = Math.pow(hillP, exponent) * 0.94 + (1 - Math.cos(hillP * Math.PI)) * 0.5 * 0.06;
  const noise = noiseSalt ? fbm(worldX, noiseSalt, 2.1, 0.48, 3) * 6 : 0;
  return -riseCurve * totalRise + noise;
}

function withRightHill(worldX, flatValFn, totalRise, exponent, noiseSalt) {
  if (worldX <= RIGHT_HILL_BASE_X - RIGHT_HILL_BLEND) return flatValFn(worldX);
  const seam = flatValFn(RIGHT_HILL_BASE_X - RIGHT_HILL_BLEND);
  const hillSide = seam + rightHillOffset(worldX, totalRise, exponent, noiseSalt);
  if (worldX >= RIGHT_HILL_BASE_X + RIGHT_HILL_BLEND) return hillSide;
  const t = (worldX - (RIGHT_HILL_BASE_X - RIGHT_HILL_BLEND)) / (RIGHT_HILL_BLEND * 2);
  const s = t * t * (3 - 2 * t);
  const flatSide = flatValFn(worldX);
  return flatSide * (1 - s) + hillSide * s;
}

function getSteepHillHeight(worldX) {
  const base = canvas ? canvas.height * 0.65 : 400;
  const flatVal = (wx) => Math.sin(wx * 0.0008) * 80 + Math.cos(wx * 0.002) * 35;
  const hillVal = (wx) => {
    const hillP = Math.min(1, Math.max(0, (wx - HILL_BASE_X) / (SECRET_START_X - HILL_BASE_X)));
    const totalRise = 560;
    const e1 = Math.pow(hillP, 1.65) * 0.92;
    const e2 = (1 - Math.cos(hillP * Math.PI)) * 0.5 * 0.08;
    const riseCurve = e1 + e2;
    const micro = fbm(wx, 7.1, 2.1, 0.48, 3) * 7;
    return -riseCurve * totalRise + micro;
  };
  const seamOffset = flatVal(HILL_BASE_X);
  const BLEND = 260;
  if (worldX <= HILL_BASE_X - BLEND) return base + withLeftHill(worldX, flatVal, 620, 1.6, 31.5);
  if (worldX >= HILL_BASE_X + BLEND) return base + seamOffset + hillVal(worldX);
  const t = (worldX - (HILL_BASE_X - BLEND)) / (BLEND * 2);
  const s = t * t * (3 - 2 * t);
  return base + flatVal(worldX) * (1 - s) + (seamOffset + hillVal(worldX)) * s;
}

function endlessTerrainOffset(worldX) {
  const dx = worldX - SECRET_START_X;
  if (dx < 0) return 0;

  // Gentle rolling terrain between the video placeholders
  const flatVal = (wx) => {
    const d = wx - SECRET_START_X;
    const base = d * Math.tan(ENDLESS_BASE_ANGLE_DEG * Math.PI / 180);
    const undulate = fbm(d, 1.4, 2.1, 0.5, 5) * 18;
    const ripples = Math.sin(d * 0.0022 + 0.9) * 5 + Math.sin(d * 0.0058 + 2.1) * 3 + Math.sin(d * 0.014 + 0.4) * 1.2;
    return base + undulate + ripples;
  };

  // After the last video placeholder → the ground climbs into a final cliff,
  // mirroring the vanishing hill at the very start of the journey
  return withRightHill(worldX, flatVal, 640, 1.6, 61.5);
}

function getSecretGround(worldX) {
  if (worldX < SECRET_START_X) return getSteepHillHeight(worldX);
  const base = canvas ? canvas.height * 0.65 : 400;
  const topOfHillAtSecret = getSteepHillHeight(SECRET_START_X) - base;
  return base + topOfHillAtSecret + endlessTerrainOffset(worldX);
}

function hillClimbHeightMid(worldX) {
  const flatVal = (wx) => Math.sin(wx * 0.00055 + 2.3) * 68 + Math.cos(wx * 0.0014) * 28;
  const hillVal = (wx) => {
    const hillP = Math.min(1, Math.max(0, (wx - HILL_BASE_X) / (SECRET_START_X - HILL_BASE_X)));
    const totalRise = 540;
    const riseCurve = Math.pow(hillP, 1.55) * 0.94 + (1 - Math.cos(hillP * Math.PI)) * 0.5 * 0.06;
    return -riseCurve * totalRise + fbm(wx, 9.3, 2.0, 0.45, 3) * 5;
  };
  const seamOffset = flatVal(HILL_BASE_X);
  const BLEND = 260;
  if (worldX <= HILL_BASE_X - BLEND) return withLeftHill(worldX, flatVal, 590, 1.5, 41.2);
  if (worldX >= HILL_BASE_X + BLEND) return seamOffset + hillVal(worldX);
  const t = (worldX - (HILL_BASE_X - BLEND)) / (BLEND * 2);
  const s = t * t * (3 - 2 * t);
  return flatVal(worldX) * (1 - s) + (seamOffset + hillVal(worldX)) * s;
}

function getSecretGroundMid(worldX) {
  const base = canvas ? canvas.height * 0.61 : 380;
  if (worldX < SECRET_START_X) {
    return base + hillClimbHeightMid(worldX);
  }
  const topOfHillAtSecret = hillClimbHeightMid(SECRET_START_X);
  const flatVal = (wx) => {
    const d = wx - SECRET_START_X;
    const down = d * Math.tan(5.0 * Math.PI / 180);
    const wave = fbm(d, 2.2, 2.0, 0.5, 4) * 32 + Math.sin(d * 0.0028 + 2.1) * 9;
    return down + wave;
  };
  return base + topOfHillAtSecret + withRightHill(worldX, flatVal, 610, 1.55, 71.2);
}

function hillClimbHeightFar(worldX) {
  const flatVal = (wx) => Math.sin(wx * 0.00035 + 1.1) * 55 + Math.cos(wx * 0.0009) * 22;
  const hillVal = (wx) => {
    const hillP = Math.min(1, Math.max(0, (wx - HILL_BASE_X) / (SECRET_START_X - HILL_BASE_X)));
    const totalRise = 510;
    const riseCurve = Math.pow(hillP, 1.50) * 0.95 + (1 - Math.cos(hillP * Math.PI)) * 0.5 * 0.05;
    return -riseCurve * totalRise + fbm(wx, 11.2, 2.0, 0.42, 3) * 4;
  };
  const seamOffset = flatVal(HILL_BASE_X);
  const BLEND = 260;
  if (worldX <= HILL_BASE_X - BLEND) return withLeftHill(worldX, flatVal, 560, 1.45, 51.8);
  if (worldX >= HILL_BASE_X + BLEND) return seamOffset + hillVal(worldX);
  const t = (worldX - (HILL_BASE_X - BLEND)) / (BLEND * 2);
  const s = t * t * (3 - 2 * t);
  return flatVal(worldX) * (1 - s) + (seamOffset + hillVal(worldX)) * s;
}

function getSecretGroundFar(worldX) {
  const base = canvas ? canvas.height * 0.56 : 360;
  if (worldX < SECRET_START_X) {
    return base + hillClimbHeightFar(worldX);
  }
  const topOfHillAtSecret = hillClimbHeightFar(SECRET_START_X);
  const flatVal = (wx) => {
    const d = wx - SECRET_START_X;
    const down = d * Math.tan(5.2 * Math.PI / 180);
    const wave = fbm(d, 3.7, 2.0, 0.48, 3) * 42 + Math.cos(d * 0.0019 + 0.9) * 14;
    return down + wave;
  };
  return base + topOfHillAtSecret + withRightHill(worldX, flatVal, 580, 1.5, 81.3);
}

function pentatonicFreq(notesCollectedIdx) {
  const idx = notesCollectedIdx % PENTATONIC.length;
  const octave = Math.min(4, Math.floor(notesCollectedIdx / PENTATONIC.length / 3));
  return PENTATONIC[idx] * Math.pow(2, octave);
}

function noteNameFromFreq(freq) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = 12 * (Math.log2(freq / 440)) + 69;
  const m = Math.round(midi);
  return names[((m % 12) + 12) % 12] + Math.floor(m / 12 - 1);
}

function initSynth() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ac = new Ctx();
    const master = ac.createGain();
    master.gain.value = 0.0;
    master.connect(ac.destination);
    const conv = ac.createConvolver();
    const rate = ac.sampleRate;
    const len = rate * 2.2;
    const ir = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const cd = ir.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.9);
      }
    }
    conv.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.18;
    const dry = ac.createGain();
    dry.gain.value = 0.82;
    master.connect(dry);
    master.connect(conv);
    conv.connect(wet);
    dry.connect(ac.destination);
    wet.connect(ac.destination);
    secretState.synthCtx = ac;
    secretState.masterGain = master;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0.0, ac.currentTime);
    master.gain.linearRampToValueAtTime(0.35, ac.currentTime + 0.08);
  } catch (e) {
    console.warn('synth init failed', e);
  }
}

function playNote(freq, velocity) {
  if (!secretState.synthCtx) initSynth();
  const ac = secretState.synthCtx;
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();
  const now = ac.currentTime;
  const velGain = 0.45 + velocity * 0.55;
  const o1 = ac.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;
  const o2 = ac.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * Math.pow(2, 19 / 12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.01 * velGain, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.006 * velGain, now + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.0001, now);
  g2.gain.exponentialRampToValueAtTime(0.0018 * velGain, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001 * velGain, now + 0.7);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3800;
  o1.connect(g);
  o2.connect(g2);
  g.connect(filter);
  g2.connect(filter);
  filter.connect(secretState.masterGain);
  o1.start(now);
  o2.start(now);
  o1.stop(now + 2.0);
  o2.stop(now + 2.0);
}

function hashFloat(wx, salt) {
  const h1 = Math.sin(wx * 0.013 + salt * 17.23) * 43758.5453;
  return h1 - Math.floor(h1);
}

function spawnSecretNoteOrbsUpTo(targetWorldX) {
  let current = secretState.lastOrbSpawnX;
  if (current >= targetWorldX) return;
  let safety = 0;
  while (current < targetWorldX && safety++ < 2000) {
    const gap = 180 + hashFloat(current, 7.1) * 160;
    current += gap;
    if (current > targetWorldX) break;
    if (secretState.noteOrbs.length >= secretState.maxNoteOrbs) {
      secretState.noteOrbs.shift();
    }
    const bobPhase = hashFloat(current, 2.9) * Math.PI * 2;
    secretState.noteOrbs.push({
      wx: current,
      collected: false,
      phase: bobPhase,
      orbIdx: secretState.notesCollected + secretState.noteOrbs.filter(o => o.collected).length
    });
  }
  secretState.lastOrbSpawnX = Math.max(secretState.lastOrbSpawnX, current - 200);
}

function triggerSecretSplash() {
  if (secretState.triggeredSplash) return;
  secretState.triggeredSplash = true;
  secretState.unlocked = true;
  secretState.splashT = 0;
  secretState.splashAlpha = 0;
  secretState.screenShakeT = 0.18;
  // Show message but do NOT freeze or slow the handpan — keep rolling naturally
  secretSequence = SECRET_SEQUENCE.LAUNCHED;
  secretState.HUDVisible = true;
  try { localStorage.setItem('ivarSecretAreaFound', '1'); } catch (e) {}
}

function secretAreaWarpHome() {
  x = 9200;
  vx = 0;
  vy = 0;
  secretState.warpBanner = { text: 'Returned to Greece · Contact', t: 0, life: 2.4 };
  secretState.HUDVisible = false;
  secretState.hudAlpha = 0;
  secretState.notesCollected = 0;
  secretState.noteOrbs = [];
  secretState.lastOrbSpawnX = SECRET_START_X;
  secretState.orbsSpawnedUpToX = SECRET_START_X;
  secretSequence = SECRET_SEQUENCE.NONE;
  secretState.triggeredSplash = false;
  secretState.unlocked = false;
  secretState.splashT = 0;
  secretState.splashAlpha = 0;
  secretState.floatingTexts = [];
  // reset video placeholders
  videoPlaceholders.forEach(vp => {
    vp.revealed = false;
    vp.revealProgress = 0;
    vp.played = false;
  });
  videoGateState.active = false;
  videoGateState.fade = 1;
  videoGateState.lockedUntilNext = false;
  cameraY = 0;
  zoomLevel = 1;
  _zoomTarget = 1;
  vanishingPlatforms.length = 0;
  _vpLastSpawnX = SECRET_START_X;
}

const sectionPositions = [
  { x: 500, index: 0, title: "Home" },
  { x: 2000, index: 1, title: "Story Portal" },
  { x: 3800, index: 2, title: "About Portal" },
  { x: 5600, index: 3, title: "Manifesto Portal" },
  { x: 7400, index: 4, title: "Partners Portal" },
  { x: 9200, index: 5, title: "Contact" }
];

// Audio orbs positions and audio files
const audioOrbs = [
  { x: 1500, audioFile: 'audio/d-minor-meditation [usesuno.com].mp3', collected: false },
  { x: 4500, audioFile: 'audio/e-minor-decay [usesuno.com].mp3', collected: false },
  { x: 7500, audioFile: 'audio/f-center [usesuno.com].mp3', collected: false }
];

let currentAudio = null;
let audioFadeInterval = null;

const parallaxSpeed = 0.3;

// --- BACKGROUND IMAGES (upscaled, ~90% screen) ---
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
  img.onload = () => {
    bgReadyCount++;
    console.log('BG image loaded (' + bgReadyCount + '/' + backgroundImageUrls.length + '): ' + url.split('/').pop());
  };
  img.onerror = () => console.error('FAILED to load BG image: ' + url);
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
const BG_MAX_OPACITY = 0.55;

function updateBackgroundSlideshow(dt) {
  if (bgImages.length < 2 || bgReadyCount < 1) return;
  bgTimer += dt;
  if (bgPhase === 'hold') {
    if (bgTimer >= BG_HOLD_DURATION && bgReadyCount >= 2) {
      bgPhase = 'fade';
      bgTimer = 0;
      bgFadeProgress = 0;
      let attempts = 0;
      do {
        bgNextIndex = (bgCurrentIndex + 1 + attempts) % bgImages.length;
        attempts++;
      } while ((!bgImages[bgNextIndex].complete || bgImages[bgNextIndex].naturalWidth === 0) && attempts < bgImages.length);
    }
  } else if (bgPhase === 'fade') {
    bgFadeProgress = Math.min(1, bgTimer / BG_FADE_DURATION);
    if (bgFadeProgress >= 1) {
      bgCurrentIndex = bgNextIndex;
      bgFadeProgress = 0;
      bgPhase = 'hold';
      bgTimer = 0;
    }
  }
}

function drawCoverImage(context, img, alpha, yOffset = 0) {
  if (!img || !img.complete || img.naturalWidth === 0 || alpha <= 0) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * 0.90;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2 + yOffset;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(img, dx, dy, dw, dh);
  context.restore();
}

function drawBackgroundGalleryImages(context, offset) {
  if (!context || !canvas) return;
  if (bgReadyCount === 0) return;
  if (!bgImages[bgCurrentIndex] || !bgImages[bgCurrentIndex].complete || bgImages[bgCurrentIndex].naturalWidth === 0) {
    for (let i = 0; i < bgImages.length; i++) {
      if (bgImages[i] && bgImages[i].complete && bgImages[i].naturalWidth > 0) {
        bgCurrentIndex = i;
        break;
      }
    }
  }
  const currentImg = bgImages[bgCurrentIndex];
  const nextImg = bgImages[bgNextIndex];
  const currentAlpha = BG_MAX_OPACITY * (1 - bgFadeProgress);
  const nextAlpha = BG_MAX_OPACITY * bgFadeProgress;

  const upOffset = -canvas.height * 0.25;
  const yOffsetFor = (idx) => (idx === 2 || idx === 5 || idx === 6) ? upOffset : 0;

  drawCoverImage(context, currentImg, currentAlpha, yOffsetFor(bgCurrentIndex));
  if (bgPhase === 'fade' && nextImg) {
    drawCoverImage(context, nextImg, nextAlpha, yOffsetFor(bgNextIndex));
  }
}

function getGroundFar(worldX) {
  return getSecretGroundFar(worldX);
}

function getGroundMid(worldX) {
  return getSecretGroundMid(worldX);
}

function getGround(worldX) {
  return getSecretGround(worldX);
}

function getSlope(worldX) {
  const delta = 1;
  return (getGround(worldX + delta) - getGround(worldX - delta)) / (2 * delta);
}

document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
  }
  if (secretState.unlocked && (e.key === 'Escape' || e.code === 'Escape')) {
    secretAreaWarpHome();
  }
});
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function drawFlowerOfLife(context, cx, cy, radius) {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    context.arc(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), radius, 0, Math.PI * 2);
  }
  context.stroke();
}

function drawGiantBackgroundFlowerOfLife(context) {
  if (!context || !canvas) return;
  const time = Date.now() * 0.001;
  const cw = canvas.width;
  const ch = canvas.height;
  const maxDim = Math.max(cw, ch);

  context.save();
  context.strokeStyle = 'rgba(212, 175, 55, 0.032)';
  context.lineWidth = 1.1;
  context.save();
  context.translate(cw * 0.5, ch * 0.5);
  context.rotate(time * 0.04);
  drawFlowerOfLife(context, 0, 0, maxDim * 0.18);
  context.restore();
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(212, 175, 55, 0.020)';
  context.lineWidth = 1;
  context.save();
  context.translate(cw * 0.24, ch * 0.30);
  context.rotate(-time * 0.03);
  drawFlowerOfLife(context, 0, 0, maxDim * 0.085);
  context.restore();
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(212, 175, 55, 0.017)';
  context.lineWidth = 0.9;
  context.save();
  context.translate(cw * 0.77, ch * 0.68);
  context.rotate(time * 0.055);
  drawFlowerOfLife(context, 0, 0, maxDim * 0.055);
  context.restore();
  context.restore();
}

// A large, elegant flower-of-life mandala that fades in behind the terrain
// as the handpan nears the final cliff at the end of the road. It sits fixed
// in screen space (not tied to world scroll), rotates very slowly, drifts
// gently through a muted jewel-tone palette, and breathes with a slow
// pulsing glow — a quiet, ceremonial backdrop for the journey's end.
function drawEndCliffFlowerOfLife() {
  if (!ctx || !canvas) return;
  const alpha = endSecretState.alpha;
  if (alpha < 0.01) return;

  const time = Date.now() * 0.001;
  const cw = canvas.width;
  const ch = canvas.height;
  const cx = cw / 2;
  const cy = ch * 0.42;

  // 75% of the canvas' smaller dimension, end to end.
  const diameter = Math.min(cw, ch) * 0.75;
  const petalR = diameter / 4;

  // Slow, continuous drift through a muted, elegant hue range rather than a
  // full rainbow cycle — reads as shifting gold / rose / amethyst / teal.
  const hue = (time * 4.5) % 360;
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.35);
  const glowAlpha = alpha * (0.16 + pulse * 0.12);
  const lineAlpha = alpha * (0.30 + pulse * 0.10);

  ctx.save();

  // Soft breathing glow behind the whole mandala.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, diameter * 0.62);
  glow.addColorStop(0, 'hsla(' + hue + ', 55%, 68%, ' + glowAlpha + ')');
  glow.addColorStop(0.5, 'hsla(' + hue + ', 50%, 60%, ' + (glowAlpha * 0.45) + ')');
  glow.addColorStop(1, 'hsla(' + hue + ', 50%, 55%, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, diameter * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.rotate(time * 0.028);

  // Outer ring containing the pattern, for a defined medallion edge.
  ctx.strokeStyle = 'hsla(' + hue + ', 45%, 72%, ' + (lineAlpha * 0.8) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, petalR * 2.05, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'hsla(' + hue + ', 50%, 75%, ' + lineAlpha + ')';
  ctx.lineWidth = 1;
  drawFlowerOfLife(ctx, 0, 0, petalR);

  // A second, counter-rotating ring at a shifted hue for depth and shimmer.
  ctx.rotate(-time * 0.028 * 2 - Math.PI / 6);
  ctx.strokeStyle = 'hsla(' + ((hue + 45) % 360) + ', 45%, 78%, ' + (lineAlpha * 0.55) + ')';
  ctx.lineWidth = 0.8;
  drawFlowerOfLife(ctx, 0, 0, petalR * 0.62);

  ctx.restore();
}

function seedRand(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windSway(time, wx, layer) {
  const slow = 0.35 + layer * 0.2;
  const fast = 1.2 + layer * 0.3;
  return Math.sin(time * slow + wx * 0.0021) * 0.45 +
    Math.sin(time * fast + wx * 0.0053) * 0.3 +
    Math.sin(time * 2.4 + wx * 0.011) * 0.22;
}

function drawVegFar(offset) {
  if (!ctx || !canvas) return;
  const parallax = 0.40;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  ctx.save();
  for (let i = 0; i < vegFar.length; i++) {
    const v = vegFar[i];
    const sx = v.wx - off;
    if (sx < -50 || sx > canvas.width + 50) continue;
    const gy = getGroundFar(v.wx);
    const h = (12 + 22 * v.size);
    const sway = windSway(time, v.wx, 0) * 0.8;
    const baseX = sx;
    const topX = sx + sway;
    ctx.lineWidth = Math.max(1.0, 1.4 * v.size);
    ctx.strokeStyle = 'rgba(12, 15, 22, 0.82)';
    ctx.beginPath();
    ctx.moveTo(baseX - 1, gy);
    ctx.quadraticCurveTo(baseX + sway * 0.5, gy - h * 0.55, topX, gy - h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(baseX, gy - 1);
    ctx.quadraticCurveTo(baseX + sway * 0.5, gy - h * 0.55 - 0.5, topX + 0.6, gy - h + 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCypressMid(c, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 30 + size * 50;
  const sway = windSway(time, c.wx || seed, 0.8) * 1.8;
  const layers = 4 + Math.floor(rng() * 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(baseX - 1.5 * size, baseY);
  ctx.lineTo(baseX + 1.5 * size, baseY);
  const topX = baseX + sway;
  const topY = baseY - height;
  for (let i = 0; i < layers; i++) {
    const t = (i + 1) / layers;
    const rY = baseY - height * t;
    const halfW = size * 5.5 * (0.35 + 0.65 * Math.sin(t * Math.PI)) + (rng() - 0.5) * 0.2;
    const stepSway = sway * t * (0.8 + rng() * 0.3);
    const rightX = baseX + stepSway + halfW;
    ctx.lineTo(rightX, rY);
  }
  ctx.lineTo(topX, topY);
  for (let i = layers - 1; i >= 0; i--) {
    const t = (i + 1) / layers;
    const rY = baseY - height * t;
    const halfW = size * 5.2 * (0.35 + 0.65 * Math.sin(t * Math.PI)) + (rng() - 0.5) * 0.15;
    const stepSway = sway * t * (0.8 + rng() * 0.3);
    const leftX = baseX + stepSway - halfW;
    ctx.lineTo(leftX, rY);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(7, 10, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawOliveMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 20 + size * 30;
  const sway = windSway(time, m.wx || seed, 0.7) * 1.2;
  ctx.save();
  ctx.strokeStyle = 'rgba(8, 11, 17, 0.95)';
  ctx.lineWidth = Math.max(1.1, size * 1.3);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.5, baseY - height * 0.55, baseX + sway, baseY - height);
  ctx.stroke();
  const cx = baseX + sway;
  const cy = baseY - height - size * 4;
  const rBig = size * 10 + rng() * size * 3;
  const blobs = 3 + Math.floor(rng() * 2);
  for (let b = 0; b < blobs; b++) {
    const ang = (b / blobs) * Math.PI * 2 + rng() * 0.5;
    const rr = rBig * (0.68 + rng() * 0.4);
    const offBX = cx + Math.cos(ang) * rBig * 0.55 + (rng() - 0.5) * 2;
    const offBY = cy + Math.sin(ang) * rBig * 0.45 + (rng() - 0.5) * 2;
    ctx.beginPath();
    const petalR = rr * 0.92;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = offBX + Math.cos(a) * petalR;
      const py = offBY + Math.sin(a) * petalR * 0.82;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 11, 17, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.11)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBushMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 12 + size * 16;
  const sway = windSway(time, m.wx || seed, 0.6) * 0.8;
  ctx.save();
  const width = size * 12 + rng() * size * 5;
  const cx = baseX + sway;
  const cy = baseY - height * 0.5;
  const blobs = 4 + Math.floor(rng() * 3);
  for (let b = 0; b < blobs; b++) {
    const ang = -Math.PI + b / (blobs - 1) * Math.PI;
    const bx = cx + Math.cos(ang) * width * 0.32 + (rng() - 0.5) * 3;
    const by = cy + Math.sin(ang) * height * 0.38 + (rng() - 0.5) * 2;
    const br = (size * 4.5 + rng() * size * 2.5);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = bx + Math.cos(a) * br;
      const py = by + Math.sin(a) * br * 0.75;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 11, 18, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.10)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

function drawVegMid(offset) {
  if (!ctx || !canvas) return;
  const parallax = 0.72;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  for (let i = 0; i < vegMid.length; i++) {
    const m = vegMid[i];
    const sx = m.wx - off;
    if (sx < -80 || sx > canvas.width + 80) continue;
    const gy = getGroundMid(m.wx);
    if (m.type === 'cypress') drawCypressMid(m, sx, gy, m.size, m.seed, time);
    else if (m.type === 'olive') drawOliveMid(m, sx, gy - 2, m.size, m.seed, time);
    else drawBushMid(m, sx, gy, m.size, m.seed, time);
  }
}

function drawGrassNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const blades = 5 + Math.floor(rng() * 4);
  const clumpW = size * 4 + rng() * size * 2;
  ctx.save();
  for (let i = 0; i < blades; i++) {
    const t = blades === 1 ? 0.5 : i / (blades - 1);
    const bx = baseX - clumpW * 0.5 + t * clumpW + (rng() - 0.5) * 1.2;
    const h = (size * 5 + rng() * size * 4) * (0.6 + t * 0.4);
    const sway = windSway(time, n.wx + i * 17, 1) * 3.5;
    const tipX = bx + sway;
    const tipY = baseY - h;
    const midX = bx + sway * 0.5;
    const midY = baseY - h * 0.55;
    ctx.strokeStyle = 'rgba(14, 18, 26, 0.95)';
    ctx.lineWidth = Math.max(0.8, size * 0.8);
    ctx.beginPath();
    ctx.moveTo(bx, baseY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(bx + 0.3, baseY - 0.5);
    ctx.quadraticCurveTo(midX + 0.2, midY - 0.5, tipX + 0.3, tipY);
    ctx.stroke();
    const tipA = 0.32 + 0.18 * Math.sin(time * 1.6 + n.seed + i);
    ctx.fillStyle = 'rgba(255, 232, 165, ' + tipA + ')';
    ctx.beginPath();
    ctx.arc(tipX, tipY, Math.max(0.6, size * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawReedNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const stalks = 3 + Math.floor(rng() * 3);
  const spread = size * 3 + rng() * 2;
  ctx.save();
  for (let i = 0; i < stalks; i++) {
    const t = stalks === 1 ? 0.5 : i / (stalks - 1);
    const bx = baseX - spread * 0.5 + t * spread + (rng() - 0.5);
    const h = size * 14 + rng() * size * 5;
    const sway = windSway(time, n.wx + i * 31, 1.2) * 5;
    const tipX = bx + sway;
    const tipY = baseY - h;
    ctx.strokeStyle = 'rgba(12, 15, 23, 0.95)';
    ctx.lineWidth = Math.max(0.9, size * 0.9);
    ctx.beginPath();
    ctx.moveTo(bx, baseY);
    ctx.quadraticCurveTo(bx + sway * 0.45, baseY - h * 0.5, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    const headY = tipY + 2;
    const headR = size * 1.1;
    const head = ctx.createRadialGradient(tipX + sway * 0.1, headY, 0, tipX, headY, headR * 2.2);
    head.addColorStop(0, 'rgba(190, 155, 58, 0.32)');
    head.addColorStop(0.5, 'rgba(170, 135, 46, 0.16)');
    head.addColorStop(1, 'rgba(140, 108, 32, 0)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.ellipse(tipX, headY - 1, headR * 1.1, headR * 2.1, sway * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBushNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const sway = windSway(time, n.wx, 0.9) * 1.2;
  const height = 10 + size * 18;
  const width = size * 15;
  const cx = baseX + sway;
  const cy = baseY - height * 0.5;
  ctx.save();
  const blobs = 5 + Math.floor(rng() * 3);
  for (let b = 0; b < blobs; b++) {
    const ang = -Math.PI + (b / (blobs - 1)) * Math.PI;
    const bx = cx + Math.cos(ang) * width * 0.32 + (rng() - 0.5) * 2.5;
    const by = cy + Math.sin(ang) * height * 0.4 + (rng() - 0.5) * 2.5;
    const br = (size * 5 + rng() * size * 3);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const petalR = br * (0.88 + 0.16 * Math.sin(i * 2.1 + b));
      const px = bx + Math.cos(a) * petalR;
      const py = by + Math.sin(a) * petalR * 0.75;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(9, 12, 20, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
}

function drawOliveTreeNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 22 + size * 30;
  const sway = windSway(time, n.wx, 0.8) * 1.6;
  ctx.save();
  ctx.strokeStyle = 'rgba(14, 17, 25, 0.97)';
  ctx.lineWidth = Math.max(1.4, size * 1.5);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.5, baseY - trunkH * 0.55, baseX + sway, baseY - trunkH);
  ctx.stroke();
  const branches = 2 + Math.floor(rng() * 2);
  for (let br = 0; br < branches; br++) {
    const t = 0.45 + rng() * 0.35;
    const brY = baseY - trunkH * t;
    const brX = baseX + sway * t;
    const side = br % 2 === 0 ? 1 : -1;
    ctx.strokeStyle = 'rgba(14, 17, 25, 0.97)';
    ctx.lineWidth = Math.max(0.9, size * 0.9);
    ctx.beginPath();
    ctx.moveTo(brX, brY);
    ctx.quadraticCurveTo(brX + side * size * 3, brY - size * 3, brX + side * size * 6 + sway * 0.2, brY - size * 6);
    ctx.stroke();
  }
  const crownCx = baseX + sway;
  const crownCy = baseY - trunkH - size * 3;
  const blobs = 4 + Math.floor(rng() * 2);
  for (let b = 0; b < blobs; b++) {
    const ang = (b / blobs) * Math.PI * 2 + rng() * 0.6;
    const dist = (size * 6 + rng() * size * 2);
    const rBig = (size * 6 + rng() * size * 2.2);
    const bX = crownCx + Math.cos(ang) * dist * 0.55;
    const bY = crownCy + Math.sin(ang) * dist * 0.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rr = rBig * (0.88 + 0.18 * Math.sin(i * 1.7 + b));
      const px = bX + Math.cos(a) * rr;
      const py = bY + Math.sin(a) * rr * 0.78;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(9, 12, 20, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.13)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    if (rng() < 0.55) {
      ctx.fillStyle = 'rgba(212, 175, 55, 0.18)';
      const dotN = 1 + Math.floor(rng() * 2);
      for (let d = 0; d < dotN; d++) {
        const da = rng() * Math.PI * 2;
        const dr = rBig * (0.25 + rng() * 0.35);
        const dx = bX + Math.cos(da) * dr;
        const dy = bY + Math.sin(da) * dr * 0.8;
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(0.7, size * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawCypressNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 45 + size * 55;
  const sway = windSway(time, n.wx, 0.9) * 2.4;
  const layers = 5 + Math.floor(rng() * 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(baseX - 2 * size, baseY);
  ctx.lineTo(baseX + 2 * size, baseY);
  const topX = baseX + sway;
  const topY = baseY - height;
  for (let i = 0; i < layers; i++) {
    const t = (i + 1) / layers;
    const rY = baseY - height * t;
    const halfW = size * 6.5 * (0.32 + 0.68 * Math.sin(t * Math.PI)) + (rng() - 0.5) * size * 0.3;
    const stepSway = sway * t * (0.82 + rng() * 0.3);
    ctx.lineTo(baseX + stepSway + halfW, rY);
  }
  ctx.lineTo(topX, topY);
  for (let i = layers - 1; i >= 0; i--) {
    const t = (i + 1) / layers;
    const rY = baseY - height * t;
    const halfW = size * 6.2 * (0.32 + 0.68 * Math.sin(t * Math.PI)) + (rng() - 0.5) * size * 0.25;
    const stepSway = sway * t * (0.82 + rng() * 0.3);
    ctx.lineTo(baseX + stepSway - halfW, rY);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 11, 19, 0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawVegNear(offset) {
  if (!ctx || !canvas) return;
  const parallax = 1.0;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  for (let i = 0; i < vegNear.length; i++) {
    const n = vegNear[i];
    const sx = n.wx - off;
    if (sx < -80 || sx > canvas.width + 80) continue;
    const gy = getGround(n.wx);
    const slope = Math.abs(getSlope(n.wx));
    if (slope > 0.55) continue;
    switch (n.type) {
      case 'grass': drawGrassNear(n, sx, gy, n.size, n.seed, time); break;
      case 'reed': drawReedNear(n, sx, gy, n.size, n.seed, time); break;
      case 'bush': drawBushNear(n, sx, gy, n.size, n.seed, time); break;
      case 'olivetree': drawOliveTreeNear(n, sx, gy, n.size, n.seed, time); break;
      case 'cypress': drawCypressNear(n, sx, gy, n.size, n.seed, time); break;
    }
  }
}

function drawGlowFlowers(offset) {
  if (!ctx || !canvas) return;
  const parallax = 1.0;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  for (let i = 0; i < glowFlowers.length; i++) {
    const f = glowFlowers[i];
    const sx = f.wx - off;
    if (sx < -60 || sx > canvas.width + 60) continue;
    const gy = getGround(f.wx);
    const stalkH = 14 + 10 * f.size;
    const sway = windSway(time, f.wx, 1.4) * 1.5;
    const tipX = sx + sway;
    const tipY = gy - stalkH;
    ctx.save();
    ctx.strokeStyle = 'rgba(18, 22, 32, 0.95)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(sx, gy);
    ctx.quadraticCurveTo(sx + sway * 0.5, gy - stalkH * 0.55, tipX, tipY);
    ctx.stroke();
    const pulse = 0.72 + 0.28 * Math.sin(time * 1.8 + f.phase);
    const size = (3.2 + 2.2 * f.size) * pulse;
    const grd = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, size * 3.4);
    grd.addColorStop(0, 'rgba(255, 240, 185, ' + (0.42 * pulse) + ')');
    grd.addColorStop(0.35, 'rgba(228, 188, 85, ' + (0.18 * pulse) + ')');
    grd.addColorStop(0.75, 'rgba(212, 175, 55, ' + (0.06 * pulse) + ')');
    grd.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tipX, tipY, size * 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 244, 200, ' + (0.7 * pulse) + ')';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const px = tipX + Math.cos(a) * size * 0.55;
      const py = tipY + Math.sin(a) * size * 0.55 * 0.9;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(212, 175, 55, ' + (0.55 * pulse) + ')';
    ctx.beginPath();
    ctx.arc(tipX, tipY, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== VIDEO PLACEHOLDER SYSTEM =====
function updateVideoPlaceholders(dt) {
  if (!secretState.unlocked) return;

  // Reveal placeholders in order as the handpan rolls forward.
  // First one appears when you get close; each next one unlocks
  // once you have passed (or almost reached) the previous one.
  let highestRevealed = -1;

  for (let i = 0; i < videoPlaceholders.length; i++) {
    const vp = videoPlaceholders[i];
    const prev = i > 0 ? videoPlaceholders[i - 1] : null;

    // Can reveal if: first placeholder and near it, OR previous is already revealed
    // and player has rolled far enough toward this one
    const nearEnough = x >= vp.wx - 520;
    const prevOk = !prev || (prev.revealed && x >= prev.wx - 80);

    if (nearEnough && prevOk) {
      if (!vp.revealed) {
        vp.revealed = true;
        for (let k = 0; k < 14; k++) {
          if (resonanceParticles.length >= PARTICLE_MAX) break;
          resonanceParticles.push({
            wx: vp.wx + (Math.random() - 0.5) * 40,
            wy: getGround(vp.wx) - 80 + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 1.4,
            vy: -0.6 - Math.random() * 1.2,
            life: 1,
            r0: 1.8 + Math.random() * 2.2,
            golden: true
          });
        }
      }
      vp.revealProgress = Math.min(1, vp.revealProgress + dt * 1.8);
      highestRevealed = i;
    }
  }

  // No movement gate — keep rolling freely through the stash, up over the
  // final cliff, where it fades away just like the hill at the start
  videoGateState.active = false;
  videoGateState.lockedUntilNext = false;
  videoGateState.fade = 1;
}

function drawVideosAheadHint(offset) {
  if (!ctx || !canvas) return;
  // Only show before the secret area is unlocked / entered
  if (secretState.unlocked && x >= SECRET_START_X - 50) return;
  const sx = VIDEOS_AHEAD_X - offset;
  if (sx < -200 || sx > canvas.width + 200) return;
  const gy = getGround(VIDEOS_AHEAD_X);
  const time = Date.now() * 0.001;
  const bob = Math.sin(time * 1.4) * 4;
  const alpha = 0.55 + 0.2 * Math.sin(time * 2.0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'italic 400 15px "Playfair Display", Georgia, serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.35)';
  ctx.shadowBlur = 12;
  ctx.fillText('videos ahead →', sx, gy - 70 + bob);
  ctx.shadowBlur = 0;
  // small gold dash under the text
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 36, gy - 58 + bob);
  ctx.lineTo(sx + 36, gy - 58 + bob);
  ctx.stroke();
  ctx.restore();
}

// A small sacred-geometry medallion drawn behind each video placeholder's
// play button. `variant` (0/1/2) gives each placeholder its own distinct
// motif — flower-of-life core, layered lotus petals, or a radiating star —
// while `rotSpeed`/`phase` keep them slowly turning out of sync with each
// other so the row doesn't feel mechanical.
function drawPlaceholderMandala(cx, cy, radius, alpha, variant, rotSpeed, phase) {
  const time = Date.now() * 0.001;
  const rot = time * rotSpeed + phase;

  ctx.save();
  ctx.translate(cx, cy);

  // Faint outer ring shared by all variants, for a consistent medallion edge.
  ctx.strokeStyle = 'rgba(255, 232, 170, ' + (alpha * 0.24) + ')';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(rot);

  if (variant === 0) {
    // Flower-of-life core.
    ctx.strokeStyle = 'rgba(255, 226, 160, ' + (alpha * 0.30) + ')';
    ctx.lineWidth = 0.7;
    drawFlowerOfLife(ctx, 0, 0, radius * 0.42);
  } else if (variant === 1) {
    // Layered lotus petals, two rings offset from one another.
    const drawPetalRing = (count, len, w, a) => {
      ctx.strokeStyle = 'rgba(255, 226, 160, ' + (alpha * a) + ')';
      ctx.lineWidth = w;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.12);
        ctx.quadraticCurveTo(radius * len * 0.55, -radius * len * 0.5, 0, -radius * len);
        ctx.quadraticCurveTo(-radius * len * 0.55, -radius * len * 0.5, 0, -radius * 0.12);
        ctx.stroke();
        ctx.restore();
      }
    };
    drawPetalRing(8, 0.85, 0.7, 0.28);
    drawPetalRing(6, 0.5, 0.6, 0.24);
  } else {
    // Radiating star with a dotted ring for a more angular, celestial feel.
    ctx.strokeStyle = 'rgba(255, 226, 160, ' + (alpha * 0.28) + ')';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * radius * 0.9, Math.sin(ang) * radius * 0.9);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 226, 160, ' + (alpha * 0.35) + ')';
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const dx = Math.cos(ang) * radius * 0.68;
      const dy = Math.sin(ang) * radius * 0.68;
      ctx.beginPath();
      ctx.arc(dx, dy, radius * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawVideoPlaceholders(offset) {
  if (!ctx || !canvas || !secretState.unlocked) return;
  const time = Date.now() * 0.001;
  videoHitBoxes.length = 0;

  const zoom = zoomLevel || 1;
  const zcx = canvas.width / 2;
  const zcy = canvas.height * 0.44;

  for (let i = 0; i < videoPlaceholders.length; i++) {
    const vp = videoPlaceholders[i];
    if (vp.revealProgress < 0.01) continue;

    const sx = vp.wx - offset;
    if (sx < -220 || sx > canvas.width + 220) continue;

    const gy = getGround(vp.wx);
    const floatY = gy - 95 - Math.sin(time * 1.3 + i * 1.7) * 8;
    const a = vp.revealProgress;
    const pulse = 0.92 + 0.08 * Math.sin(time * 2.4 + i);

    // Record screen-space hit box (inverse of zoom + cameraY transforms)
    const cardW = 118, cardH = 74;
    const preX = sx;
    const preY = floatY - cameraY;
    const screenCX = zcx + (preX - zcx) * zoom;
    const screenCY = zcy + (preY - zcy) * zoom;
    const hw = (cardW / 2 + 24) * zoom;
    const hh = (cardH / 2 + 28) * zoom;
    videoHitBoxes.push({
      x: screenCX - hw,
      y: screenCY - hh,
      w: hw * 2,
      h: hh * 2,
      vp: vp
    });

    ctx.save();
    ctx.globalAlpha = a;

    // soft golden aura
    const auraR = 78 * pulse;
    const aura = ctx.createRadialGradient(sx, floatY, 0, sx, floatY, auraR * 1.8);
    aura.addColorStop(0, 'rgba(255, 230, 150, ' + (0.22 * a) + ')');
    aura.addColorStop(0.45, 'rgba(212, 175, 55, ' + (0.10 * a) + ')');
    aura.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(sx, floatY, auraR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // glass card
    const rx = sx - cardW / 2;
    const ry = floatY - cardH / 2;
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + cardW - r, ry);
    ctx.quadraticCurveTo(rx + cardW, ry, rx + cardW, ry + r);
    ctx.lineTo(rx + cardW, ry + cardH - r);
    ctx.quadraticCurveTo(rx + cardW, ry + cardH, rx + cardW - r, ry + cardH);
    ctx.lineTo(rx + r, ry + cardH);
    ctx.quadraticCurveTo(rx, ry + cardH, rx, ry + cardH - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath();

    const glass = ctx.createLinearGradient(0, ry, 0, ry + cardH);
    glass.addColorStop(0, 'rgba(28, 22, 12, 0.72)');
    glass.addColorStop(1, 'rgba(12, 10, 6, 0.82)');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, ' + (0.55 * a) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Custom slowly-rotating mandala medallion, one distinct motif per
    // placeholder, clipped to the card so it reads as an engraved emblem
    // rather than spilling past the card edges.
    ctx.save();
    ctx.clip();
    drawPlaceholderMandala(sx, floatY, cardH * 0.46, a, i % 3, 0.05 + (i % 3) * 0.015, i * 2.1);
    ctx.restore();

    // play triangle
    ctx.fillStyle = 'rgba(255, 235, 170, ' + (0.92 * a) + ')';
    ctx.beginPath();
    const triX = sx - 6;
    const triY = floatY;
    ctx.moveTo(triX - 8, triY - 12);
    ctx.lineTo(triX - 8, triY + 12);
    ctx.lineTo(triX + 14, triY);
    ctx.closePath();
    ctx.fill();

    // subtle hint only (no titles)
    if (a > 0.85) {
      ctx.font = '400 10px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(180, 160, 110, ' + (0.55 * a) + ')';
      ctx.textAlign = 'center';
      ctx.fillText('click to play', sx, ry + cardH + 18);
    }

    ctx.restore();
  }
}

// keep old function name so any remaining calls don't break
function drawSecretNoteOrbs(offset) {
  // intentionally empty – note orbs removed
}

function drawGhostReeds(offset) {
  if (!ctx || !canvas) return;
  const leftX = Math.max(SECRET_START_X + 200, offset - 80);
  const rightX = offset + canvas.width + 80;
  const time = Date.now() * 0.001;
  let lastX = leftX;
  while (lastX < rightX) {
    const h = hashFloat(lastX, 5.4);
    if (h > 0.42) {
      lastX += 60 + hashFloat(lastX, 8.1) * 40;
      continue;
    }
    const reedCount = 2 + Math.floor(hashFloat(lastX, 3.2) * 3);
    const clumpW = 3 + hashFloat(lastX, 6.7) * 4;
    for (let i = 0; i < reedCount; i++) {
      const t = reedCount === 1 ? 0.5 : i / (reedCount - 1);
      const wx = lastX - clumpW * 0.5 + t * clumpW;
      const sx = wx - offset;
      if (sx < -20 || sx > canvas.width + 20) continue;
      const gy = getGround(wx);
      const sway = windSway(time, wx, 1.1) * 2;
      const hR = 8 + hashFloat(wx, 12.9) * 12;
      const tipX = sx + sway;
      const tipY = gy - hR;
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.quadraticCurveTo(sx + sway * 0.5, gy - hR * 0.55, tipX, tipY);
      ctx.stroke();
      const dotA = 0.18 + 0.08 * Math.sin(time * 1.4 + wx * 0.021 + i);
      ctx.fillStyle = 'rgba(255, 232, 160, ' + dotA + ')';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    lastX += 60 + hashFloat(lastX, 8.1) * 40;
  }
}

function drawFloatingTexts(offset) {
  if (!ctx || !canvas) return;
  if (secretState.floatingTexts.length === 0) return;
  const cw = canvas.width;
  ctx.save();
  ctx.textAlign = 'center';
  for (let i = 0; i < secretState.floatingTexts.length; i++) {
    const t = secretState.floatingTexts[i];
    const sx = t.wx - offset;
    if (sx < -60 || sx > cw + 60) continue;
    const a = t.life;
    if (a <= 0) continue;
    ctx.font = 'italic 500 18px "Playfair Display", Georgia, serif';
    ctx.fillStyle = 'rgba(255, 235, 165, ' + (0.85 * a) + ')';
    ctx.shadowColor = 'rgba(212, 175, 55, ' + (0.55 * a) + ')';
    ctx.shadowBlur = 10;
    ctx.fillText(t.text, sx, t.wy);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function spawnVanishingPlatformsUpTo(targetX) {
  // Platforms removed from secret area – do nothing
  return;
  while (vanishingPlatforms.length > _VP_MAX) vanishingPlatforms.shift();
  if (!canvas) return;
  while (_vpLastSpawnX < targetX) {
    const gapBase = 320 + hashFloat(_vpLastSpawnX, 17.3) * 260;
    const nextX = _vpLastSpawnX + gapBase;
    const terrainAt = getGround(nextX);
    const layerRoll = hashFloat(_vpLastSpawnX, 31.9);
    let layer, heightVariance;
    if (layerRoll < 0.45) {
      layer = 0;
      heightVariance = hashFloat(_vpLastSpawnX, 22.8) * 110 + 60;
    } else if (layerRoll < 0.8) {
      layer = 1;
      heightVariance = hashFloat(_vpLastSpawnX, 22.8) * 130 + 190;
    } else {
      layer = 2;
      heightVariance = hashFloat(_vpLastSpawnX, 22.8) * 150 + 340;
    }
    const topY = terrainAt - heightVariance - 60;
    const width = 90 + hashFloat(_vpLastSpawnX, 3.1) * 120;
    const h = 14;
    const phase = hashFloat(_vpLastSpawnX, 9.4) * Math.PI * 2;
    vanishingPlatforms.push({
      wx: nextX,
      wy: topY,
      w: width,
      h: h,
      layer: layer,
      phase: phase,
      bobAmp: 2 + hashFloat(_vpLastSpawnX, 11.7) * 4,
      fadeInDur: 1.1,
      fadeOutDur: 1.5,
      lifeSpan: 12.0,
      age: null,
      appeared: false,
      dead: false,
      onPlatform: false,
      noteOnLand: Math.random() < 0.55
    });
    _vpLastSpawnX = nextX;
  }
}

function updateVanishingPlatforms(dt) {
  if (!dt) dt = 1 / 60;
  for (let i = 0; i < vanishingPlatforms.length; i++) {
    const p = vanishingPlatforms[i];
    const camLeftEdge = x - (canvas ? canvas.width * 1.5 / Math.max(0.3, zoomLevel) : 1000);
    if (!p.appeared && p.wx < x + (canvas ? canvas.width / Math.max(0.3, zoomLevel) : 900)) {
      p.age = 0;
      p.appeared = true;
    }
    if (p.appeared) p.age += dt;
    if (p.wx < camLeftEdge || (p.age !== null && p.age > p.lifeSpan + p.fadeOutDur)) {
      p.dead = true;
    }
  }
  while (vanishingPlatforms.length && vanishingPlatforms[0].dead) vanishingPlatforms.shift();
  handleVanishingPlatformCollision(dt);
}

function getVanishingPlatformAlpha(p) {
  if (!p.appeared) return 0;
  if (p.age <= p.fadeInDur) return p.age / p.fadeInDur;
  const remain = p.lifeSpan - p.age;
  if (remain < p.fadeOutDur) return Math.max(0, remain / p.fadeOutDur);
  if (p.age > p.lifeSpan) return 0;
  return 1;
}

function getVanishingPlatformWorldY(p, time) {
  if (!time) time = Date.now() * 0.001;
  return p.wy + Math.sin(time * 1.1 + p.phase) * p.bobAmp + Math.sin(time * 2.3 + p.phase * 1.3) * 0.8;
}

function handleVanishingPlatformCollision(dt) {
  if (!secretState.unlocked) return;
  const time = Date.now() * 0.001;
  let landedOnPlatform = false;
  let platformY = null;
  let lastLanded = null;
  const prevBottom = y + ballRadius - vy;
  const currBottom = y + ballRadius;
  const leftX = x - ballRadius * 0.6;
  const rightX = x + ballRadius * 0.6;
  for (let i = 0; i < vanishingPlatforms.length; i++) {
    const p = vanishingPlatforms[i];
    if (!p.appeared || p.dead) continue;
    const alpha = getVanishingPlatformAlpha(p);
    if (alpha < 0.12) continue;
    if (rightX < p.wx || leftX > p.wx + p.w) continue;
    const py = getVanishingPlatformWorldY(p, time);
    if (vy >= 0 && prevBottom <= py + 2 && currBottom >= py) {
      landedOnPlatform = true;
      if (platformY === null || py < platformY) {
        platformY = py;
        lastLanded = p;
      }
    }
  }
  if (landedOnPlatform && platformY !== null) {
    y = platformY - ballRadius;
    vy = 0;
    onGround = true;
    if (lastLanded) {
      if (!lastLanded.onPlatform && lastLanded.noteOnLand) {
        const freq = pentatonicFreq(secretState.notesCollected + 1);
        playNote(freq * 0.5, 0.2);
      }
      lastLanded.onPlatform = true;
      if (lastLanded.age < lastLanded.lifeSpan * 0.65) {
        lastLanded.age = Math.max(lastLanded.age, lastLanded.lifeSpan * 0.65);
      }
    }
  }
  for (let i = 0; i < vanishingPlatforms.length; i++) {
    const p = vanishingPlatforms[i];
    if (p !== lastLanded) p.onPlatform = false;
  }
}

function drawVanishingPlatforms(offset) {
  if (!ctx || !canvas) return;
  if (vanishingPlatforms.length === 0) return;
  const time = Date.now() * 0.001;
  const cw = canvas.width;
  ctx.save();
  for (let i = 0; i < vanishingPlatforms.length; i++) {
    const p = vanishingPlatforms[i];
    if (p.dead) continue;
    const sx = p.wx - offset;
    if (sx + p.w < -120 || sx > cw + 120) continue;
    const rawAlpha = getVanishingPlatformAlpha(p);
    if (rawAlpha <= 0.01) continue;
    const layerDim = p.layer === 2 ? 0.72 : (p.layer === 1 ? 0.86 : 1);
    const alpha = rawAlpha * layerDim;
    const sy = getVanishingPlatformWorldY(p, time);
    const w = p.w, h = p.h;
    const r = 9;
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(0, sy, 0, sy + h + 26);
    grad.addColorStop(0, 'rgba(255, 240, 190, 0.35)');
    grad.addColorStop(0.22, 'rgba(212, 175, 55, 0.28)');
    grad.addColorStop(0.6, 'rgba(26, 20, 10, 0.68)');
    grad.addColorStop(1, 'rgba(8, 6, 4, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx + r, sy);
    ctx.lineTo(sx + w - r, sy);
    ctx.quadraticCurveTo(sx + w, sy, sx + w, sy + r);
    ctx.lineTo(sx + w, sy + h);
    ctx.lineTo(sx + w - 6, sy + h + 18);
    ctx.lineTo(sx + 6, sy + h + 18);
    ctx.lineTo(sx, sy + h);
    ctx.lineTo(sx, sy + r);
    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.onPlatform ? 'rgba(255, 238, 180, 0.95)' : 'rgba(232, 200, 105, 0.55)';
    ctx.lineWidth = p.onPlatform ? 1.6 : 0.9;
    ctx.beginPath();
    ctx.moveTo(sx + r + 2, sy + 0.5);
    ctx.lineTo(sx + w - r - 2, sy + 0.5);
    ctx.stroke();
    ctx.globalAlpha = alpha * (p.onPlatform ? 0.55 : 0.28);
    ctx.shadowColor = 'rgba(212, 175, 55, 0.85)';
    ctx.shadowBlur = p.onPlatform ? 22 : 10;
    ctx.fillStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.beginPath();
    ctx.ellipse(sx + w / 2, sy + 1, Math.max(8, w * 0.28), 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

const METERS_PER_WORLD_UNIT = 1 / 45;

function drawSecretHUD() {
  if (!ctx || !canvas) return;
  if (secretState.hudAlpha < 0.01) return;
  const cw = canvas.width;
  const a = secretState.hudAlpha;
  const revealedCount = videoPlaceholders.filter(v => v.revealed).length;
  const meters = Math.max(0, Math.floor((x - SECRET_START_X) * 0.12));
  ctx.save();
  ctx.globalAlpha = a;
  const pad = 24;
  ctx.textAlign = 'right';
  ctx.font = 'italic 500 15px "Playfair Display", Georgia, serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
  const line1 = 'VIDEOS · ' + revealedCount + ' / ' + VIDEO_PLACEHOLDER_COUNT;
  const line2 = 'METERS · ' + meters + 'm';
  ctx.fillText(line1, cw - pad, pad + 2);
  ctx.fillText(line2, cw - pad, pad + 22);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.font = 'italic 400 12px "Playfair Display", Georgia, serif';
  const line3 = 'click a placeholder to play';
  ctx.fillText(line3, cw - pad, pad + 42);
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const line4 = isMobile ? 'Tap ← Exit below →' : 'ESC to return';
  ctx.fillText(line4, cw - pad, pad + 62);
  ctx.restore();
  if (isMobile && secretState.hudAlpha > 0.5) {
    const bx = cw / 2;
    const by = Math.max(110, canvas.height - 170);
    ctx.save();
    ctx.globalAlpha = a * 0.95;
    const bw = 130, bh = 38;
    const br = 19;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2 + br, by - bh / 2);
    ctx.lineTo(bx + bw / 2 - br, by - bh / 2);
    ctx.quadraticCurveTo(bx + bw / 2, by - bh / 2, bx + bw / 2, by - bh / 2 + br);
    ctx.lineTo(bx + bw / 2, by + bh / 2 - br);
    ctx.quadraticCurveTo(bx + bw / 2, by + bh / 2, bx + bw / 2 - br, by + bh / 2);
    ctx.lineTo(bx - bw / 2 + br, by + bh / 2);
    ctx.quadraticCurveTo(bx - bw / 2, by + bh / 2, bx - bw / 2, by + bh / 2 - br);
    ctx.lineTo(bx - bw / 2, by - bh / 2 + br);
    ctx.quadraticCurveTo(bx - bw / 2, by - bh / 2, bx - bw / 2 + br, by - bh / 2);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
    bg.addColorStop(0, 'rgba(212, 175, 55, 0.18)');
    bg.addColorStop(1, 'rgba(120, 85, 20, 0.10)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 235, 165, 0.92)';
    ctx.font = '500 13px "Inter", sans-serif';
    ctx.fillText('RETURN HOME', bx, by + 4);
    ctx.restore();
    secretState._exitBtnRect = { x: bx - bw / 2, y: by - bh / 2, w: bw, h: bh };
  } else {
    secretState._exitBtnRect = null;
  }
}

function drawSecretSplash() {
  // Intentionally disabled: the "how to use video" explainer panel that
  // used to appear on entering the secret zone has been fully removed —
  // it's unnecessary. secretState.splashT/splashAlpha keep updating
  // harmlessly elsewhere; this just no longer renders anything for them.
  return;
  // eslint-disable-next-line no-unreachable
  if (!ctx || !canvas) return;
  if (secretState.splashAlpha < 0.01) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const a = secretState.splashAlpha;
  const cx = cw / 2;
  const cy = ch / 2;
  const panelW = Math.min(680, cw * 0.82);
  const panelH = Math.min(360, ch * 0.58);
  const px = cx - panelW / 2;
  const py = cy - panelH / 2;
  const r = 28;
  ctx.save();
  ctx.globalAlpha = a;
  const vignette = ctx.createRadialGradient(cx, cy, panelW * 0.18, cx, cy, Math.max(cw, ch) * 0.8);
  vignette.addColorStop(0, 'rgba(3, 5, 8, 0.32)');
  vignette.addColorStop(1, 'rgba(2, 4, 7, 0.72)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.globalAlpha = a * 0.32;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
  ctx.lineWidth = 0.7;
  const foldR = 0.44 + 0.09 * Math.sin(performance.now() * 0.0009);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(performance.now() * 0.00005);
  drawFlowerOfLife(ctx, 0, 0, Math.min(panelW, panelH) * foldR * 0.5);
  ctx.restore();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + panelW - r, py);
  ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + r);
  ctx.lineTo(px + panelW, py + panelH - r);
  ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - r, py + panelH);
  ctx.lineTo(px + r, py + panelH);
  ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - r);
  ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.closePath();
  const glass = ctx.createLinearGradient(0, py, 0, py + panelH);
  glass.addColorStop(0, 'rgba(22, 18, 10, 0.58)');
  glass.addColorStop(0.5, 'rgba(12, 10, 6, 0.48)');
  glass.addColorStop(1, 'rgba(28, 22, 10, 0.62)');
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.38)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + r * 0.6, py + 1);
  ctx.lineTo(px + panelW - r * 0.6, py + 1);
  ctx.strokeStyle = 'rgba(255, 235, 165, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const dividerY = cy - panelH * 0.04;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - panelW * 0.14, dividerY);
  ctx.lineTo(cx - 10, dividerY);
  ctx.moveTo(cx + 10, dividerY);
  ctx.lineTo(cx + panelW * 0.14, dividerY);
  ctx.stroke();
  ctx.fillStyle = 'rgba(212, 175, 55, 0.65)';
  ctx.beginPath();
  ctx.arc(cx, dividerY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(255, 238, 180, 0.92)';
  ctx.font = 'italic 400 17px "Playfair Display", Georgia, serif';
  ctx.fillText('Let the handpan roll · click a placeholder to watch', cx, cy - panelH * 0.02);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(212, 175, 55, 0.52)';
  ctx.font = 'italic 400 12px "Playfair Display", Georgia, serif';
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const exitTxt = isMobile ? 'Tap the button below when you are ready to return' : 'Press ESC to return to Greece';
  ctx.fillText(exitTxt, cx, cy + panelH * 0.22);
  ctx.restore();
}

function drawWarpBanner() {
  if (!ctx || !canvas) return;
  const w = secretState.warpBanner;
  if (!w) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const p = w.t / w.life;
  const a = p < 0.18 ? (p / 0.18) : p > 0.78 ? (1 - (p - 0.78) / 0.22) : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.font = 'italic 500 22px "Playfair Display", Georgia, serif';
  ctx.fillStyle = 'rgba(232, 200, 105, 0.95)';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText(w.text, cw / 2, ch / 2 - 24);
  ctx.restore();
}

function drawNothingHereMessage() {
  if (!ctx || !canvas) return;
  const alpha = Math.max(leftSecretState.alpha, endSecretState.alpha);
  if (alpha < 0.01) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'italic 400 26px "Playfair Display", Georgia, serif';
  ctx.fillStyle = 'rgba(200, 200, 210, 0.75)';
  ctx.shadowColor = 'rgba(150, 150, 170, 0.35)';
  ctx.shadowBlur = 10;
  ctx.fillText('nothing here...', cw / 2, ch / 2 - 24);
  ctx.restore();
}

function drawStarfield(context, offset) {
  if (!context || !canvas) return;
  const ch = canvas.height;
  const time = Date.now() * 0.001;
  const PARALLAX_FAR = 0.10;
  const PARALLAX_MID = 0.28;
  const PARALLAX_NEAR = 0.52;

  function drawLayer(stars, parallax, baseAlpha, glow) {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      let sx = s.wx - offset * parallax;
      sx = ((sx % STAR_WORLD_WIDTH) + STAR_WORLD_WIDTH) % STAR_WORLD_WIDTH;
      if (sx > STAR_WORLD_WIDTH / 2) sx -= STAR_WORLD_WIDTH;
      const screenX = sx + canvas.width / 2 - STAR_WORLD_WIDTH / 2 + offset * (1 - parallax);
      const screenY = s.y * ch;
      if (screenX < -10 || screenX > canvas.width + 10) continue;
      const twinkle = 0.72 + 0.28 * Math.sin(time * 1.6 + s.tw);
      const alpha = baseAlpha * twinkle;
      if (glow) {
        const grd = context.createRadialGradient(screenX, screenY, 0, screenX, screenY, s.r * 3.2);
        grd.addColorStop(0, 'rgba(255, 236, 180, ' + (alpha * 0.65) + ')');
        grd.addColorStop(0.4, 'rgba(228, 188, 85, ' + (alpha * 0.22) + ')');
        grd.addColorStop(1, 'rgba(212, 175, 55, 0)');
        context.fillStyle = grd;
        context.beginPath();
        context.arc(screenX, screenY, s.r * 3.2, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = 'rgba(255, 240, 200, ' + alpha + ')';
      context.beginPath();
      context.arc(screenX, screenY, s.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  drawLayer(starsFar, PARALLAX_FAR, 0.28, false);
  drawLayer(starsMid, PARALLAX_MID, 0.42, false);
  drawLayer(starsNear, PARALLAX_NEAR, 0.58, true);
}

function drawAtmosphereBands(context) {
  if (!context || !canvas) return;
  const cw = canvas.width;
  const ch = canvas.height;

  const topV = context.createLinearGradient(0, 0, 0, ch * 0.24);
  topV.addColorStop(0, 'rgba(3, 5, 8, 0.55)');
  topV.addColorStop(1, 'rgba(3, 5, 8, 0)');
  context.fillStyle = topV;
  context.fillRect(0, 0, cw, ch * 0.24);

  const mid = context.createLinearGradient(0, ch * 0.26, 0, ch * 0.56);
  mid.addColorStop(0, 'rgba(212, 175, 55, 0)');
  mid.addColorStop(0.5, 'rgba(212, 175, 55, 0.018)');
  mid.addColorStop(1, 'rgba(212, 175, 55, 0)');
  context.fillStyle = mid;
  context.fillRect(0, ch * 0.26, cw, ch * 0.30);

  const lowFog = context.createLinearGradient(0, ch * 0.54, 0, ch * 0.74);
  lowFog.addColorStop(0, 'rgba(3, 5, 8, 0)');
  lowFog.addColorStop(0.55, 'rgba(3, 5, 8, 0.52)');
  lowFog.addColorStop(1, 'rgba(3, 5, 8, 0.18)');
  context.fillStyle = lowFog;
  context.fillRect(0, ch * 0.54, cw, ch * 0.20);
}

function getZoomDrawRange() {
  const z = zoomLevel || 1;
  const cw = canvas ? canvas.width : 0;
  if (z >= 0.999) return { min: 0, max: cw };
  const half = cw / 2;
  return { min: half * (1 - 1 / z), max: half * (1 + 1 / z) };
}

function buildTerrainPath(context, offset, getHeightFn, step) {
  step = step || 6;
  const range = getZoomDrawRange();
  context.beginPath();
  let first = true;
  for (let i = range.min; i <= range.max; i += step) {
    const worldX = i + offset;
    const gy = getHeightFn(worldX);
    if (first) { context.moveTo(i, gy); first = false; }
    else context.lineTo(i, gy);
  }
  const lastWorldX = range.max + offset;
  context.lineTo(range.max, getHeightFn(lastWorldX));
  context.lineTo(range.max, canvas.height + 120);
  context.lineTo(range.min, canvas.height + 120);
  context.closePath();
}

function drawHillsFar(offset) {
  if (!ctx || !canvas) return;
  const parallaxOffset = offset * 0.40;
  ctx.save();
  buildTerrainPath(ctx, parallaxOffset, getGroundFar, 10);
  ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.11)';
  ctx.beginPath();
  const rangeFar = getZoomDrawRange();
  let firstFar = true;
  for (let i = rangeFar.min; i <= rangeFar.max; i += 10) {
    const worldX = i + parallaxOffset;
    const gy = getGroundFar(worldX);
    if (firstFar) { ctx.moveTo(i, gy); firstFar = false; }
    else ctx.lineTo(i, gy);
  }
  ctx.lineTo(rangeFar.max, getGroundFar(rangeFar.max + parallaxOffset));
  ctx.stroke();
  ctx.restore();
}

function drawHorizonLights(offset) {
  if (!ctx || !canvas) return;
  const parallaxOffset = offset * 0.40;
  const time = Date.now() * 0.001;
  for (let i = 0; i < horizonLights.length; i++) {
    const l = horizonLights[i];
    const screenX = l.x - parallaxOffset;
    if (screenX < -80 || screenX > canvas.width + 80) continue;
    const y = getGroundFar(l.x) - (22 + 22 * l.size);
    const palette = HUE_PALETTE[l.hue] || HUE_PALETTE.warm;
    const [rc, gc, bc] = palette.core;
    const [rg, gg, bg] = palette.glow;
    const pulse = 0.82 + 0.18 * Math.sin(time * (1.1 + l.size * 0.3) + i);
    const size = 22 * l.size * pulse;
    const intensity = l.intensity;

    const grd = ctx.createRadialGradient(screenX, y, 0, screenX, y, size * 2.1);
    grd.addColorStop(0, 'rgba(' + rc + ',' + gc + ',' + bc + ',' + (0.32 * intensity) + ')');
    grd.addColorStop(0.32, 'rgba(' + rg + ',' + gg + ',' + bg + ',' + (0.14 * intensity) + ')');
    grd.addColorStop(0.7, 'rgba(' + rg + ',' + gg + ',' + bg + ',' + (0.05 * intensity) + ')');
    grd.addColorStop(1, 'rgba(' + rg + ',' + gg + ',' + bg + ',0)');
    ctx.save();
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(screenX, y, size * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(' + rc + ',' + gc + ',' + bc + ',' + (0.55 * intensity) + ')';
    ctx.beginPath();
    ctx.arc(screenX, y, Math.max(1.2, size * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHillsMid(offset) {
  if (!ctx || !canvas) return;
  const parallaxOffset = offset * 0.72;
  ctx.save();
  buildTerrainPath(ctx, parallaxOffset, getGroundMid, 8);
  ctx.fillStyle = 'rgba(7, 9, 14, 0.90)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.20)';
  ctx.beginPath();
  const rangeMid = getZoomDrawRange();
  let firstMid = true;
  for (let i = rangeMid.min; i <= rangeMid.max; i += 8) {
    const worldX = i + parallaxOffset;
    const gy = getGroundMid(worldX);
    if (firstMid) { ctx.moveTo(i, gy); firstMid = false; }
    else ctx.lineTo(i, gy);
  }
  ctx.lineTo(rangeMid.max, getGroundMid(rangeMid.max + parallaxOffset));
  ctx.stroke();
  ctx.restore();
}

function drawGround(offset) {
  if (!ctx || !canvas) return;
  ctx.save();
  buildTerrainPath(ctx, offset, getGround, 6);
  ctx.fillStyle = '#07090e';
  ctx.fill();
  ctx.restore();

  ctx.save();
  const step = 6;
  const range = getZoomDrawRange();
  ctx.beginPath();
  let first1 = true;
  for (let i = range.min; i <= range.max; i += step) {
    const worldX = i + offset;
    const gy = getGround(worldX);
    if (first1) { ctx.moveTo(i, gy); first1 = false; }
    else ctx.lineTo(i, gy);
  }
  const lastWorldX = range.max + offset;
  ctx.lineTo(range.max, getGround(lastWorldX));
  ctx.lineTo(range.max, getGround(lastWorldX) + 44);
  ctx.lineTo(range.min, getGround(range.min + offset) + 44);
  ctx.closePath();
  const edgeGrd = ctx.createLinearGradient(0, getGround(offset + canvas.width * 0.5) - 4, 0, getGround(offset + canvas.width * 0.5) + 44);
  edgeGrd.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
  edgeGrd.addColorStop(0.35, 'rgba(180, 138, 40, 0.09)');
  edgeGrd.addColorStop(1, 'rgba(120, 85, 20, 0)');
  ctx.fillStyle = edgeGrd;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.40)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let first2 = true;
  for (let i = range.min; i <= range.max; i += step) {
    const worldX = i + offset;
    const gy = getGround(worldX);
    if (first2) { ctx.moveTo(i, gy); first2 = false; }
    else ctx.lineTo(i, gy);
  }
  ctx.lineTo(range.max, getGround(lastWorldX));
  ctx.stroke();
  ctx.restore();
}

function updateWorldParticles(dt) {
  resonanceTimer += dt;
  const interval = currentAudio ? 0.06 : 0.14;
  while (resonanceTimer >= interval) {
    resonanceTimer -= interval;
    spawnResonanceParticle();
  }
  for (let i = resonanceParticles.length - 1; i >= 0; i--) {
    const p = resonanceParticles[i];
    if (p.pwx === undefined) { p.pwx = p.wx; p.pwy = p.wy; }
    if (p.seed === undefined) p.seed = Math.random() * Math.PI * 2;
    if (p.twinkleSpeed === undefined) p.twinkleSpeed = 4 + Math.random() * 5;
    p.pwx = p.wx;
    p.pwy = p.wy;
    p.wx += p.vx;
    p.wy += p.vy;
    p.vy += 0.012;
    p.vx *= 0.992;
    p.life -= dt * 0.55;
    if (p.life <= 0) resonanceParticles.splice(i, 1);
  }
  for (let i = soundRings.length - 1; i >= 0; i--) {
    const r = soundRings[i];
    r.t += dt;
    r.life = Math.max(0, 1 - r.t / 4);
    if (r.life <= 0) soundRings.splice(i, 1);
  }
  if (!wasOnGround && onGround && Math.abs(vy) < 2 && Math.abs(vx) + Math.abs(vy) > 3.5) {
    spawnLandingDust();
  }
  wasOnGround = onGround;
  if (secretState.unlocked && x >= SECRET_START_X - 200) {
    if (!secretState.HUDVisible) {
      secretState.HUDVisible = true;
    }
    secretState.hudAlpha = Math.min(1, secretState.hudAlpha + dt * 2.2);
  } else {
    secretState.hudAlpha = Math.max(0, secretState.hudAlpha - dt * 1.8);
    if (secretState.hudAlpha < 0.01) secretState.HUDVisible = false;
  }
  if (secretState.screenShakeT > 0) {
    secretState.screenShakeT = Math.max(0, secretState.screenShakeT - dt);
  }
  for (let i = secretState.floatingTexts.length - 1; i >= 0; i--) {
    const t = secretState.floatingTexts[i];
    t.t += dt;
    t.wy -= dt * 32;
    t.life = Math.max(0, 1 - t.t / 1.1);
    if (t.life <= 0) secretState.floatingTexts.splice(i, 1);
  }
  if (secretState.warpBanner) {
    secretState.warpBanner.t += dt;
    if (secretState.warpBanner.t >= secretState.warpBanner.life) {
      secretState.warpBanner = null;
    }
  }
}

function drawWorldParticles(offset) {
  if (!ctx || !canvas) return;
  const time = Date.now() * 0.001;
  for (let i = 0; i < soundRings.length; i++) {
    const r = soundRings[i];
    const sx = r.wx - offset;
    const sy = r.wy;
    if (sx < -200 || sx > canvas.width + 200) continue;
    const baseR = 30 + r.t * 90;
    for (let k = 0; k < 3; k++) {
      const rad = baseR + k * 22;
      const a = r.life * (0.14 - k * 0.035);
      if (a <= 0) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 175, 55, ' + a + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, -Math.PI * 0.95 + Math.sin(time + k) * 0.05, -Math.PI * 0.05 - Math.sin(time + k) * 0.05);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < resonanceParticles.length; i++) {
    const p = resonanceParticles[i];
    const sx = p.wx - offset;
    const sy = p.wy;
    if (sx < -20 || sx > canvas.width + 20) continue;
    const psx = (p.pwx !== undefined ? p.pwx : p.wx) - offset;
    const psy = p.pwy !== undefined ? p.pwy : p.wy;
    const twinkle = 0.72 + Math.sin(time * (p.twinkleSpeed || 5) + (p.seed || 0)) * 0.28;
    const r = p.r0 * (0.85 + (1 - p.life) * 1.2) * twinkle;
    const alpha = Math.max(0, p.life) * (p.golden ? 0.58 : 0.34) * twinkle;
    const [cr, cg, cb] = p.golden ? [255, 230, 165] : [220, 220, 235];
    const [gr, gg, gb] = p.golden ? [212, 175, 55] : [180, 180, 200];

    // Faint motion streak trailing the particle, so the resonance reads as
    // a living spark rather than a flat dot.
    const trailDx = sx - psx;
    const trailDy = sy - psy;
    if (trailDx * trailDx + trailDy * trailDy > 0.4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(' + gr + ',' + gg + ',' + gb + ',' + (alpha * 0.30) + ')';
      ctx.lineWidth = Math.max(0.5, r * 0.7);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.restore();
    }

    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
    glow.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha * 0.5) + ')');
    glow.addColorStop(0.45, 'rgba(' + gr + ',' + gg + ',' + gb + ',' + (alpha * 0.16) + ')');
    glow.addColorStop(1, 'rgba(' + gr + ',' + gg + ',' + gb + ',0)');
    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + alpha + ')';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // A rare few golden motes get a four-point diamond glint for a premium,
    // sunlit-dust-mote feel instead of every particle looking identical.
    if (p.sparkle) {
      const flareLen = r * 5.2 * twinkle;
      const flareAlpha = alpha * 0.85;
      ctx.save();
      ctx.translate(sx, sy);
      const drawFlareAxis = (len) => {
        const grad = ctx.createLinearGradient(-len, 0, len, 0);
        grad.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
        grad.addColorStop(0.5, 'rgba(' + cr + ',' + cg + ',' + cb + ',' + flareAlpha + ')');
        grad.addColorStop(1, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len, 0);
        ctx.stroke();
      };
      drawFlareAxis(flareLen);
      ctx.rotate(Math.PI / 2);
      drawFlareAxis(flareLen * 0.6);
      ctx.restore();
    }
  }
}

function drawAudioOrbs(offset) {
  if (!ctx || !canvas) return;
  audioOrbs.forEach(orb => {
    if (orb.collected) return;

    const screenX = orb.x - offset;
    if (screenX < -150 || screenX > canvas.width + 150) return;

    const groundY = getGround(orb.x);
    const orbY = groundY - 55;
    const time = Date.now() * 0.001;
    const baseRadius = 25;
    const floatBob = Math.sin(time * 1.6 + orb.x * 0.001) * 6;
    const pulseSize = 1 + Math.sin(time * 2.4 + orb.x * 0.002) * 0.06;
    const radius = baseRadius * pulseSize;
    const y = orbY + floatBob;

    const bigGlow = ctx.createRadialGradient(screenX, y, 0, screenX, y, radius * 4.2);
    bigGlow.addColorStop(0, 'rgba(212, 175, 55, 0.18)');
    bigGlow.addColorStop(0.25, 'rgba(185, 145, 45, 0.09)');
    bigGlow.addColorStop(0.6, 'rgba(140, 105, 30, 0.035)');
    bigGlow.addColorStop(1, 'rgba(80, 55, 10, 0)');
    ctx.save();
    ctx.fillStyle = bigGlow;
    ctx.beginPath();
    ctx.arc(screenX, y, radius * 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const glowGradient = ctx.createRadialGradient(screenX, y, 0, screenX, y, radius * 2.1);
    glowGradient.addColorStop(0, 'rgba(230, 192, 82, 0.32)');
    glowGradient.addColorStop(0.4, 'rgba(200, 160, 55, 0.17)');
    glowGradient.addColorStop(0.75, 'rgba(160, 122, 38, 0.06)');
    glowGradient.addColorStop(1, 'rgba(110, 80, 20, 0)');
    ctx.save();
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(screenX, y, radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const orbGradient = ctx.createRadialGradient(
      screenX - radius * 0.28, y - radius * 0.34, radius * 0.05,
      screenX, y, radius
    );
    orbGradient.addColorStop(0, 'rgba(252, 238, 190, 0.92)');
    orbGradient.addColorStop(0.22, 'rgba(232, 204, 120, 0.84)');
    orbGradient.addColorStop(0.5, 'rgba(202, 168, 76, 0.72)');
    orbGradient.addColorStop(0.78, 'rgba(162, 128, 46, 0.58)');
    orbGradient.addColorStop(1, 'rgba(112, 84, 28, 0.38)');
    ctx.save();
    ctx.fillStyle = orbGradient;
    ctx.beginPath();
    ctx.arc(screenX, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const innerCore = ctx.createRadialGradient(
      screenX - radius * 0.12, y - radius * 0.18, 0,
      screenX, y, radius * 0.62
    );
    innerCore.addColorStop(0, 'rgba(255, 248, 218, 0.70)');
    innerCore.addColorStop(0.4, 'rgba(240, 215, 140, 0.40)');
    innerCore.addColorStop(0.8, 'rgba(212, 180, 85, 0.15)');
    innerCore.addColorStop(1, 'rgba(180, 146, 55, 0)');
    ctx.save();
    ctx.fillStyle = innerCore;
    ctx.beginPath();
    ctx.arc(screenX, y, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const spec = ctx.createRadialGradient(
      screenX - radius * 0.3, y - radius * 0.38, 0,
      screenX - radius * 0.18, y - radius * 0.28, radius * 0.36
    );
    spec.addColorStop(0, 'rgba(255, 252, 238, 0.55)');
    spec.addColorStop(0.35, 'rgba(255, 245, 212, 0.28)');
    spec.addColorStop(0.75, 'rgba(255, 236, 180, 0.08)');
    spec.addColorStop(1, 'rgba(255, 228, 160, 0)');
    ctx.save();
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(screenX - radius * 0.18, y - radius * 0.28, radius * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// Editorial reveal: the first time a section swings into view, its eyebrow,
// heading, divider and copy stagger in individually instead of arriving as
// one flat block. Re-arms once you've drifted well past it, so wandering
// back replays the entrance.
const sectionRevealed = new Set();

function revealSectionContent(sectionEl) {
  if (typeof gsap === 'undefined' || !sectionEl) return;
  const targets = sectionEl.querySelectorAll(
    '.eyebrow, .hairline, h1, h2, .lead, .subtitle, .subtext, .story-entry, .partners-list, .contact-icons'
  );
  if (!targets.length) return;
  gsap.killTweensOf(targets);
  gsap.fromTo(targets,
    { opacity: 0, y: 22, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out', stagger: 0.09, overwrite: true }
  );
}

function updateSections() {
  if (!canvas) return;
  const screenCenterX = canvas.width / 2;
  const offset = x - screenCenterX;
  let closestIndex = 0;
  let closestDistance = Infinity;
  sectionPositions.forEach((pos, index) => {
    const sectionEl = document.getElementById('s' + index);
    const distance = pos.x - x;
    if (Math.abs(distance) < closestDistance) {
      closestDistance = Math.abs(distance);
      closestIndex = index;
    }
    if (!sectionEl) return;
    const parallaxX = distance * parallaxSpeed;
    const terrainY = getGround(pos.x);
    const verticalOffset = (canvas.height * 0.5 - terrainY) * 0.3;
    sectionEl.style.transform = 'translate(calc(-50% + ' + parallaxX + 'px), calc(-50% + ' + verticalOffset + 'px))';
    if (Math.abs(distance) < 800) {
      sectionEl.classList.add('visible');
      sectionEl.style.opacity = Math.max(0, 1 - (Math.abs(distance) / 800));
      if (!sectionRevealed.has(index)) {
        sectionRevealed.add(index);
        revealSectionContent(sectionEl);
      }
      // Contact section (index 5): show email / IG / YouTube icons
      if (index === 5 && !contactIconsAnimated) {
        document.querySelectorAll('.contact-icon').forEach(el => el.classList.add('visible'));
        contactIconsAnimated = true;
      }
    } else {
      sectionEl.classList.remove('visible');
      sectionEl.style.opacity = 0;
      if (Math.abs(distance) > 1600) sectionRevealed.delete(index);
    }
  });

  if (closestIndex !== currentSection) {
    currentSection = closestIndex;
  }
}

function checkAudioOrbCollision() {
  audioOrbs.forEach(orb => {
    if (orb.collected) return;

    const distance = Math.abs(x - orb.x);
    if (distance < ballRadius + 30) {
      orb.collected = true;
      const groundY = getGround(orb.x);
      const orbY = groundY - 55;
      for (let k = 0; k < 3; k++) {
        setTimeout(() => spawnSoundRing(orb.x, orbY), k * 180);
      }
      playAudio(orb.audioFile);
    }
  });
}

function playAudio(audioFile) {
  // Fade out current audio if playing
  if (currentAudio) {
    fadeOutAudio(currentAudio, () => {
      currentAudio = null;
      startNewAudio(audioFile);
    });
  } else {
    startNewAudio(audioFile);
  }
}

function startNewAudio(audioFile) {
  const audio = new Audio(audioFile);
  audio.volume = 0;
  audio.loop = true;
  
  // Try to play, handle mobile restrictions
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      currentAudio = audio;
      fadeInAudio(audio);
    }).catch(e => {
      console.log('Audio play failed:', e);
      // Try user interaction fallback
      document.addEventListener('click', function initAudio() {
        audio.play().then(() => {
          currentAudio = audio;
          fadeInAudio(audio);
        }).catch(e => console.log('Audio still failed:', e));
        document.removeEventListener('click', initAudio);
      }, { once: true });
    });
  }
}

function fadeInAudio(audio) {
  let volume = 0;
  const targetVolume = 0.5;
  const fadeSpeed = 0.02;
  
  if (audioFadeInterval) clearInterval(audioFadeInterval);
  
  audioFadeInterval = setInterval(() => {
    volume += fadeSpeed;
    if (volume >= targetVolume) {
      volume = targetVolume;
      clearInterval(audioFadeInterval);
      audioFadeInterval = null;
    }
    audio.volume = volume;
  }, 50);
}

function fadeOutAudio(audio, callback) {
  let volume = audio.volume;
  const fadeSpeed = 0.02;
  
  if (audioFadeInterval) clearInterval(audioFadeInterval);
  
  audioFadeInterval = setInterval(() => {
    volume -= fadeSpeed;
    if (volume <= 0) {
      volume = 0;
      clearInterval(audioFadeInterval);
      audioFadeInterval = null;
      audio.pause();
      audio.currentTime = 0;
      if (callback) callback();
    }
    audio.volume = volume;
  }, 50);
}

// Pause ambient music orbs while a video is playing
let ambientPausedForVideo = false;
let ambientVolumeBeforeVideo = 0.5;

function stopAmbientForVideo() {
  if (!currentAudio) return;
  ambientPausedForVideo = true;
  ambientVolumeBeforeVideo = currentAudio.volume || 0.5;
  if (audioFadeInterval) {
    clearInterval(audioFadeInterval);
    audioFadeInterval = null;
  }
  try {
    currentAudio.pause();
  } catch (e) {}
}

function resumeAmbientAfterVideo() {
  if (!ambientPausedForVideo || !currentAudio) {
    ambientPausedForVideo = false;
    return;
  }
  ambientPausedForVideo = false;
  try {
    const playPromise = currentAudio.play();
    if (playPromise && playPromise.then) {
      playPromise.then(() => fadeInAudio(currentAudio)).catch(() => {});
    } else {
      fadeInAudio(currentAudio);
    }
  } catch (e) {}
}

function updateCamera(dt) {
  if (!canvas) return;
  const ch = canvas.height;
  const ballScreenY = y - cameraY;
  const deadTop = ch * 0.32;
  const deadBot = ch * 0.76;
  const targetLerp = dt ? 1 - Math.pow(0.001, dt) : 0.08;
  let target = cameraY;
  if (ballScreenY < deadTop) target = y - deadTop;
  else if (ballScreenY > deadBot) target = y - deadBot;
  if (secretState.unlocked && x >= SECRET_START_X + 200) {
    const ahead = y - ch * 0.38;
    target = (target + ahead) * 0.5;
  }
  cameraY += (target - cameraY) * Math.min(1, targetLerp);
}

function update(dt) {
  // Freeze world while video modal is open
  if (typeof videoPlayer !== 'undefined' && videoPlayer.isOpen) {
    updateCamera(dt);
    return;
  }
  // Secret splash message fades in the background without freezing movement
  if (secretState.triggeredSplash && secretState.splashT < 4.5) {
    secretState.splashT += dt;
    const t = secretState.splashT;
    if (t < 0.4) secretState.splashAlpha = Math.min(1, t / 0.4);
    else if (t < 2.8) secretState.splashAlpha = 1;
    else if (t < 4.5) secretState.splashAlpha = Math.max(0, 1 - (t - 2.8) / 1.7);
    else secretState.splashAlpha = 0;
  }

  const inEndless = secretState.unlocked && (secretSequence === SECRET_SEQUENCE.LAUNCHED || x >= SECRET_START_X - 50);
  if (keys['a'] || keys['arrowleft']) vx -= moveAccel;
  if (keys['d'] || keys['arrowright']) vx += moveAccel;
  const currentMax = inEndless ? maxSpeed * 2.2 : maxSpeed;
  vx = Math.max(-currentMax, Math.min(currentMax, vx));
  vx *= onGround ? groundFriction : airResist;
  vy += gravity;
  x += vx;
  y += vy;
  rotation += vx / ballRadius;
  const ground = getGround(x);
  if (y + ballRadius >= ground) {
    y = ground - ballRadius;
    vy = vy > 2 ? -vy * 0.3 : 0;
    onGround = true;
    const slope = getSlope(x);
    const slopeGravity = inEndless ? 0.9 : 0.55;
    vx += slope * slopeGravity;
    if (slope < -0.35 && onGround && !keys['a'] && !keys['arrowleft']) {
      const climbBoost = 0.22;
      vx += climbBoost;
    }
  } else {
    onGround = false;
  }
  if (keys[' '] && onGround) {
    vy = -jumpForce;
    onGround = false;
  }
  updateSections();
  checkAudioOrbCollision();
  if (x < LEFT_HILL_END_X) { x = LEFT_HILL_END_X; vx = 0; }
  if (x > RIGHT_HILL_END_X) { x = RIGHT_HILL_END_X; vx = 0; }
  const inLeftSecret = x <= LEFT_REVEAL_X;
  leftSecretState.alpha = inLeftSecret ? Math.min(1, leftSecretState.alpha + dt * 1.8) : Math.max(0, leftSecretState.alpha - dt * 2.2);
  const inRightSecret = x >= RIGHT_REVEAL_X;
  endSecretState.alpha = inRightSecret ? Math.min(1, endSecretState.alpha + dt * 1.8) : Math.max(0, endSecretState.alpha - dt * 2.2);
  if (x >= SECRET_START_X && !secretState.triggeredSplash) {
    triggerSecretSplash();
  }
  if (secretState.HUDVisible) {
    secretState.hudAlpha = Math.min(1, secretState.hudAlpha + 0.02);
  } else if (secretState.hudAlpha > 0) {
    secretState.hudAlpha = Math.max(0, secretState.hudAlpha - 0.04);
  }

  _zoomTarget = secretState.unlocked && (secretSequence === SECRET_SEQUENCE.LAUNCHED || x >= SECRET_START_X + 100) ? 0.78 : 1.0;
  zoomLevel += (_zoomTarget - zoomLevel) * 0.025;

  // --- Video placeholders reveal + gate logic (replaces platforms & note orbs) ---
  if (secretState.unlocked) {
    updateVideoPlaceholders(dt);
  }
  updateCamera(1 / 60);
}

// Precomputed once (not re-randomized per frame) so the handpan's brushed
// metal texture stays stable while it rolls, rather than flickering.
const BRUSHED_RING_COUNT = 34;
const brushedRingSeeds = (function () {
  const seeds = [];
  for (let i = 0; i < BRUSHED_RING_COUNT; i++) {
    seeds.push({
      rFrac: Math.random(),
      tone: Math.random(),
      start: Math.random() * Math.PI * 2,
      span: 0.6 + Math.random() * 1.8
    });
  }
  return seeds;
})();

function drawBall(screenX, screenY) {
  if (!ctx || !canvas) return;
  const r = ballRadius;
  const time = Date.now() * 0.001;

  if (onGround) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const shadowY = getGround(x) + 12;
    const shadowW = r * 1.15;
    const g = ctx.createRadialGradient(screenX, shadowY, 0, screenX, shadowY, shadowW);
    g.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
    g.addColorStop(0.3, 'rgba(160, 120, 40, 0.12)');
    g.addColorStop(0.6, 'rgba(40, 25, 5, 0.06)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(screenX, shadowY, shadowW, shadowW * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(rotation);

  const auraPulse = 0.02 + Math.sin(time * 2.2) * 0.008;
  const aura = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.75);
  aura.addColorStop(0, 'rgba(212, 175, 55, ' + (0.18 + auraPulse) + ')');
  aura.addColorStop(0.35, 'rgba(180, 138, 42, 0.08)');
  aura.addColorStop(0.7, 'rgba(120, 85, 20, 0.03)');
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
  ctx.fill();

  const shell = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.08, 0, 0, r);
  shell.addColorStop(0, 'rgba(250, 232, 178, 0.95)');
  shell.addColorStop(0.12, 'rgba(230, 200, 118, 0.9)');
  shell.addColorStop(0.28, 'rgba(205, 168, 78, 0.88)');
  shell.addColorStop(0.48, 'rgba(175, 138, 52, 0.85)');
  shell.addColorStop(0.68, 'rgba(135, 102, 36, 0.82)');
  shell.addColorStop(0.84, 'rgba(92, 66, 22, 0.78)');
  shell.addColorStop(0.94, 'rgba(60, 42, 14, 0.7)');
  shell.addColorStop(1, 'rgba(38, 26, 8, 0.55)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  const innerHalo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 0.96);
  innerHalo.addColorStop(0, 'rgba(255, 240, 195, 0)');
  innerHalo.addColorStop(0.75, 'rgba(255, 230, 165, 0)');
  innerHalo.addColorStop(0.88, 'rgba(255, 228, 160, 0.10)');
  innerHalo.addColorStop(0.96, 'rgba(255, 228, 160, 0.03)');
  innerHalo.addColorStop(1, 'rgba(255, 228, 160, 0)');
  ctx.fillStyle = innerHalo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(250, 220, 150, 0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.965, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(120, 88, 28, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  // Brushed-metal texture: a set of fine concentric rings at fixed radii
  // (seeded, not random-per-frame) so the shell reads as spun/hammered
  // metal instead of a flat gradient sphere.
  for (let i = 0; i < BRUSHED_RING_COUNT; i++) {
    const seed = brushedRingSeeds[i];
    const ringR = r * (0.20 + seed.rFrac * 0.74);
    const toneLight = seed.tone > 0.5;
    ctx.strokeStyle = toneLight
      ? 'rgba(255, 240, 200, ' + (0.05 + seed.tone * 0.05) + ')'
      : 'rgba(40, 26, 8, ' + (0.05 + (1 - seed.tone) * 0.06) + ')';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, seed.start, seed.start + seed.span);
    ctx.stroke();
  }

  const noteRing1 = r * 0.72;
  const noteRing2 = r * 0.52;
  const noteCountOuter = 8;
  const noteCountInner = 8;

  for (let i = 0; i < noteCountOuter; i++) {
    const angle = (i / noteCountOuter) * Math.PI * 2 - Math.PI / 2;
    const nx = Math.cos(angle) * noteRing1;
    const ny = Math.sin(angle) * noteRing1 * 0.82 - r * 0.03;
    const nr = r * 0.105;
    const noteAngle = angle + Math.PI / 2;

    const noteBase = ctx.createRadialGradient(
      nx + nr * 0.08, ny + nr * 0.08, 0,
      nx, ny, nr * 1.15
    );
    noteBase.addColorStop(0, 'rgba(50, 35, 10, 0.40)');
    noteBase.addColorStop(0.5, 'rgba(72, 50, 16, 0.28)');
    noteBase.addColorStop(0.8, 'rgba(110, 80, 30, 0.14)');
    noteBase.addColorStop(1, 'rgba(150, 112, 45, 0)');
    ctx.fillStyle = noteBase;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 1.12, nr * 0.78, noteAngle, 0, Math.PI * 2);
    ctx.fill();

    const noteTop = ctx.createRadialGradient(
      nx - nr * 0.2, ny - nr * 0.3, 0,
      nx, ny, nr
    );
    noteTop.addColorStop(0, 'rgba(170, 132, 48, 0.22)');
    noteTop.addColorStop(0.45, 'rgba(140, 105, 36, 0.16)');
    noteTop.addColorStop(0.8, 'rgba(105, 78, 26, 0.08)');
    noteTop.addColorStop(1, 'rgba(75, 55, 18, 0)');
    ctx.fillStyle = noteTop;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.92, nr * 0.66, noteAngle, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(220, 180, 90, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.88, nr * 0.62, noteAngle, 0, Math.PI * 2);
    ctx.stroke();

    // Directional bevel: a bright rim on the upper-left lip of the dent and
    // a dark rim on the lower-right, so each note reads as a real pressed
    // indentation rather than a flat gradient blob.
    ctx.strokeStyle = 'rgba(255, 244, 205, 0.30)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.95, nr * 0.68, noteAngle, Math.PI * 0.98, Math.PI * 1.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30, 20, 6, 0.32)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.95, nr * 0.68, noteAngle, Math.PI * -0.02, Math.PI * 0.62);
    ctx.stroke();
  }

  for (let i = 0; i < noteCountInner; i++) {
    const angle = (i / noteCountInner) * Math.PI * 2 - Math.PI / 2 + Math.PI / noteCountInner;
    const nx = Math.cos(angle) * noteRing2;
    const ny = Math.sin(angle) * noteRing2 * 0.86;
    const nr = r * 0.075;
    const noteAngle = angle + Math.PI / 2;

    const noteBase = ctx.createRadialGradient(
      nx + nr * 0.08, ny + nr * 0.08, 0,
      nx, ny, nr * 1.15
    );
    noteBase.addColorStop(0, 'rgba(45, 30, 8, 0.30)');
    noteBase.addColorStop(0.6, 'rgba(75, 54, 18, 0.18)');
    noteBase.addColorStop(1, 'rgba(120, 88, 30, 0)');
    ctx.fillStyle = noteBase;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 1.08, nr * 0.74, noteAngle, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 168, 82, 0.14)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.88, nr * 0.58, noteAngle, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 244, 205, 0.20)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.92, nr * 0.62, noteAngle, Math.PI * 0.98, Math.PI * 1.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30, 20, 6, 0.22)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 0.92, nr * 0.62, noteAngle, Math.PI * -0.02, Math.PI * 0.62);
    ctx.stroke();
  }

  const dingR = r * 0.30;
  const dingOff = -r * 0.035;
  const dingGlow = ctx.createRadialGradient(0, dingOff, 0, 0, dingOff, dingR * 1.8);
  dingGlow.addColorStop(0, 'rgba(255, 238, 188, 0.18)');
  dingGlow.addColorStop(0.4, 'rgba(220, 185, 98, 0.08)');
  dingGlow.addColorStop(1, 'rgba(160, 124, 40, 0)');
  ctx.fillStyle = dingGlow;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingR * 1.8, 0, Math.PI * 2);
  ctx.fill();

  const dingOuter = ctx.createRadialGradient(
    -dingR * 0.22, -dingR * 0.32 + dingOff, dingR * 0.05,
    0, dingOff, dingR
  );
  dingOuter.addColorStop(0, 'rgba(245, 220, 150, 0.82)');
  dingOuter.addColorStop(0.25, 'rgba(218, 182, 95, 0.75)');
  dingOuter.addColorStop(0.55, 'rgba(182, 146, 60, 0.68)');
  dingOuter.addColorStop(0.8, 'rgba(138, 106, 38, 0.58)');
  dingOuter.addColorStop(1, 'rgba(95, 70, 24, 0.40)');
  ctx.fillStyle = dingOuter;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingR, 0, Math.PI * 2);
  ctx.fill();

  const dingInner = ctx.createRadialGradient(
    -dingR * 0.18, -dingR * 0.26 + dingOff, 0,
    0, dingOff, dingR * 0.78
  );
  dingInner.addColorStop(0, 'rgba(252, 232, 178, 0.70)');
  dingInner.addColorStop(0.4, 'rgba(218, 184, 92, 0.48)');
  dingInner.addColorStop(0.8, 'rgba(170, 136, 50, 0.22)');
  dingInner.addColorStop(1, 'rgba(125, 96, 34, 0)');
  ctx.fillStyle = dingInner;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingR * 0.78, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(155, 118, 42, 0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingR * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  // From here on, undo the roll rotation: a real metal surface's specular
  // highlight comes from a fixed light source in the world/screen, not from
  // the object itself, so these should stay put while the shell spins
  // underneath them rather than orbiting around the ball as it rolls.
  ctx.save();
  ctx.rotate(-rotation);

  const spec1 = ctx.createRadialGradient(
    -r * 0.30, -r * 0.42, 0,
    -r * 0.18, -r * 0.32, r * 0.42
  );
  spec1.addColorStop(0, 'rgba(255, 252, 240, 0.42)');
  spec1.addColorStop(0.22, 'rgba(255, 246, 214, 0.26)');
  spec1.addColorStop(0.5, 'rgba(255, 238, 190, 0.10)');
  spec1.addColorStop(1, 'rgba(255, 232, 170, 0)');
  ctx.fillStyle = spec1;
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.32, r * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // A tight, near-white hotspot at the core of the main highlight — the
  // kind of sharp glint a curved metal surface throws back, rather than a
  // soft diffuse blob.
  const hotspot = ctx.createRadialGradient(
    -r * 0.20, -r * 0.34, 0,
    -r * 0.20, -r * 0.34, r * 0.11
  );
  hotspot.addColorStop(0, 'rgba(255, 255, 250, 0.55)');
  hotspot.addColorStop(1, 'rgba(255, 255, 250, 0)');
  ctx.fillStyle = hotspot;
  ctx.beginPath();
  ctx.arc(-r * 0.20, -r * 0.34, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  const spec2 = ctx.createRadialGradient(
    r * 0.22, -r * 0.12, 0,
    r * 0.16, -r * 0.06, r * 0.26
  );
  spec2.addColorStop(0, 'rgba(255, 240, 195, 0.14)');
  spec2.addColorStop(0.5, 'rgba(255, 232, 170, 0.06)');
  spec2.addColorStop(1, 'rgba(255, 224, 150, 0)');
  ctx.fillStyle = spec2;
  ctx.beginPath();
  ctx.arc(r * 0.16, -r * 0.06, r * 0.26, 0, Math.PI * 2);
  ctx.fill();

  // Soft occlusion opposite the light, grounding the sphere so the shading
  // reads as one consistent light source rather than a flat tint.
  const occlusion = ctx.createRadialGradient(
    r * 0.32, r * 0.4, 0,
    r * 0.22, r * 0.34, r * 0.75
  );
  occlusion.addColorStop(0, 'rgba(20, 13, 4, 0.16)');
  occlusion.addColorStop(0.6, 'rgba(20, 13, 4, 0.06)');
  occlusion.addColorStop(1, 'rgba(20, 13, 4, 0)');
  ctx.fillStyle = occlusion;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  const rimShimmer = 0.05 + Math.sin(time * 3.1) * 0.02;
  ctx.strokeStyle = 'rgba(255, 244, 200, ' + (0.18 + rimShimmer) + ')';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.945, -Math.PI * 0.88, -Math.PI * 0.12);
  ctx.stroke();

  const thinRim = ctx.createLinearGradient(-r, 0, r, 0);
  thinRim.addColorStop(0, 'rgba(255, 240, 190, 0.08)');
  thinRim.addColorStop(0.5, 'rgba(255, 245, 210, 0.20)');
  thinRim.addColorStop(1, 'rgba(255, 240, 190, 0.08)');
  ctx.strokeStyle = thinRim;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

function draw(offset) {
  if (!ctx || !canvas) return;
  ctx.save();
  if (secretState.screenShakeT > 0) {
    const s = secretState.screenShakeT * 18;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  ctx.fillStyle = '#030508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const zoom = zoomLevel || 1;
  if (zoom !== 1) {
    const zcx = canvas.width / 2;
    const zcy = canvas.height * 0.44;
    ctx.translate(zcx, zcy);
    ctx.scale(zoom, zoom);
    ctx.translate(-zcx, -zcy);
  }
  drawGiantBackgroundFlowerOfLife(ctx);
  drawStarfield(ctx, offset);
  drawBackgroundGalleryImages(ctx, offset);
  drawAtmosphereBands(ctx);
  drawEndCliffFlowerOfLife();
  if (Math.abs(cameraY) > 0.01) ctx.translate(0, -cameraY);
  drawHillsFar(offset);
  drawVegFar(offset);
  drawEndlessVegFar(offset);
  drawHorizonLights(offset);
  drawHillsMid(offset);
  drawVegMid(offset);
  drawEndlessVegMid(offset);
  drawGround(offset);
  drawVegNear(offset);
  drawEndlessVegNear(offset);
  drawGlowFlowers(offset);
  drawEndlessGlowFlowers(offset);
  // drawVanishingPlatforms removed from secret area
  drawGhostReeds(offset);
  drawWorldParticles(offset);
  drawAudioOrbs(offset);
  drawVideoPlaceholders(offset);
  drawFloatingTexts(offset);
  const edgeFade = Math.max(leftSecretState.alpha, endSecretState.alpha);
  if (edgeFade < 0.99) {
    ctx.save();
    // apply video-gate fade on top of the edge-of-the-world fade
    ctx.globalAlpha = (1 - edgeFade) * videoGateState.fade;
    drawBall(canvas.width / 2, y);
    ctx.restore();
  }
  ctx.restore();
  drawSecretSplash();
  drawSecretHUD();
  drawWarpBanner();
  drawNothingHereMessage();
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateBackgroundSlideshow(dt);
  update(dt);
  updateWorldParticles(dt);
  if (canvas) draw(x - canvas.width / 2);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Nav links: jump the player to the target section, and mobile hamburger toggle
const navLinkSectionIndex = {
  '#home': 0,
  '#about': 1,
  '#story': 2,
  '#manifesto': 3,
  '#partners': 4,
  '#contact': 5
};

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const hash = link.getAttribute('href');
    const index = navLinkSectionIndex[hash];
    if (index !== undefined && sectionPositions[index]) {
      x = sectionPositions[index].x;
      vx = 0;
    }
    const navLinksEl = document.getElementById('navLinks');
    const hamburgerEl = document.getElementById('hamburger');
    if (navLinksEl) navLinksEl.classList.remove('active');
    if (hamburgerEl) hamburgerEl.classList.remove('active');
  });
});

const hamburgerBtn = document.getElementById('hamburger');
const navLinksMenu = document.getElementById('navLinks');
if (hamburgerBtn && navLinksMenu) {
  hamburgerBtn.addEventListener('click', () => {
    hamburgerBtn.classList.toggle('active');
    navLinksMenu.classList.toggle('active');
  });
}

// QR tip popup close
const qrPopupEl = document.getElementById('qrPopup');
const qrCloseBtn = document.getElementById('qrCloseBtn');
if (qrCloseBtn && qrPopupEl) {
  qrCloseBtn.addEventListener('click', () => {
    qrPopupEl.classList.remove('visible');
  });
}
if (qrPopupEl) {
  qrPopupEl.addEventListener('click', (e) => {
    if (e.target === qrPopupEl) qrPopupEl.classList.remove('visible');
  });
}

// Manual tip button
const tipButtonEl = document.getElementById('tipButton');
const tipButtonMobileEl = document.getElementById('tipButtonMobile');

function addTipButtonListener(button) {
  if (button && qrPopupEl) {
    button.addEventListener('click', () => {
      qrPopupEl.classList.add('visible');
    });
  }
}

addTipButtonListener(tipButtonEl);
addTipButtonListener(tipButtonMobileEl);

function checkExitButtonClick(clientX, clientY) {
  const r = secretState._exitBtnRect;
  if (!r) return false;
  const offset = x - (canvas ? canvas.width / 2 : 0);
  const rx = clientX;
  const ry = clientY;
  if (rx >= r.x && rx <= r.x + r.w && ry >= r.y && ry <= r.y + r.h) {
    secretAreaWarpHome();
    return true;
  }
  return false;
}

// Click / tap detection for video placeholders
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

// Screen-space hit boxes updated every frame while drawing
const videoHitBoxes = [];

function tryPlayVideoPlaceholder(clientX, clientY) {
  if (!secretState.unlocked || !canvas) return false;
  if (typeof videoPlayer !== 'undefined' && videoPlayer.isOpen) return false;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;

  // Prefer hit boxes recorded during the last draw (accounts for zoom + camera)
  for (let i = 0; i < videoHitBoxes.length; i++) {
    const b = videoHitBoxes[i];
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      openVideoPlaceholder(b.vp);
      return true;
    }
  }

  // Fallback: distance to ball-near placeholders
  for (let i = 0; i < videoPlaceholders.length; i++) {
    const vp = videoPlaceholders[i];
    if (vp.revealProgress < 0.5) continue;
    if (Math.abs(x - vp.wx) < 140) {
      openVideoPlaceholder(vp);
      return true;
    }
  }
  return false;
}

// ===== CUSTOM VIDEO PLAYER =====
const videoPlayer = {
  modal: null,
  video: null,
  vimeoFrame: null,
  titleEl: null,
  bigPlay: null,
  playBtn: null,
  muteBtn: null,
  progressFilled: null,
  progressHandle: null,
  progressBar: null,
  timeEl: null,
  isOpen: false,
  isDragging: false,
  wasGamePaused: false
};

function initVideoPlayer() {
  videoPlayer.modal = document.getElementById('videoModal');
  videoPlayer.video = document.getElementById('handpanVideo');
  videoPlayer.vimeoFrame = document.getElementById('vimeoFrame');
  videoPlayer.titleEl = document.getElementById('videoPlayerTitle');
  videoPlayer.bigPlay = document.getElementById('videoBigPlay');
  videoPlayer.playBtn = document.getElementById('vcPlay');
  videoPlayer.muteBtn = document.getElementById('vcMute');
  videoPlayer.progressFilled = document.getElementById('vcProgressFilled');
  videoPlayer.progressHandle = document.getElementById('vcProgressHandle');
  videoPlayer.progressBar = document.getElementById('vcProgress');
  videoPlayer.timeEl = document.getElementById('vcTime');

  if (!videoPlayer.modal || !videoPlayer.video) return;

  const closeBtn = document.getElementById('videoPlayerClose');
  const backdrop = document.getElementById('videoModalBackdrop');
  const fsBtn = document.getElementById('vcFullscreen');

  if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);
  if (backdrop) backdrop.addEventListener('click', closeVideoModal);

  videoPlayer.bigPlay.addEventListener('click', togglePlay);
  videoPlayer.playBtn.addEventListener('click', togglePlay);
  videoPlayer.muteBtn.addEventListener('click', toggleMute);
  if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);

  videoPlayer.video.addEventListener('timeupdate', updateProgress);
  videoPlayer.video.addEventListener('loadedmetadata', updateProgress);
  videoPlayer.video.addEventListener('play', onPlayState);
  videoPlayer.video.addEventListener('pause', onPlayState);
  videoPlayer.video.addEventListener('ended', onPlayState);

  videoPlayer.progressBar.addEventListener('click', seekFromEvent);
  videoPlayer.progressBar.addEventListener('mousedown', (e) => {
    videoPlayer.isDragging = true;
    seekFromEvent(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (videoPlayer.isDragging) seekFromEvent(e);
  });
  window.addEventListener('mouseup', () => { videoPlayer.isDragging = false; });

  videoPlayer.progressBar.addEventListener('touchstart', (e) => {
    videoPlayer.isDragging = true;
    if (e.touches[0]) seekFromEvent(e.touches[0]);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (videoPlayer.isDragging && e.touches[0]) seekFromEvent(e.touches[0]);
  }, { passive: true });
  window.addEventListener('touchend', () => { videoPlayer.isDragging = false; });

  document.addEventListener('keydown', (e) => {
    if (!videoPlayer.isOpen) return;
    if (e.key === 'Escape') closeVideoModal();
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    if (e.key === 'm') toggleMute();
    if (e.key === 'f') toggleFullscreen();
  });
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateProgress() {
  const v = videoPlayer.video;
  if (!v || !v.duration) return;
  const pct = (v.currentTime / v.duration) * 100;
  videoPlayer.progressFilled.style.width = pct + '%';
  videoPlayer.progressHandle.style.left = pct + '%';
  videoPlayer.timeEl.textContent = formatTime(v.currentTime) + ' / ' + formatTime(v.duration);
}

function seekFromEvent(e) {
  const v = videoPlayer.video;
  if (!v || !v.duration) return;
  const rect = videoPlayer.progressBar.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  v.currentTime = x * v.duration;
  updateProgress();
}

function onPlayState() {
  const playing = !videoPlayer.video.paused;
  const playIcon = videoPlayer.playBtn.querySelector('.icon-play');
  const pauseIcon = videoPlayer.playBtn.querySelector('.icon-pause');
  if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
  if (playing) videoPlayer.bigPlay.classList.add('hidden');
  else videoPlayer.bigPlay.classList.remove('hidden');
}

function togglePlay() {
  const v = videoPlayer.video;
  if (!v) return;
  if (v.paused) v.play().catch(function(){});
  else v.pause();
}

function toggleMute() {
  const v = videoPlayer.video;
  if (!v) return;
  v.muted = !v.muted;
  const volIcon = videoPlayer.muteBtn.querySelector('.icon-volume');
  const muteIcon = videoPlayer.muteBtn.querySelector('.icon-muted');
  if (volIcon) volIcon.style.display = v.muted ? 'none' : 'block';
  if (muteIcon) muteIcon.style.display = v.muted ? 'block' : 'none';
}

function toggleFullscreen() {
  const shell = document.querySelector('.video-player-shell');
  if (!shell) return;
  if (!document.fullscreenElement) {
    if (shell.requestFullscreen) shell.requestFullscreen();
    else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function openVideoModal(vp) {
  if (!videoPlayer.modal) initVideoPlayer();
  if (!videoPlayer.modal) return;

  videoPlayer.titleEl.textContent = vp.title || '';

  const v = videoPlayer.video;
  const frame = videoPlayer.vimeoFrame;

  if (vp.videoSrc) {
    v.style.display = 'block';
    frame.style.display = 'none';
    frame.src = '';
    v.src = vp.videoSrc;
    v.load();
  } else if (vp.vimeoId) {
    v.style.display = 'none';
    v.removeAttribute('src');
    frame.style.display = 'block';
    frame.src = 'https://player.vimeo.com/video/' + vp.vimeoId +
      '?color=d4af37&title=0&byline=0&portrait=0&autoplay=1';
  } else {
    // Demo fallback so the UI is testable before real videos are added
    v.style.display = 'block';
    frame.style.display = 'none';
    frame.src = '';
    v.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    v.load();
  }

  videoPlayer.modal.classList.add('visible');
  videoPlayer.modal.setAttribute('aria-hidden', 'false');
  videoPlayer.isOpen = true;
  videoPlayer.bigPlay.classList.remove('hidden');
  onPlayState();
  videoPlayer.wasGamePaused = true;
  keys = {};
  stopAmbientForVideo();
  // Mute secret-area synth notes if active
  try {
    if (secretState.masterGain && secretState.synthCtx) {
      const now = secretState.synthCtx.currentTime;
      secretState.masterGain.gain.cancelScheduledValues(now);
      secretState.masterGain.gain.setValueAtTime(secretState.masterGain.gain.value, now);
      secretState.masterGain.gain.linearRampToValueAtTime(0, now + 0.15);
    }
  } catch (e) {}

  if (vp.videoSrc || !vp.vimeoId) {
    setTimeout(function() { v.play().catch(function(){}); }, 200);
  }
}

function closeVideoModal() {
  if (!videoPlayer.modal) return;
  videoPlayer.modal.classList.remove('visible');
  videoPlayer.modal.setAttribute('aria-hidden', 'true');
  videoPlayer.isOpen = false;

  const v = videoPlayer.video;
  if (v) {
    v.pause();
    v.removeAttribute('src');
    v.load();
  }
  if (videoPlayer.vimeoFrame) {
    videoPlayer.vimeoFrame.src = '';
    videoPlayer.vimeoFrame.style.display = 'none';
  }
  videoPlayer.wasGamePaused = false;
  resumeAmbientAfterVideo();
}

function openVideoPlaceholder(vp) {
  vp.played = true;

  for (let k = 0; k < 10; k++) {
    if (resonanceParticles.length >= PARTICLE_MAX) break;
    resonanceParticles.push({
      wx: vp.wx + (Math.random() - 0.5) * 30,
      wy: getGround(vp.wx) - 90 + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -0.8 - Math.random() * 1.4,
      life: 1,
      r0: 2 + Math.random() * 2,
      golden: true
    });
  }

  openVideoModal(vp);
}

if (canvas) {
  // Single click opens a video card (more reliable than double-click)
  canvas.addEventListener('click', (e) => {
    if (checkExitButtonClick(e.clientX, e.clientY)) return;
    tryPlayVideoPlaceholder(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      if (checkExitButtonClick(t.clientX, t.clientY)) return;
      // Single tap on a card opens it
      tryPlayVideoPlaceholder(t.clientX, t.clientY);
    }
  }, { passive: true });
}

function drawEndlessVegFar(offset) {
  if (!ctx || !canvas) return;
  const parallax = 0.40;
  const off = offset * parallax;
  const leftWX = Math.max(10500, offset - 100);
  const rightWX = offset + canvas.width + 100;
  if (rightWX < 10500) return;
  const time = Date.now() * 0.001;
  let wx = leftWX;
  while (wx < rightWX) {
    const pick = hashFloat(wx, 11.3);
    if (pick < 0.55) {
      const sx = wx - off;
      if (sx > -60 && sx < canvas.width + 60) {
        const gy = getGroundFar(wx);
        const sz = 0.28 + hashFloat(wx, 4.7) * 0.32;
        const h = (12 + 22 * sz);
        const sway = windSway(time, wx, 0) * 0.8;
        const topX = sx + sway;
        ctx.lineWidth = Math.max(1.0, 1.4 * sz);
        ctx.strokeStyle = 'rgba(12, 15, 22, 0.82)';
        ctx.beginPath();
        ctx.moveTo(sx - 1, gy);
        ctx.quadraticCurveTo(sx + sway * 0.5, gy - h * 0.55, topX, gy - h);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(sx, gy - 1);
        ctx.quadraticCurveTo(sx + sway * 0.5, gy - h * 0.55 - 0.5, topX + 0.6, gy - h + 0.3);
        ctx.stroke();
      }
      wx += 52 + hashFloat(wx, 8.9) * 55;
    } else {
      wx += 18;
    }
  }
}

function drawEndlessVegMid(offset) {
  if (!ctx || !canvas) return;
  const parallax = 0.72;
  const off = offset * parallax;
  const leftWX = Math.max(10500, offset - 120);
  const rightWX = offset + canvas.width + 120;
  if (rightWX < 10500) return;
  const time = Date.now() * 0.001;
  let wx = leftWX;
  while (wx < rightWX) {
    const pick = hashFloat(wx, 22.4);
    if (pick < 0.42) {
      const sx = wx - off;
      if (sx > -100 && sx < canvas.width + 100) {
        const gy = getGroundMid(wx);
        const sz = 0.6 + hashFloat(wx, 5.1) * 0.6;
        const seed = Math.floor(hashFloat(wx, 6.2) * 1e7);
        const type = hashFloat(wx, 7.3);
        const fakeRec = { wx: wx };
        if (type < 0.33) drawCypressMid(fakeRec, sx, gy, sz, seed, time);
        else if (type < 0.72) drawOliveMid(fakeRec, sx, gy - 2, sz, seed, time);
        else drawBushMid(fakeRec, sx, gy, sz, seed, time);
      }
      wx += 85 + hashFloat(wx, 9.1) * 95;
    } else {
      wx += 22;
    }
  }
}

function drawEndlessVegNear(offset) {
  if (!ctx || !canvas) return;
  const parallax = 1.0;
  const off = offset * parallax;
  const leftWX = Math.max(10500, offset - 120);
  const rightWX = offset + canvas.width + 120;
  if (rightWX < 10500) return;
  const time = Date.now() * 0.001;
  let wx = leftWX;
  while (wx < rightWX) {
    const pick = hashFloat(wx, 33.7);
    if (pick < 0.6) {
      const sx = wx - off;
      if (sx > -100 && sx < canvas.width + 100) {
        const gy = getGround(wx);
        const slope = Math.abs(getSlope(wx));
        if (slope > 0.55) { wx += 32; continue; }
        const sz = 0.9 + hashFloat(wx, 1.8) * 0.75;
        const seed = Math.floor(hashFloat(wx, 3.4) * 1e7);
        const type = hashFloat(wx, 4.9);
        const fakeRec = { wx: wx, seed: seed };
        if (type < 0.5) drawGrassNear(fakeRec, sx, gy, sz, seed, time);
        else if (type < 0.68) drawReedNear(fakeRec, sx, gy, sz, seed, time);
        else if (type < 0.86) drawBushNear(fakeRec, sx, gy, sz, seed, time);
        else if (type < 0.96) drawOliveTreeNear(fakeRec, sx, gy, sz, seed, time);
        else drawCypressNear(fakeRec, sx, gy, sz, seed, time);
      }
      wx += 50 + hashFloat(wx, 7.6) * 60;
    } else {
      wx += 15;
    }
  }
}

function drawEndlessGlowFlowers(offset) {
  if (!ctx || !canvas) return;
  const parallax = 1.0;
  const off = offset * parallax;
  const leftWX = Math.max(10500, offset - 100);
  const rightWX = offset + canvas.width + 100;
  if (rightWX < 10500) return;
  const time = Date.now() * 0.001;
  let wx = leftWX;
  while (wx < rightWX) {
    const pick = hashFloat(wx, 55.9);
    if (pick < 0.08) {
      const sx = wx - off;
      if (sx > -80 && sx < canvas.width + 80) {
        const gy = getGround(wx);
        const size = 0.7 + hashFloat(wx, 2.1) * 0.7;
        const phase = hashFloat(wx, 4.5) * Math.PI * 2;
        const stalkH = 14 + 10 * size;
        const sway = windSway(time, wx, 1.4) * 1.5;
        const tipX = sx + sway;
        const tipY = gy - stalkH;
        ctx.save();
        ctx.strokeStyle = 'rgba(18, 22, 32, 0.95)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(sx, gy);
        ctx.quadraticCurveTo(sx + sway * 0.5, gy - stalkH * 0.55, tipX, tipY);
        ctx.stroke();
        const pulse = 0.72 + 0.28 * Math.sin(time * 1.8 + phase);
        const fsz = (3.2 + 2.2 * size) * pulse;
        const grd = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, fsz * 3.4);
        grd.addColorStop(0, 'rgba(255, 240, 185, ' + (0.42 * pulse) + ')');
        grd.addColorStop(0.35, 'rgba(228, 188, 85, ' + (0.18 * pulse) + ')');
        grd.addColorStop(0.75, 'rgba(212, 175, 55, ' + (0.06 * pulse) + ')');
        grd.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(tipX, tipY, fsz * 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 244, 200, ' + (0.7 * pulse) + ')';
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const px = tipX + Math.cos(a) * fsz * 0.55;
          const py = tipY + Math.sin(a) * fsz * 0.55 * 0.9;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(212, 175, 55, ' + (0.55 * pulse) + ')';
        ctx.beginPath();
        ctx.arc(tipX, tipY, fsz * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      wx += 240 + hashFloat(wx, 8.3) * 480;
    } else {
      wx += 30;
    }
  }
}

const touchLeftEl = document.getElementById('touchLeft');
const touchRightEl = document.getElementById('touchRight');

const DOUBLE_TAP_MS = 320;
const TAP_MOVE_THRESHOLD = 18;

function bindTouchZone(el, moveKey, side) {
  if (!el) return;
  let lastTapTime = 0;
  let holdActive = false;
  let holdTimer = null;
  let startX = 0, startY = 0;
  let moved = false;
  let tapCountForSide = 0;

  const clearHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdActive) {
      holdActive = false;
      keys[moveKey] = false;
      el.classList.remove('active');
    }
  };

  const tryJump = () => {
    if (onGround) {
      vy = -jumpForce;
      onGround = false;
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 160);
    }
  };

  const onStart = (e) => {
    e.preventDefault();
    const now = performance.now();
    moved = false;
    let pt;
    if (e.touches && e.touches.length > 0) {
      pt = e.touches[0];
    } else {
      pt = e;
    }
    startX = pt.clientX;
    startY = pt.clientY;

    holdTimer = setTimeout(() => {
      holdActive = true;
      keys[moveKey] = true;
      el.classList.add('active');
    }, 110);

    const timeSinceLast = now - lastTapTime;
    if (timeSinceLast < DOUBLE_TAP_MS && tapCountForSide >= 1) {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      holdActive = false;
      tryJump();
      tapCountForSide = 0;
      lastTapTime = 0;
      return;
    }
    tapCountForSide = 1;
    lastTapTime = now;
  };

  const onMove = (e) => {
    if (moved) return;
    let pt;
    if (e.touches && e.touches.length > 0) {
      pt = e.touches[0];
    } else {
      pt = e;
    }
    const dx = Math.abs(pt.clientX - startX);
    const dy = Math.abs(pt.clientY - startY);
    if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
      moved = true;
      if (!holdActive && holdTimer) {
        clearTimeout(holdTimer);
        holdActive = true;
        keys[moveKey] = true;
        el.classList.add('active');
      }
    }
  };

  const onEnd = (e) => {
    e.preventDefault();
    clearHold();
    setTimeout(() => {
      if (tapCountForSide > 0 && performance.now() - lastTapTime > DOUBLE_TAP_MS) {
        tapCountForSide = 0;
        lastTapTime = 0;
      }
    }, DOUBLE_TAP_MS + 10);
  };

  el.addEventListener('touchstart', onStart, { passive: false });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd, { passive: false });
  el.addEventListener('touchcancel', onEnd, { passive: false });
  el.addEventListener('mousedown', onStart);
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseup', onEnd);
  el.addEventListener('mouseleave', onEnd);
}

bindTouchZone(touchLeftEl, 'a', 'left');
bindTouchZone(touchRightEl, 'd', 'right');



// Custom cursor
const cursorEl = document.getElementById('cursor');
if (cursorEl && window.matchMedia('(pointer: fine)').matches) {
  cursorEl.style.left = '0px';
  cursorEl.style.top = '0px';
  cursorEl.style.opacity = '0';
  document.addEventListener('mousemove', (e) => {
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';
    cursorEl.style.transform = 'translate(-50%, -50%)';
    cursorEl.style.opacity = '1';
  });
  document.addEventListener('mouseleave', () => {
    cursorEl.style.opacity = '0';
  });
} else if (cursorEl) {
  cursorEl.style.display = 'none';
  document.body.style.cursor = 'auto';
}
// Initialize custom video player once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVideoPlayer);
} else {
  initVideoPlayer();
}
