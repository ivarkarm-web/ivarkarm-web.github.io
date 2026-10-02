// Register ScrollTrigger if GSAP is available in the window
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Canvas setup
const canvas = document.getElementById("game");
const ctx = canvas ? canvas.getContext("2d") : null;

// --- Resolution-independent sizing -----------------------------------------
let viewW = window.innerWidth;
let viewH = window.innerHeight;
let DPR = 1;

const VEG_BASE_MAX_HEIGHT_PX = 45 + 2.2 * 55;
let vegGlobalScale = 1;
function updateVegGlobalScale() {
  if (!viewH) return;
  const targetMaxHeight = viewH * 0.5;
  vegGlobalScale = Math.min(1.7, Math.max(0.5, targetMaxHeight / VEG_BASE_MAX_HEIGHT_PX));
}

function resizeCanvas() {
  if (!canvas) return;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  canvas.width = Math.round(viewW * DPR);
  canvas.height = Math.round(viewH * DPR);
  if (ctx) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  updateVegGlobalScale();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// ============================================================================
// RESONANCE AUDIO ENGINE — Procedural Physical Modeling & Soundscapes
// Handpan in D Celtic Minor / Kurd: D3, A3, Bb3, C4, D4, E4, F4, G4, A4, C5
// Modeled with fundamental, octave, and compound fifth harmonic overtones
// ============================================================================
const ResonanceAudio = {
  ctx: null,
  masterGain: null,
  ambientGain: null,
  isMuted: false,
  isBackgroundSilenced: false,
  initialized: false,
  scale: [
    { name: 'D3', freq: 146.83, pan: 0 },       // Ding fundamental
    { name: 'A3', freq: 220.00, pan: -0.35 },   // Note 1
    { name: 'Bb3', freq: 233.08, pan: 0.35 },   // Note 2
    { name: 'C4', freq: 261.63, pan: -0.6 },    // Note 3
    { name: 'D4', freq: 293.66, pan: 0.6 },     // Note 4
    { name: 'E4', freq: 329.63, pan: -0.4 },    // Note 5
    { name: 'F4', freq: 349.23, pan: 0.4 },     // Note 6
    { name: 'G4', freq: 392.00, pan: -0.2 },    // Note 7
    { name: 'A4', freq: 440.00, pan: 0.2 },     // Note 8
    { name: 'C5', freq: 523.25, pan: 0 }        // High overtone
  ],
  rollingGain: null,
  rollingFilter: null,
  ambientFilter: null,
  lastNoteTime: 0,

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.20, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.setupRollingSound();
      this.setupAmbientSoundscape();
      this.initialized = true;
      this.isMuted = localStorage.getItem('ivar_resonance_muted') === 'true';
      if (this.isMuted) this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.updateUIIcon();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  toggleMute() {
    if (!this.initialized) this.init();
    this.resume();
    this.isMuted = !this.isMuted;
    localStorage.setItem('ivar_resonance_muted', this.isMuted ? 'true' : 'false');
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.7, now + 0.08);
    }
    this.updateUIIcon();
    return this.isMuted;
  },

  updateUIIcon() {
    const btn = document.getElementById('audioToggleBtn');
    if (!btn) return;
    const onIcon = btn.querySelector('.icon-sound-on');
    const offIcon = btn.querySelector('.icon-sound-off');
    if (onIcon) onIcon.style.display = this.isMuted ? 'none' : 'block';
    if (offIcon) offIcon.style.display = this.isMuted ? 'block' : 'none';
    btn.classList.toggle('active', !this.isMuted);
  },

  // Physical model of a single handpan tone field strike
  playTone(index = 0, velocity = 0.5, customOptions = {}) {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const note = this.scale[index % this.scale.length];
    const now = this.ctx.currentTime;
    const freq = note.freq * (customOptions.octaveOffset ? Math.pow(2, customOptions.octaveOffset) : 1);
    const duration = customOptions.duration || (1.6 + velocity * 1.6);
    const strikeVol = Math.max(0.04, Math.min(0.65, velocity * 0.48));

    let output = this.masterGain;
    if (this.ctx.createStereoPanner) {
      const panNode = this.ctx.createStereoPanner();
      panNode.pan.setValueAtTime(note.pan, now);
      panNode.connect(this.masterGain);
      output = panNode;
    }

    // 1. Fundamental
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.frequency.exponentialRampToValueAtTime(freq * 0.998, now + 0.12);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(strikeVol, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(strikeVol * 0.42, now + 0.3);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    gain1.connect(output);
    osc1.start(now);
    osc1.stop(now + duration);

    // 2. Octave overtone (2x)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    const vol2 = strikeVol * 0.45;
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(vol2, now + 0.004);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.65);
    osc2.connect(gain2);
    gain2.connect(output);
    osc2.start(now);
    osc2.stop(now + duration * 0.65);

    // 3. Compound fifth overtone (3x)
    const osc3 = this.ctx.createOscillator();
    const gain3 = this.ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const vol3 = strikeVol * 0.22;
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(vol3, now + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.4);
    osc3.connect(gain3);
    gain3.connect(output);
    osc3.start(now);
    osc3.stop(now + duration * 0.4);

    // 4. Soft transient strike click
    this.playStrikeNoise(now, output, strikeVol);
    this.lastNoteTime = performance.now();
  },

  playStrikeNoise(now, output, vol) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.02);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, now);
    filter.Q.setValueAtTime(3.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
  },

  playImpact(vy) {
    const v = Math.min(1, Math.max(0.1, (Math.abs(vy) - 2.0) / 12));
    this.playTone(0, v, { duration: 2.2 }); // Ding fundamental (D3)
  },

  playJump() {
    this.playTone(4, 0.42, { duration: 1.2 }); // D4 overtone
  },

  playDash() {
    // Ethereal rising chord sweep
    [1, 4, 7].forEach((idx, step) => {
      setTimeout(() => this.playTone(idx, 0.4, { duration: 1.5 }), step * 70);
    });
  },

  setupRollingSound() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(360, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.rollingGain = this.ctx.createGain();
    this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.rollingGain);
    this.rollingGain.connect(this.masterGain);
    noise.start();
    this.rollingFilter = filter;
  },

  updateRolling(speed, onGround) {
    if (!this.rollingGain || !this.ctx || this.isMuted || this.isBackgroundSilenced) {
      if (this.rollingGain && this.ctx) this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }
    const now = this.ctx.currentTime;
    const targetVol = onGround ? Math.min(0.16, (speed / 16) * 0.16) : 0;
    this.rollingGain.gain.setTargetAtTime(targetVol, now, 0.08);
    if (this.rollingFilter) {
      const targetFreq = 280 + Math.min(520, speed * 30);
      this.rollingFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
    }
  },

  setupAmbientSoundscape() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(73.42, this.ctx.currentTime); // D2 sub drone

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    osc.start();
    this.ambientFilter = filter;
  },

  updateAmbientBiome(biome) {
    if (!this.ambientFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (biome === 'berlin') {
      this.ambientFilter.frequency.setTargetAtTime(130, now, 1.5);
    } else if (biome === 'travel') {
      this.ambientFilter.frequency.setTargetAtTime(210, now, 1.5);
    } else if (biome === 'greece') {
      this.ambientFilter.frequency.setTargetAtTime(270, now, 1.5);
    }
  }
};

// Physics variables
let x = 500;
let y = canvas ? viewH / 2 : 300;
let vx = 0;
let vy = 0;
let rotation = 0;
let angularVelocity = 0;
const gravity = 0.58;
const jumpForce = 17.5;
const moveAccel = 0.85;
const maxSpeed = 15;
const airResist = 0.988;
const groundFriction = 0.925;
let onGround = false;
const ballRadius = 34;

// Dash mechanic
let dashActive = false;
let dashTimeRemaining = 0;
let dashCooldown = 0;
const DASH_SPEED = 23;
const DASH_DURATION = 0.25;
const DASH_COOLDOWN_TIME = 0.9;
const dashTrail = [];

let keys = {};
let gameStarted = true;
let currentSection = -1;
let contactIconsAnimated = false;

// Cinematic camera
let cameraX = 100;
let cameraY = 0;
let zoomLevel = 1;
let _zoomTarget = 1;

// Resonant Discovery Stones (Tactile Environmental Storytelling)
const resonantStones = [
  {
    id: 'summit',
    x: -650,
    title: 'The Mountain Hermitage',
    meta: 'Secret Vista · 1,400m',
    text: 'Above the tree line, the sound of the steel travels for miles into the quiet valleys. Silence is as heavy as stone.',
    noteIdx: 0,
    triggered: false
  },
  {
    id: 'berlin',
    x: 1800,
    title: 'Alexanderplatz Viaduct',
    meta: 'Origins · Berlin 2010',
    text: 'Cold autumn dawn. The raw concrete arches under the S-Bahn caught the handpan’s overtones like an acoustic cathedral.',
    noteIdx: 1,
    triggered: false
  },
  {
    id: 'road',
    x: 4200,
    title: 'The Hitchhiker’s Pack',
    meta: 'The Road · Baltic Corridor 2015',
    text: 'Twelve rides across Poland with a backpack and a handpan strapped with climbing cord. Strangers became an audience in seconds.',
    noteIdx: 4,
    triggered: false
  },
  {
    id: 'greece',
    x: 8000,
    title: 'Aegean Sunstone',
    meta: 'Greece · Athens & Samos 2021',
    text: 'Warm stone steps in Monastiraki. People sitting down in the midday heat, listening to the scale while the city kept hurrying past.',
    noteIdx: 6,
    triggered: false
  },
  {
    id: 'archive',
    x: 10500,
    title: 'The Threshold',
    meta: 'Deep Archive · The Rabbit Hole',
    text: 'Where the journey reflects back on itself. Every street, every note, every face remembered and preserved in the deep archive.',
    noteIdx: 8,
    triggered: false
  }
];

// ===== END OF ROAD (after Contact) =====
const CONTACT_X = 11000;
const END_FADE_START_X = 12200;
const WORLD_END_X = 12900;

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
updateVegGlobalScale();

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
  { x: 7400, index: 4, title: "Album" },
  { x: 9200, index: 5, title: "Partners" },
  { x: 11000, index: 6, title: "Contact" },
  { x: 11800, index: 7, title: "The Rabbit Hole" }
];

const NARRATIVE_ZOOM_SECTION_INDICES = [2, 3, 4];
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
  { x: 1500, audioFile: './audio/berlin-dawn.wav', collected: false },
  { x: 4500, audioFile: './audio/alexanderplatz-drift.wav', collected: false },
  { x: 7500, audioFile: './audio/baltic-wind.wav', collected: false }
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
  const cw = viewW;
  const ch = viewH;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const z = Math.max(0.3, Math.min(1, zoomLevel || 1));
  const zoomCompensate = 1 / z;
  const scale = Math.max(cw / iw, ch / ih) * 1.04 * zoomCompensate;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2 + yOffset;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(img, dx, dy, dw, dh);
  context.restore();
}

function drawBackgroundVignette(context) {
  if (!context || !canvas) return;
  const cw = viewW;
  const ch = viewH;
  const z = Math.max(0.3, Math.min(1, zoomLevel || 1));
  const expand = 1 / z;
  const ox = cw * 0.5 * (1 - expand);
  const oy = ch * 0.5 * (1 - expand);
  const ew = cw * expand;
  const eh = ch * expand;
  const cx = ox + ew / 2;
  const cy = oy + eh / 2;
  const innerR = Math.min(ew, eh) * 0.32;
  const outerR = Math.sqrt(ew * ew + eh * eh) / 2;
  const g = context.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  g.addColorStop(0, 'rgba(3, 5, 8, 0)');
  g.addColorStop(0.55, 'rgba(3, 5, 8, 0.55)');
  g.addColorStop(1, 'rgba(3, 5, 8, 0.98)');
  context.save();
  context.fillStyle = g;
  context.fillRect(ox, oy, ew, eh);
  context.restore();
}

function drawBackgroundGalleryImages(context) {
  if (!context || !canvas || bgReadyCount === 0) return;
  const currentImg = bgImages[bgCurrentIndex];
  const nextImg = bgImages[bgNextIndex];
  const currentAlpha = BG_MAX_OPACITY * (1 - bgFadeProgress);
  const nextAlpha = BG_MAX_OPACITY * bgFadeProgress;

  const upOffset = -viewH * 0.25;
  const yOffsetFor = (idx) => (idx === 2 || idx === 5 || idx === 6) ? upOffset : 0;

  drawCoverImage(context, currentImg, currentAlpha, yOffsetFor(bgCurrentIndex));
  if (bgPhase === 'fade' && nextImg) {
    drawCoverImage(context, nextImg, nextAlpha, yOffsetFor(bgNextIndex));
  }
  drawBackgroundVignette(context);
}

// Input listeners
document.addEventListener("keydown", e => {
  if (!gameStarted) {
    if (e.key === 'Enter' || e.code === 'Enter') { e.preventDefault(); startGame(); }
    return;
  }

  // Global shortcuts
  if (e.code === 'KeyM') {
    e.preventDefault();
    ResonanceAudio.toggleMute();
    return;
  }
  if (e.code === 'KeyV') {
    e.preventDefault();
    toggleDirectMonographModal();
    return;
  }
  if (e.key === 'Escape') {
    const dmModal = document.getElementById('directMonographModal');
    if (dmModal && dmModal.classList.contains('open')) {
      e.preventDefault();
      closeDirectMonographModal();
      return;
    }
    const qrPopup = document.getElementById('qrPopup');
    if (qrPopup && qrPopup.classList.contains('visible')) {
      e.preventDefault();
      qrPopup.classList.remove('visible');
      return;
    }
    if (typeof videoPlayer !== 'undefined' && videoPlayer.isOpen) {
      e.preventDefault();
      closeVideoModal();
      return;
    }
    if (endOfRoadState.rabbitHoleShown) {
      e.preventDefault();
      closeRabbitHoleScreen();
      return;
    }
  }

  if (endOfRoadState.rabbitHoleShown) {
    if (e.key === 'ArrowRight' || e.key === 'KeyD') {
      e.preventDefault();
      if (typeof rhDeckManager !== 'undefined' && rhDeckManager.next) rhDeckManager.next();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
      e.preventDefault();
      if (typeof rhDeckManager !== 'undefined' && rhDeckManager.prev) rhDeckManager.prev();
      return;
    }
    return;
  }

  if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    openRabbitHoleScreen();
    return;
  }

  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'shift') {
    keys['shift'] = true;
    keys['dash'] = true;
  }

  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
    e.preventDefault();
  }
});

document.addEventListener("keyup", e => {
  if (!gameStarted) return;
  keys[e.key.toLowerCase()] = false;
  if (e.key.toLowerCase() === 'shift') {
    keys['shift'] = false;
    keys['dash'] = false;
  }
});

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
  const cw = viewW;
  const ch = viewH;
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

