// Register ScrollTrigger if GSAP is available in the window
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Canvas setup
const canvas = document.getElementById("game");
const ctx = canvas ? canvas.getContext("2d") : null;
// Expose on window so modules that load earlier can safely reference them
window.canvas = canvas;
window.ctx = ctx;

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
  // Use performance-mode DPR cap when available
  let dprCap = 2;
  if (typeof AppCore !== 'undefined' && AppCore.getSettings) {
    dprCap = AppCore.getSettings().dprCap || 2;
  }
  DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, dprCap));
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  canvas.width = Math.round(viewW * DPR);
  canvas.height = Math.round(viewH * DPR);
  if (ctx) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  updateVegGlobalScale();
  window.viewW = viewW;
  window.viewH = viewH;
  window.DPR = DPR;
  window.vegGlobalScale = vegGlobalScale;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// Physics state (ball, dash, keys, camera, gameStarted) moved to js/physics.js
// Data (resonantStones, veg*, sectionPositions, audioOrbs, bg*, stars, etc.) moved to js/content.js
// Background slideshow + remaining early draw helpers moved to js/scenes.js
function isLightTheme() {
  try {
    return document.documentElement.getAttribute('data-theme') === 'light';
  } catch (_) {
    return false;
  }
}
window.isLightTheme = isLightTheme;

function draw(offset) {
  if (!ctx || !canvas) return;
  const call = (fn, ...args) => { if (typeof fn === 'function') try { fn(...args); } catch (e) { console.warn('draw layer error', e.message); } };
  const light = isLightTheme();
  ctx.save();
  // Cohesive sky: night charcoal vs day parchment atmosphere
  if (light) {
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, '#d8d0be');
    sky.addColorStop(0.45, '#ebe4d4');
    sky.addColorStop(1, '#cfc6b4');
    ctx.fillStyle = sky;
  } else {
    ctx.fillStyle = '#030508';
  }
  ctx.fillRect(0, 0, viewW, viewH);
  const zoom = zoomLevel || 1;
  if (zoom !== 1) {
    const zcx = viewW / 2;
    const zcy = viewH * 0.44;
    ctx.translate(zcx, zcy);
    ctx.scale(zoom, zoom);
    ctx.translate(-zcx, -zcy);
  }
  call(drawGiantBackgroundFlowerOfLife, ctx);
  call(drawStarfield, ctx, offset);
  call(drawBackgroundGalleryImages, ctx, offset);
  call(drawAtmosphereBands, ctx);
  if (Math.abs(cameraY) > 0.01) ctx.translate(0, -cameraY);

  call(drawHillsFar, offset);
  call(drawChapterLandmarks, ctx, offset);
  call(typeof drawVegFar === "function" ? drawVegFar : window.drawVegFar, offset);
  call(drawHorizonLights, offset);
  call(drawHillsMid, offset);
  call(drawVegMid, offset);
  call(drawGround, offset);
  call(drawResonantStones, ctx, offset);
  call(drawVegNear, offset);
  call(drawWorldParticles, offset);
  call(drawAudioOrbs, offset);

  const edgeFade = leftSecretState.alpha;
  if (gameStarted && edgeFade < 0.99 && endOfRoadState.fade > 0.01) {
    ctx.save();
    ctx.globalAlpha = (1 - edgeFade) * endOfRoadState.fade;
    // Calculate accurate screen position based on camera offset
    const ballScreenX = x - offset;
    call(typeof drawBall === "function" ? drawBall : window.drawBall, ballScreenX, y);
    ctx.restore();
  }
  call(drawVegFore, offset);
  ctx.restore();

  if (endOfRoadState.screenFade > 0.01 && !endOfRoadState.rabbitHoleShown) {
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = (typeof isLightTheme === 'function' && isLightTheme())
      ? ('rgba(235, 228, 212, ' + (endOfRoadState.screenFade * 0.92) + ')')
      : ('rgba(5, 5, 5, ' + (endOfRoadState.screenFade * 0.92) + ')');
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }
}

// Visible "pull up" cue for the Improv Sessions music player
let improvCueActive = false;
let improvCueEl = null;
function updateImprovCue() {
  if (!improvCueEl) improvCueEl = document.getElementById('mpPullCue');
  if (!improvCueEl) return;
  const pos = sectionPositions[4];
  const drawerOpen = typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen;
  const videoOpen = typeof videoPlayer !== 'undefined' && videoPlayer.isOpen;
  const active = !!pos && gameStarted && !drawerOpen && !videoOpen &&
    !endOfRoadState.rabbitHoleShown && Math.abs(pos.x - x) < 520;
  if (active === improvCueActive) return;
  improvCueActive = active;
  improvCueEl.classList.toggle('show', active);
  improvCueEl.setAttribute('aria-hidden', active ? 'false' : 'true');
  improvCueEl.tabIndex = active ? 0 : -1;
}

