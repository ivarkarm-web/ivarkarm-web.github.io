/**
 * scenes.js
 * Botanical models, vegetation layers, starfield, atmosphere, hills,
 * ground, particles, audio orbs, landmarks, and all canvas drawing helpers.
 * Depends on: utilities.js, content.js (veg data, constants)
 */

function drawAudioOrbs(offset) {
  if (!getCtx() || !getCanvas()) return;
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
  const hairline = sectionEl.querySelector('.hairline');
  const heading = sectionEl.querySelector('h1, h2');
  const rest = sectionEl.querySelectorAll(
    '.eyebrow, .lead, .subtitle, .subtext, p:not(.lead), .story-entry, .music-player, .contact-icons'
  );
  const partnerCards = sectionEl.querySelectorAll('.partner-card');
  const all = [hairline, heading, ...rest, ...partnerCards].filter(Boolean);
  if (!all.length) return;
  gsap.killTweensOf(all);

  const isPartners = sectionEl.id === 's5';
  const tl = gsap.timeline();
  if (hairline) {
    tl.fromTo(hairline, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.6, duration: 0.5, ease: 'power2.out' }, 0);
  }
  if (heading) {
    tl.fromTo(heading,
      { clipPath: 'inset(0 0 100% 0)', y: 14 },
      { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 0.85, ease: 'expo.out' },
      hairline ? 0.08 : 0
    );
  }
  if (rest.length) {
    tl.fromTo(rest,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.05, overwrite: true },
      heading ? 0.32 : 0.1
    );
  }
  if (partnerCards.length) {
    const list = sectionEl.querySelector('.partners-list');
    if (list) gsap.set(list, { transformPerspective: 1200, transformStyle: 'preserve-3d' });
    gsap.set(partnerCards, {
      transformPerspective: 1200,
      transformStyle: 'preserve-3d',
      transformOrigin: 'left center',
      opacity: 0
    });
    partnerCards.forEach((card, idx) => {
      // Sequential 3D flip-in: edge hinge from left, slight rise, no oversized scale
      tl.fromTo(card,
        {
          opacity: 0,
          rotateY: isPartners ? -92 : -40,
          rotateX: isPartners ? 6 : 0,
          x: isPartners ? -28 : 0,
          y: 18,
          scale: 0.92,
          filter: 'blur(6px)'
        },
        {
          opacity: 1,
          rotateY: 0,
          rotateX: 0,
          x: 0,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: isPartners ? 0.72 : 0.65,
          ease: isPartners ? 'power3.out' : 'back.out(2)',
          overwrite: true,
          clearProps: 'filter'
        },
        (isPartners ? 0.42 : 0.2) + idx * (isPartners ? 0.22 : 0.28)
      );
    });
  }
}

