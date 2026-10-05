/**
 * scenes-effects.js
 * Starfield, atmosphere, horizon lights, world particles, and related helpers.
 * Depends on: utilities, content, core, audio (for bands), physics state.
 */

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

function drawStarfield(context, offset) {
  if (!context || !canvas) return;
  // Day journey: no night stars
  if (typeof isLightTheme === 'function' && isLightTheme()) return;
  const ch = viewH;
  const time = Date.now() * 0.001;
  const PARALLAX_FAR = 0.10;
  const PARALLAX_MID = 0.28;
  const PARALLAX_NEAR = 0.52;

  // Subtle breathing with the handpan (never a hard equalizer)
  let audioBoost = 1;
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.bands) {
    audioBoost = 1 + ResonanceAudio.bands.amplitude * 0.55 + ResonanceAudio.bands.high * 0.25;
  }

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
      const alpha = Math.min(1, baseAlpha * twinkle * audioBoost);
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

  const starScale = getStarCountScale();
  // Pass scaled length by temporarily limiting via a thin wrapper
  function limitedLayer(stars, parallax, baseAlpha, glow) {
    const limit = Math.max(1, Math.floor(stars.length * starScale));
    // Reuse drawLayer but only first `limit` items by slicing view (cheap)
    const view = stars.length === limit ? stars : stars.slice(0, limit);
    drawLayer(view, parallax, baseAlpha, glow);
  }
  limitedLayer(starsFar, PARALLAX_FAR, 0.28, false);
  limitedLayer(starsMid, PARALLAX_MID, 0.42, false);
  limitedLayer(starsNear, PARALLAX_NEAR, 0.58, true);
}

function drawAtmosphereBands(context) {
  if (!context || !canvas) return;
  const light = typeof isLightTheme === 'function' && isLightTheme();
  const cw = viewW;
  const ch = viewH;
  const z = Math.max(0.3, Math.min(1, zoomLevel || 1));
  const expand = 1 / z;
  const ox = cw * 0.5 * (1 - expand);
  const oy = ch * 0.5 * (1 - expand);
  const ew = cw * expand;
  const eh = ch * expand;

  const lowFog = context.createLinearGradient(0, oy + eh * 0.48, 0, oy + eh);
  if (light) {
    lowFog.addColorStop(0, 'rgba(200, 190, 170, 0)');
    lowFog.addColorStop(0.4, 'rgba(190, 178, 155, 0.35)');
    lowFog.addColorStop(0.75, 'rgba(175, 162, 138, 0.7)');
    lowFog.addColorStop(1, 'rgba(160, 148, 124, 0.88)');
  } else {
    lowFog.addColorStop(0, 'rgba(3, 5, 8, 0)');
    lowFog.addColorStop(0.35, 'rgba(3, 5, 8, 0.45)');
    lowFog.addColorStop(0.65, 'rgba(3, 5, 8, 0.82)');
    lowFog.addColorStop(1, 'rgba(3, 5, 8, 0.95)');
  }
  context.fillStyle = lowFog;
  context.fillRect(ox, oy + eh * 0.48, ew, eh * 0.52);

  const maskTop = oy + eh * 0.62;
  const maskH = (oy + eh) - maskTop + ch * 0.15;
  context.fillStyle = light ? 'rgba(165, 152, 128, 0.75)' : 'rgba(3, 5, 8, 0.92)';
  context.fillRect(ox - cw * 0.1, maskTop, ew + cw * 0.2, maskH);
}

function getZoomDrawRange() {
  const z = zoomLevel || 1;
  const cw = canvas ? viewW : 0;
  if (z >= 0.999) return { min: 0, max: cw };
  const half = cw / 2;
  return { min: half * (1 - 1 / z), max: half * (1 + 1 / z) };
}