// Universal smooth atmospheric screen-edge fade (Hermite smoothstep)
// Prevents sharp popping when trees and architectural models enter/exit viewport
function getScreenEdgeAlpha(sx, halfWidth = 60, fadeDist = 140) {
  const leftBound = -halfWidth - fadeDist;
  const rightBound = viewW + halfWidth + fadeDist;
  if (sx <= leftBound || sx >= rightBound) return 0;

  const leftMargin = halfWidth + fadeDist;
  const rightMargin = viewW - (halfWidth + fadeDist);

  if (sx >= leftMargin && sx <= rightMargin) {
    return 1.0;
  }

  // Smooth Hermite fade-in on the left
  if (sx < leftMargin) {
    const t = Math.max(0, Math.min(1, (sx - leftBound) / (leftMargin - leftBound)));
    return t * t * (3 - 2 * t);
  }

  // Smooth Hermite fade-out on the right
  const t = Math.max(0, Math.min(1, (rightBound - sx) / (rightBound - rightMargin)));
  return t * t * (3 - 2 * t);
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
    const fade = getScreenEdgeAlpha(sx, 50, 120);
    if (fade <= 0.005) continue;
    const gy = getGroundFar(v.wx);
    const h = (18 + 28 * v.size);
    const sway = windSway(time, v.wx, 0) * 0.8;
    const isPine = (v.seed % 3 === 0);

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * fade * 0.88;

    if (v.biome === 'baltic' || v.type === 'balticSpruce') {
      // Distant Baltic Spruce silhouette
      const trunkTopY = gy - h;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.lineTo(sx + sway * 0.5, trunkTopY);
      ctx.strokeStyle = 'rgba(8, 12, 18, 0.88)';
      ctx.lineWidth = Math.max(1.2, 1.6 * v.size);
      ctx.stroke();

      // Tiered spruce cone silhouette
      ctx.beginPath();
      ctx.moveTo(sx + sway * 0.5, trunkTopY);
      ctx.lineTo(sx + (6 + 8 * v.size), gy - h * 0.15);
      ctx.lineTo(sx - (6 + 8 * v.size), gy - h * 0.15);
      ctx.closePath();
      ctx.fillStyle = 'rgba(8, 12, 18, 0.90)';
      ctx.fill();
    } else if (isPine) {
      // Distant Mediterranean umbrella pine silhouette
      const trunkTopY = gy - h * 0.65;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.quadraticCurveTo(sx + sway * 0.3, gy - h * 0.35, sx + sway * 0.6, trunkTopY);
      ctx.strokeStyle = 'rgba(12, 16, 25, 0.85)';
      ctx.lineWidth = Math.max(1.2, 1.6 * v.size);
      ctx.stroke();

      // Parasol canopy cloud
      ctx.beginPath();
      ctx.ellipse(sx + sway * 0.8, trunkTopY - h * 0.2, (8 + 12 * v.size), (4 + 6 * v.size), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
      ctx.fill();
    } else {
      // Distant Tuscan / Mediterranean cypress flame spire
      const w = (2.5 + 3.8 * v.size);
      const topX = sx + sway;
      const topY = gy - h;

      ctx.beginPath();
      ctx.moveTo(sx - w * 0.5, gy);
      ctx.quadraticCurveTo(sx + sway * 0.4 + w, gy - h * 0.45, topX, topY);
      ctx.quadraticCurveTo(sx + sway * 0.4 - w, gy - h * 0.45, sx + w * 0.5, gy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
      ctx.fill();

      // Subtle atmospheric rim
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// BOTANICAL MODELS — Atmospheric Painterly Mediterranean Flora
// Authentic Italian Cypress spires, gnarled ancient Olive trees & wild meadow grasses
// Rich dark silhouettes with subtle warm gold accents (#d4af37)
// ============================================================================

// 1. MEDITERRANEAN CYPRESS (Iconic slender flame conifer with feathery foliage tufts)
function drawCypressMid(c, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 36 + size * 48;
  const sway = windSway(time, c.wx || seed, 0.8) * 1.5;
  const maxW = (size * 7.5 + 4);
  const lobes = 10 + Math.floor(rng() * 4);

  ctx.save();
  // Short ground trunk
  ctx.fillStyle = 'rgba(7, 9, 14, 0.96)';
  ctx.fillRect(baseX - 1.2 * size, baseY - height * 0.08, 2.4 * size, height * 0.08);

  // Flame-shaped feathery foliage envelope
  ctx.beginPath();
  ctx.moveTo(baseX - 1.5 * size, baseY - height * 0.06);

  // Right undulating leafy contour
  for (let i = 0; i <= lobes; i++) {
    const t = i / lobes;
    const yPos = baseY - height * (0.06 + t * 0.94);
    const profileW = maxW * Math.sin(Math.pow(t, 0.65) * Math.PI) * (0.88 + 0.24 * Math.sin(i * 1.9 + seed));
    const tipSway = sway * Math.pow(t, 1.3);
    const xPos = baseX + tipSway + profileW;
    const ctrlY = yPos + (height / lobes) * 0.45;
    ctx.quadraticCurveTo(xPos + 1.2, ctrlY, xPos, yPos);
  }

  // Spearhead apex tip
  const apexX = baseX + sway * 1.1;
  const apexY = baseY - height;
  ctx.lineTo(apexX, apexY);

  // Left undulating leafy contour
  for (let i = lobes; i >= 0; i--) {
    const t = i / lobes;
    const yPos = baseY - height * (0.06 + t * 0.94);
    const profileW = maxW * Math.sin(Math.pow(t, 0.65) * Math.PI) * (0.88 + 0.24 * Math.sin(i * 2.3 + seed * 2));
    const tipSway = sway * Math.pow(t, 1.3);
    const xPos = baseX + tipSway - profileW;
    const ctrlY = yPos + (height / lobes) * 0.45;
    ctx.quadraticCurveTo(xPos - 1.2, ctrlY, xPos, yPos);
  }

  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 9, 15, 0.97)';
  ctx.fill();

  // Subtle windward gold edge sheen
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.restore();
}

function drawCypressNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const height = 58 + size * 78;
  const sway = windSway(time, n.wx, 0.9) * 2.2;
  const maxW = (size * 10 + 6);
  const lobes = 16 + Math.floor(rng() * 4);

  ctx.save();
  // Gnarled base trunk with root grip
  ctx.fillStyle = 'rgba(5, 7, 12, 0.98)';
  ctx.beginPath();
  ctx.moveTo(baseX - 3.2 * size, baseY);
  ctx.quadraticCurveTo(baseX - 1.2 * size, baseY - height * 0.08, baseX - 1.2 * size, baseY - height * 0.12);
  ctx.lineTo(baseX + 1.2 * size, baseY - height * 0.12);
  ctx.quadraticCurveTo(baseX + 1.2 * size, baseY - height * 0.08, baseX + 3.2 * size, baseY);
  ctx.closePath();
  ctx.fill();

  // Majestic dense conifer flame silhouette
  ctx.beginPath();
  ctx.moveTo(baseX - 1.8 * size, baseY - height * 0.09);

  // Right textured scalloped tufts
  for (let i = 0; i <= lobes; i++) {
    const t = i / lobes;
    const yPos = baseY - height * (0.09 + t * 0.91);
    const profileW = maxW * Math.sin(Math.pow(t, 0.6) * Math.PI) * (0.86 + 0.28 * Math.sin(i * 1.8 + seed));
    const tipSway = sway * Math.pow(t, 1.35);
    const xPos = baseX + tipSway + profileW;
    const cuspY = yPos + (height / lobes) * 0.5;
    ctx.quadraticCurveTo(xPos + 2.5 * size, cuspY, xPos, yPos);
  }

  // Slender spire tip
  const topX = baseX + sway * 1.15;
  const topY = baseY - height;
  ctx.lineTo(topX, topY);

  // Left textured scalloped tufts
  for (let i = lobes; i >= 0; i--) {
    const t = i / lobes;
    const yPos = baseY - height * (0.09 + t * 0.91);
    const profileW = maxW * Math.sin(Math.pow(t, 0.6) * Math.PI) * (0.86 + 0.28 * Math.sin(i * 2.1 + seed * 3));
    const tipSway = sway * Math.pow(t, 1.35);
    const xPos = baseX + tipSway - profileW;
    const cuspY = yPos + (height / lobes) * 0.5;
    ctx.quadraticCurveTo(xPos - 2.5 * size, cuspY, xPos, yPos);
  }

  ctx.closePath();
  ctx.fillStyle = 'rgba(5, 7, 12, 0.98)';
  ctx.fill();

  // Delicate micro-foliage interior tufts & warm golden rim highlights
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // Internal layered foliage crevices
  for (let k = 1; k < 6; k++) {
    const kt = k / 7;
    const ky = baseY - height * kt;
    const kx = baseX + sway * Math.pow(kt, 1.3);
    const kw = maxW * Math.sin(Math.pow(kt, 0.6) * Math.PI) * 0.7;
    ctx.beginPath();
    ctx.moveTo(kx - kw * 0.4, ky);
    ctx.quadraticCurveTo(kx, ky - 3.5, kx + kw * 0.4, ky);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  ctx.restore();
}

// 2. ANCIENT GNARLED OLIVE TREE (Massive twisting trunk, hollows, multi-forked boughs & dense billowing leaf clouds)
function drawOliveMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 26 + size * 36;
  const sway = windSway(time, m.wx || seed, 0.7) * 1.3;

  ctx.save();
  // Sinuous twisting trunk
  const crownX = baseX + sway * 0.5;
  const crownY = baseY - trunkH;

  ctx.beginPath();
  ctx.moveTo(baseX - 3.5 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.2 - 2, baseY - trunkH * 0.5, crownX - 1.5 * size, crownY);
  ctx.lineTo(crownX + 1.5 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.2 + 2, baseY - trunkH * 0.5, baseX + 3.5 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(7, 9, 14, 0.96)';
  ctx.fill();

  // 3 Primary spreading boughs
  const boughs = [
    { dx: -size * 18 - 8, dy: -size * 12 - 6, r: size * 11 + 7 },
    { dx: size * 2, dy: -size * 18 - 10, r: size * 13 + 8 },
    { dx: size * 18 + 8, dy: -size * 10 - 5, r: size * 11 + 7 }
  ];

  for (let b = 0; b < boughs.length; b++) {
    const bg = boughs[b];
    const bx = crownX + bg.dx + sway * 0.8;
    const by = crownY + bg.dy;

    // Heavy limb
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + bg.dx * 0.45, crownY + bg.dy * 0.6, bx, by);
    ctx.strokeStyle = 'rgba(7, 9, 14, 0.96)';
    ctx.lineWidth = Math.max(1.8, size * 2.4);
    ctx.stroke();

    // Billowing foliage cloud with serrated leaf perimeter
    ctx.beginPath();
    const scallops = 8;
    for (let s = 0; s < scallops; s++) {
      const a = (s / scallops) * Math.PI * 2;
      const rad = bg.r * (0.82 + 0.22 * Math.sin(s * 2.3 + b));
      const px = bx + Math.cos(a) * rad;
      const py = by + Math.sin(a) * rad * 0.78;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 8, 13, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  ctx.restore();
}

function drawOliveTreeNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 44 + size * 58;
  const sway = windSway(time, n.wx, 0.8) * 1.8;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crownX = baseX + sway * 0.5;
  const crownY = baseY - trunkH;

  // 1. Massive gnarled trunk with deep fissures & flaring root buttresses
  ctx.beginPath();
  ctx.moveTo(baseX - 6.5 * size, baseY);
  ctx.quadraticCurveTo(baseX - 4 * size, baseY - trunkH * 0.2, baseX - 3.2 * size + sway * 0.2, baseY - trunkH * 0.55);
  ctx.quadraticCurveTo(baseX - 2.5 * size + sway * 0.35, baseY - trunkH * 0.82, crownX - 2.2 * size, crownY);
  ctx.lineTo(crownX + 2.2 * size, crownY);
  ctx.quadraticCurveTo(baseX + 2.5 * size + sway * 0.35, baseY - trunkH * 0.82, baseX + 3.2 * size + sway * 0.2, baseY - trunkH * 0.55);
  ctx.quadraticCurveTo(baseX + 4 * size, baseY - trunkH * 0.2, baseX + 6.5 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(5, 7, 12, 0.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Natural hollow knot aperture (centuries-old olive tree negative space)
  ctx.beginPath();
  ctx.ellipse(baseX + sway * 0.25, baseY - trunkH * 0.45, 1.8 * size + 1.2, 4.5 * size + 2, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(3, 4, 7, 0.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // 2. Four heavy, twisting architectural boughs
  const majorBoughs = [
    { angle: -Math.PI * 0.78, len: size * 32 + 18, cloudR: size * 18 + 12, subCount: 3 },
    { angle: -Math.PI * 0.58, len: size * 38 + 22, cloudR: size * 22 + 14, subCount: 4 },
    { angle: -Math.PI * 0.38, len: size * 36 + 20, cloudR: size * 20 + 13, subCount: 3 },
    { angle: -Math.PI * 0.18, len: size * 28 + 16, cloudR: size * 17 + 11, subCount: 3 }
  ];

  for (let b = 0; b < majorBoughs.length; b++) {
    const mb = majorBoughs[b];
    const bSway = sway * (0.7 + b * 0.1);
    const endX = crownX + Math.cos(mb.angle) * mb.len + bSway;
    const endY = crownY + Math.sin(mb.angle) * mb.len * 0.75;
    const midX = crownX + Math.cos(mb.angle + 0.12) * mb.len * 0.5 + bSway * 0.4;
    const midY = crownY + Math.sin(mb.angle + 0.12) * mb.len * 0.45;

    // Gnarled limb branch
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.strokeStyle = 'rgba(5, 7, 12, 0.98)';
    ctx.lineWidth = Math.max(2.2, size * 3.2 * (1 - b * 0.12));
    ctx.stroke();

    // Billowing multi-lobed foliage cloud with natural leaf edge scallops
    const cloudLobes = 12;
    ctx.beginPath();
    for (let c = 0; c < cloudLobes; c++) {
      const a = (c / cloudLobes) * Math.PI * 2;
      const rMod = 0.85 + 0.22 * Math.sin(c * 2.4 + b * 1.5);
      const cr = mb.cloudR * rMod;
      const px = endX + Math.cos(a) * cr;
      const py = endY + Math.sin(a) * cr * 0.72;
      if (c === 0) ctx.moveTo(px, py);
      else {
        const prevA = ((c - 0.5) / cloudLobes) * Math.PI * 2;
        const cuspR = cr * 1.08;
        ctx.quadraticCurveTo(
          endX + Math.cos(prevA) * cuspR,
          endY + Math.sin(prevA) * cuspR * 0.72,
          px, py
        );
      }
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(5, 7, 12, 0.97)';
    ctx.fill();

    // Fine leaf rim highlight & warm horizon gold sheen
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
    ctx.lineWidth = 0.85;
    ctx.stroke();
  }

  ctx.restore();
}

// 3. MEDITERRANEAN STONE PINE / UMBRELLA PINE (Pinus pinea — Iconic coastal parasol pine)
function drawStonePineMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 34 + size * 46;
  const sway = windSway(time, m.wx || seed, 0.7) * 1.5;

  ctx.save();
  const crownX = baseX + sway * 0.7;
  const crownY = baseY - trunkH;

  // Tall curving trunk
  ctx.beginPath();
  ctx.moveTo(baseX - 2.5 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.3, baseY - trunkH * 0.5, crownX - 1.2 * size, crownY);
  ctx.lineTo(crownX + 1.2 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.3 + 1, baseY - trunkH * 0.5, baseX + 2.5 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 10, 15, 0.96)';
  ctx.fill();

  // Spreading cantilever boughs
  const boughCount = 3;
  for (let b = 0; b < boughCount; b++) {
    const angle = -Math.PI * 0.8 + (b / (boughCount - 1)) * Math.PI * 0.6;
    const len = (size * 18 + 12);
    const bx = crownX + Math.cos(angle) * len + sway * 0.8;
    const by = crownY + Math.sin(angle) * len * 0.6;

    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(angle) * len * 0.5, crownY - 3, bx, by);
    ctx.strokeStyle = 'rgba(8, 10, 15, 0.96)';
    ctx.lineWidth = Math.max(1.4, 2.0 * size);
    ctx.stroke();

    // Parasol needle dome
    ctx.beginPath();
    ctx.ellipse(bx, by - 4, size * 14 + 10, size * 7 + 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 8, 13, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  ctx.restore();
}

function drawStonePineNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 55 + size * 72;
  const sway = windSway(time, n.wx, 0.75) * 2.0;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crownX = baseX + sway * 0.75;
  const crownY = baseY - trunkH;

  // Stately towering trunk with natural lean
  ctx.beginPath();
  ctx.moveTo(baseX - 4.5 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 - 2, baseY - trunkH * 0.45, crownX - 2.2 * size, crownY);
  ctx.lineTo(crownX + 2.2 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 + 2, baseY - trunkH * 0.45, baseX + 4.5 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 8, 13, 0.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Bark fissures
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - 5);
  ctx.quadraticCurveTo(baseX + sway * 0.2, baseY - trunkH * 0.5, crownX, crownY + 8);
  ctx.strokeStyle = 'rgba(3, 4, 7, 0.98)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Spreading umbrella boughs
  const boughs = [
    { angle: -Math.PI * 0.82, len: size * 34 + 20, w: size * 26 + 16, h: size * 12 + 7 },
    { angle: -Math.PI * 0.62, len: size * 38 + 22, w: size * 32 + 18, h: size * 14 + 8 },
    { angle: -Math.PI * 0.42, len: size * 38 + 22, w: size * 32 + 18, h: size * 14 + 8 },
    { angle: -Math.PI * 0.22, len: size * 34 + 20, w: size * 26 + 16, h: size * 12 + 7 }
  ];

  for (let b = 0; b < boughs.length; b++) {
    const bg = boughs[b];
    const bx = crownX + Math.cos(bg.angle) * bg.len + sway * 0.85;
    const by = crownY + Math.sin(bg.angle) * bg.len * 0.65;

    // Muscular cantilever arm
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(bg.angle) * bg.len * 0.45, crownY - 6, bx, by);
    ctx.strokeStyle = 'rgba(6, 8, 13, 0.98)';
    ctx.lineWidth = Math.max(2.0, 3.0 * size * (1 - b * 0.08));
    ctx.stroke();

    // Broad umbrella needle canopy lobe with scalloped edge
    ctx.beginPath();
    const lobes = 10;
    for (let l = 0; l < lobes; l++) {
      const a = (l / lobes) * Math.PI * 2;
      const rMod = 0.86 + 0.2 * Math.sin(l * 2.2 + b);
      const px = bx + Math.cos(a) * bg.w * 0.5 * rMod;
      const py = by + Math.sin(a) * bg.h * 0.5 * rMod;
      if (l === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(5, 7, 12, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
    ctx.lineWidth = 0.85;
    ctx.stroke();

    // Hanging pine cones with warm golden-amber accents
    const coneX = bx + (b % 2 === 0 ? 6 : -6);
    const coneY = by + bg.h * 0.35;
    ctx.beginPath();
    ctx.ellipse(coneX, coneY, 2.2, 4.2, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.fill();
  }

  ctx.restore();
}

// 4. REALISTIC NORDIC SILVER BIRCH (Betula pendula — Slender organic birch, realistic foliage clusters)
function drawBirchMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 32 + size * 42;
  const sway = windSway(time, m.wx || seed, 0.8) * 1.5;

  ctx.save();
  const crownX = baseX + sway * 0.6;
  const crownY = baseY - trunkH;

  // Slender organic trunk with gentle natural taper
  ctx.beginPath();
  ctx.moveTo(baseX - 1.8 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.25, baseY - trunkH * 0.5, crownX - 0.9 * size, crownY);
  ctx.lineTo(crownX + 0.9 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 + 0.8, baseY - trunkH * 0.5, baseX + 1.8 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(14, 18, 26, 0.96)';
  ctx.fill();

  // Natural upward-reaching branches with organic cloud lobes
  const boughs = 3;
  for (let b = 0; b < boughs; b++) {
    const angle = -Math.PI * 0.75 + (b / (boughs - 1)) * Math.PI * 0.5;
    const len = size * 16 + 10;
    const bx = crownX + Math.cos(angle) * len + sway * 0.8;
    const by = crownY + Math.sin(angle) * len * 0.7;

    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(angle) * len * 0.5, crownY - 2, bx, by);
    ctx.strokeStyle = 'rgba(14, 18, 26, 0.96)';
    ctx.lineWidth = Math.max(1.2, 1.8 * size);
    ctx.stroke();

    // Billowing foliage cloud
    ctx.beginPath();
    ctx.ellipse(bx, by - 3, size * 12 + 8, size * 8 + 5, 0.1 * (b - 1), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 11, 18, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBirchNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 50 + size * 68;
  const sway = windSway(time, n.wx, 0.85) * 2.1;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crownX = baseX + sway * 0.65;
  const crownY = baseY - trunkH;

  // Stately slender birch trunk with natural lean
  ctx.beginPath();
  ctx.moveTo(baseX - 3.2 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 - 1.5, baseY - trunkH * 0.45, crownX - 1.6 * size, crownY);
  ctx.lineTo(crownX + 1.6 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 + 1.5, baseY - trunkH * 0.45, baseX + 3.2 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12, 16, 24, 0.98)';
  ctx.fill();

  // Fine birch bark lenticel markings
  for (let k = 0; k < 5; k++) {
    const ky = baseY - (k + 1) * (trunkH * 0.15);
    const kx = baseX + (crownX - baseX) * ((k + 1) * 0.15);
    ctx.beginPath();
    ctx.moveTo(kx - 2.2 * size, ky);
    ctx.lineTo(kx + 2.2 * size, ky - 0.5);
    ctx.strokeStyle = 'rgba(32, 40, 56, 0.95)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  // Soft gold rim reflection on trunk
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Spreading master limbs
  const limbAngles = [-Math.PI * 0.78, -Math.PI * 0.60, -Math.PI * 0.42, -Math.PI * 0.22];
  for (let l = 0; l < limbAngles.length; l++) {
    const angle = limbAngles[l];
    const len = size * 28 + 18;
    const lx = crownX + Math.cos(angle) * len + sway * 0.85;
    const ly = crownY + Math.sin(angle) * len * 0.75;

    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(angle) * len * 0.45, crownY - 4, lx, ly);
    ctx.strokeStyle = 'rgba(10, 14, 22, 0.98)';
    ctx.lineWidth = Math.max(1.8, 2.6 * size * (1 - l * 0.1));
    ctx.stroke();

    // Billowing scalloped leaf clusters with organic rustle
    ctx.beginPath();
    const lobes = 9;
    const cloudW = size * 22 + 14;
    const cloudH = size * 14 + 9;
    for (let c = 0; c < lobes; c++) {
      const a = (c / lobes) * Math.PI * 2;
      const rMod = 0.85 + 0.22 * Math.sin(c * 2.2 + l);
      const px = lx + Math.cos(a) * cloudW * 0.5 * rMod;
      const py = ly + Math.sin(a) * cloudH * 0.5 * rMod;
      if (c === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(7, 10, 16, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

// 5. BALTIC NORWAY SPRUCE (Picea abies — Layered conical evergreen boughs)
function drawBalticSpruceMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const treeH = 38 + size * 48;
  const sway = windSway(time, m.wx || seed, 0.6) * 1.2;

  ctx.save();
  const apexX = baseX + sway;
  const apexY = baseY - treeH;

  // Central spruce trunk
  ctx.beginPath();
  ctx.moveTo(baseX - 2.2 * size, baseY);
  ctx.lineTo(baseX + 2.2 * size, baseY);
  ctx.lineTo(apexX + 0.8 * size, apexY);
  ctx.lineTo(apexX - 0.8 * size, apexY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 12, 18, 0.96)';
  ctx.fill();

  // Tiered downward-arching evergreen boughs (5 tiers)
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const frac = (t + 1) / (tiers + 1);
    const ty = apexY + treeH * frac;
    const tx = baseX + (apexX - baseX) * (1 - frac);
    const tierW = (size * 18 + 12) * frac;

    ctx.beginPath();
    ctx.moveTo(tx, ty - 4);
    ctx.lineTo(tx + tierW, ty + 5);
    ctx.lineTo(tx + tierW * 0.6, ty + 2);
    ctx.lineTo(tx, ty + 7);
    ctx.lineTo(tx - tierW * 0.6, ty + 2);
    ctx.lineTo(tx - tierW, ty + 5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(5, 8, 14, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.10)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBalticSpruceNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const treeH = 62 + size * 78;
  const sway = windSway(time, n.wx, 0.65) * 1.8;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const apexX = baseX + sway;
  const apexY = baseY - treeH;

  // Stately straight spruce trunk
  ctx.beginPath();
  ctx.moveTo(baseX - 3.8 * size, baseY);
  ctx.lineTo(baseX + 3.8 * size, baseY);
  ctx.lineTo(apexX + 1.2 * size, apexY);
  ctx.lineTo(apexX - 1.2 * size, apexY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 9, 15, 0.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // 7 Tiered downward-sweeping coniferous boughs with serrated needle teeth
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const frac = (t + 1) / (tiers + 1);
    const ty = apexY + treeH * frac;
    const tx = baseX + (apexX - baseX) * (1 - frac) * 0.8;
    const tierW = (size * 28 + 18) * frac;
    const tierH = size * 10 + 6;

    ctx.beginPath();
    ctx.moveTo(tx, ty - tierH * 0.4);
    // Right arching bough with needle teeth
    ctx.quadraticCurveTo(tx + tierW * 0.5, ty + tierH * 0.2, tx + tierW, ty + tierH * 0.8);
    ctx.lineTo(tx + tierW * 0.72, ty + tierH * 0.4);
    ctx.lineTo(tx + tierW * 0.45, ty + tierH * 0.6);
    ctx.lineTo(tx, ty + tierH * 0.85);
    // Left arching bough
    ctx.lineTo(tx - tierW * 0.45, ty + tierH * 0.6);
    ctx.lineTo(tx - tierW * 0.72, ty + tierH * 0.4);
    ctx.quadraticCurveTo(tx - tierW * 0.5, ty + tierH * 0.2, tx - tierW, ty + tierH * 0.8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 7, 12, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Pine apex spire needle
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(apexX, apexY - 6);
  ctx.strokeStyle = 'rgba(4, 7, 12, 0.98)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.restore();
}

// 6. BALTIC SCOTS PINE (Pinus sylvestris — Northern coastal pine with amber-ochre bark)
function drawBalticPineMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 36 + size * 46;
  const sway = windSway(time, m.wx || seed, 0.7) * 1.4;

  ctx.save();
  const crownX = baseX + sway * 0.7;
  const crownY = baseY - trunkH;

  // Stately trunk with amber upper section
  ctx.beginPath();
  ctx.moveTo(baseX - 2.2 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.25, baseY - trunkH * 0.5, crownX - 1.1 * size, crownY);
  ctx.lineTo(crownX + 1.1 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 + 0.8, baseY - trunkH * 0.5, baseX + 2.2 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 11, 16, 0.96)';
  ctx.fill();

  // High dense evergreen needle pads
  const pads = 3;
  for (let p = 0; p < pads; p++) {
    const angle = -Math.PI * 0.75 + (p / (pads - 1)) * Math.PI * 0.5;
    const len = size * 16 + 10;
    const px = crownX + Math.cos(angle) * len + sway * 0.8;
    const py = crownY + Math.sin(angle) * len * 0.6;

    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.lineTo(px, py);
    ctx.strokeStyle = 'rgba(8, 11, 16, 0.96)';
    ctx.lineWidth = Math.max(1.4, 2.0 * size);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(px, py - 3, size * 13 + 8, size * 6 + 4, 0.1 * (p - 1), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 8, 13, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBalticPineNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const trunkH = 58 + size * 74;
  const sway = windSway(time, n.wx, 0.75) * 2.0;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crownX = baseX + sway * 0.7;
  const crownY = baseY - trunkH;

  // Stately Scots Pine trunk
  ctx.beginPath();
  ctx.moveTo(baseX - 4.0 * size, baseY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 - 1.5, baseY - trunkH * 0.45, crownX - 2.0 * size, crownY);
  ctx.lineTo(crownX + 2.0 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25 + 1.5, baseY - trunkH * 0.45, baseX + 4.0 * size, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 8, 13, 0.98)';
  ctx.fill();

  // Characteristic Baltic Scots Pine reddish-cinnamon upper bark
  ctx.beginPath();
  ctx.moveTo(crownX - 2.0 * size, crownY);
  ctx.quadraticCurveTo(baseX + sway * 0.25, baseY - trunkH * 0.65, crownX - 2.6 * size, baseY - trunkH * 0.55);
  ctx.lineTo(crownX + 2.6 * size, baseY - trunkH * 0.55);
  ctx.quadraticCurveTo(baseX + sway * 0.25, baseY - trunkH * 0.65, crownX + 2.0 * size, crownY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(145, 82, 38, 0.25)';
  ctx.fill();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // Spreading high cantilever arms
  const boughs = [
    { angle: -Math.PI * 0.80, len: size * 32 + 18, w: size * 24 + 14, h: size * 10 + 6 },
    { angle: -Math.PI * 0.55, len: size * 36 + 20, w: size * 28 + 16, h: size * 12 + 7 },
    { angle: -Math.PI * 0.25, len: size * 30 + 17, w: size * 24 + 14, h: size * 10 + 6 }
  ];

  for (let b = 0; b < boughs.length; b++) {
    const bg = boughs[b];
    const bx = crownX + Math.cos(bg.angle) * bg.len + sway * 0.85;
    const by = crownY + Math.sin(bg.angle) * bg.len * 0.65;

    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + Math.cos(bg.angle) * bg.len * 0.45, crownY - 5, bx, by);
    ctx.strokeStyle = 'rgba(6, 8, 13, 0.98)';
    ctx.lineWidth = Math.max(1.8, 2.8 * size * (1 - b * 0.08));
    ctx.stroke();

    // Dense horizontal evergreen needle cushion
    ctx.beginPath();
    const lobes = 8;
    for (let l = 0; l < lobes; l++) {
      const a = (l / lobes) * Math.PI * 2;
      const rMod = 0.86 + 0.2 * Math.sin(l * 2.2 + b);
      const px = bx + Math.cos(a) * bg.w * 0.5 * rMod;
      const py = by + Math.sin(a) * bg.h * 0.5 * rMod;
      if (l === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 7, 12, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

// 7. BALTIC HEATHER & FOREST FLOOR SHRUB (Calluna / Vaccinium myrtillus)
function drawBalticShrubNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const width = size * 20 + 14;
  const height = size * 14 + 10;
  const sway = windSway(time, n.wx, 0.9) * 1.5;

  ctx.save();
  const cx = baseX + sway * 0.4;

  // Woody forest floor twigs
  for (let t = 0; t < 3; t++) {
    const tx = baseX + (t - 1) * size * 3;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(cx + (t - 1) * size * 5, baseY - height * 0.7);
    ctx.strokeStyle = 'rgba(6, 8, 14, 0.95)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  // Low dense heather / bilberry mounds
  const mounds = 4;
  for (let i = 0; i < mounds; i++) {
    const mt = i / (mounds - 1);
    const mx = cx + (mt - 0.5) * width * 0.8;
    const my = baseY - height * (0.35 + 0.65 * Math.sin(mt * Math.PI));
    const mr = (size * 6 + 4) * (0.8 + rng() * 0.4);

    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 7, 12, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.10)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  ctx.restore();
}

// 5. WILD BRIAR & MYRTLE THICKET (Dense layered Mediterranean hillside bush)
function drawBushMid(m, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const width = size * 22 + 16;
  const height = size * 16 + 12;
  const sway = windSway(time, m.wx || seed, 0.6) * 1.0;
  const mounds = 5 + Math.floor(rng() * 3);

  ctx.save();
  const cx = baseX + sway * 0.5;

  // Tangled woody twigs at base
  for (let t = 0; t < 4; t++) {
    const tx = baseX + (t - 1.5) * size * 4;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(cx + (t - 1.5) * size * 6, baseY - height * 0.6);
    ctx.strokeStyle = 'rgba(7, 9, 14, 0.94)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Layered organic leaf clusters
  for (let i = 0; i < mounds; i++) {
    const mt = i / (mounds - 1);
    const mx = cx + (mt - 0.5) * width * 0.75 + (rng() - 0.5) * 3;
    const my = baseY - height * (0.35 + 0.65 * Math.sin(mt * Math.PI));
    const mr = (size * 7 + 5) * (0.8 + rng() * 0.4);

    ctx.beginPath();
    const petals = 7;
    for (let p = 0; p < petals; p++) {
      const a = (p / petals) * Math.PI * 2;
      const pr = mr * (0.84 + 0.22 * Math.sin(p * 2.1 + i));
      const px = mx + Math.cos(a) * pr;
      const py = my + Math.sin(a) * pr * 0.72;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 8, 14, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
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
    const fade = getScreenEdgeAlpha(sx, 65, 140);
    if (fade <= 0.005) continue;
    const gy = getGroundMid(m.wx);
    const sz = m.size * Math.sqrt(vegGlobalScale);

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * fade;
    if (m.type === 'cypress') drawCypressMid(m, sx, gy, sz, m.seed, time);
    else if (m.type === 'olive') drawOliveMid(m, sx, gy - 2, sz, m.seed, time);
    else if (m.type === 'pine') drawStonePineMid(m, sx, gy - 2, sz, m.seed, time);
    else if (m.type === 'balticSpruce') drawBalticSpruceMid(m, sx, gy - 2, sz, m.seed, time);
    else if (m.type === 'balticPine') drawBalticPineMid(m, sx, gy - 2, sz, m.seed, time);
    else if (m.type === 'birch' || m.type === 'willow') drawBirchMid(m, sx, gy - 2, sz, m.seed, time);
    else drawBushMid(m, sx, gy, sz, m.seed, time);
    ctx.restore();
  }
}

// 6. LUSH WILD MEADOW & HILLSIDE GRASSES (Wild oats, nodding feather grass plumes & delicate awns)
function drawGrassNear(n, baseX, baseY, size, seed, time) {
  const rng = seedRand(seed);
  const bladeCount = 9 + Math.floor(rng() * 5);
  const plumeCount = 2 + Math.floor(rng() * 2);

  ctx.save();
  ctx.lineCap = 'round';

  // 1. Dense ground grass blades
  for (let i = 0; i < bladeCount; i++) {
    const t = i / (bladeCount - 1);
    const spreadX = baseX + (t - 0.5) * (size * 18 + 8) + (rng() - 0.5) * 2;
    const h = (size * 14 + 10) * (0.65 + rng() * 0.7);
    const sway = windSway(time, n.wx + i * 19, 1.0) * 3.4;
    const bendDir = (t - 0.5) * 6;
    const tipX = spreadX + sway + bendDir;
    const tipY = baseY - h;
    const midX = spreadX + sway * 0.45 + bendDir * 0.5;
    const midY = baseY - h * 0.55;

    // Organic blade tapering to razor tip
    ctx.beginPath();
    ctx.moveTo(spreadX - 0.9, baseY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + 0.4, midY, spreadX + 0.9, baseY);
    ctx.fillStyle = 'rgba(7, 9, 15, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.10)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // 2. Elegant arching wild oat (Avena) & feather grass plumes with nodding seed heads
  for (let p = 0; p < plumeCount; p++) {
    const pt = p / plumeCount;
    const rootX = baseX + (pt - 0.5) * (size * 12);
    const stalkH = (size * 28 + 18) * (0.85 + rng() * 0.35);
    const sway = windSway(time, n.wx + p * 31, 1.2) * 4.2;
    const curveDir = p % 2 === 0 ? 1 : -1;
    const tipX = rootX + sway + curveDir * (size * 10 + 6);
    const tipY = baseY - stalkH;

    // Gracefully arching slender stalk
    ctx.beginPath();
    ctx.moveTo(rootX, baseY);
    ctx.quadraticCurveTo(rootX + sway * 0.4, baseY - stalkH * 0.6, tipX, tipY);
    ctx.strokeStyle = 'rgba(8, 11, 17, 0.95)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Nodding feather awns without fake glowing balls
    const seeds = 4;
    for (let s = 0; s < seeds; s++) {
      const st = s / seeds;
      const sx = tipX - Math.sin(sway * 0.05) * (s * 4);
      const sy = tipY + s * 3.5;
      const awnLen = (4 + size * 3) * (1 - st * 0.3);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + curveDir * awnLen, sy - 2);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
  }

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
    const fade = getScreenEdgeAlpha(sx, 75, 150);
    if (fade <= 0.005) continue;
    const gy = getGround(n.wx);
    const slope = Math.abs(getSlope(n.wx));
    if (slope > 0.52) continue;
    const sz = n.size * vegGlobalScale;

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * fade;
    if (n.type === 'cypress') drawCypressNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'olivetree') drawOliveTreeNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'pine') drawStonePineNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'balticSpruce') drawBalticSpruceNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'balticPine') drawBalticPineNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'birch' || n.type === 'willow') drawBirchNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'balticShrub') drawBalticShrubNear(n, sx, gy, sz, n.seed, time);
    else drawGrassNear(n, sx, gy, sz, n.seed, time);
    ctx.restore();
  }
}

function drawVegFore(offset) {
  if (!ctx || !viewW) return;
  const parallax = 1.45;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  ctx.save();
  ctx.filter = 'blur(3px)';
  for (let i = 0; i < vegFore.length; i++) {
    const n = vegFore[i];
    const sx = n.wx - off;
    const fade = getScreenEdgeAlpha(sx, 140, 220);
    if (fade <= 0.005) continue;
    const gy = getGround(n.wx) + viewH * 0.06;
    const sz = n.size * vegGlobalScale * 1.15;
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * fade;
    if (n.type === 'cypress') drawCypressNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'pine') drawStonePineNear(n, sx, gy, sz, n.seed, time);
    else drawOliveTreeNear(n, sx, gy, sz, n.seed, time);
    ctx.restore();
  }
  ctx.restore();
}

function drawStarfield(context, offset) {
  if (!context || !canvas) return;
  const ch = viewH;
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
      const screenX = sx + viewW / 2 - STAR_WORLD_WIDTH / 2 + offset * (1 - parallax);
      const screenY = s.y * ch;
      if (screenX < -10 || screenX > viewW + 10) continue;
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
  const cw = viewW;
  const ch = viewH;
  const z = Math.max(0.3, Math.min(1, zoomLevel || 1));
  const expand = 1 / z;
  const ox = cw * 0.5 * (1 - expand);
  const oy = ch * 0.5 * (1 - expand);
  const ew = cw * expand;
  const eh = ch * expand;

  const lowFog = context.createLinearGradient(0, oy + eh * 0.48, 0, oy + eh);
  lowFog.addColorStop(0, 'rgba(3, 5, 8, 0)');
  lowFog.addColorStop(0.35, 'rgba(3, 5, 8, 0.45)');
  lowFog.addColorStop(0.65, 'rgba(3, 5, 8, 0.82)');
  lowFog.addColorStop(1, 'rgba(3, 5, 8, 0.95)');
  context.fillStyle = lowFog;
  context.fillRect(ox, oy + eh * 0.48, ew, eh * 0.52);

  const maskTop = oy + eh * 0.62;
  const maskH = (oy + eh) - maskTop + ch * 0.15;
  context.fillStyle = 'rgba(3, 5, 8, 0.92)';
  context.fillRect(ox - cw * 0.1, maskTop, ew + cw * 0.2, maskH);
}

function getZoomDrawRange() {
  const z = zoomLevel || 1;
  const cw = canvas ? viewW : 0;
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
  context.lineTo(range.max, viewH + 120);
  context.lineTo(range.min, viewH + 120);
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
}

function drawHorizonLights(offset) {
  if (!ctx || !canvas) return;
  const parallaxOffset = offset * 0.40;
  const time = Date.now() * 0.001;
  for (let i = 0; i < horizonLights.length; i++) {
    const l = horizonLights[i];
    const screenX = l.x - parallaxOffset;
    if (screenX < -80 || screenX > viewW + 80) continue;
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
  const lastWorldX = range.max + offset;
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
}

function drawWorldParticles(offset) {
  if (!ctx || !canvas) return;
  const time = Date.now() * 0.001;
  for (let i = 0; i < soundRings.length; i++) {
    const r = soundRings[i];
    const sx = r.wx - offset;
    const sy = r.wy;
    if (sx < -200 || sx > viewW + 200) continue;
    const baseR = 30 + r.t * 90;
    for (let k = 0; k < 3; k++) {
      const rad = baseR + k * 22;
      const a = r.life * (0.14 - k * 0.035);
      if (a <= 0) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 175, 55, ' + a + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, -Math.PI * 0.95, -Math.PI * 0.05);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < resonanceParticles.length; i++) {
    const p = resonanceParticles[i];
    const sx = p.wx - offset;
    const sy = p.wy;
    if (sx < -20 || sx > viewW + 20) continue;
    const twinkle = 0.72 + Math.sin(time * (p.twinkleSpeed || 5) + (p.seed || 0)) * 0.28;
    const r = p.r0 * (0.85 + (1 - p.life) * 1.2) * twinkle;
    const alpha = Math.max(0, p.life) * (p.golden ? 0.58 : 0.34) * twinkle;
    const [cr, cg, cb] = p.golden ? [255, 230, 165] : [220, 220, 235];
    const [gr, gg, gb] = p.golden ? [212, 175, 55] : [180, 180, 200];

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
  }
}

function drawAudioOrbs(offset) {
  if (!ctx || !canvas) return;
  audioOrbs.forEach(orb => {
    if (orb.collected) return;
    const screenX = orb.x - offset;
    if (screenX < -150 || screenX > viewW + 150) return;
    const groundY = getGround(orb.x);
    const orbY = groundY - 55;
    const time = Date.now() * 0.001;
    const baseRadius = 25;
    const floatBob = Math.sin(time * 1.6 + orb.x * 0.001) * 6;
    const radius = baseRadius;
    const y = orbY + floatBob;

    const bigGlow = ctx.createRadialGradient(screenX, y, 0, screenX, y, radius * 3.5);
    bigGlow.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
    bigGlow.addColorStop(0.5, 'rgba(185, 145, 45, 0.08)');
    bigGlow.addColorStop(1, 'rgba(80, 55, 10, 0)');
    ctx.save();
    ctx.fillStyle = bigGlow;
    ctx.beginPath();
    ctx.arc(screenX, y, radius * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const orbGradient = ctx.createRadialGradient(screenX - radius * 0.28, y - radius * 0.34, radius * 0.05, screenX, y, radius);
    orbGradient.addColorStop(0, 'rgba(252, 238, 190, 0.92)');
    orbGradient.addColorStop(0.5, 'rgba(202, 168, 76, 0.72)');
    orbGradient.addColorStop(1, 'rgba(112, 84, 28, 0.38)');
    ctx.save();
    ctx.fillStyle = orbGradient;
    ctx.beginPath();
    ctx.arc(screenX, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

const sectionRevealed = new Set();
function revealSectionContent(sectionEl) {
  if (typeof gsap === 'undefined' || !sectionEl) return;
  const isStory = sectionEl.id === 's2';
  const isManifesto = sectionEl.id === 's3';

  const hairline = sectionEl.querySelector('.hairline');
  const heading = sectionEl.querySelector('h1, h2');
  const eyebrow = sectionEl.querySelector('.eyebrow');
  const lead = sectionEl.querySelector('.lead');
  const storyEntries = sectionEl.querySelectorAll('.story-entry');
  const paragraphs = sectionEl.querySelectorAll('p:not(.lead):not(.story-era)');
  const partnerCards = sectionEl.querySelectorAll('.partner-card');
  const musicPlayerEl = sectionEl.querySelector('.music-player');
  const contactIcons = sectionEl.querySelectorAll('.contact-icon');

  const all = [hairline, heading, eyebrow, lead, ...storyEntries, ...paragraphs, ...partnerCards, musicPlayerEl, ...contactIcons].filter(Boolean);
  if (!all.length) return;
  gsap.killTweensOf(all);

  const tl = gsap.timeline();

  // 1. Eyebrow tracking reveal
  if (eyebrow) {
    tl.fromTo(eyebrow,
      { opacity: 0, y: -8, letterSpacing: '0.08em' },
      { opacity: 0.85, y: 0, letterSpacing: '0.01em', duration: 0.6, ease: 'power2.out' },
      0
    );
  }

  // 2. Glowing expanding hairline
  if (hairline) {
    tl.fromTo(hairline,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 0.7, duration: 0.65, ease: 'power3.out' },
      0.06
    );
  }

  // 3. Cinematic heading unmasking
  if (heading) {
    tl.fromTo(heading,
      { clipPath: 'inset(0 0 100% 0)', y: 22, opacity: 0 },
      { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1, duration: 0.95, ease: 'expo.out' },
      0.1
    );
  }

  // 4. Custom Cinematic Story Section Animation (Section 2)
  if (isStory && storyEntries.length) {
    gsap.set(storyEntries, { transformPerspective: 1000 });
    tl.fromTo(storyEntries,
      { opacity: 0, x: -32, y: 20, rotateX: -14 },
      { opacity: 1, x: 0, y: 0, rotateX: 0, duration: 0.88, ease: 'power3.out', stagger: 0.16 },
      0.24
    );
  }

  // 5. Custom Cinematic Manifesto Section Animation (Section 3)
  if (isManifesto) {
    if (lead) {
      tl.fromTo(lead,
        { opacity: 0, y: 18, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.82, ease: 'power3.out' },
        0.22
      );
    }
    if (paragraphs.length) {
      tl.fromTo(paragraphs,
        { opacity: 0, x: -22, y: 15, filter: 'blur(3px)' },
        { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', duration: 0.78, ease: 'power3.out', stagger: 0.12 },
        0.34
      );
    }
  }

  // 6. Generic sections fallback & special cards
  if (!isStory && !isManifesto) {
    if (lead) {
      tl.fromTo(lead,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' },
        0.2
      );
    }
    if (paragraphs.length) {
      tl.fromTo(paragraphs,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06 },
        0.28
      );
    }
  }

  if (partnerCards.length) {
    gsap.set(partnerCards, { transformPerspective: 900 });
    tl.fromTo(partnerCards,
      { opacity: 0, y: 70, rotationX: -75, transformOrigin: '50% 100%' },
      { opacity: 1, y: 0, rotationX: 0, duration: 1, ease: 'power4.out', stagger: 0.22 },
      0.3
    );
  }

  if (musicPlayerEl) {
    tl.fromTo(musicPlayerEl,
      { opacity: 0, y: 28, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'power3.out' },
      0.3
    );
  }
}

function updateSections() {
  if (!canvas) return;
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
    const verticalOffset = (viewH * 0.5 - terrainY) * 0.3;
    const revealRange = (index === 6 || index === 7) ? 900 : 800;
    if (Math.abs(distance) < revealRange) {
      sectionEl.classList.add('visible');
      const t = Math.max(0, 1 - (Math.abs(distance) / revealRange));
      const smoothFactor = t * t * (3 - 2 * t);
      let opacity = smoothFactor;
      if (index === 6 && x > CONTACT_X && endOfRoadState.fading) {
        opacity *= endOfRoadState.fade;
      }
      sectionEl.style.opacity = opacity;
      const scale = 0.95 + 0.05 * smoothFactor;
      sectionEl.style.transform = 'translate(calc(-50% + ' + parallaxX + 'px), calc(-50% + ' + verticalOffset + 'px)) scale(' + scale + ')';
      if (!sectionRevealed.has(index)) {
        sectionRevealed.add(index);
        revealSectionContent(sectionEl);
      }
      if (index === 6 && !contactIconsAnimated) {
        document.querySelectorAll('.contact-icon').forEach(el => el.classList.add('visible'));
        contactIconsAnimated = true;
      }
    } else {
      sectionEl.classList.remove('visible');
      sectionEl.style.opacity = 0;
      sectionEl.style.transform = 'translate(calc(-50% + ' + parallaxX + 'px), calc(-50% + ' + verticalOffset + 'px)) scale(0.95)';
      if (Math.abs(distance) > 1500) sectionRevealed.delete(index);
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
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      currentAudio = audio;
      fadeInAudio(audio);
    }).catch(() => {});
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

function updateCamera(dt) {
  if (!canvas) return;
  const ch = viewH;
  const ballScreenY = y - cameraY;
  const deadTop = ch * 0.30;
  const deadBot = ch * 0.74;
  const targetLerp = dt ? 1 - Math.pow(0.001, dt) : 0.08;
  let targetY = cameraY;
  if (ballScreenY < deadTop) targetY = y - deadTop;
  else if (ballScreenY > deadBot) targetY = y - deadBot;
  cameraY += (targetY - cameraY) * Math.min(1, targetLerp);

  // Cinematic horizontal camera with velocity lead
  const targetCamX = x - viewW / 2 + Math.max(-140, Math.min(140, vx * 14));
  const horizLerp = dt ? 1 - Math.pow(0.002, dt) : 0.08;
  cameraX += (targetCamX - cameraX) * Math.min(1, horizLerp);
}

function checkResonantStones() {
  for (let i = 0; i < resonantStones.length; i++) {
    const s = resonantStones[i];
    const dist = Math.abs(x - s.x);
    if (dist < ballRadius + 45 && !s.triggered) {
      s.triggered = true;
      ResonanceAudio.playTone(s.noteIdx, 0.65, { duration: 3.2 });
      spawnSoundRing(s.x, getGround(s.x) - 25);
      if (typeof triggerHaptic === 'function') triggerHaptic('medium');
    }
  }
}

function showMemoryShard() {}
function hideMemoryShard() {}

function update(dt) {
  if (endOfRoadState.rabbitHoleShown) return;
  if (typeof videoPlayer !== 'undefined' && videoPlayer.isOpen) {
    updateCamera(dt);
    return;
  }

  const timeScale = dt * 60;

  // Dash mechanic update
  if (dashActive) {
    dashTimeRemaining -= dt;
    if (dashTimeRemaining <= 0) {
      dashActive = false;
    }
  }
  if (dashCooldown > 0) {
    dashCooldown -= dt;
  }

  // Trigger dash
  if ((keys['shift'] || keys['dash']) && dashCooldown <= 0 && gameStarted) {
    dashActive = true;
    dashTimeRemaining = DASH_DURATION;
    dashCooldown = DASH_COOLDOWN_TIME;
    const dashDir = (keys['a'] || keys['arrowleft']) ? -1 : ((keys['d'] || keys['arrowright']) ? 1 : (Math.sign(vx) || 1));
    vx = dashDir * DASH_SPEED;
    ResonanceAudio.playDash();
    spawnSoundRing(x, y);
    if (typeof triggerHaptic === 'function') triggerHaptic('medium');
  }

  // Horizontal acceleration
  if (keys['a'] || keys['arrowleft']) vx -= moveAccel * timeScale;
  if (keys['d'] || keys['arrowright']) vx += moveAccel * timeScale;

  const currentMaxSpeed = dashActive ? DASH_SPEED : maxSpeed;
  vx = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, vx));
  vx *= Math.pow(onGround ? groundFriction : airResist, timeScale);

  // Gravity
  vy += gravity * timeScale;
  x += vx * timeScale;
  y += vy * timeScale;

  // Angular inertia & authentic rolling traction
  if (onGround) {
    angularVelocity = (vx * timeScale) / ballRadius;
  } else {
    angularVelocity *= 0.992;
  }
  rotation += angularVelocity;

  // Ground collision & tangential slope acceleration
  const ground = getGround(x);
  const prevWasOnGround = onGround;
  const impactVelocity = vy;

  if (y + ballRadius >= ground) {
    y = ground - ballRadius;
    vy = vy > 2 ? -vy * 0.28 : 0;
    onGround = true;

    // Realistic tangential slope acceleration: g * sin(theta)
    const slope = getSlope(x);
    const slopeAngle = Math.atan(slope);
    const tangentialForce = Math.sin(slopeAngle) * gravity * 1.6;
    vx += tangentialForce * timeScale;

    if (slope < -0.35 && onGround && !keys['a'] && !keys['arrowleft']) {
      vx += 0.22 * timeScale;
    }

    // Acoustic and tactile landing response
    if (!prevWasOnGround && impactVelocity > 2.6) {
      ResonanceAudio.playImpact(impactVelocity);
      spawnLandingDust();
      spawnSoundRing(x, ground);
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
    }
  } else {
    onGround = false;
  }

  // Jump mechanic
  if (keys[' '] && onGround) {
    vy = -jumpForce;
    onGround = false;
    ResonanceAudio.playJump();
    spawnSoundRing(x, y);
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
  }

  // Rolling singing-bowl whisper update & ambient biome
  ResonanceAudio.updateRolling(Math.abs(vx), onGround);
  ResonanceAudio.updateAmbientBiome(biomeForWorldX(x));

  updateSections();
  checkAudioOrbCollision();
  checkResonantStones();

  if (x < LEFT_HILL_END_X) { x = LEFT_HILL_END_X; vx = 0; }
  if (x > WORLD_END_X) {
    x = WORLD_END_X;
    if (vx > 0) vx = 0;
  }

  if (x >= END_FADE_START_X && !endOfRoadState.rabbitHoleShown) {
    const linear = Math.min(1, Math.max(0, (x - END_FADE_START_X) / (WORLD_END_X - END_FADE_START_X)));
    const s1 = linear * linear * (3 - 2 * linear);
    const eased = s1 * s1 * (3 - 2 * s1);
    endOfRoadState.fading = true;
    endOfRoadState.fade = 1 - eased;
    const drag = 0.94 - 0.12 * linear;
    if (vx > 0) vx *= Math.pow(Math.max(0.78, drag), Math.max(0.5, dt * 60));
    endOfRoadState.screenFade = Math.max(0, (eased - 0.35) / 0.65);
    if (eased >= 0.85) {
      endOfRoadState.fade = 0;
      openRabbitHoleScreen();
    }
  } else if (!endOfRoadState.rabbitHoleShown) {
    endOfRoadState.fading = false;
    endOfRoadState.fade += (1 - endOfRoadState.fade) * Math.min(1, dt * 3.2);
    endOfRoadState.screenFade = Math.max(0, endOfRoadState.screenFade - dt * 1.6);
  }

  const inLeftSecret = x <= LEFT_REVEAL_X;
  leftSecretState.alpha = inLeftSecret ? Math.min(1, leftSecretState.alpha + dt * 1.8) : Math.max(0, leftSecretState.alpha - dt * 2.2);

  // Dynamic kinetic zoom: opens up slightly when moving fast downhill
  const speedZoom = Math.max(0, Math.min(0.12, (Math.abs(vx) - 8) * 0.015));
  const narrativeZoomTarget = 1 - computeNarrativeZoomFactor() * (1 - NARRATIVE_ZOOM_LEVEL) - speedZoom;
  _zoomTarget = narrativeZoomTarget;
  const zoomLerp = 1 - Math.pow(0.0006, dt);
  zoomLevel += (_zoomTarget - zoomLevel) * zoomLerp;

  updateCamera(dt);
}

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

// ============================================================================
// HANDPAN RENDERING — Authentic Handpan Geometry & Craftsmanship
// Central Ding dome + 8 tuned elliptical Tone Fields in D Kurd harmonic pattern
// Equatorial brass join seam + acoustic vibration pulse
// ============================================================================
function drawBall(screenX, screenY) {
  if (!ctx || !canvas) return;
  const r = ballRadius;

  // 1. Soft depth-adjusted contact shadow on the ground
  if (onGround) {
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const shadowY = getGround(x) + 10;
    const shadowW = r * 1.2;
    const g = ctx.createRadialGradient(screenX, shadowY, 0, screenX, shadowY, shadowW);
    g.addColorStop(0, 'rgba(212, 175, 55, 0.28)');
    g.addColorStop(0.35, 'rgba(120, 85, 25, 0.15)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(screenX, shadowY, shadowW, shadowW * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(rotation);

  // 2. Outer harmonic acoustic aura
  const timeSinceNote = (performance.now() - ResonanceAudio.lastNoteTime) / 1000;
  const notePulse = timeSinceNote < 1.5 ? Math.exp(-timeSinceNote * 2.5) : 0;
  const auraR = r * (1.6 + notePulse * 0.4);

  const aura = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, auraR);
  aura.addColorStop(0, 'rgba(212, 175, 55, ' + (0.16 + notePulse * 0.25) + ')');
  aura.addColorStop(0.65, 'rgba(140, 105, 30, ' + (0.04 + notePulse * 0.1) + ')');
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();

  // 3. Handpan nitrided steel shell (rich ember-gold and raw dark steel)
  const shell = ctx.createRadialGradient(-r * 0.28, -r * 0.38, r * 0.08, 0, 0, r);
  shell.addColorStop(0, 'rgba(252, 236, 185, 0.96)');
  shell.addColorStop(0.24, 'rgba(215, 175, 82, 0.90)');
  shell.addColorStop(0.65, 'rgba(115, 88, 38, 0.85)');
  shell.addColorStop(0.92, 'rgba(42, 32, 16, 0.75)');
  shell.addColorStop(1, 'rgba(18, 14, 8, 0.92)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // 4. Subtle hand-hammered radial steel grain rings
  for (let i = 0; i < BRUSHED_RING_COUNT; i++) {
    const seed = brushedRingSeeds[i];
    const ringR = r * (0.22 + seed.rFrac * 0.72);
    ctx.strokeStyle = seed.tone > 0.5 ? 'rgba(255, 242, 210, 0.06)' : 'rgba(30, 20, 8, 0.07)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, seed.start, seed.start + seed.span);
    ctx.stroke();
  }

  // 5. Eight tuned elliptical Tone Fields around perimeter (D Kurd scale)
  const TONE_FIELD_COUNT = 8;
  const toneFieldDist = r * 0.60;
  for (let k = 0; k < TONE_FIELD_COUNT; k++) {
    const angle = (k * (Math.PI * 2 / TONE_FIELD_COUNT)) - Math.PI / 2;
    const tfX = Math.cos(angle) * toneFieldDist;
    const tfY = Math.sin(angle) * toneFieldDist;

    ctx.save();
    ctx.translate(tfX, tfY);
    ctx.rotate(angle);

    // Tone field depression (elliptical membrane)
    const tfW = r * 0.22;
    const tfH = r * 0.16;
    const tfGrd = ctx.createRadialGradient(-tfW * 0.2, -tfH * 0.2, 1, 0, 0, tfW);
    tfGrd.addColorStop(0, 'rgba(235, 205, 130, 0.55)');
    tfGrd.addColorStop(0.7, 'rgba(90, 68, 25, 0.35)');
    tfGrd.addColorStop(1, 'rgba(40, 28, 10, 0.15)');
    ctx.fillStyle = tfGrd;
    ctx.strokeStyle = 'rgba(255, 230, 160, 0.22)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, tfW, tfH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center tuned dimple of the tone field
    const dimpleR = r * 0.055;
    const dimpleGrd = ctx.createRadialGradient(-dimpleR * 0.3, -dimpleR * 0.3, 0.5, 0, 0, dimpleR);
    dimpleGrd.addColorStop(0, 'rgba(255, 240, 190, 0.75)');
    dimpleGrd.addColorStop(1, 'rgba(70, 50, 18, 0.60)');
    ctx.fillStyle = dimpleGrd;
    ctx.beginPath();
    ctx.arc(0, 0, dimpleR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 6. Central Ding dome (the heart of the handpan)
  const dingR = r * 0.30;
  const dingOff = -r * 0.02;
  const dingOuter = ctx.createRadialGradient(-dingR * 0.25, -dingR * 0.35 + dingOff, dingR * 0.05, 0, dingOff, dingR);
  dingOuter.addColorStop(0, 'rgba(255, 235, 175, 0.92)');
  dingOuter.addColorStop(0.5, 'rgba(195, 150, 60, 0.75)');
  dingOuter.addColorStop(1, 'rgba(80, 55, 20, 0.55)');
  ctx.fillStyle = dingOuter;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingR, 0, Math.PI * 2);
  ctx.fill();

  // Ding center recessed dimple
  const dingDimpleR = dingR * 0.35;
  const dingDimple = ctx.createRadialGradient(dingDimpleR * 0.2, dingDimpleR * 0.2 + dingOff, 0.5, 0, dingOff, dingDimpleR);
  dingDimple.addColorStop(0, 'rgba(50, 35, 12, 0.85)');
  dingDimple.addColorStop(0.8, 'rgba(160, 120, 45, 0.65)');
  dingDimple.addColorStop(1, 'rgba(255, 230, 160, 0.85)');
  ctx.fillStyle = dingDimple;
  ctx.beginPath();
  ctx.arc(0, dingOff, dingDimpleR, 0, Math.PI * 2);
  ctx.fill();

  // 7. Outer equatorial brass weld seam ring
  ctx.strokeStyle = 'rgba(235, 195, 85, 0.55)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawResonantStones(context, offset) {
  if (!context || !canvas) return;
  const time = Date.now() * 0.001;
  for (let i = 0; i < resonantStones.length; i++) {
    const s = resonantStones[i];
    const screenX = s.x - offset;
    const fade = getScreenEdgeAlpha(screenX, 50, 130);
    if (fade <= 0.005) continue;
    const groundY = getGround(s.x);
    const stoneH = 68;
    const stoneW = 24;

    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * fade;
    // Ambient sound aura
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + i);
    const glowR = 48 + pulse * 14;
    const aura = context.createRadialGradient(screenX, groundY - stoneH * 0.55, 0, screenX, groundY - stoneH * 0.55, glowR);
    aura.addColorStop(0, s.triggered ? 'rgba(212, 175, 55, 0.24)' : 'rgba(212, 175, 55, 0.10)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = aura;
    context.beginPath();
    context.arc(screenX, groundY - stoneH * 0.55, glowR, 0, Math.PI * 2);
    context.fill();

    // Standing stone body
    const bodyGrd = context.createLinearGradient(screenX - stoneW / 2, groundY - stoneH, screenX + stoneW / 2, groundY);
    bodyGrd.addColorStop(0, '#384050');
    bodyGrd.addColorStop(0.45, '#202634');
    bodyGrd.addColorStop(1, '#0e121a');
    context.fillStyle = bodyGrd;
    context.strokeStyle = s.triggered ? 'rgba(212, 175, 55, 0.75)' : 'rgba(212, 175, 55, 0.32)';
    context.lineWidth = 1.2;

    context.beginPath();
    context.moveTo(screenX - stoneW * 0.45, groundY);
    context.lineTo(screenX - stoneW * 0.5, groundY - stoneH * 0.82);
    context.lineTo(screenX, groundY - stoneH);
    context.lineTo(screenX + stoneW * 0.5, groundY - stoneH * 0.82);
    context.lineTo(screenX + stoneW * 0.45, groundY);
    context.closePath();
    context.fill();
    context.stroke();

    // Inscribed handpan harmonic circle
    const symbolY = groundY - stoneH * 0.55;
    context.strokeStyle = s.triggered ? 'rgba(255, 235, 170, 0.85)' : 'rgba(212, 175, 55, 0.45)';
    context.lineWidth = 1.0;
    context.beginPath();
    context.arc(screenX, symbolY, 6.5, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = s.triggered ? 'rgba(255, 220, 130, 0.95)' : 'rgba(212, 175, 55, 0.6)';
    context.beginPath();
    context.arc(screenX, symbolY, 2.0, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }
}

function drawChapterLandmarks(context, offset) {
  if (!context || !canvas) return;

  // =========================================================================
  // 1. BERLIN INDUSTRIAL S-BAHN VIADUCT ARCHES & TV TOWER (x = 1000 to 2800)
  // Historic brick arches with fluted stone piers, iron deck, and glowing lanterns
  // =========================================================================

  // A. Distant Berlin TV Tower (Fernsehturm) needle silhouette in twilight haze
  const tvX = 1850 - offset * 0.28;
  const tvFade = getScreenEdgeAlpha(tvX, 60, 160);
  if (tvFade > 0.005) {
    const tvBaseY = getGroundFar(1850) + 15;
    const tvH = 260;

    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * tvFade;
    context.fillStyle = 'rgba(18, 24, 38, 0.45)';
    context.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    context.lineWidth = 0.8;

    // Slender tapered concrete tower shaft
    context.beginPath();
    context.moveTo(tvX - 6, tvBaseY);
    context.lineTo(tvX - 2.5, tvBaseY - tvH * 0.65);
    context.lineTo(tvX + 2.5, tvBaseY - tvH * 0.65);
    context.lineTo(tvX + 6, tvBaseY);
    context.closePath();
    context.fill();

    // Iconic sphere observation deck
    const sphereY = tvBaseY - tvH * 0.72;
    context.beginPath();
    context.arc(tvX, sphereY, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // Equatorial observation gallery ring
    context.beginPath();
    context.ellipse(tvX, sphereY, 17, 3, 0, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    context.stroke();

    // Needle antenna spire
    context.beginPath();
    context.moveTo(tvX, sphereY - 15);
    context.lineTo(tvX, tvBaseY - tvH);
    context.strokeStyle = 'rgba(18, 24, 38, 0.6)';
    context.lineWidth = 1.6;
    context.stroke();

    // Pulsing summit red/gold beacon
    const time = Date.now() * 0.001;
    const beaconPulse = 0.5 + 0.5 * Math.sin(time * 3);
    context.beginPath();
    context.arc(tvX, tvBaseY - tvH - 2, 2.2, 0, Math.PI * 2);
    context.fillStyle = 'rgba(235, 80, 50, ' + (0.5 + beaconPulse * 0.5) + ')';
    context.fill();

    context.restore();
  }

  // B. Berlin S-Bahn brick viaduct arches with hanging gas lanterns
  for (let vx = 1100; vx <= 2600; vx += 320) {
    const screenX = vx - offset * 0.62;
    const archFade = getScreenEdgeAlpha(screenX, 160, 240);
    if (archFade <= 0.005) continue;
    const baseGround = getGroundFar(vx);
    const archH = 120;
    const span = 260;
    const pierW = 34;

    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * archFade;

    // Heavy masonry pier towers (left and right)
    const pierGrd = context.createLinearGradient(screenX - span / 2, baseGround - archH, screenX - span / 2 + pierW, baseGround);
    pierGrd.addColorStop(0, 'rgba(20, 24, 34, 0.92)');
    pierGrd.addColorStop(0.5, 'rgba(14, 18, 26, 0.95)');
    pierGrd.addColorStop(1, 'rgba(9, 12, 18, 0.98)');

    // Left Pier with stone base plinth and impost molding
    context.fillStyle = pierGrd;
    context.fillRect(screenX - span / 2 - pierW / 2, baseGround - archH * 0.75, pierW, archH * 0.75 + 10);
    // Left Impost cap
    context.fillStyle = 'rgba(26, 32, 44, 0.95)';
    context.fillRect(screenX - span / 2 - pierW / 2 - 3, baseGround - archH * 0.75 - 4, pierW + 6, 6);

    // Right Pier
    context.fillStyle = pierGrd;
    context.fillRect(screenX + span / 2 - pierW / 2, baseGround - archH * 0.75, pierW, archH * 0.75 + 10);
    // Right Impost cap
    context.fillStyle = 'rgba(26, 32, 44, 0.95)';
    context.fillRect(screenX + span / 2 - pierW / 2 - 3, baseGround - archH * 0.75 - 4, pierW + 6, 6);

    // Vault Arch span
    const archRadius = (span - pierW) * 0.5;
    const archSpringY = baseGround - archH * 0.75;

    // Recessed arch cavity
    context.beginPath();
    context.arc(screenX, archSpringY, archRadius, Math.PI, 0);
    context.lineTo(screenX + archRadius, baseGround + 10);
    context.lineTo(screenX - archRadius, baseGround + 10);
    context.closePath();
    context.fillStyle = 'rgba(6, 8, 12, 0.94)';
    context.fill();

    // Arch brick voussoir ring
    context.beginPath();
    context.arc(screenX, archSpringY, archRadius, Math.PI, 0);
    context.strokeStyle = 'rgba(28, 35, 50, 0.85)';
    context.lineWidth = 7;
    context.stroke();

    context.beginPath();
    context.arc(screenX, archSpringY, archRadius + 4, Math.PI, 0);
    context.strokeStyle = 'rgba(212, 175, 55, 0.18)';
    context.lineWidth = 1;
    context.stroke();

    // Viaduct upper track deck & spandrel wall
    context.beginPath();
    context.rect(screenX - span / 2 - pierW / 2 - 8, baseGround - archH - 12, span + pierW + 16, archH * 0.25 + 12);
    context.fillStyle = 'rgba(16, 20, 30, 0.95)';
    context.fill();

    // Ornamental corbel frieze
    context.strokeStyle = 'rgba(24, 30, 42, 0.9)';
    context.lineWidth = 2.5;
    context.strokeRect(screenX - span / 2 - pierW / 2 - 8, baseGround - archH - 12, span + pierW + 16, 6);

    // Iron track deck railing with decorative balustrade posts
    const railY = baseGround - archH - 22;
    context.beginPath();
    context.moveTo(screenX - span / 2 - pierW / 2 - 10, railY);
    context.lineTo(screenX + span / 2 + pierW / 2 + 10, railY);
    context.moveTo(screenX - span / 2 - pierW / 2 - 10, railY + 6);
    context.lineTo(screenX + span / 2 + pierW / 2 + 10, railY + 6);
    context.strokeStyle = 'rgba(28, 35, 48, 0.9)';
    context.lineWidth = 1.2;
    context.stroke();

    // Ornate street gas lantern hanging under the arch keystone
    const lampX = screenX;
    const lampY = archSpringY - archRadius + 22;

    // Hanging chain
    context.beginPath();
    context.moveTo(lampX, archSpringY - archRadius);
    context.lineTo(lampX, lampY);
    context.strokeStyle = 'rgba(180, 150, 60, 0.4)';
    context.lineWidth = 1;
    context.stroke();

    // Cast-iron lantern housing
    context.fillStyle = 'rgba(15, 18, 25, 0.98)';
    context.fillRect(lampX - 4.5, lampY, 9, 13);
    context.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    context.lineWidth = 0.8;
    context.strokeRect(lampX - 4.5, lampY, 9, 13);

    // Glowing warm amber lamp core
    const time = Date.now() * 0.001;
    const flicker = 0.92 + 0.08 * Math.sin(time * 7 + vx);
    context.beginPath();
    context.arc(lampX, lampY + 6.5, 3.2, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 235, 175, ' + (0.85 * flicker) + ')';
    context.fill();

    // Soft ambient golden light pool casting downward on the ground
    const lightCone = context.createRadialGradient(lampX, lampY + 7, 3, lampX, baseGround, 95);
    lightCone.addColorStop(0, 'rgba(240, 200, 95, ' + (0.24 * flicker) + ')');
    lightCone.addColorStop(0.4, 'rgba(180, 135, 45, ' + (0.08 * flicker) + ')');
    lightCone.addColorStop(1, 'rgba(212, 175, 55, 0)');
    context.fillStyle = lightCone;
    context.beginPath();
    context.moveTo(lampX - 5, lampY + 12);
    context.lineTo(lampX + 5, lampY + 12);
    context.lineTo(lampX + 75, baseGround);
    context.lineTo(lampX - 75, baseGround);
    context.closePath();
    context.fill();

    context.restore();
  }

  // =========================================================================
  // 2. ANCIENT ACOUSTIC AMPHITHEATER / ODEON HEMICYCLE (x = 5800 to 6800)
  // Stepped semicircular marble tiers cut into hillside, acoustic sounding altar
  // =========================================================================
  const odeonX = 6400 - offset * 0.70;
  const odeonFade = getScreenEdgeAlpha(odeonX, 140, 220);
  if (odeonFade > 0.005) {
    const odeonGround = getGroundMid(6400);
    const tierCount = 7;
    const tierWMax = 220;

    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * odeonFade;

    // Stepped semicircular marble cavea tiers carved into hillside
    for (let t = tierCount; t >= 1; t--) {
      const frac = t / tierCount;
      const tw = tierWMax * frac;
      const ty = odeonGround - (tierCount - t) * 7 - 12;

      context.beginPath();
      context.ellipse(odeonX, ty, tw * 0.5, tw * 0.16, 0, Math.PI * 0.95, Math.PI * 2.05);
      context.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      context.lineWidth = 1.2;
      context.stroke();

      context.fillStyle = 'rgba(22, 20, 26, 0.95)';
      context.fill();

      // Individual stone block radial joint incisions
      for (let s = -4; s <= 4; s++) {
        const sa = Math.PI * 1.5 + (s / 5) * Math.PI * 0.45;
        const jx = odeonX + Math.cos(sa) * tw * 0.5;
        const jy = ty + Math.sin(sa) * tw * 0.16;
        context.beginPath();
        context.moveTo(jx, jy);
        context.lineTo(jx, jy + 6);
        context.strokeStyle = 'rgba(12, 10, 15, 0.9)';
        context.lineWidth = 1;
        context.stroke();
      }
    }

    // Circular marble orchestra stage
    const orchY = odeonGround - 4;
    context.beginPath();
    context.ellipse(odeonX, orchY, 32, 10, 0, 0, Math.PI * 2);
    context.fillStyle = 'rgba(28, 25, 32, 0.98)';
    context.fill();
    context.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    context.lineWidth = 1.0;
    context.stroke();

    // Central acoustic bronze sounding altar / pedestal
    context.fillStyle = 'rgba(34, 30, 38, 0.98)';
    context.fillRect(odeonX - 7, orchY - 14, 14, 14);
    context.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    context.strokeRect(odeonX - 7, orchY - 14, 14, 14);

    // Resonating bronze bowl on pedestal (symbol of handpan acoustics)
    context.beginPath();
    context.arc(odeonX, orchY - 16, 8, 0, Math.PI);
    context.fillStyle = 'rgba(212, 175, 55, 0.75)';
    context.fill();

    const time = Date.now() * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
    context.beginPath();
    context.arc(odeonX, orchY - 16, 14 + pulse * 6, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(212, 175, 55, ' + (0.15 + pulse * 0.2) + ')';
    context.lineWidth = 0.8;
    context.stroke();

    context.restore();
  }

  // =========================================================================
  // 3. ATHENIAN ACROPOLIS & CLASSICAL DORIC SANCTUARY RUINS (x = 7400 to 9900)
  // Stepped marble stylobate, fluted Doric columns, entablature & weathered blocks
  // =========================================================================

  // A. Distant Acropolis Hilltop Parthenon Colonnade on the horizon
  const acropolisX = 8900 - offset * 0.45;
  const acroFade = getScreenEdgeAlpha(acropolisX, 120, 200);
  if (acroFade > 0.005) {
    const acroY = getGroundFar(8900) - 25;
    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * acroFade;
    context.fillStyle = 'rgba(16, 20, 30, 0.75)';
    context.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    context.lineWidth = 0.8;

    // Rocky Acropolis crag base
    context.beginPath();
    context.moveTo(acropolisX - 80, acroY + 30);
    context.lineTo(acropolisX - 65, acroY + 8);
    context.lineTo(acropolisX + 75, acroY + 8);
    context.lineTo(acropolisX + 90, acroY + 30);
    context.closePath();
    context.fill();

    // Stepped temple platform
    context.fillRect(acropolisX - 60, acroY + 2, 120, 6);

    // Colonnade silhouette (8 classical peristyle columns)
    for (let c = 0; c < 8; c++) {
      const colX = acropolisX - 50 + c * 14.5;
      context.fillRect(colX, acroY - 18, 3.8, 20);
    }
    // Entablature & pediment roof
    context.fillRect(acropolisX - 56, acroY - 23, 112, 5);
    context.beginPath();
    context.moveTo(acropolisX - 56, acroY - 23);
    context.lineTo(acropolisX, acroY - 33);
    context.lineTo(acropolisX + 56, acroY - 23);
    context.closePath();
    context.fill();
    context.stroke();

    context.restore();
  }

  // B. Forefront Classical Doric Temple Colonnade & Fallen Weathered Drums
  const templeSites = [
    { x: 7650, columns: 3, entablature: true, fallen: true },
    { x: 8400, columns: 4, entablature: true, fallen: false },
    { x: 9200, columns: 3, entablature: false, fallen: true },
    { x: 9750, columns: 4, entablature: true, fallen: true }
  ];

  for (let s = 0; s < templeSites.length; s++) {
    const site = templeSites[s];
    const screenX = site.x - offset * 0.72;
    const siteFade = getScreenEdgeAlpha(screenX, 140, 220);
    if (siteFade <= 0.005) continue;
    const baseGround = getGroundMid(site.x);

    context.save();
    context.globalAlpha = (context.globalAlpha || 1.0) * siteFade;

    // 1. Stepped marble crepidoma / stylobate platform
    const platW = site.columns * 42 + 40;
    const stylobateY = baseGround - 8;
    context.fillStyle = 'rgba(24, 22, 26, 0.96)';
    context.fillRect(screenX - platW / 2, baseGround - 4, platW, 8);
    context.fillRect(screenX - platW / 2 + 6, baseGround - 8, platW - 12, 5);
    context.strokeStyle = 'rgba(212, 175, 55, 0.18)';
    context.lineWidth = 0.8;
    context.strokeRect(screenX - platW / 2 + 6, baseGround - 8, platW - 12, 5);

    const colH = 92;
    const colSpacing = 42;
    const colBaseW = 16;
    const colTopW = 12.5;

    // 2. Doric fluted columns with entasis and sculptural capitals
    for (let c = 0; c < site.columns; c++) {
      const cx = screenX - ((site.columns - 1) * colSpacing) / 2 + c * colSpacing;
      const cy = stylobateY;

      // Column shaft with gentle convex entasis taper
      context.beginPath();
      context.moveTo(cx - colBaseW / 2, cy);
      context.quadraticCurveTo(cx - colBaseW * 0.52, cy - colH * 0.45, cx - colTopW / 2, cy - colH);
      context.lineTo(cx + colTopW / 2, cy - colH);
      context.quadraticCurveTo(cx + colBaseW * 0.52, cy - colH * 0.45, cx + colBaseW / 2, cy);
      context.closePath();
      context.fillStyle = 'rgba(22, 20, 24, 0.98)';
      context.fill();

      // Fluting channel shadow incisions
      context.strokeStyle = 'rgba(12, 10, 14, 0.95)';
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(cx - colBaseW * 0.22, cy);
      context.lineTo(cx - colTopW * 0.22, cy - colH);
      context.moveTo(cx, cy);
      context.lineTo(cx, cy - colH);
      context.moveTo(cx + colBaseW * 0.22, cy);
      context.lineTo(cx + colTopW * 0.22, cy - colH);
      context.stroke();

      // Warm golden edge reflection
      context.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(cx + colBaseW / 2, cy);
      context.quadraticCurveTo(cx + colBaseW * 0.52, cy - colH * 0.45, cx + colTopW / 2, cy - colH);
      context.stroke();

      // Doric Capital: Echinus (flaring circular cushion) & Abacus (flat square slab)
      const capY = cy - colH;
      // Echinus
      context.beginPath();
      context.moveTo(cx - colTopW / 2 - 1, capY);
      context.lineTo(cx - colTopW * 0.85, capY - 5);
      context.lineTo(cx + colTopW * 0.85, capY - 5);
      context.lineTo(cx + colTopW / 2 + 1, capY);
      context.closePath();
      context.fillStyle = 'rgba(28, 25, 30, 0.98)';
      context.fill();
      context.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      context.stroke();

      // Abacus slab
      context.fillStyle = 'rgba(32, 28, 34, 0.98)';
      context.fillRect(cx - colTopW - 1, capY - 10, (colTopW + 1) * 2, 5);
      context.strokeRect(cx - colTopW - 1, capY - 10, (colTopW + 1) * 2, 5);
    }

    // 3. Spanning Architrave & Weathered Entablature Beams
    if (site.entablature) {
      const entabStartX = screenX - ((site.columns - 1) * colSpacing) / 2 - colTopW - 4;
      const entabW = (site.columns - 1) * colSpacing + (colTopW + 4) * 2;
      const entabY = stylobateY - colH - 24;

      context.fillStyle = 'rgba(24, 21, 26, 0.98)';
      context.fillRect(entabStartX, entabY, entabW, 14);

      // Triglyph / metope frieze carvings
      context.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      context.lineWidth = 0.9;
      context.strokeRect(entabStartX, entabY, entabW, 14);

      // Fractured broken edge where stone collapsed over antiquity
      context.beginPath();
      context.moveTo(entabStartX + entabW, entabY);
      context.lineTo(entabStartX + entabW + 6, entabY + 4);
      context.lineTo(entabStartX + entabW - 2, entabY + 10);
      context.lineTo(entabStartX + entabW + 4, entabY + 14);
      context.strokeStyle = 'rgba(10, 8, 12, 0.95)';
      context.lineWidth = 1.2;
      context.stroke();
    }

    // 4. Fallen column drums & weathered stone slabs lying in wild grasses
    if (site.fallen) {
      const fallenX = screenX + platW / 2 + 18;
      const fallenY = baseGround - 2;

      // Fallen fluted drum
      context.save();
      context.translate(fallenX, fallenY);
      context.rotate(0.24);
      context.fillStyle = 'rgba(22, 19, 24, 0.98)';
      context.fillRect(-12, -8, 24, 16);
      context.strokeStyle = 'rgba(212, 175, 55, 0.24)';
      context.lineWidth = 0.8;
      context.strokeRect(-12, -8, 24, 16);

      // Fluting lines on drum
      context.beginPath();
      context.moveTo(-12, -2); context.lineTo(12, -2);
      context.moveTo(-12, 3); context.lineTo(12, 3);
      context.strokeStyle = 'rgba(10, 8, 12, 0.95)';
      context.stroke();
      context.restore();

      // Climbing ivy tendril
      context.beginPath();
      context.moveTo(fallenX - 8, baseGround);
      context.quadraticCurveTo(fallenX, fallenY - 12, fallenX + 14, fallenY - 6);
      context.strokeStyle = 'rgba(212, 175, 55, 0.35)';
      context.lineWidth = 0.8;
      context.stroke();
    }

    context.restore();
  }
}

function draw(offset) {
  if (!ctx || !canvas) return;
  ctx.save();
  ctx.fillStyle = '#030508';
  ctx.fillRect(0, 0, viewW, viewH);
  const zoom = zoomLevel || 1;
  if (zoom !== 1) {
    const zcx = viewW / 2;
    const zcy = viewH * 0.44;
    ctx.translate(zcx, zcy);
    ctx.scale(zoom, zoom);
    ctx.translate(-zcx, -zcy);
  }
  drawGiantBackgroundFlowerOfLife(ctx);
  drawStarfield(ctx, offset);
  drawBackgroundGalleryImages(ctx, offset);
  drawAtmosphereBands(ctx);
  if (Math.abs(cameraY) > 0.01) ctx.translate(0, -cameraY);

  drawHillsFar(offset);
  drawChapterLandmarks(ctx, offset);
  drawVegFar(offset);
  drawHorizonLights(offset);
  drawHillsMid(offset);
  drawVegMid(offset);
  drawGround(offset);
  drawResonantStones(ctx, offset);
  drawVegNear(offset);
  drawWorldParticles(offset);
  drawAudioOrbs(offset);

  const edgeFade = leftSecretState.alpha;
  if (edgeFade < 0.99 && endOfRoadState.fade > 0.01) {
    ctx.save();
    ctx.globalAlpha = (1 - edgeFade) * endOfRoadState.fade;
    // Calculate accurate screen position based on camera offset
    const ballScreenX = x - offset;
    drawBall(ballScreenX, y);
    ctx.restore();
  }
  drawVegFore(offset);
  ctx.restore();

  if (endOfRoadState.screenFade > 0.01 && !endOfRoadState.rabbitHoleShown) {
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = 'rgba(5, 5, 5, ' + (endOfRoadState.screenFade * 0.92) + ')';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateBackgroundSlideshow(dt);
  update(dt);
  updateWorldParticles(dt);
  if (canvas) draw(cameraX);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Navigation links
let dockedSectionIndex = -1;
let dockedReleaseTime = 0;

function navigateToSection(index) {
  if (index === undefined || !sectionPositions[index]) return;
  if (typeof startGame === "function") startGame();
  if (typeof endOfRoadState !== "undefined" && endOfRoadState.rabbitHoleShown) {
    if (typeof closeRabbitHoleScreen === "function") closeRabbitHoleScreen(sectionPositions[index].x);
  }
  const target = sectionPositions[index];
  x = target.x;
  vx = 0;
  vy = 0;
  y = getGround(x) - ballRadius;
  onGround = true;
  cameraX = x - viewW / 2;
  const terrainY = getGround(target.x);
  cameraY = (terrainY - viewH * 0.5) * 0.3;
  dockedSectionIndex = index;
  dockedReleaseTime = Date.now() + 3000;
  updateSections();
  const secEl = document.getElementById("s" + index);
  if (secEl) {
    secEl.classList.add("visible");
    secEl.style.opacity = 1;
    secEl.style.pointerEvents = "auto";
    revealSectionContent(secEl);
  }
}

const navLinkSectionIndex = {
  '#home': 0,
  '#about': 1,
  '#story': 2,
  '#manifesto': 3,
  '#album': 4,
  '#partners': 5,
  '#contact': 6,
  '#rabbit-hole': 7,
  '#archive': 7
};

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const hash = link.getAttribute('href');
    const navLinksEl = document.getElementById('navLinks');
    const hamburgerEl = document.getElementById('hamburger');
    if (navLinksEl) navLinksEl.classList.remove('active');
    if (hamburgerEl) hamburgerEl.classList.remove('active');
    if (hash === '#rabbit-hole' || hash === '#archive') {
      openRabbitHoleScreen();
      return;
    }
    const index = navLinkSectionIndex[hash];
    if (index !== undefined) {
      navigateToSection(index);
    }
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

// QR Tip Popup
const qrPopupEl = document.getElementById('qrPopup');
const qrCloseBtn = document.getElementById('qrCloseBtn');
if (qrCloseBtn && qrPopupEl) {
  qrCloseBtn.addEventListener('click', () => { qrPopupEl.classList.remove('visible'); });
}
if (qrPopupEl) {
  qrPopupEl.addEventListener('click', (e) => {
    if (e.target === qrPopupEl) qrPopupEl.classList.remove('visible');
  });
}

const tipButtonEl = document.getElementById('tipButton');
const tipButtonMobileEl = document.getElementById('tipButtonMobile');
function addTipButtonListener(button) {
  if (button && qrPopupEl) {
    button.addEventListener('click', () => { qrPopupEl.classList.add('visible'); });
  }
}
addTipButtonListener(tipButtonEl);
addTipButtonListener(tipButtonMobileEl);

// Video Modal
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
  isOpen: false
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
  if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);
  if (backdrop) backdrop.addEventListener('click', closeVideoModal);
}

function closeVideoModal() {
  if (!videoPlayer.modal) return;
  videoPlayer.modal.classList.remove('visible');
  videoPlayer.modal.setAttribute('aria-hidden', 'true');
  videoPlayer.isOpen = false;
  if (videoPlayer.video) {
    videoPlayer.video.pause();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVideoPlayer);
} else {
  initVideoPlayer();
}

// ============================================================================
// UNIFIED INPUT MODALITY & DEVICE SYSTEM
// Event-driven system: adds 'is-mobile-device' if navigator.maxTouchPoints > 0
// removes cursor and keyboard-prompts on mobile; hides touch buttons on fine-pointer
// ============================================================================
const UnifiedModalitySystem = {
  isMobile: false,

  init() {
    this.bindEvents();
    this.evaluateModality('load');
  },

  getCursorEl() {
    return document.getElementById('cursor');
  },

  getKeyboardPrompts() {
    return document.querySelectorAll('.keyboard-prompt-overlay, .desktop-ctrl-hint');
  },

  getTouchControls() {
    return document.querySelectorAll('.touch-specific-button, .touch-specific-control, .touch-controls, .touch-zones, .touch-arrow, .touch-action-btn, .tip-button-mobile, .mobile-ctrl-hint');
  },

  activateMobileMode() {
    this.isMobile = true;
    document.body.classList.add('is-mobile-device');
    document.body.classList.remove('is-desktop-device');

    // 1. Remove desktop-specific UI elements: cursor & keyboard-prompt overlays
    const cursor = this.getCursorEl();
    if (cursor) {
      cursor.style.display = 'none';
      cursor.style.opacity = '0';
      cursor.setAttribute('aria-hidden', 'true');
    }
    this.getKeyboardPrompts().forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });

    // 2. Display touch-specific buttons and mobile hints
    this.getTouchControls().forEach((el) => {
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    });
  },

  activateDesktopMode() {
    // Never force desktop mode on mobile screen sizes or touch devices
    if (window.innerWidth <= 900 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)) {
      this.activateMobileMode();
      return;
    }

    this.isMobile = false;
    document.body.classList.remove('is-mobile-device');
    document.body.classList.add('is-desktop-device');

    // 1. Hide touch-specific buttons when a fine-pointer device is detected on desktop
    this.getTouchControls().forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });

    // 2. Restore desktop-specific UI elements: cursor & keyboard-prompt overlays
    const cursor = this.getCursorEl();
    if (cursor) {
      cursor.style.removeProperty('display');
      cursor.removeAttribute('aria-hidden');
    }
    this.getKeyboardPrompts().forEach((el) => {
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    });
  },

  evaluateModality(triggerSource) {
    const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 900;
    const hasTouchEvents = ('ontouchstart' in window);

    // On mobile devices, small screens, or touch devices, ALWAYS activate mobile mode
    if (hasTouchPoints || isSmallScreen || hasTouchEvents) {
      this.activateMobileMode();
    } else {
      this.activateDesktopMode();
    }
  },

  bindEvents() {
    // Listen for fine-pointer media query changes
    if (window.matchMedia) {
      const finePointerQuery = window.matchMedia('(pointer: fine)');
      const handlePointerQueryChange = (e) => {
        if (e.matches && window.innerWidth > 900 && (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0)) {
          this.activateDesktopMode();
        } else {
          this.activateMobileMode();
        }
      };
      if (finePointerQuery.addEventListener) {
        finePointerQuery.addEventListener('change', handlePointerQueryChange);
      } else if (finePointerQuery.addListener) {
        finePointerQuery.addListener(handlePointerQueryChange);
      }
    }

    // Pointer events: Detect fine pointer vs touch in real time
    const onPointerActivity = (e) => {
      if (e.pointerType === 'touch') {
        this.activateMobileMode();
      } else if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && window.innerWidth > 900 && (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0)) {
        this.activateDesktopMode();
      }
    };
    window.addEventListener('pointerdown', onPointerActivity, { passive: true });
    window.addEventListener('pointermove', onPointerActivity, { passive: true });

    // Touch event listener: always activates mobile mode
    window.addEventListener('touchstart', () => {
      this.activateMobileMode();
    }, { passive: true });

    // Viewport resize and orientation changes
    window.addEventListener('resize', () => {
      this.evaluateModality('resize');
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
      this.evaluateModality('orientationchange');
    }, { passive: true });
  }
};

// Initialize immediately on script execution, DOMContentLoaded, and window load
UnifiedModalitySystem.init();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UnifiedModalitySystem.evaluateModality('DOMContentLoaded'));
}
window.addEventListener('load', () => UnifiedModalitySystem.evaluateModality('load'));

function isTouchCapableDevice() {
  return true; // Never block touch inputs
}

// Touch UI elements
const touchZonesEl = document.getElementById('touchZones');
const touchLeftEl = document.getElementById('touchLeft');
const touchRightEl = document.getElementById('touchRight');
const touchArrowLeftEl = document.getElementById('touchArrowLeft') || document.querySelector('.touch-arrow.left');
const touchArrowRightEl = document.getElementById('touchArrowRight') || document.querySelector('.touch-arrow.right');
const touchDashBtn = document.getElementById('touchDash');

// ============================================================================
// MULTI-TOUCH MOVEMENT & CONTROL ENGINE
// Robust tracking for touch movement, button holds, and canvas steering
// ============================================================================
const activeTouchAssignments = new Map();

function updateMovementKeys() {
  let hasLeft = false;
  let hasRight = false;
  let hasJump = false;
  let hasDash = false;

  for (const action of activeTouchAssignments.values()) {
    if (action === 'a') hasLeft = true;
    if (action === 'd') hasRight = true;
    if (action === ' ') hasJump = true;
    if (action === 'dash') hasDash = true;
  }

  // Update physics keys map
  keys['a'] = hasLeft;
  keys['arrowleft'] = hasLeft;
  keys['d'] = hasRight;
  keys['arrowright'] = hasRight;
  keys[' '] = hasJump;
  keys['dash'] = hasDash;

  // Visual active state for arrows and buttons
  if (touchLeftEl) touchLeftEl.classList.toggle('active', hasLeft);
  if (touchArrowLeftEl) touchArrowLeftEl.classList.toggle('active', hasLeft);
  if (touchRightEl) touchRightEl.classList.toggle('active', hasRight);
  if (touchArrowRightEl) touchArrowRightEl.classList.toggle('active', hasRight);
  if (touchDashBtn) touchDashBtn.classList.toggle('active', hasDash);
}

function bindTouchButton(element, actionKey) {
  if (!element) return;

  const handleStart = (e) => {
    if (e.cancelable) e.preventDefault();
    if (typeof ResonanceAudio !== 'undefined') ResonanceAudio.resume();
    UnifiedModalitySystem.activateMobileMode();

    if (e.changedTouches) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        activeTouchAssignments.set('btn_' + e.changedTouches[i].identifier, actionKey);
      }
    } else {
      activeTouchAssignments.set('btn_' + actionKey, actionKey);
    }

    updateMovementKeys();
    if (actionKey === ' ') executeMobileJump();
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
  };

  const handleEnd = (e) => {
    if (e.cancelable) e.preventDefault();

    if (e.changedTouches) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        activeTouchAssignments.delete('btn_' + e.changedTouches[i].identifier);
      }
    } else {
      activeTouchAssignments.delete('btn_' + actionKey);
    }

    updateMovementKeys();
  };

  // Primary: Native touch events (prevents scroll/cancellation)
  element.addEventListener('touchstart', handleStart, { passive: false });
  element.addEventListener('touchend', handleEnd, { passive: false });
  element.addEventListener('touchcancel', handleEnd, { passive: false });

  // Fallback: Pointer events with capture
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !document.body.classList.contains('is-mobile-device')) return;
    if (e.setPointerCapture) {
      try { element.setPointerCapture(e.pointerId); } catch (_) {}
    }
    activeTouchAssignments.set('ptr_' + e.pointerId, actionKey);
    updateMovementKeys();
    if (actionKey === ' ') executeMobileJump();
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
  });

  const onPointerRelease = (e) => {
    if (e.releasePointerCapture) {
      try { element.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    activeTouchAssignments.delete('ptr_' + e.pointerId);
    updateMovementKeys();
  };

  element.addEventListener('pointerup', onPointerRelease);
  element.addEventListener('pointercancel', onPointerRelease);
}

// Bind explicit touch buttons
bindTouchButton(touchArrowLeftEl, 'a');
bindTouchButton(touchArrowRightEl, 'd');
bindTouchButton(touchDashBtn, 'dash');

// ============================================================================
// TOUCH ZONES & FULL-SCREEN TOUCH STEERING
// Touching left half of screen rolls left, touching right half rolls right
// ============================================================================
function handleZoneTouchStart(e) {
  if (!gameStarted || (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown)) return;

  const target = e.target;
  // Ignore taps on interactive UI dialogs, modal buttons, sections, cards, and music player
  if (target && target.closest('button, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .music-player, .mp-track, .mp-now, .mp-btn, #welcome, .section, .partner-card, .promo-card, .promo-copy-btn, .touch-controls')) {
    return;
  }
  const activeSec = document.querySelector('.section.visible');
  if (activeSec) {
    const sRect = activeSec.getBoundingClientRect();
    const touchPt = (e.touches && e.touches[0]) || e;
    if (touchPt.clientX >= sRect.left && touchPt.clientX <= sRect.right && touchPt.clientY >= sRect.top && touchPt.clientY <= sRect.bottom) {
      return; // Do not steer while user interacts with visible section
    }
  }

  UnifiedModalitySystem.activateMobileMode();
  if (typeof ResonanceAudio !== 'undefined') ResonanceAudio.resume();

  if (e.cancelable) e.preventDefault();

  const touches = e.changedTouches ? e.changedTouches : [e];
  const halfWidth = window.innerWidth / 2;

  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const id = t.identifier !== undefined ? t.identifier : ('zone_' + (e.pointerId || 0));
    const action = t.clientX < halfWidth ? 'a' : 'd';
    activeTouchAssignments.set(id, action);
  }

  updateMovementKeys();
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
}

function handleZoneTouchMove(e) {
  if (!gameStarted || (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown)) return;

  const target = e.target;
  if (target && target.closest('button, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .music-player, .mp-track, .mp-now, .mp-btn, #welcome')) {
    return;
  }

  if (e.cancelable) e.preventDefault();

  const touches = e.changedTouches ? e.changedTouches : [e];
  const halfWidth = window.innerWidth / 2;

  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const id = t.identifier !== undefined ? t.identifier : ('zone_' + (e.pointerId || 0));
    if (activeTouchAssignments.has(id)) {
      const action = t.clientX < halfWidth ? 'a' : 'd';
      activeTouchAssignments.set(id, action);
    }
  }

  updateMovementKeys();
}

function handleZoneTouchEnd(e) {
  const touches = e.changedTouches ? e.changedTouches : [e];

  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const id = t.identifier !== undefined ? t.identifier : ('zone_' + (e.pointerId || 0));
    activeTouchAssignments.delete(id);
  }

  updateMovementKeys();
}

// Bind steering directly on touch zones, canvas, and window for guaranteed capture
[touchLeftEl, touchRightEl, touchZonesEl, canvas].forEach((zoneEl) => {
  if (!zoneEl) return;
  zoneEl.addEventListener('touchstart', handleZoneTouchStart, { passive: false });
  zoneEl.addEventListener('touchmove', handleZoneTouchMove, { passive: false });
  zoneEl.addEventListener('touchend', handleZoneTouchEnd, { passive: false });
  zoneEl.addEventListener('touchcancel', handleZoneTouchEnd, { passive: false });
});

// Global window touch listeners removed so sections, partner links and music player receive taps

// ============================================================================
// MOBILE DOUBLE-TAP JUMP SYSTEM
// Allows handpan to jump via rapid double-tap on mobile touch zones and canvas
// ============================================================================
let lastTouchTapTime = 0;
let lastTouchTapX = 0;
let lastTouchTapY = 0;

function executeMobileJump() {
  if (!gameStarted) return;
  if (onGround || Math.abs(vy) < 3.2) {
    vy = -jumpForce;
    onGround = false;
    ResonanceAudio.playJump();
    spawnSoundRing(x, y);
    if (typeof triggerHaptic === 'function') triggerHaptic('medium');
  }
}

function handleTouchZoneDoubleTap(e) {
  if (!gameStarted || endOfRoadState.rabbitHoleShown) return;

  // Reject mouse clicks on desktop
  if (e.pointerType && e.pointerType === 'mouse' && !document.body.classList.contains('is-mobile-device')) return;

  // Do not trigger jump if tapping on interactive UI elements or dialogs
  const target = e.target;
  if (target && target.closest('button, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .music-player, .mp-track, .partner-card, .section.visible, .memory-shard-card')) {
    return;
  }

  const touch = e.changedTouches ? e.changedTouches[0] : e;
  if (!touch) return;

  const now = performance.now();
  const timeElapsed = now - lastTouchTapTime;
  const distance = Math.hypot(touch.clientX - lastTouchTapX, touch.clientY - lastTouchTapY);

  // Rapid double tap detection on touch zones: between 45ms and 400ms, within 130px radius
  if (timeElapsed > 45 && timeElapsed < 400 && distance < 130) {
    executeMobileJump();
    lastTouchTapTime = 0; // Prevent triple-tap from firing another jump immediately
  } else {
    lastTouchTapTime = now;
    lastTouchTapX = touch.clientX;
    lastTouchTapY = touch.clientY;
  }
}

// Bind double-tap event listener directly to mobile touch zones, touch arrows, and canvas
[touchLeftEl, touchRightEl, touchZonesEl, touchArrowLeftEl, touchArrowRightEl, canvas].forEach((zoneEl) => {
  if (!zoneEl) return;
  zoneEl.addEventListener('touchstart', handleTouchZoneDoubleTap, { passive: true });
});

// Audio Toggle Button
const audioToggleBtn = document.getElementById('audioToggleBtn');
if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    ResonanceAudio.toggleMute();
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
  });
}

// Direct Monograph Reader Modal
function openDirectMonographModal() {
  const modal = document.getElementById('directMonographModal');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  ResonanceAudio.resume();
  ResonanceAudio.playTone(3, 0.45);
}

function closeDirectMonographModal() {
  const modal = document.getElementById('directMonographModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function toggleDirectMonographModal() {
  const modal = document.getElementById('directMonographModal');
  if (!modal) return;
  if (modal.classList.contains('open')) closeDirectMonographModal();
  else openDirectMonographModal();
}

const monographToggleBtn = document.getElementById('monographToggleBtn');
const dmCloseBtn = document.getElementById('dmCloseBtn');
const dmBackdrop = document.getElementById('dmBackdrop');
const dmOpenRhBtn = document.getElementById('dmOpenRhBtn');

if (monographToggleBtn) monographToggleBtn.addEventListener('click', toggleDirectMonographModal);
if (dmCloseBtn) dmCloseBtn.addEventListener('click', closeDirectMonographModal);
if (dmBackdrop) dmBackdrop.addEventListener('click', closeDirectMonographModal);
if (dmOpenRhBtn) {
  dmOpenRhBtn.addEventListener('click', () => {
    closeDirectMonographModal();
    openRabbitHoleScreen();
  });
}

// Mouse wheel navigation
window.addEventListener('wheel', (e) => {
  if (!gameStarted || endOfRoadState.rabbitHoleShown) return;
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  vx += Math.sign(delta) * Math.min(2.5, Math.abs(delta) * 0.04);
}, { passive: true });

// Custom cursor handling integrated with UnifiedModalitySystem
const cursorEl = document.getElementById('cursor');
if (cursorEl) {
  cursorEl.style.opacity = '0';
  document.addEventListener('mousemove', (e) => {
    if (document.body.classList.contains('is-mobile-device') || !window.matchMedia('(pointer: fine)').matches) {
      cursorEl.style.display = 'none';
      return;
    }
    cursorEl.style.display = 'block';
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';
    cursorEl.style.transform = 'translate(-50%, -50%)';
    cursorEl.style.opacity = '1';
  });
  document.addEventListener('mouseleave', () => {
    cursorEl.style.opacity = '0';
  });
}

let siteEntered = true;

function startGame() {
  if (typeof ResonanceAudio !== 'undefined') {
    try {
      ResonanceAudio.init();
      ResonanceAudio.resume();
    } catch (_) {}
  }
  if (typeof triggerHaptic === 'function') {
    triggerHaptic('light');
  }
  if (canvas) {
    try { canvas.focus({ preventScroll: true }); } catch (e) {}
  }
}

// Global touch & click activation to wake audio context immediately
window.addEventListener('touchstart', () => {
  if (typeof ResonanceAudio !== 'undefined') ResonanceAudio.resume();
}, { passive: true });
window.addEventListener('click', () => {
  if (typeof ResonanceAudio !== 'undefined') ResonanceAudio.resume();
}, { passive: true });

// ============================================================================
// WEBSITE BACKGROUND AUDIO CONTROLLER
// Stops website ambient soundscape, rolling audio, and orb loops during music playback
// ============================================================================
function stopWebsiteBackgroundAudio() {
  // 1. Stop any currently playing audio file (e.g. ambient orbs)
  if (typeof currentAudio !== 'undefined' && currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (_) {}
    currentAudio = null;
  }
  if (typeof audioFadeInterval !== 'undefined' && audioFadeInterval) {
    clearInterval(audioFadeInterval);
    audioFadeInterval = null;
  }

  // 2. Mute procedural background soundscape and rolling audio
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx) {
    ResonanceAudio.isBackgroundSilenced = true;
    const now = ResonanceAudio.ctx.currentTime;
    if (ResonanceAudio.ambientGain) {
      ResonanceAudio.ambientGain.gain.cancelScheduledValues(now);
      ResonanceAudio.ambientGain.gain.setValueAtTime(ResonanceAudio.ambientGain.gain.value, now);
      ResonanceAudio.ambientGain.gain.linearRampToValueAtTime(0, now + 0.12);
    }
    if (ResonanceAudio.rollingGain) {
      ResonanceAudio.rollingGain.gain.cancelScheduledValues(now);
      ResonanceAudio.rollingGain.gain.setValueAtTime(0, now);
    }
  }
}

function restoreWebsiteBackgroundAudio() {
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx && !ResonanceAudio.isMuted) {
    ResonanceAudio.isBackgroundSilenced = false;
    const now = ResonanceAudio.ctx.currentTime;
    if (ResonanceAudio.ambientGain) {
      ResonanceAudio.ambientGain.gain.cancelScheduledValues(now);
      ResonanceAudio.ambientGain.gain.setValueAtTime(ResonanceAudio.ambientGain.gain.value, now);
      ResonanceAudio.ambientGain.gain.linearRampToValueAtTime(0.20, now + 0.5);
    }
  }
}

// Music player
const MUSIC_TRACKS = [
  { title:'Berlin Dawn', subtitle:'Handpan · Improvised · Berlin', src:'./audio/berlin-dawn.wav', duration: '3:45' },
  { title:'Alexanderplatz Drift', subtitle:'Handpan · Improvised · Berlin', src:'./audio/alexanderplatz-drift.wav', duration: '4:12' },
  { title:"Hitchhiker's Scale", subtitle:'Handpan · Improvised · Travels', src:'./audio/hitchhikers-scale.wav', duration: '3:58' },
  { title:'Baltic Wind', subtitle:'Handpan · Improvised · Travels', src:'./audio/baltic-wind.wav', duration: '4:30' },
  { title:'Athens Courtyard', subtitle:'Handpan · Improvised · Greece', src:'./audio/athens-courtyard.wav', duration: '3:24' },
  { title:'Resonance', subtitle:'Handpan · Improvised', src:'./audio/resonance.wav', duration: '4:05' }
];

const musicPlayer = { audio:null, index:-1, els:{} };
function mpFormatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function mpUpdateProgress() {
  const a = musicPlayer.audio;
  if (!a || !a.duration) return;
  const p = (a.currentTime / a.duration) * 100;
  if (musicPlayer.els.filled) musicPlayer.els.filled.style.width = p + '%';
  if (musicPlayer.els.handle) musicPlayer.els.handle.style.left = p + '%';
  if (musicPlayer.els.current) musicPlayer.els.current.textContent = mpFormatTime(a.currentTime);
  if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(a.duration);
}

function mpSetPlayingUI(playing) {
  const pi = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-play');
  const pa = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-pause');
  if (pi) pi.style.display = playing ? 'none' : 'block';
  if (pa) pa.style.display = playing ? 'block' : 'none';
}

function mpHighlightTrack(i) {
  if (!musicPlayer.els.tracklist) return;
  musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li, j) => li.classList.toggle('active', j === i));
}

function mpLoadTrack(index, autoplay) {
  if (index < 0 || index >= MUSIC_TRACKS.length) return;
  const t = MUSIC_TRACKS[index];
  musicPlayer.index = index;
  const a = musicPlayer.audio;
  if (!a) return;

  // STOP all background website audio whenever a track is loaded or changed
  stopWebsiteBackgroundAudio();

  if (musicPlayer.els.title) musicPlayer.els.title.textContent = t.title;
  if (musicPlayer.els.subtitle) musicPlayer.els.subtitle.textContent = t.subtitle;
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = String(index + 1).padStart(2, '0');
  mpHighlightTrack(index);

  const targetSrc = t.src;
  if (!a.src || !a.src.endsWith(targetSrc.replace(/^\.\//, ''))) {
    a.src = targetSrc;
  }

  if (autoplay) {
    stopWebsiteBackgroundAudio();
    const playPromise = a.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        stopWebsiteBackgroundAudio();
        mpSetPlayingUI(true);
      }).catch((err) => {
        console.warn('Track playback prevented by browser:', err);
        mpSetPlayingUI(false);
      });
    }
  } else {
    mpSetPlayingUI(false);
  }
}

function mpTogglePlay() {
  const a = musicPlayer.audio;
  if (!a) return;
  if (musicPlayer.index < 0) {
    mpLoadTrack(0, true);
    return;
  }
  if (a.paused) {
    stopWebsiteBackgroundAudio();
    const playPromise = a.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        stopWebsiteBackgroundAudio();
        mpSetPlayingUI(true);
      }).catch(() => {});
    }
  } else {
    if (typeof a.pause === 'function') a.pause();
    restoreWebsiteBackgroundAudio();
    mpSetPlayingUI(false);
  }
}

function mpPrev() {
  if (musicPlayer.index < 0) {
    mpLoadTrack(0, true);
    return;
  }
  const nextIdx = (musicPlayer.index - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  mpLoadTrack(nextIdx, true);
}

function mpNext() {
  if (musicPlayer.index < 0) {
    mpLoadTrack(0, true);
    return;
  }
  const nextIdx = (musicPlayer.index + 1) % MUSIC_TRACKS.length;
  mpLoadTrack(nextIdx, true);
}

function initMusicPlayer() {
  const container = document.getElementById('musicPlayer');
  if (!container) return;
  musicPlayer.audio = document.getElementById('mpAudio');
  musicPlayer.els = {
    title: document.getElementById('mpTitle'),
    subtitle: document.getElementById('mpSubtitle'),
    trackNum: document.getElementById('mpTrackNum'),
    filled: document.getElementById('mpProgressFilled'),
    handle: document.getElementById('mpProgressHandle'),
    progress: document.getElementById('mpProgress'),
    current: document.getElementById('mpCurrentTime'),
    duration: document.getElementById('mpDuration'),
    playBtn: document.getElementById('mpPlay'),
    prevBtn: document.getElementById('mpPrev'),
    nextBtn: document.getElementById('mpNext'),
    tracklist: document.getElementById('mpTracklist')
  };
  const a = musicPlayer.audio;
  if (!a) return;

  a.addEventListener('timeupdate', mpUpdateProgress);
  a.addEventListener('loadedmetadata', mpUpdateProgress);
  a.addEventListener('play', () => {
    stopWebsiteBackgroundAudio();
    mpSetPlayingUI(true);
  });
  a.addEventListener('pause', () => {
    mpSetPlayingUI(false);
    restoreWebsiteBackgroundAudio();
  });
  a.addEventListener('ended', mpNext);

  let lastActionTime = 0;
  const handleAction = (el, fn) => {
    if (!el) return;
    const trigger = (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastActionTime < 320) return; // Prevent double-trigger from touchend + click
      lastActionTime = now;
      fn();
    };
    el.addEventListener('click', trigger);
    el.addEventListener('touchend', trigger);
  };

  handleAction(musicPlayer.els.playBtn, mpTogglePlay);
  handleAction(musicPlayer.els.prevBtn, mpPrev);
  handleAction(musicPlayer.els.nextBtn, mpNext);

  if (musicPlayer.els.progress) {
    const onSeek = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const r = musicPlayer.els.progress.getBoundingClientRect();
      const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
      const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (a && a.duration) {
        a.currentTime = frac * a.duration;
        mpUpdateProgress();
      }
    };
    musicPlayer.els.progress.addEventListener('click', onSeek);
    musicPlayer.els.progress.addEventListener('touchstart', onSeek, { passive: false });
  }

  if (musicPlayer.els.tracklist) {
    musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li) => {
      const idx = parseInt(li.getAttribute('data-index'), 10);
      const durEl = li.querySelector('.mp-t-dur');
      if (durEl && MUSIC_TRACKS[idx] && MUSIC_TRACKS[idx].duration) {
        durEl.textContent = MUSIC_TRACKS[idx].duration;
      }
      let lastTrackTime = 0;
      const onSelect = (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTrackTime < 320) return;
        lastTrackTime = now;
        if (musicPlayer.index === idx && !a.paused) {
          if (typeof a.pause === 'function') a.pause();
          restoreWebsiteBackgroundAudio();
        } else {
          mpLoadTrack(idx, true);
        }
      };
      li.addEventListener('click', onSelect);
      li.addEventListener('touchend', onSelect);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(e);
        }
      });
    });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMusicPlayer);