// End-of-road hint: after Contact, invite the player to keep rolling into the Rabbit Hole
let rhRollCueActive = false;
let rhRollCueEl = null;
function updateRhRollCue() {
  if (!rhRollCueEl) rhRollCueEl = document.getElementById('rhRollCue');
  if (!rhRollCueEl) return;
  const contactX = (typeof CONTACT_X === 'number') ? CONTACT_X : 11000;
  const fadeStart = (typeof END_FADE_START_X === 'number') ? END_FADE_START_X : 11350;
  const drawerOpen = typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen;
  const videoOpen = typeof videoPlayer !== 'undefined' && videoPlayer.isOpen;
  // Show after contact plate, before the auto-fade fully takes over
  const pastContact = gameStarted && x > contactX + 180;
  const beforeDeepFade = x < fadeStart + 180;
  const active = pastContact && beforeDeepFade && !endOfRoadState.rabbitHoleShown && !drawerOpen && !videoOpen;
  if (active === rhRollCueActive) return;
  rhRollCueActive = active;
  rhRollCueEl.classList.toggle('show', active);
  rhRollCueEl.setAttribute('aria-hidden', active ? 'false' : 'true');
}

let lastTime = performance.now();
let rafId = null;

function loop(now) {
  rafId = requestAnimationFrame(loop);

  // Pause expensive work when tab is hidden
  if (typeof AppCore !== 'undefined' && AppCore.isRafPaused && AppCore.isRafPaused()) {
    lastTime = now;
    return;
  }

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Reduced motion: still advance state lightly but skip heavy visual updates if desired
  const reduced = (typeof AppCore !== 'undefined' && AppCore.getCapabilities && AppCore.getCapabilities().reducedMotion);

  try {
    if (typeof updateBackgroundSlideshow === 'function') updateBackgroundSlideshow(dt);
    if (typeof update === 'function') update(dt);
    if (typeof updateImprovCue === 'function') updateImprovCue();
    if (typeof updateRhRollCue === 'function') updateRhRollCue();
    if (typeof updateWorldParticles === 'function') updateWorldParticles(dt);
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.updateBands) {
      ResonanceAudio.updateBands();
    }
    if (typeof canvas !== 'undefined' && canvas && ctx) {
      draw(cameraX);
    }
  } catch (loopErr) {
    // Keep the loop alive; log once per second max
    if (!loop._lastErr || now - loop._lastErr > 1000) {
      console.warn('frame error:', loopErr);
      loop._lastErr = now;
    }
  }
}

// Resume cleanly after tab becomes visible again
window.addEventListener('appresume', () => {
  lastTime = performance.now();
});

// React to performance mode changes (re-apply DPR)
window.addEventListener('perfmodechange', () => {
  resizeCanvas();
});

rafId = requestAnimationFrame(loop);

// Navigation links
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
    if (typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen) closeMusicDrawer();
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
    if (index !== undefined && sectionPositions[index]) {
      x = sectionPositions[index].x;
      vx = 0;
      if (endOfRoadState.rabbitHoleShown) closeRabbitHoleScreen();
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

// QR Tip Popup — mobile-first, isolated from game touch steering
(function initTipQr() {
  const popup = document.getElementById('qrPopup');
  if (!popup) return;

  const BUSK_URL = 'https://busk.co/84950/tip';

  function openTipQr() {
    popup.classList.add('visible');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qr-open');
    if (typeof trackEvent === 'function') trackEvent('tip_open', { source: 'nav' });
  }
  function closeTipQr() {
    popup.classList.remove('visible');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qr-open');
  }
  function toggleTipQr() {
    if (popup.classList.contains('visible')) closeTipQr();
    else openTipQr();
  }

  window.openTipQr = openTipQr;
  window.closeTipQr = closeTipQr;
  window.toggleTipQr = toggleTipQr;

  // Open from nav tip button(s)
  ['tipButton', 'tipButtonMobile'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTipQr();
    };
    btn.addEventListener('click', open);
    btn.addEventListener('touchend', open, { passive: false });
  });

  // Unified handler for anything inside the popup
  const onPopupActivate = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    // CLOSE
    if (t.closest('#qrCloseBtn, #qrCloseTextBtn, .qr-close, .qr-close-x')) {
      e.preventDefault();
      e.stopPropagation();
      closeTipQr();
      return;
    }

    // BUSK LINK / BUTTON — force navigation (iOS-safe)
    const busk = t.closest('#qrBuskLink, #qrBuskBtn, .qr-link, .qr-busk-btn');
    if (busk) {
      e.preventDefault();
      e.stopPropagation();
      // Prefer new tab; fall back to same tab if blocked
      const win = window.open(BUSK_URL, '_blank', 'noopener,noreferrer');
      if (!win) window.location.href = BUSK_URL;
      return;
    }

    // Backdrop (tap outside the card)
    if (t === popup) {
      e.preventDefault();
      e.stopPropagation();
      closeTipQr();
    }
  };

  // Prefer touchend on mobile; click for desktop — both bound
  popup.addEventListener('touchend', onPopupActivate, { passive: false });
  popup.addEventListener('click', onPopupActivate);

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'Esc') && popup.classList.contains('visible')) {
      e.preventDefault();
      closeTipQr();
    }
  });
})();

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
// UI systems (modality, music, video, rabbit-hole, touch, navigation) moved to js/ui.js


/* Cursor resonance expansion on interactive targets */
(function initCursorResonance() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const interactive = 'a, button, .partner-card, .nav-action-btn, .welcome-enter, .rh-chapter-step, .dm-quicknav-btn';
  document.addEventListener('mouseover', (e) => {
    if (e.target && e.target.closest && e.target.closest(interactive)) {
      document.body.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target && e.target.closest && e.target.closest(interactive)) {
      document.body.classList.remove('cursor-hover');
    }
  });
})();
