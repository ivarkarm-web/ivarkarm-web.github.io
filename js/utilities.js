/**
 * utilities.js
 * Pure helper functions for procedural generation, math, haptics and common utilities.
 */

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

function windSway(time, wx, layer) {
  const slow = 0.35 + layer * 0.2;
  const fast = 1.2 + layer * 0.3;
  return Math.sin(time * slow + wx * 0.0021) * 0.45 +
    Math.sin(time * fast + wx * 0.0053) * 0.3 +
    Math.sin(time * 2.4 + wx * 0.011) * 0.22;
}

// Universal smooth atmospheric screen-edge fade (Hermite smoothstep)
function getScreenEdgeAlpha(sx, halfWidth = 60, fadeDist = 140) {
  const leftBound = -halfWidth - fadeDist;
  const rightBound = viewW + halfWidth + fadeDist;
  if (sx <= leftBound || sx >= rightBound) return 0;

  const leftMargin = halfWidth + fadeDist;
  const rightMargin = viewW - (halfWidth + fadeDist);

  if (sx >= leftMargin && sx <= rightMargin) {
    return 1.0;
  }

  if (sx < leftMargin) {
    const t = Math.max(0, Math.min(1, (sx - leftBound) / (leftMargin - leftBound)));
    return t * t * (3 - 2 * t);
  }

  const t = Math.max(0, Math.min(1, (rightBound - sx) / (rightBound - rightMargin)));
  return t * t * (3 - 2 * t);
}

function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'double':
          navigator.vibrate([12, 35, 14]);
          break;
        case 'success':
          navigator.vibrate([14, 28, 22]);
          break;
        default:
          navigator.vibrate(12);
      }
    } catch (e) {}
  }
}