else initMusicPlayer();


// ==========================================================================
// TACTILE FEEDBACK (Web Vibration API helper)
// Subtle, high-fidelity tactile confirmations for mobile touch interactions
// ==========================================================================
function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10); // subtle tap for pips, step markers, close buttons
          break;
        case 'medium':
          navigator.vibrate(20); // distinct tap for drawer toggle and swipe navigation
          break;
        case 'double':
          navigator.vibrate([12, 35, 14]); // double pulse for audio preview toggle
          break;
        case 'success':
          navigator.vibrate([14, 28, 22]); // confirmed chapter selection jump
          break;
        default:
          navigator.vibrate(12);
      }
    } catch (e) {
      // Gracefully ignore if browser policies or devices lack vibration support
    }
  }
}

// ==========================================================================
// REDESIGNED RABBIT HOLE SCROLL & SECTION REVEAL MANAGER
// Up-and-down smooth scrollable journey with dynamic section fade-in / fade-out
// and bespoke reveals for each section.
// ==========================================================================

const rhScrollManager = {
  container: null,
  sections: [],
  sideNav: null,
  pips: [],
  sectionObserver: null,
  breadcrumb: null,
  progressBar: null,
  progressGlow: null,
  progressTrack: null,
  progressPercent: null,
  progressionStat: null,
  chapterSteps: [],
  separators: [],
  scrollTriggers: [],
  tocDrawer: null,
  tocBackdrop: null,
  tocToggleBtn: null,
  tocFloatingBtn: null,
  tocCloseBtn: null,
  tocItems: [],
  tocProgressVal: null,
  tocMiniFill: null,
  isTocOpen: false,
  backdropGeometry: null,
  parallaxAura: null,
  parallaxHarmonics: null,
  parallaxFlower: null,
  parallaxNodes: null,
  reducedMotion: false,
  mouseParallax: {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    dampeningFactor: 0.065 // Tuned organic dampening factor for silky mouse response
  },
  scrollVelocity: {
    current: 0,
    target: 0,
    lastScrollTop: 0,
    lastScrollTime: 0
  },
  parallaxRafId: null,
  activePreviewAudio: null,
  activePreviewBtn: null,
  touchStartY: 0,
  touchStartTime: 0,
  isScrollingProgrammatically: false,
  currentSectionIndex: 0,

  sectionTitles: [
    "01 / 07 · Early Life",
    "02 / 07 · Way to Music",
    "03 / 07 · Street Stories",
    "04 / 07 · Artisans & Makers",
    "05 / 07 · Instruments",
    "06 / 07 · Audio Vault",
    "07 / 07 · Notes from the Road"
  ],

  init() {
    this.container = document.getElementById('rabbit-hole');
    this.sections = Array.from(document.querySelectorAll('.rh-section'));
    this.sideNav = document.querySelector('.rh-side-nav');
    this.pips = Array.from(document.querySelectorAll('.rh-side-pip'));
    this.breadcrumb = document.getElementById('rhBreadcrumb');
    this.progressBar = document.getElementById('rhProgressBar');
    this.progressGlow = document.getElementById('rhProgressGlow');
    this.progressTrack = document.getElementById('rhProgressTrack');
    this.progressPercent = document.getElementById('rhProgressPercent');
    this.progressionStat = document.getElementById('rhProgressionStat');
    this.chapterSteps = Array.from(document.querySelectorAll('.rh-chapter-step'));
    this.separators = Array.from(document.querySelectorAll('.rh-section-separator'));
    this.backdropGeometry = document.getElementById('rhBackdropGeometry') || document.querySelector('.rh-backdrop-geometry');
    this.parallaxAura = document.getElementById('rhParallaxAura');
    this.parallaxHarmonics = document.getElementById('rhParallaxHarmonics');
    this.parallaxFlower = document.getElementById('rhParallaxFlower');
    this.parallaxNodes = document.getElementById('rhParallaxNodes');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!this.container || !this.sections.length) return;

    // Listen to scroll events on container
    this.container.addEventListener('scroll', () => {
      this.handleScroll();
    }, { passive: true });

    // Event delegation on .rh-side-nav to smoothly scroll to corresponding section ID
    if (this.sideNav) {
      this.sideNav.addEventListener('click', (e) => {
        const pip = e.target.closest('.rh-side-pip');
        if (!pip) return;
        e.preventDefault();
        triggerHaptic('light');

        // Extract target section ID from data-target, data-section-id, href, or data-sec-target
        let targetId = pip.getAttribute('data-target') || 
                       pip.getAttribute('data-section-id') || 
                       pip.getAttribute('href');

        if (!targetId && pip.hasAttribute('data-sec-target')) {
          targetId = 'rhSec' + pip.getAttribute('data-sec-target');
        }

        if (targetId) {
          this.scrollToSectionId(targetId);
        }
      });
    }

    // Click on chapter progression steps to smooth-scroll
    this.chapterSteps.forEach((step) => {
      step.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic('light');
        const target = parseInt(step.getAttribute('data-sec-target'), 10);
        if (!isNaN(target)) {
          this.scrollToSection(target);
        }
      });
    });

    // Initialize Table of Contents Slide-in Drawer
    this.initToc();

    // Initialize IntersectionObserver to dynamically update active state styling
    this.initIntersectionObserver();

    // Initialize GSAP ScrollTrigger dynamic exit transitions
    this.initScrollTriggers();

    // Keyboard navigation when rabbit hole is open
    document.addEventListener('keydown', (e) => {
      if (!endOfRoadState.rabbitHoleShown) return;

      // Escape closes TOC if open, without closing whole Rabbit Hole
      if (e.key === 'Escape') {
        if (this.isTocOpen) {
          e.preventDefault();
          e.stopPropagation();
          this.closeToc();
          return;
        }
      }

      // Quick toggle TOC with 't' key
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          this.toggleToc();
          return;
        }
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        this.scrollToSection(Math.min(this.sections.length - 1, this.currentSectionIndex + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        this.scrollToSection(Math.max(0, this.currentSectionIndex - 1));
      }
    });

    // Touch swipe gestures for mobile
    this.bindTouchSwipe();

    // Inline audio previews
    this.initAudioPreviews();

    // Mouse movement listeners for interactive spatial parallax with smooth dampening
    const onPointerMove = (e) => {
      if (!endOfRoadState.rabbitHoleShown || this.reducedMotion) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Normalized coordinates from -1.0 (left/top) to +1.0 (right/bottom)
      this.mouseParallax.targetX = Math.max(-1, Math.min(1, (e.clientX - w / 2) / (w / 2)));
      this.mouseParallax.targetY = Math.max(-1, Math.min(1, (e.clientY - h / 2) / (h / 2)));
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    if (this.container) {
      this.container.addEventListener('mousemove', onPointerMove, { passive: true });
    }

    const onPointerLeave = () => {
      this.mouseParallax.targetX = 0;
      this.mouseParallax.targetY = 0;
    };

    window.addEventListener('mouseleave', onPointerLeave, { passive: true });
    if (this.container) {
      this.container.addEventListener('mouseleave', onPointerLeave, { passive: true });
    }

    // Start RAF rendering loop for continuous parallax physics
    this.startParallaxLoop();

    // Initial positioning & progress setup
    this.handleScroll();
  },

  initToc() {
    this.tocDrawer = document.getElementById('rhTocDrawer');
    if (!this.tocDrawer) return;
    this.tocBackdrop = document.getElementById('rhTocBackdrop');
    this.tocToggleBtn = document.getElementById('rhTocToggleBtn');
    this.tocFloatingBtn = document.getElementById('rhTocFloatingBtn');
    this.tocCloseBtn = document.getElementById('rhTocCloseBtn');
    this.tocItems = Array.from(document.querySelectorAll('.rh-toc-item'));
    this.tocProgressVal = document.getElementById('rhTocProgressVal');
    this.tocMiniFill = document.getElementById('rhTocMiniFill');

    // Header TOC button
    if (this.tocToggleBtn) {
      this.tocToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic(this.isTocOpen ? 'light' : 'medium');
        this.toggleToc();
      });
    }

    // Persistent floating edge button
    if (this.tocFloatingBtn) {
      this.tocFloatingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        this.openToc();
      });
    }

    // Drawer close button
    if (this.tocCloseBtn) {
      this.tocCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic('light');
        this.closeToc();
      });
    }

    // Backdrop click
    if (this.tocBackdrop) {
      this.tocBackdrop.addEventListener('click', () => {
        triggerHaptic('light');
        this.closeToc();
      });
    }

    // Event delegation on TOC chapter list container
    const tocList = document.querySelector('.rh-toc-list');
    if (tocList) {
      tocList.addEventListener('click', (e) => {
        const item = e.target.closest('.rh-toc-item');
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic('success');
        const target = parseInt(item.getAttribute('data-sec-target'), 10);
        if (!isNaN(target)) {
          this.closeToc();
          setTimeout(() => {
            this.scrollToSection(target);
          }, 40);
        }
      });
    }

    // Direct click listener on each TOC chapter button as fallback
    this.tocItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic('success');
        const target = parseInt(item.getAttribute('data-sec-target'), 10);
        if (!isNaN(target)) {
          this.closeToc();
          setTimeout(() => {
            this.scrollToSection(target);
          }, 40);
        }
      });
    });
  },

  openToc() {
    if (!this.tocDrawer) return;
    triggerHaptic('medium');
    this.isTocOpen = true;
    this.tocDrawer.classList.add('open');
    this.tocDrawer.setAttribute('aria-hidden', 'false');
    if (this.tocBackdrop) this.tocBackdrop.classList.add('open');
    if (this.tocToggleBtn) this.tocToggleBtn.setAttribute('aria-expanded', 'true');
    if (this.tocFloatingBtn) this.tocFloatingBtn.setAttribute('aria-expanded', 'true');
    if (this.tocCloseBtn) {
      setTimeout(() => this.tocCloseBtn.focus(), 60);
    }
  },

  closeToc() {
    if (!this.tocDrawer) return;
    this.isTocOpen = false;
    this.tocDrawer.classList.remove('open');
    this.tocDrawer.setAttribute('aria-hidden', 'true');
    if (this.tocBackdrop) this.tocBackdrop.classList.remove('open');
    if (this.tocToggleBtn) this.tocToggleBtn.setAttribute('aria-expanded', 'false');
    if (this.tocFloatingBtn) this.tocFloatingBtn.setAttribute('aria-expanded', 'false');
  },

  toggleToc() {
    if (this.isTocOpen) {
      this.closeToc();
    } else {
      this.openToc();
    }
  },

  // Initialize IntersectionObserver to dynamically update active state styling on .rh-side-pip
  initIntersectionObserver() {
    if (!('IntersectionObserver' in window) || !this.container || !this.sections.length) return;

    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }

    const sectionEntries = new Map();

    const observerOptions = {
      root: this.container,
      rootMargin: '-10% 0px -30% 0px',
      threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0]
    };

    this.sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          sectionEntries.set(entry.target, entry);
        } else {
          sectionEntries.delete(entry.target);
        }
      });

      if (this.isScrollingProgrammatically) return;

      if (sectionEntries.size > 0) {
        const containerRect = this.container.getBoundingClientRect();
        const focalLine = containerRect.top + containerRect.height * 0.38;

        let bestSec = null;
        let maxVisibleHeight = -1;

        sectionEntries.forEach((entry, sec) => {
          const rect = entry.boundingClientRect;
          // Primary check: Does the section encompass the reading focal line?
          if (rect.top <= focalLine && rect.bottom >= focalLine) {
            bestSec = sec;
          }
          // Secondary fallback: Which intersecting section has the largest visible pixel height?
          const visibleHeight = entry.intersectionRect ? entry.intersectionRect.height : 0;
          if (!bestSec && visibleHeight > maxVisibleHeight) {
            maxVisibleHeight = visibleHeight;
            bestSec = sec;
          }
        });

        if (bestSec) {
          const idx = this.sections.indexOf(bestSec);
          if (idx !== -1 && idx !== this.currentSectionIndex) {
            this.currentSectionIndex = idx;
            this.updateActiveNav(idx);
          }
        }
      }
    }, observerOptions);

    this.sections.forEach((sec) => {
      this.sectionObserver.observe(sec);
    });
  },

  handleScroll() {
    if (!this.container) return;

    // --- Dynamic Scroll Progress Percentage Calculation ---
    const scrollTop = this.container.scrollTop;
    const maxScroll = this.container.scrollHeight - this.container.clientHeight;
    let scrollPercent = 0;
    if (maxScroll > 0) {
      scrollPercent = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    }

    // --- Dynamic Scroll Velocity Tracking ---
    const now = performance.now();
    const lastTime = this.scrollVelocity.lastScrollTime || now;
    const dt = Math.max(8, now - lastTime);
    const deltaY = scrollTop - (this.scrollVelocity.lastScrollTop || 0);
    this.scrollVelocity.lastScrollTop = scrollTop;
    this.scrollVelocity.lastScrollTime = now;
    const rawVelocity = (deltaY / dt) * 16;
    this.scrollVelocity.target = Math.max(-55, Math.min(55, rawVelocity));

    // --- Parallax Movement for Background Geometry Elements ---
    this.updateParallax(scrollTop, scrollPercent);

    // --- Update Proximity Glow on Chapter Horizontal Separators ---
    this.updateSeparatorsProximity();

    // Update Top Visual Progress Bar & Glow Spark
    if (this.progressBar) {
      this.progressBar.style.width = scrollPercent.toFixed(1) + '%';
    }
    if (this.progressGlow) {
      this.progressGlow.style.left = scrollPercent.toFixed(1) + '%';
      if (scrollPercent > 0.5) {
        this.progressGlow.classList.add('active');
      } else {
        this.progressGlow.classList.remove('active');
      }
    }
    if (this.progressTrack) {
      this.progressTrack.setAttribute('aria-valuenow', Math.round(scrollPercent));
    }
    if (this.progressPercent) {
      this.progressPercent.textContent = Math.round(scrollPercent) + '%';
    }
    if (this.progressionStat) {
      this.progressionStat.innerHTML = `<span class="rh-stat-highlight">${Math.round(scrollPercent)}%</span> Explored · Chapter ${this.currentSectionIndex + 1} of ${this.sections.length}`;
    }

    // Update TOC overall progress in real time
    if (this.tocProgressVal) {
      this.tocProgressVal.textContent = Math.round(scrollPercent) + '%';
    }
    if (this.tocMiniFill) {
      this.tocMiniFill.style.width = scrollPercent.toFixed(1) + '%';
    }

    // --- Section Visibility Calculation ---
    const containerRect = this.container.getBoundingClientRect();
    const viewportHeight = containerRect.height || window.innerHeight;
    const viewportCenter = containerRect.top + viewportHeight / 2;

    let closestIndex = 0;
    let minDistance = Infinity;

    this.sections.forEach((sec, idx) => {
      const rect = sec.getBoundingClientRect();
      const secCenter = rect.top + rect.height / 2;
      const distToCenter = Math.abs(secCenter - viewportCenter);

      if (distToCenter < minDistance) {
        minDistance = distToCenter;
        closestIndex = idx;
      }

      // If the section is scrolled well past the top:
      if (rect.bottom < viewportHeight * 0.22) {
        sec.classList.remove('in-view', 'pending-below');
        sec.classList.add('scrolled-past');
      } else if (rect.top > viewportHeight * 0.88) {
        // Pending below viewport
        sec.classList.remove('in-view', 'scrolled-past');
        sec.classList.add('pending-below');
      } else {
        // In viewport view
        sec.classList.remove('scrolled-past', 'pending-below');
        sec.classList.add('in-view');
      }
    });

    // Boundary checks for top and bottom of scroll track
    if (scrollPercent <= 0.5 && this.currentSectionIndex !== 0) {
      this.currentSectionIndex = 0;
      this.updateActiveNav(0);
    } else if (scrollPercent >= 99.5 && this.currentSectionIndex !== this.sections.length - 1) {
      this.currentSectionIndex = this.sections.length - 1;
      this.updateActiveNav(this.sections.length - 1);
    } else if (!this.sectionObserver && closestIndex !== this.currentSectionIndex) {
      this.currentSectionIndex = closestIndex;
      this.updateActiveNav(closestIndex);
    }
  },

  updateActiveNav(index) {
    if (this.breadcrumb && this.sectionTitles[index]) {
      this.breadcrumb.textContent = this.sectionTitles[index];
    }

    // Side pips
    this.pips.forEach((pip, idx) => {
      const isActive = idx === index;
      pip.classList.toggle('active', isActive);
      pip.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    // Chapter Steps in the Progression Strip
    this.chapterSteps.forEach((step, idx) => {
      const isActive = idx === index;
      const isCompleted = idx < index;
      step.classList.toggle('active', isActive);
      step.classList.toggle('completed', isCompleted);
      step.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    // Table of Contents Drawer Items
    this.tocItems.forEach((item, idx) => {
      const isActive = idx === index;
      const isCompleted = idx < index;
      item.classList.toggle('active', isActive);
      item.classList.toggle('completed', isCompleted);
      item.setAttribute('aria-current', isActive ? 'true' : 'false');
      const badge = item.querySelector('.rh-toc-item-badge');
      if (badge) {
        badge.textContent = isActive ? 'Active' : (isCompleted ? 'Completed' : 'Pending');
      }
    });

    if (this.progressionStat) {
      const maxScroll = this.container.scrollHeight - this.container.clientHeight;
      const pct = maxScroll > 0 ? Math.round(Math.min(100, Math.max(0, (this.container.scrollTop / maxScroll) * 100))) : 0;
      this.progressionStat.innerHTML = `<span class="rh-stat-highlight">${pct}%</span> Explored · Chapter ${index + 1} of ${this.sections.length}`;
    }
  },

  scrollToSectionId(targetId) {
    if (!targetId || !this.container) return;
    const cleanId = targetId.startsWith('#') ? targetId.slice(1) : targetId;
    const targetSec = document.getElementById(cleanId);
    if (!targetSec) return;

    const targetIndex = this.sections.indexOf(targetSec);
    if (targetIndex !== -1) {
      this.scrollToSection(targetIndex);
    } else {
      // Direct scroll calculation if target element is not directly in this.sections
      this.isScrollingProgrammatically = true;
      const stickyHeader = document.querySelector('.rh-sticky-header');
      const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 64;
      const containerRect = this.container.getBoundingClientRect();
      const secRect = targetSec.getBoundingClientRect();
      let targetScrollTop = (this.container.scrollTop + (secRect.top - containerRect.top)) - (headerHeight + 8);
      const maxScroll = Math.max(0, this.container.scrollHeight - this.container.clientHeight);
      targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

      if (typeof gsap !== 'undefined' && gsap.to) {
        gsap.killTweensOf(this.container);
        gsap.to(this.container, {
          scrollTop: targetScrollTop,
          duration: 0.85,
          ease: 'power2.inOut',
          overwrite: 'auto',
          onUpdate: () => this.handleScroll(),
          onComplete: () => {
            this.isScrollingProgrammatically = false;
            this.handleScroll();
          }
        });
      } else {
        this.container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
        setTimeout(() => {
          this.isScrollingProgrammatically = false;
          this.handleScroll();
        }, 750);
      }
    }
  },

  scrollToSection(target) {
    if (typeof target === 'string') {
      return this.scrollToSectionId(target);
    }
    const index = parseInt(target, 10);
    if (isNaN(index) || index < 0 || index >= this.sections.length || !this.container) return;
    const targetSec = this.sections[index];
    if (!targetSec) return;

    this.isScrollingProgrammatically = true;

    // Fixed sticky top header offset (default ~64px)
    const stickyHeader = document.querySelector('.rh-sticky-header');
    const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 64;

    // Calculate exact scroll target inside this.container (#rabbit-hole)
    let targetScrollTop = 0;
    if (index === 0) {
      targetScrollTop = 0;
    } else {
      const containerRect = this.container.getBoundingClientRect();
      const secRect = targetSec.getBoundingClientRect();
      targetScrollTop = (this.container.scrollTop + (secRect.top - containerRect.top)) - (headerHeight + 8);
    }

    // Clamp between 0 and maxScroll
    const maxScroll = Math.max(0, this.container.scrollHeight - this.container.clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

    // Update active nav states immediately for snappy visual feedback
    this.currentSectionIndex = index;
    this.updateActiveNav(index);

    // Smooth scroll using GSAP if available, with robust fallback
    if (typeof gsap !== 'undefined' && gsap.to) {
      gsap.killTweensOf(this.container);
      gsap.to(this.container, {
        scrollTop: targetScrollTop,
        duration: 0.85,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onUpdate: () => {
          this.handleScroll();
        },
        onComplete: () => {
          this.isScrollingProgrammatically = false;
          this.handleScroll();
        }
      });
    } else {
      this.container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
      setTimeout(() => {
        this.isScrollingProgrammatically = false;
        this.handleScroll();
      }, 750);
    }
  },

  bindTouchSwipe() {
    let startY = 0;
    let startTime = 0;

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startTime = performance.now();
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      if (!startY) return;
      const endY = e.changedTouches[0]?.clientY || startY;
      const deltaY = endY - startY;
      const duration = performance.now() - startTime;
      const velocity = Math.abs(deltaY) / Math.max(1, duration);

      // Fast vertical flick
      if (Math.abs(deltaY) > 70 && velocity > 0.35) {
        triggerHaptic('medium');
        if (deltaY < 0) {
          // Swiped up -> next section
          this.scrollToSection(Math.min(this.sections.length - 1, this.currentSectionIndex + 1));
        } else {
          // Swiped down -> prev section
          this.scrollToSection(Math.max(0, this.currentSectionIndex - 1));
        }
      }
      startY = 0;
    }, { passive: true });
  },

  initAudioPreviews() {
    const previewButtons = document.querySelectorAll('.rh-preview-btn');
    previewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic('double');
        const src = btn.getAttribute('data-preview-src');
        if (!src) return;

        if (this.activePreviewAudio && !this.activePreviewAudio.paused && this.activePreviewBtn === btn) {
          this.activePreviewAudio.pause();
          this.setPreviewPlayingState(btn, false);
          return;
        }

        if (this.activePreviewAudio) {
          this.activePreviewAudio.pause();
          if (this.activePreviewBtn) this.setPreviewPlayingState(this.activePreviewBtn, false);
        }

        const audio = new Audio(src);
        audio.volume = 0.65;
        this.activePreviewAudio = audio;
        this.activePreviewBtn = btn;

        audio.play().then(() => {
          this.setPreviewPlayingState(btn, true);
        }).catch(() => {});

        audio.addEventListener('ended', () => {
          this.setPreviewPlayingState(btn, false);
        });
      });
    });
  },

  setPreviewPlayingState(btn, isPlaying) {
    const playIcon = btn.querySelector('.rh-icon-play');
    const pauseIcon = btn.querySelector('.rh-icon-pause');
    if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
  },

  stopAudioPreview() {
    if (this.activePreviewAudio) {
      this.activePreviewAudio.pause();
      if (this.activePreviewBtn) this.setPreviewPlayingState(this.activePreviewBtn, false);
      this.activePreviewAudio = null;
      this.activePreviewBtn = null;
    }
  },

  startParallaxLoop() {
    if (this.parallaxRafId) return;

    const tick = () => {
      if (endOfRoadState.rabbitHoleShown) {
        this.renderParallaxFrame();
      }
      this.parallaxRafId = requestAnimationFrame(tick);
    };
    this.parallaxRafId = requestAnimationFrame(tick);
  },

  stopParallaxLoop() {
    if (this.parallaxRafId) {
      cancelAnimationFrame(this.parallaxRafId);
      this.parallaxRafId = null;
    }
  },

  updateParallax(scrollTop, scrollPercent) {
    if (this.reducedMotion) return;
    this.renderParallaxFrame();
  },

  renderParallaxFrame() {
    if (!this.container || this.reducedMotion) return;

    // Smooth lerping of mouse coordinates with tuned dampening factor
    const dampening = this.mouseParallax.dampeningFactor || 0.065;
    this.mouseParallax.x += (this.mouseParallax.targetX - this.mouseParallax.x) * dampening;
    this.mouseParallax.y += (this.mouseParallax.targetY - this.mouseParallax.y) * dampening;

    // Smooth lerping and exponential decay of scroll velocity
    this.scrollVelocity.current += (this.scrollVelocity.target - this.scrollVelocity.current) * 0.12;
    this.scrollVelocity.target *= 0.88;

    const mx = this.mouseParallax.x;
    const my = this.mouseParallax.y;
    const vel = this.scrollVelocity.current;

    const scrollTop = this.container.scrollTop;
    const maxScroll = this.container.scrollHeight - this.container.clientHeight;
    const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;

    // Base Backdrop Container: 3D perspective warp responsive to mouse movement
    if (this.backdropGeometry) {
      const containerTiltX = -my * 2.8;
      const containerTiltY = mx * 2.8;
      this.backdropGeometry.style.transform = 
        `perspective(1200px) rotateX(${containerTiltX.toFixed(2)}deg) rotateY(${containerTiltY.toFixed(2)}deg)`;
    }

    // Layer 1: Concentric Harmonic Rings (Far depth plane: translateZ -80px)
    // Counter-clockwise spin, subtle mouse tilt, deep spatial plane
    if (this.parallaxHarmonics) {
      const rot = -progress * 55 + vel * 0.09;
      const x = mx * 24;
      const y = -scrollTop * 0.07 + my * 18;
      const tiltX = -my * 4.0;
      const tiltY = mx * 4.0;
      const scale = 1 + Math.min(0.06, Math.abs(vel) * 0.0012);
      this.parallaxHarmonics.style.transform = 
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, -80px) rotate(${rot.toFixed(1)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    // Layer 2: Handpan Resonator Flower & Sacred Geometry (Mid depth plane: translateZ 0px)
    // Clockwise spin, balanced mouse sway, rotational warp with scroll velocity
    if (this.parallaxFlower) {
      const rot = progress * 72 - vel * 0.15;
      const x = mx * 48;
      const y = -scrollTop * 0.14 + my * 34;
      const tiltX = -my * 7.5;
      const tiltY = mx * 7.5;
      const scale = 1 + Math.min(0.08, Math.abs(vel) * 0.0018);
      this.parallaxFlower.style.transform = 
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0px) rotate(${rot.toFixed(1)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    // Layer 3: Overtone Constellation Nodes (Near foreground plane: translateZ 75px)
    // Foreground nodes react with pronounced spatial displacement, lateral drift & inertial trail
    if (this.parallaxNodes) {
      const rot = progress * 32 + vel * 0.22;
      const driftX = Math.sin(progress * Math.PI) * 16;
      const x = mx * 84 + driftX;
      // Inertial lag effect: scroll velocity causes foreground nodes to trail dynamically
      const inertiaY = -vel * 0.75;
      const y = -scrollTop * 0.22 + my * 58 + inertiaY;
      const tiltX = -my * 12.0;
      const tiltY = mx * 12.0;
      const scale = 1 + Math.min(0.12, Math.abs(vel) * 0.0025);
      this.parallaxNodes.style.transform = 
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 75px) rotate(${rot.toFixed(1)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    // Layer 4: Deep Ambient Aura Halo (Atmospheric deep plane: translateZ -140px)
    if (this.parallaxAura) {
      const x = mx * 16;
      const y = -scrollTop * 0.04 + my * 11;
      const scale = 1 + Math.min(0.09, Math.abs(vel) * 0.002);
      this.parallaxAura.style.transform = 
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, -140px) scale(${scale.toFixed(3)})`;
    }
  },

  updateSeparatorsProximity() {
    if (!this.separators || !this.separators.length || !this.container) return;
    const containerRect = this.container.getBoundingClientRect();
    const viewportHeight = containerRect.height || window.innerHeight;
    const viewportCenter = containerRect.top + viewportHeight / 2;
    // Radius around the viewport center in which the separator illuminates
    const glowRadius = viewportHeight * 0.44;

    this.separators.forEach((sep) => {
      const rect = sep.getBoundingClientRect();
      const sepCenter = rect.top + rect.height / 2;
      const dist = Math.abs(sepCenter - viewportCenter);

      if (dist < glowRadius) {
        // Proximity normalized from 0 (at glowRadius) to 1 (at dead center)
        const raw = 1 - (dist / glowRadius);
        // Smooth Hermite easing curve (smoothstep: 3x^2 - 2x^3)
        const proximity = raw * raw * (3 - 2 * raw);
        sep.classList.add('near-glow');
        sep.style.setProperty('--glow-proximity', proximity.toFixed(3));
      } else {
        sep.classList.remove('near-glow');
        sep.style.setProperty('--glow-proximity', '0');
      }
    });
  },

  initScrollTriggers() {
    if (this.reducedMotion || !this.sections.length || !this.container) return;

    this.killScrollTriggers();

    this.sections.forEach((sec, idx) => {
      if (idx === 0) {
        // Chapter 1 is at the top of the track on arrival
        const tween = gsap.fromTo(sec,
          { scale: 1, filter: 'blur(0px)', opacity: 1, y: 0 },
          {
            scale: 0.85,
            filter: 'blur(14px)',
            opacity: 0,
            y: -75,
            ease: 'power2.in',
            scrollTrigger: {
              trigger: sec,
              scroller: this.container,
              start: 'top 5%',
              end: 'bottom top',
              scrub: 0.7,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                sec.style.pointerEvents = self.progress > 0.92 ? 'none' : 'auto';
              }
            }
          }
        );
        if (tween.scrollTrigger) this.scrollTriggers.push(tween.scrollTrigger);
      } else {
        // Chapters 2 through 7: Cinematic entrance, focal reading plateau, dynamic blur & scale-down exit
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sec,
            scroller: this.container,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.7,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              sec.style.pointerEvents = (self.progress < 0.1 || self.progress > 0.9) ? 'none' : 'auto';
            }
          }
        });

        // 1. Entrance: smoothly scale in, clear blur, and fade in as chapter enters from bottom
        tl.fromTo(sec,
          { scale: 0.93, filter: 'blur(8px)', opacity: 0.2, y: 45 },
          { scale: 1, filter: 'blur(0px)', opacity: 1, y: 0, ease: 'power1.out', duration: 1 }
        );

        // 2. Focus: steady, crisp reading plateau while chapter is centered in view
        tl.to(sec, { scale: 1, filter: 'blur(0px)', opacity: 1, y: 0, duration: 1.3 });

        // 3. Exit: dynamic cinematic blur, scale-down, and upward drift as it exits the viewport
        tl.to(sec, {
          scale: 0.85,
          filter: 'blur(14px)',
          opacity: 0,
          y: -75,
          ease: 'power2.in',
          duration: 1.1
        });

        if (tl.scrollTrigger) this.scrollTriggers.push(tl.scrollTrigger);
      }
    });

    ScrollTrigger.refresh();
  },

  killScrollTriggers() {
    if (this.scrollTriggers && this.scrollTriggers.length) {
      this.scrollTriggers.forEach((st) => {
        try { st.kill(); } catch (e) {}
      });
      this.scrollTriggers = [];
    }
  },

  reset() {
    if (this.container) {
      this.container.scrollTop = 0;
    }
    this.currentSectionIndex = 0;
    this.mouseParallax.x = 0;
    this.mouseParallax.y = 0;
    this.mouseParallax.targetX = 0;
    this.mouseParallax.targetY = 0;
    this.scrollVelocity.current = 0;
    this.scrollVelocity.target = 0;
    this.scrollVelocity.lastScrollTop = 0;
    this.scrollVelocity.lastScrollTime = performance.now();
    this.updateActiveNav(0);
    this.initIntersectionObserver();
    this.closeToc();
    if (this.progressBar) this.progressBar.style.width = '0%';
    if (this.progressGlow) {
      this.progressGlow.style.left = '0%';
      this.progressGlow.classList.remove('active');
    }
    if (this.progressPercent) this.progressPercent.textContent = '0%';
    if (this.progressTrack) this.progressTrack.setAttribute('aria-valuenow', '0');
    if (this.tocProgressVal) this.tocProgressVal.textContent = '0%';
    if (this.tocMiniFill) this.tocMiniFill.style.width = '0%';
    this.renderParallaxFrame();
    if (this.separators) {
      this.separators.forEach((sep) => {
        sep.classList.remove('near-glow');
        sep.style.setProperty('--glow-proximity', '0');
      });
    }
    if (this.sections && this.sections.length && !this.reducedMotion) {
      gsap.set(this.sections[0], { scale: 1, filter: 'blur(0px)', opacity: 1, y: 0 });
    }
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
    this.handleScroll();
  }
};

// Initialize scroll manager when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => rhScrollManager.init());
} else {
  rhScrollManager.init();
}

// ===== RABBIT HOLE SCREEN OPEN / CLOSE =====

// ============================================================================
// ULTRA-PREMIUM CINEMATIC RABBIT HOLE THRESHOLD PORTAL & CONTROLS
// ============================================================================
let rhTransAnimId = null;

function startTransitionEmbers() {
  const c = document.getElementById('rhTransCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  const w = c.width = window.innerWidth;
  const h = c.height = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;

  const count = 55;
  const embers = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 2.2;
    const dist = Math.random() * 90;
    embers.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.45,
      radius: 1.2 + Math.random() * 2.5,
      alpha: 0.15 + Math.random() * 0.7,
      pulseSpeed: 0.02 + Math.random() * 0.04,
      pulsePhase: Math.random() * Math.PI,
      hue: Math.random() > 0.4 ? 'rgba(212, 175, 55, ' : 'rgba(247, 236, 213, '
    });
  }

  const startTime = Date.now();
  if (rhTransAnimId) cancelAnimationFrame(rhTransAnimId);

  function render() {
    const elapsed = Date.now() - startTime;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < embers.length; i++) {
      const p = embers[i];
      p.x += p.vx;
      p.y += p.vy;
      p.pulsePhase += p.pulseSpeed;

      const currentAlpha = Math.max(0, p.alpha * (0.6 + 0.4 * Math.sin(p.pulsePhase)));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.hue + currentAlpha + ')';
      ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
      ctx.shadowBlur = p.radius * 3.5;
      ctx.fill();
    }

    if (elapsed < 3000) {
      rhTransAnimId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }

  rhTransAnimId = requestAnimationFrame(render);
}

function stopTransitionEmbers() {
  if (rhTransAnimId) {
    cancelAnimationFrame(rhTransAnimId);
    rhTransAnimId = null;
  }
  const c = document.getElementById('rhTransCanvas');
  if (c) {
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }
}

// Opens the Threshold Portal with Enter & Leave buttons
function openRabbitHoleScreen() {
  if (endOfRoadState.rabbitHoleShown && document.getElementById('rabbit-hole').classList.contains('visible')) return;

  // 1. Acoustic chime & tactile confirmation
  if (typeof triggerHaptic === 'function') triggerHaptic('medium');
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx) {
    try {
      ResonanceAudio.resume();
      ResonanceAudio.playTone(0, 0.7, { duration: 3.5 });
    } catch (_) {}
  }

  endOfRoadState.archiveShown = true;
  endOfRoadState.rabbitHoleShown = true;
  endOfRoadState.fading = false;
  endOfRoadState.fade = 0;
  endOfRoadState.screenFade = 1;
  keys = {};
  vx = 0;

  // 2. Cinematic road focus blur
  if (canvas) {
    canvas.style.transition = 'transform 1.1s cubic-bezier(0.16, 1, 0.3, 1), filter 1.1s cubic-bezier(0.16, 1, 0.3, 1)';
    canvas.style.transform = 'scale(1.06)';
    canvas.style.filter = 'blur(10px) brightness(0.4)';
  }

  // 3. Open the Threshold Portal overlay (awaits user choice: ENTER or LEAVE)
  const transitionOverlay = document.getElementById('rabbitHoleTransition');
  if (transitionOverlay) {
    transitionOverlay.classList.remove('active');
    void transitionOverlay.offsetWidth;
    transitionOverlay.classList.add('active');
    transitionOverlay.setAttribute('aria-hidden', 'false');
    startTransitionEmbers();
  }

  document.body.classList.add('rabbit-hole-open');
}

// User confirms ENTER: dissolves into the Monograph
function confirmEnterRabbitHole() {
  if (typeof triggerHaptic === 'function') triggerHaptic('heavy');
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx) {
    try {
      // Resonant harmonic chord: Deep Ding fundamental (D3) + Fifth (A3)
      ResonanceAudio.playTone(0, 0.95, { duration: 4.8, detune: -1200 });
      setTimeout(() => {
        ResonanceAudio.playTone(4, 0.65, { duration: 4.0, detune: -500 });
      }, 160);
    } catch (_) {}
  }

  const el = document.getElementById('rabbit-hole');
  const transitionOverlay = document.getElementById('rabbitHoleTransition');

  if (el) {
    el.classList.remove('rabbit-hole-closing');
    el.setAttribute('aria-hidden', 'false');
    el.scrollTop = 0;
    void el.offsetWidth;

    el.classList.add('visible');
    rhScrollManager.reset();
    rhScrollManager.startParallaxLoop();
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }

  // Fade out portal overlay smoothly
  setTimeout(() => {
    if (transitionOverlay) {
      transitionOverlay.classList.remove('active');
      transitionOverlay.setAttribute('aria-hidden', 'true');
    }
    setTimeout(() => {
      stopTransitionEmbers();
      if (canvas) {
        canvas.style.transform = '';
        canvas.style.filter = '';
        canvas.style.transition = '';
      }
    }, 600);
  }, 400);
}

// User chooses LEAVE: returns to the road
function leaveRabbitHolePortal() {
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx) {
    try {
      ResonanceAudio.playTone(2, 0.5, { duration: 2.2 });
    } catch (_) {}
  }

  const transitionOverlay = document.getElementById('rabbitHoleTransition');
  if (transitionOverlay) {
    transitionOverlay.classList.remove('active');
    transitionOverlay.setAttribute('aria-hidden', 'true');
  }

  stopTransitionEmbers();

  if (canvas) {
    canvas.style.transform = '';
    canvas.style.filter = '';
    canvas.style.transition = '';
  }

  // Back up ball safely to CONTACT_X (11000) so it doesn't immediately re-trigger the threshold
  x = CONTACT_X;
  vx = 0;
  vy = 0;
  y = getGround(x) - ballRadius;
  onGround = true;
  cameraX = x - viewW / 2;
  cameraY = (getGround(x) - viewH * 0.5) * 0.3;
  keys = {};

  endOfRoadState.archiveShown = false;
  endOfRoadState.rabbitHoleShown = false;
  endOfRoadState.fading = false;
  endOfRoadState.fade = 1;
  endOfRoadState.screenFade = 0;

  document.body.classList.remove('rabbit-hole-open');
}

// Wire up portal buttons and mobile exit controls
function initRabbitHolePortalControls() {
  // 1. Enter button on portal
  const enterBtn = document.getElementById('rhPortalEnterBtn');
  if (enterBtn) {
    let lastTime = 0;
    const onEnter = (e) => {
      const now = Date.now();
      if (now - lastTime < 400) return;
      lastTime = now;
      e.preventDefault();
      e.stopPropagation();
      confirmEnterRabbitHole();
    };
    enterBtn.addEventListener('click', onEnter);
    enterBtn.addEventListener('touchend', onEnter);
  }

  // 2. Leave button on portal
  const leaveBtn = document.getElementById('rhPortalLeaveBtn');
  if (leaveBtn) {
    let lastTime = 0;
    const onLeave = (e) => {
      const now = Date.now();
      if (now - lastTime < 400) return;
      lastTime = now;
      e.preventDefault();
      e.stopPropagation();
      leaveRabbitHolePortal();
    };
    leaveBtn.addEventListener('click', onLeave);
    leaveBtn.addEventListener('touchend', onLeave);
  }

  // 3. Mobile floating leave button inside Rabbit Hole
  const mobileLeaveBtn = document.getElementById('rhMobileLeaveBtn');
  if (mobileLeaveBtn) {
    mobileLeaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRabbitHoleScreen(CONTACT_X);
    });
    mobileLeaveBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRabbitHoleScreen(CONTACT_X);
    });
  }

  // 4. On-screen button at Section 6
  const s6OpenBtn = document.getElementById('openRabbitHoleBtn');
  if (s6OpenBtn) {
    s6OpenBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRabbitHoleScreen();
    });
    s6OpenBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRabbitHoleScreen();
    });
  }
}


  const sec7Btn = document.getElementById('openRabbitHoleSectionBtn');
  if (sec7Btn) {
    const onSec7Open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRabbitHoleScreen();
    };
    sec7Btn.addEventListener('click', onSec7Open);
    sec7Btn.addEventListener('touchend', onSec7Open);
  }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRabbitHolePortalControls);
else initRabbitHolePortalControls();




function closeRabbitHoleScreen(targetWorldX) {
  const returnX = (typeof targetWorldX === "number") ? targetWorldX : CONTACT_X;
  const el = document.getElementById('rabbit-hole');
  if (el && el.classList.contains('visible')) {
    el.classList.add('rabbit-hole-closing');
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');

    // Stop active audio preview, close TOC & stop parallax animation loop
    rhScrollManager.stopAudioPreview();
    rhScrollManager.closeToc();
    rhScrollManager.stopParallaxLoop();

    const transitionOverlay = document.getElementById('rabbitHoleTransition');
    if (transitionOverlay) {
      transitionOverlay.classList.add('active');
      setTimeout(() => {
        transitionOverlay.classList.remove('active');
      }, 600);
    }

    const finish = () => {
      el.classList.remove('rabbit-hole-closing');
      endOfRoadState.archiveShown = false;
      endOfRoadState.rabbitHoleShown = false;
      endOfRoadState.fading = false;
      endOfRoadState.fade = 1;
      endOfRoadState.screenFade = 0;
      x = returnX;
      vx = 0;
      vy = 0;
      y = getGround(x) - ballRadius;
      onGround = true;
      cameraX = x - viewW / 2;
      cameraY = (getGround(x) - viewH * 0.5) * 0.3;
      keys = {};
      document.body.classList.remove('rabbit-hole-open');
      if (canvas) {
        try { canvas.focus({ preventScroll: true }); } catch (e) {}
      }
    };

    setTimeout(finish, 450);
  } else {
    endOfRoadState.archiveShown = false;
    endOfRoadState.rabbitHoleShown = false;
    endOfRoadState.fading = false;
    endOfRoadState.fade = 1;
    endOfRoadState.screenFade = 0;
    x = returnX;
    vx = 0;
    vy = 0;
    y = getGround(x) - ballRadius;
    onGround = true;
    cameraX = x - viewW / 2;
    cameraY = (getGround(x) - viewH * 0.5) * 0.3;
    keys = {};
    document.body.classList.remove('rabbit-hole-open');
    if (canvas) {
      try { canvas.focus({ preventScroll: true }); } catch (e) {}
    }
  }
}

// Replaced by startTransitionEmbers() and Canvas engine

(function initBackBtn() {
  const btn = document.getElementById('rabbitHoleBackBtn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerHaptic('light');
      closeRabbitHoleScreen();
    });
  }
})();

// Backward compatibility exports
window.openRabbitHoleScreen = openRabbitHoleScreen;
window.closeRabbitHoleScreen = closeRabbitHoleScreen;
window.rhScrollManager = rhScrollManager;


// ============================================================================
// PROMO CODE COPY BUTTONS (Artisans & Makers Chapter)
// ============================================================================
function initPromoCopyButtons() {
  const copyButtons = document.querySelectorAll('.promo-copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = btn.getAttribute('data-code');
      if (!code) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        if (typeof triggerHaptic === 'function') triggerHaptic('light');
        const copyText = btn.querySelector('.copy-text');
        const origText = copyText ? copyText.textContent : 'Copy';
        if (copyText) copyText.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          if (copyText) copyText.textContent = origText;
          btn.classList.remove('copied');
        }, 2200);
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
      }
    });
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPromoCopyButtons);
else initPromoCopyButtons();


// ============================================================================
// PARTNER LINKS MOBILE & DESKTOP INTERACTION HANDLER
// ============================================================================
function initPartnerLinks() {
  const cards = document.querySelectorAll('.partner-card');
  cards.forEach(card => {
    let lastNavTime = 0;
    const openLink = (e) => {
      const now = Date.now();
      if (now - lastNavTime < 450) return;
      lastNavTime = now;
      e.stopPropagation();
      const href = card.getAttribute('href');
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };
    card.addEventListener('click', openLink);
    card.addEventListener('touchend', openLink);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPartnerLinks);
else initPartnerLinks();


// AUTO_RESUME_AUDIO_ON_FIRST_TOUCH
window.addEventListener('touchstart', () => {
  if (typeof ResonanceAudio !== 'undefined') ResonanceAudio.resume();
}, { passive: true });
