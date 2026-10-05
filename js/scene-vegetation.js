/**
 * scene-vegetation.js
 * Vegetation rendering primitives and shared canvas helpers for the road world.
 * Kept separate from scene orchestration so landmarks, ambience and world state
 * can evolve independently without turning scenes.js into a single renderer.
 */

function getVegGlobalScale() {
  if (typeof vegGlobalScale !== 'undefined') return vegGlobalScale;
  if (typeof window !== 'undefined' && typeof window.vegGlobalScale === 'number') return window.vegGlobalScale;
  return 1;
}
function getCanvas() {
  return (typeof canvas !== 'undefined' && canvas) ? canvas : (window.canvas || document.getElementById('game'));
}
function getCtx() {
  const c = getCanvas();
  return (typeof ctx !== 'undefined' && ctx) ? ctx : (window.ctx || (c ? c.getContext('2d') : null));
}


/** Runtime density scale from performance mode (1 = full, lower = sparser). */
function getVegDensityScale() {
  return (typeof AppCore !== 'undefined' && AppCore.getVegDensityScale) ? AppCore.getVegDensityScale() : 1;
}
function getParticleMax() {
  return (typeof AppCore !== 'undefined' && AppCore.getParticleMax) ? AppCore.getParticleMax() : 120;
}
function getStarCountScale() {
  return (typeof AppCore !== 'undefined' && AppCore.getStarCountScale) ? AppCore.getStarCountScale() : 1;
}
function shouldDrawComplexFoliage() {
  return (typeof AppCore !== 'undefined' && AppCore.shouldDrawComplexFoliage) ? AppCore.shouldDrawComplexFoliage() : true;
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
  if (!getCtx() || !getCanvas()) return;
  const parallax = 0.72;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  const densityMid = getVegDensityScale();
  const complex = shouldDrawComplexFoliage();
  for (let i = 0; i < vegMid.length; i++) {
    if (densityMid < 0.99 && ((i * 31 + 7) % 100) / 100 >= densityMid) continue;
    const m = vegMid[i];
    const sx = m.wx - off;
    const fade = getScreenEdgeAlpha(sx, 65, 140);
    if (fade <= 0.005) continue;
    const gy = getGroundMid(m.wx);
    const sz = m.size * Math.sqrt(getVegGlobalScale());

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
  if (!getCtx() || !getCanvas()) return;
  const parallax = 1.0;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  const densityNear = getVegDensityScale();
  for (let i = 0; i < vegNear.length; i++) {
    if (densityNear < 0.99 && ((i * 13 + 11) % 100) / 100 >= densityNear) continue;
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
  if (!getCtx() || !getCanvas()) return;
  const parallax = 1.45;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  ctx.save();
  ctx.filter = 'blur(3px)';
  const densityFore = getVegDensityScale();
  for (let i = 0; i < vegFore.length; i++) {
    if (densityFore < 0.99 && ((i * 19 + 5) % 100) / 100 >= densityFore) continue;
    const n = vegFore[i];
    const sx = n.wx - off;
    const fade = getScreenEdgeAlpha(sx, 140, 220);
    if (fade <= 0.005) continue;
    const gy = getGround(n.wx) + viewH * 0.06;
    const sz = n.size * getVegGlobalScale() * 1.15;
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * fade;
    if (n.type === 'cypress') drawCypressNear(n, sx, gy, sz, n.seed, time);
    else if (n.type === 'pine') drawStonePineNear(n, sx, gy, sz, n.seed, time);
    else drawOliveTreeNear(n, sx, gy, sz, n.seed, time);
    ctx.restore();
  }
  ctx.filter = 'none';
  ctx.restore();
}

function drawVegFar(offset) {
  if (!getCtx() || !getCanvas()) return;
  const parallax = 0.40;
  const off = offset * parallax;
  const time = Date.now() * 0.001;
  ctx.save();

  const densityFar = getVegDensityScale();
  for (let i = 0; i < vegFar.length; i++) {
    // Deterministic sparse sampling for lower performance modes
    if (densityFar < 0.99 && ((i * 17 + 3) % 100) / 100 >= densityFar) continue;
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

// Starfield, atmosphere, horizon lights, particles → js/scenes-effects.js