function getAudioTerrainOffset() {
  if (typeof ResonanceAudio === 'undefined' || !ResonanceAudio.bands) return 0;
  if (typeof AppCore !== 'undefined' && AppCore.caps && AppCore.caps.reducedMotion) return 0;
  const b = ResonanceAudio.bands;
  // Bass lifts the land gently; amplitude adds slow breathing
  return -(b.bass * 10 + b.amplitude * 4);
}

function buildTerrainPath(context, offset, getHeightFn, step) {
  step = step || 6;
  const range = getZoomDrawRange();
  const audioY = getAudioTerrainOffset();
  context.beginPath();
  let first = true;
  for (let i = range.min; i <= range.max; i += step) {
    const worldX = i + offset;
    // Spatial modulation so the whole ridge does not bounce as one block
    const wave = Math.sin(worldX * 0.004 + (Date.now() * 0.0004)) * (ResonanceAudio.bands ? ResonanceAudio.bands.mid * 3 : 0);
    const gy = getHeightFn(worldX) + audioY + wave;
    if (first) { context.moveTo(i, gy); first = false; }
    else context.lineTo(i, gy);
  }
  const lastWorldX = range.max + offset;
  const lastY = getHeightFn(lastWorldX) + audioY;
  context.lineTo(range.max, lastY);
  context.lineTo(range.max, viewH + 120);
  context.lineTo(range.min, viewH + 120);
  context.closePath();
}

function drawHillsFar(offset) {
  if (!ctx || !canvas) return;
  const parallaxOffset = offset * 0.40;
  ctx.save();
  buildTerrainPath(ctx, parallaxOffset, getGroundFar, 10);
  ctx.fillStyle = (typeof isLightTheme === 'function' && isLightTheme())
    ? 'rgba(186, 175, 150, 0.85)'
    : 'rgba(10, 14, 22, 0.72)';
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
    let audioPulse = 1;
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.bands) {
      // Gentle bass-driven glow — cinematic, not flashy
      audioPulse = 1 + ResonanceAudio.bands.bass * 0.45 + ResonanceAudio.bands.amplitude * 0.2;
    }
    const pulse = (0.82 + 0.18 * Math.sin(time * (1.1 + l.size * 0.3) + i)) * audioPulse;
    const size = 22 * l.size * pulse;
    const intensity = l.intensity * Math.min(1.35, audioPulse);

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
  ctx.fillStyle = (typeof isLightTheme === 'function' && isLightTheme())
    ? 'rgba(168, 156, 132, 0.92)'
    : 'rgba(7, 9, 14, 0.90)';
  ctx.fill();
  ctx.restore();
}

function drawGround(offset) {
  if (!ctx || !canvas) return;
  const light = typeof isLightTheme === 'function' && isLightTheme();
  ctx.save();
  buildTerrainPath(ctx, offset, getGround, 6);
  ctx.fillStyle = light ? '#b5a88e' : '#07090e';
  ctx.fill();
  ctx.restore();

  ctx.save();
  const step = 6;
  const range = getZoomDrawRange();
  ctx.strokeStyle = light ? 'rgba(120, 90, 30, 0.55)' : 'rgba(212, 175, 55, 0.40)';
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

  let particleAudio = 1;
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.bands) {
    particleAudio = 1 + ResonanceAudio.bands.mid * 0.4 + ResonanceAudio.bands.amplitude * 0.25;
  }

  for (let i = 0; i < resonanceParticles.length; i++) {
    const p = resonanceParticles[i];
    const sx = p.wx - offset;
    const sy = p.wy;
    if (sx < -20 || sx > viewW + 20) continue;
    const twinkle = 0.72 + Math.sin(time * (p.twinkleSpeed || 5) + (p.seed || 0)) * 0.28;
    const r = p.r0 * (0.85 + (1 - p.life) * 1.2) * twinkle * Math.min(1.2, particleAudio);
    const alpha = Math.max(0, p.life) * (p.golden ? 0.58 : 0.34) * twinkle * Math.min(1.35, particleAudio);
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