function updateSections() {
  if (!canvas) return;
  let closestIndex = 0;
  let closestDistance = Infinity;
  sectionPositions.forEach((pos, index) => {
    const sectionEl = document.getElementById('s' + index) || document.querySelector('[data-section-id="s' + index + '"]');
    const distance = pos.x - x;
    if (Math.abs(distance) < closestDistance) {
      closestDistance = Math.abs(distance);
      closestIndex = index;
    }
    if (!sectionEl) return;
    const parallaxX = distance * parallaxSpeed;
    const terrainY = getGround(pos.x);
    const verticalOffset = (viewH * 0.5 - terrainY) * 0.3;
    sectionEl.style.transform = 'translate(calc(-50% + ' + parallaxX + 'px), calc(-50% + ' + verticalOffset + 'px))';
    // Partners (5): tighter window so the flip sequence is visible on-screen, not off to the side
    const revealRange = (index === 0) ? 700 : (index === 5) ? 720 : (index === 6) ? 1000 : 1100;
    const contentRevealDist = (index === 5) ? 420 : revealRange;
    if (Math.abs(distance) < revealRange) {
      sectionEl.classList.add('visible');
      let opacity = Math.max(0, 1 - (Math.abs(distance) / revealRange));
      if (index === 6 && x > CONTACT_X && endOfRoadState.fading) {
        opacity *= endOfRoadState.fade;
      }
      // Partners: hold cards invisible until the flip timeline runs (avoids early glimpse)
      if (index === 5 && !sectionRevealed.has(index)) {
        sectionEl.querySelectorAll('.partner-card').forEach((c) => { c.style.opacity = '0'; });
      }
      sectionEl.style.opacity = String(Math.min(1, Math.max(0.15, opacity)));
      if (Math.abs(distance) < contentRevealDist && !sectionRevealed.has(index)) {
        sectionRevealed.add(index);
        revealSectionContent(sectionEl);
      }
      if (index === 6 && !contactIconsAnimated) {
        document.querySelectorAll('.contact-icon').forEach(el => el.classList.add('visible'));
        const bookButton = document.getElementById('bookMeButton');
        if (bookButton) window.setTimeout(() => bookButton.classList.add('visible'), 620);
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
      /* discovery counter removed — shards still show */
      ResonanceAudio.playTone(s.noteIdx, 0.65, { duration: 3.2 });
      spawnSoundRing(s.x, getGround(s.x) - 25);
      showMemoryShard(s);
      if (typeof trackEvent === 'function') {
        trackEvent('discovery', { id: s.id || '', title: s.title || '' });
      }
      if (typeof triggerHaptic === 'function') triggerHaptic('medium');
    }
  }
}

let memoryShardTimer = null;

function showMemoryShard(stone) {
  const hud = document.getElementById('memoryShardHud');
  if (!hud) return;
  const metaEl = document.getElementById('memoryShardMeta');
  const titleEl = document.getElementById('memoryShardTitle');
  const textEl = document.getElementById('memoryShardText');
  if (metaEl) metaEl.textContent = stone.meta || '';
  if (titleEl) titleEl.textContent = stone.title || '';
  if (textEl) textEl.textContent = stone.text || '';
  hud.classList.add('active');
  hud.setAttribute('aria-hidden', 'false');
  if (memoryShardTimer) clearTimeout(memoryShardTimer);
  memoryShardTimer = setTimeout(() => {
    hideMemoryShard();
    memoryShardTimer = null;
  }, 10000);
}

function hideMemoryShard() {
  const hud = document.getElementById('memoryShardHud');
  if (!hud) return;
  hud.classList.remove('active');
  hud.setAttribute('aria-hidden', 'true');
  if (memoryShardTimer) {
    clearTimeout(memoryShardTimer);
    memoryShardTimer = null;
  }
}

function update(dt) {
  if (!gameStarted) return;
  if (endOfRoadState.rabbitHoleShown) return;
  if (typeof videoPlayer !== 'undefined' && videoPlayer.isOpen) {
    updateCamera(dt);
    return;
  }
  // Music player drawer open: the platformer is frozen until the player is closed
  if (typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen) {
    ResonanceAudio.updateRolling(0, true);
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

  // Dash removed from controls — keep vars inert
  if (false && (keys['shift'] || keys['dash']) && dashCooldown <= 0 && gameStarted) {
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
    // Endpoint: stop the handpan and fade it out. Portal CTA is the only way in —
    // do NOT auto-open the rabbit hole by rolling further.
    if (eased >= 0.82) {
      endOfRoadState.fade = 0;
      endOfRoadState.screenFade = 1;
      x = WORLD_END_X;
      if (vx > 0) vx = 0;
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
  if (!getCtx() || !getCanvas()) return;
  const r = ballRadius;

  // 1. Soft depth-adjusted contact shadow on the ground
  if (onGround) {
    ctx.save();
    const shadowY = getGround(x);
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

  // 2. Outer harmonic acoustic aura (strike pulse + live bands)
  const timeSinceNote = (performance.now() - ResonanceAudio.lastNoteTime) / 1000;
  const notePulse = timeSinceNote < 1.5 ? Math.exp(-timeSinceNote * 2.5) : 0;
  let bandAmp = 0;
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.bands) {
    bandAmp = ResonanceAudio.bands.amplitude * 0.35 + ResonanceAudio.bands.mid * 0.2;
  }
  const auraR = r * (1.6 + notePulse * 0.4 + bandAmp * 0.55);

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
  if (!context || !getCanvas()) return;
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
    let audioHigh = 0;
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.bands) {
      audioHigh = ResonanceAudio.bands.high * 0.55 + ResonanceAudio.bands.amplitude * 0.25;
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + i) + audioHigh * 0.35;
    const glowR = 48 + pulse * 14 + audioHigh * 18;
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
  if (!context || !getCanvas()) return;

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

// --- end of additional scenes extract ---
function updateBackgroundSlideshow(dt) {
  const images = (typeof bgImages !== 'undefined' && bgImages) ? bgImages : (window.bgImages || []);
  const ready = (typeof bgReadyCount !== 'undefined') ? bgReadyCount : (window.bgReadyCount || 0);
  if (images.length < 2 || ready < 1) return;

  // Use window-backed state so missing lexical bindings cannot crash the loop
  if (typeof window.bgPhase === 'undefined') window.bgPhase = 'hold';
  if (typeof window.bgTimer === 'undefined') window.bgTimer = 0;
  if (typeof window.bgFadeProgress === 'undefined') window.bgFadeProgress = 0;
  if (typeof window.bgCurrentIndex === 'undefined') window.bgCurrentIndex = 0;
  if (typeof window.bgNextIndex === 'undefined') window.bgNextIndex = 1;
  const holdDur = (typeof BG_HOLD_DURATION !== 'undefined') ? BG_HOLD_DURATION : 4.0;
  const fadeDur = (typeof BG_FADE_DURATION !== 'undefined') ? BG_FADE_DURATION : 2.5;

  window.bgTimer += dt;
  if (window.bgPhase === 'hold') {
    if (window.bgTimer >= holdDur && ready >= 2) {
      window.bgPhase = 'fade';
      window.bgTimer = 0;
      window.bgFadeProgress = 0;
      let attempts = 0;
      do {
        window.bgNextIndex = (window.bgCurrentIndex + 1 + attempts) % images.length;
        attempts++;
      } while (images[window.bgNextIndex] && (!images[window.bgNextIndex].complete || images[window.bgNextIndex].naturalWidth === 0) && attempts < images.length);
    }
  } else if (window.bgPhase === 'fade') {
    window.bgFadeProgress = Math.min(1, window.bgTimer / fadeDur);
    if (window.bgFadeProgress >= 1) {
      window.bgCurrentIndex = window.bgNextIndex;
      window.bgFadeProgress = 0;
      window.bgPhase = 'hold';
      window.bgTimer = 0;
    }
  }
  // Mirror onto lexical bindings when they exist
  try {
    if (typeof bgPhase !== 'undefined') bgPhase = window.bgPhase;
    if (typeof bgTimer !== 'undefined') bgTimer = window.bgTimer;
    if (typeof bgFadeProgress !== 'undefined') bgFadeProgress = window.bgFadeProgress;
    if (typeof bgCurrentIndex !== 'undefined') bgCurrentIndex = window.bgCurrentIndex;
    if (typeof bgNextIndex !== 'undefined') bgNextIndex = window.bgNextIndex;
  } catch (_) {}
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
  if (!context || !getCanvas()) return;
  const light = typeof isLightTheme === 'function' && isLightTheme();
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
  const innerR = Math.min(ew, eh) * 0.42;
  const outerR = Math.sqrt(ew * ew + eh * eh) / 2;
  const g = context.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  if (light) {
    // Very light edge only — do not wash out slideshow photos
    g.addColorStop(0, 'rgba(235, 228, 212, 0)');
    g.addColorStop(0.7, 'rgba(235, 228, 212, 0.08)');
    g.addColorStop(1, 'rgba(230, 223, 208, 0.28)');
  } else {
    g.addColorStop(0, 'rgba(3, 5, 8, 0)');
    g.addColorStop(0.65, 'rgba(3, 5, 8, 0.18)');
    g.addColorStop(1, 'rgba(3, 5, 8, 0.55)');
  }
  context.save();
  context.fillStyle = g;
  context.fillRect(ox, oy, ew, eh);
  context.restore();
}

function drawBackgroundGalleryImages(context) {
  const images = (typeof bgImages !== 'undefined' && bgImages) ? bgImages : (window.bgImages || []);
  const ready = (typeof bgReadyCount !== 'undefined') ? bgReadyCount : (window.bgReadyCount || 0);
  const cnv = (typeof canvas !== 'undefined') ? canvas : document.getElementById('game');
  if (!context || !cnv || ready === 0 || images.length === 0) return;

  const curIdx = (typeof window.bgCurrentIndex !== 'undefined') ? window.bgCurrentIndex : (typeof bgCurrentIndex !== 'undefined' ? bgCurrentIndex : 0);
  const nextIdx = (typeof window.bgNextIndex !== 'undefined') ? window.bgNextIndex : (typeof bgNextIndex !== 'undefined' ? bgNextIndex : 1);
  const fade = (typeof window.bgFadeProgress !== 'undefined') ? window.bgFadeProgress : (typeof bgFadeProgress !== 'undefined' ? bgFadeProgress : 0);
  const phase = (typeof window.bgPhase !== 'undefined') ? window.bgPhase : (typeof bgPhase !== 'undefined' ? bgPhase : 'hold');
  let maxOp = (typeof window.BG_MAX_OPACITY === 'number') ? window.BG_MAX_OPACITY
    : ((typeof BG_MAX_OPACITY !== 'undefined') ? BG_MAX_OPACITY : 0.92);
  if (typeof isLightTheme === 'function' && isLightTheme()) {
    maxOp = Math.max(maxOp, 0.95); // full-strength photos in light mode
  }

  const currentImg = images[curIdx];
  const nextImg = images[nextIdx];
  const currentAlpha = maxOp * (1 - fade);
  const nextAlpha = maxOp * fade;

  const vh = (typeof viewH !== 'undefined') ? viewH : window.innerHeight;
  const upOffset = -vh * 0.25;
  const yOffsetFor = (idx) => (idx === 2 || idx === 5 || idx === 6) ? upOffset : 0;

  drawCoverImage(context, currentImg, currentAlpha, yOffsetFor(curIdx));
  if (phase === 'fade' && nextImg) {
    drawCoverImage(context, nextImg, nextAlpha, yOffsetFor(nextIdx));
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
  if (typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMusicDrawer();
    }
    return; // game controls stay frozen while the player is open
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
    const shard = document.getElementById('memoryShardHud');
    if (shard && shard.classList.contains('active')) {
      e.preventDefault();
      hideMemoryShard();
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

  if (e.key === 'ArrowUp' && improvCueActive) {
    e.preventDefault();
    openMusicDrawer();
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
  if (!context || !getCanvas()) return;
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


// Drawing helpers (drawVeg*, drawBall, drawResonantStones, drawChapterLandmarks, etc.) moved to js/scenes.js

// Ensure critical draw fns are reachable even if lexical scope is odd
try {
  window.drawVegFar = drawVegFar;
  window.drawVegMid = drawVegMid;
  window.drawVegNear = drawVegNear;
  window.drawVegFore = drawVegFore;
  window.drawBall = drawBall;
  window.drawGround = drawGround;
  window.drawHillsFar = drawHillsFar;
  window.drawHillsMid = drawHillsMid;
  window.update = update;
} catch (e) { console.warn('scene export', e); }
