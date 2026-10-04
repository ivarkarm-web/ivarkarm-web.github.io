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
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// Physics state (ball, dash, keys, camera, gameStarted) moved to js/physics.js
// Data (resonantStones, veg*, sectionPositions, audioOrbs, bg*, stars, etc.) moved to js/content.js
// Background slideshow + remaining early draw helpers moved to js/scenes.js
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
  if (gameStarted && edgeFade < 0.99 && endOfRoadState.fade > 0.01) {
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

// Small glowing "pull up" cue for the Improv Sessions music player
let improvCueActive = false;
let improvCueEl = null;
function updateImprovCue() {
  if (!improvCueEl) improvCueEl = document.getElementById('mpPullCue');
  if (!improvCueEl) return;
  const pos = sectionPositions[4];
  const drawerOpen = typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen;
  const videoOpen = typeof videoPlayer !== 'undefined' && videoPlayer.isOpen;
  const active = !!pos && gameStarted && !drawerOpen && !videoOpen &&
    !endOfRoadState.rabbitHoleShown && Math.abs(pos.x - x) < 420;
  if (active === improvCueActive) return;
  improvCueActive = active;
  improvCueEl.classList.toggle('show', active);
  improvCueEl.setAttribute('aria-hidden', active ? 'false' : 'true');
  improvCueEl.tabIndex = active ? 0 : -1;
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

  if (typeof updateBackgroundSlideshow === 'function') updateBackgroundSlideshow(dt);
  if (typeof update === 'function') update(dt);
  if (typeof updateImprovCue === 'function') updateImprovCue();
  if (typeof updateWorldParticles === 'function') updateWorldParticles(dt);
  // Subtle audio reactivity (breathing of the world)
  if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.updateBands) {
    ResonanceAudio.updateBands();
  }

  if (canvas && ctx) {
    draw(cameraX);
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
// UI systems (modality, music, video, rabbit-hole, touch, navigation) moved to js/ui.js
