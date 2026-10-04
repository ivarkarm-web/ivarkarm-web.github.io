/**
 * ui.js
 * Unified modality system (mobile/desktop), multi-touch controls,
 * music player drawer, video player, rabbit-hole archive managers,
 * navigation handlers, and haptic integration.
 * Depends on: utilities.js (triggerHaptic), audio.js
 */

// UI managers (UnifiedModalitySystem, musicPlayer, rhScrollManager,
// rhGalleryManager, open/closeRabbitHoleScreen, etc.) remain in the
// main script for the current step. They will be moved here in the
 // next pure extraction pass.
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
const touchJumpBtn = document.getElementById('touchJump');
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
  if (touchJumpBtn) touchJumpBtn.classList.toggle('active', hasJump);
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
bindTouchButton(touchJumpBtn, ' ');
bindTouchButton(touchDashBtn, 'dash');

// ============================================================================
// TOUCH ZONES & FULL-SCREEN TOUCH STEERING
// Touching left half of screen rolls left, touching right half rolls right
// ============================================================================
function handleZoneTouchStart(e) {
  if (!gameStarted || (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown)) return;

  const target = e.target;
  // Ignore taps on interactive UI dialogs, modal buttons, and navigation
  if (target && target.closest('button, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .memory-shard-card, #welcome')) {
    return;
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
  if (target && target.closest('button, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .memory-shard-card, #welcome')) {
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
[touchLeftEl, touchRightEl, touchZonesEl, document.getElementById('game')].forEach((zoneEl) => {
  if (!zoneEl) return;
  zoneEl.addEventListener('touchstart', handleZoneTouchStart, { passive: false });
  zoneEl.addEventListener('touchmove', handleZoneTouchMove, { passive: false });
  zoneEl.addEventListener('touchend', handleZoneTouchEnd, { passive: false });
  zoneEl.addEventListener('touchcancel', handleZoneTouchEnd, { passive: false });
});

window.addEventListener('touchstart', handleZoneTouchStart, { passive: false });
window.addEventListener('touchmove', handleZoneTouchMove, { passive: false });
window.addEventListener('touchend', handleZoneTouchEnd, { passive: false });
window.addEventListener('touchcancel', handleZoneTouchEnd, { passive: false });

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
  if (target && target.closest('button.tip-button-mobile, button.touch-action-btn, a, input, select, textarea, .nav-links, .direct-monograph-modal, #videoModal, #qrPopup, .rh-deck-wrap, .rabbit-hole, .mp-controls, .mp-progress-wrap, .memory-shard-card')) {
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
[touchLeftEl, touchRightEl, touchZonesEl, touchArrowLeftEl, touchArrowRightEl, document.getElementById('game')].forEach((zoneEl) => {
  if (!zoneEl) return;
  zoneEl.addEventListener('touchstart', handleTouchZoneDoubleTap, { passive: true });
});

// Audio Toggle Button
const audioToggleBtn = document.getElementById('audioToggleBtn');
if (audioToggleBtn) {
  const handleAcousticToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    ResonanceAudio.toggleMute();
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
  };
  audioToggleBtn.addEventListener('click', handleAcousticToggle);
  audioToggleBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  audioToggleBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleAcousticToggle(e);
  }, { passive: false });
}

// Memory Shard Dismiss
const memoryShardCloseBtn = document.getElementById('memoryShardClose');
if (memoryShardCloseBtn) {
  memoryShardCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideMemoryShard();
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

function startGame() {
  if (typeof gameStarted !== 'undefined' && gameStarted) return;
  try {
    gameStarted = true;
    const startX = (typeof sectionPositions !== 'undefined' && sectionPositions[0])
      ? sectionPositions[0].x : 500;
    x = startX;
    vx = 0;
    vy = 0;
    if (typeof getGround === 'function' && typeof ballRadius !== 'undefined') {
      y = getGround(x) - ballRadius;
      onGround = true;
      if (typeof viewW !== 'undefined') cameraX = x - viewW / 2;
      if (typeof viewH !== 'undefined') {
        const terrainY = getGround(x);
        cameraY = (terrainY - viewH * 0.5) * 0.3;
      }
    } else {
      y = (typeof viewH !== 'undefined' ? viewH * 0.65 : 400);
      onGround = true;
    }
    keys = {};

    // Initialize Web Audio procedural resonance
    if (typeof ResonanceAudio !== 'undefined') {
      try {
        ResonanceAudio.init();
        ResonanceAudio.resume();
        ResonanceAudio.playTone(0, 0.65, { duration: 3.0 });
      } catch (audioErr) {
        console.warn('ResonanceAudio init failed:', audioErr);
      }
    }
  } catch (err) {
    console.error('startGame setup error (continuing to dismiss welcome):', err);
    gameStarted = true;
  }

  // Always dismiss welcome — never leave the user stuck
  const welcome = document.getElementById('welcome');
  if (welcome) {
    welcome.classList.add('hidden');
    welcome.style.opacity = '0';
    welcome.style.pointerEvents = 'none';
    setTimeout(() => { welcome.style.display = 'none'; }, 950);
  }
  if (document.body) document.body.classList.remove('pre-enter');
  if (typeof canvas !== 'undefined' && canvas) {
    try { canvas.focus({ preventScroll: true }); } catch (e) {}
  }
}

(function () {
  const btn = document.getElementById('welcomeEnter');
  const welcome = document.getElementById('welcome');

  const onEnterTrigger = (e) => {
    if (e && e.cancelable) e.preventDefault();
    startGame();
  };

  if (btn) {
    btn.addEventListener('click', onEnterTrigger);
    btn.addEventListener('pointerdown', onEnterTrigger);
    btn.addEventListener('touchend', onEnterTrigger, { passive: false });
    btn.addEventListener('pointerup', onEnterTrigger);
  }

  if (welcome) {
    welcome.addEventListener('click', (e) => {
      if (!gameStarted) startGame();
    });
    welcome.addEventListener('pointerdown', (e) => {
      if (!gameStarted) startGame();
    });
  }
})();

// Music player
const MUSIC_TRACKS = [
  {
    title: 'Bedroom Session 1',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%201.wav',
    duration: 85
  },
  {
    title: 'Bedroom Session 2',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%202.wav',
    duration: 106
  },
  {
    title: 'Bedroom Session 3',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%203.wav',
    duration: 89
  },
  {
    title: 'Bedroom Session 4',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%204.wav',
    duration: 65
  },
  {
    title: 'Bedroom Session 5',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%205.wav',
    duration: 106
  },
  {
    title: 'Bedroom Session 7',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%207.wav',
    duration: 77
  },
  {
    title: 'Bedroom Session 8',
    subtitle: 'Handpan · Bedroom Sessions · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20session%208.wav',
    duration: 68
  },
  {
    title: 'Bedroom Sessions (Master)',
    subtitle: 'Handpan Extended Session · Archive.org',
    src: 'https://archive.org/download/bedroom-sessions-03.10.2026-22.29/bedroom%20sessions%20-%2003.10.2026%2C%2022.29.wav',
    duration: 163
  }
];

const musicPlayer = window.musicPlayer = {
  audio: null,
  index: 0,
  isPlaying: false,
  els: {},
  fadeTimer: null,
  isEndingFade: false,
  isDrawerOpen: false
};

function mpFormatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function mpFadeVolume(targetVol, durationMs, onComplete) {
  if (musicPlayer.fadeTimer) {
    clearInterval(musicPlayer.fadeTimer);
    musicPlayer.fadeTimer = null;
  }
  const a = musicPlayer.audio;
  if (!a) {
    if (onComplete) onComplete();
    return;
  }

  const startVol = typeof a.volume === 'number' ? a.volume : 1;
  const startTime = Date.now();
  durationMs = Math.max(80, durationMs || 450);

  musicPlayer.fadeTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const factor = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    const curVol = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * factor));

    try { a.volume = curVol; } catch (_) {}

    if (progress >= 1) {
      clearInterval(musicPlayer.fadeTimer);
      musicPlayer.fadeTimer = null;
      try { a.volume = targetVol; } catch (_) {}
      if (onComplete) onComplete();
    }
  }, 25);
}

function mpUpdateProgress() {
  const a = musicPlayer.audio;
  if (!a) return;
  const track = MUSIC_TRACKS[musicPlayer.index] || MUSIC_TRACKS[0];
  const dur = (isFinite(a.duration) && a.duration > 0) ? a.duration : (track.duration || 85);
  const curTime = (isFinite(a.currentTime) && a.currentTime > 0) ? a.currentTime : 0;

  if (dur > 0) {
    const p = Math.max(0, Math.min(100, (curTime / dur) * 100));
    if (musicPlayer.els.filled) musicPlayer.els.filled.style.width = p + '%';
    if (musicPlayer.els.handle) musicPlayer.els.handle.style.left = p + '%';
    if (musicPlayer.els.current) musicPlayer.els.current.textContent = mpFormatTime(curTime);
    if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(dur);
    if (musicPlayer.els.progress) musicPlayer.els.progress.setAttribute('aria-valuenow', Math.round(p));

    const timeLeft = dur - curTime;
    if (timeLeft <= 2.2 && !musicPlayer.isEndingFade && !a.paused && dur > 6) {
      musicPlayer.isEndingFade = true;
      mpFadeVolume(0, Math.max(400, timeLeft * 1000 - 150));
    }
  }
}

function mpSetPlayingUI(playing) {
  musicPlayer.isPlaying = playing;
  const pi = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-play');
  const pa = musicPlayer.els.playBtn && musicPlayer.els.playBtn.querySelector('.mp-icon-pause');
  if (pi) pi.style.display = playing ? 'none' : 'block';
  if (pa) pa.style.display = playing ? 'block' : 'none';

  if (musicPlayer.els.tracklist) {
    musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li, idx) => {
      if (idx === musicPlayer.index) {
        li.classList.toggle('is-playing', playing);
      } else {
        li.classList.remove('is-playing');
      }
    });
  }
}

function mpHighlightTrack(i) {
  if (!musicPlayer.els.tracklist) return;
  musicPlayer.els.tracklist.querySelectorAll('.mp-track').forEach((li, j) => {
    const isActive = j === i;
    li.classList.toggle('active', isActive);
    li.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive && musicPlayer.isPlaying) {
      li.classList.add('is-playing');
    } else {
      li.classList.remove('is-playing');
    }
  });
}

function mpSelectAndPlayTrack(index) {
  if (index < 0 || index >= MUSIC_TRACKS.length) return;
  const track = MUSIC_TRACKS[index];
  musicPlayer.index = index;
  musicPlayer.isEndingFade = false;
  const a = musicPlayer.audio;
  if (!a) return;

  // 1. Immediately update active class
  mpHighlightTrack(index);

  // 2. Immediately reset progress bar and timer to zero
  if (musicPlayer.els.filled) musicPlayer.els.filled.style.width = '0%';
  if (musicPlayer.els.handle) musicPlayer.els.handle.style.left = '0%';
  if (musicPlayer.els.current) musicPlayer.els.current.textContent = '0:00';
  if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(track.duration);
  if (musicPlayer.els.progress) musicPlayer.els.progress.setAttribute('aria-valuenow', '0');

  // 3. Immediately update titles and track number
  if (musicPlayer.els.title) musicPlayer.els.title.textContent = track.title;
  if (musicPlayer.els.subtitle) musicPlayer.els.subtitle.textContent = track.subtitle;
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = String(index + 1).padStart(2, '0');

  // 4. Fade out any background audio orb
  if (typeof currentAudio !== 'undefined' && currentAudio) {
    const orbAudio = currentAudio;
    currentAudio = null;
    if (typeof fadeOutAudio === 'function') fadeOutAudio(orbAudio);
  }

  // 5. Cancel any pending volume fade timer
  if (musicPlayer.fadeTimer) {
    clearInterval(musicPlayer.fadeTimer);
    musicPlayer.fadeTimer = null;
  }

  // 6. Set source, reset currentTime to 0, and start playback
  if (a.src !== track.src) {
    a.src = track.src;
  }
  a.currentTime = 0;
  try { a.volume = 0; } catch (_) {}

  mpSetPlayingUI(true);

  const playPromise = a.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      mpSetPlayingUI(true);
      mpFadeVolume(1.0, 600);
    }).catch((err) => {
      console.warn('Audio playback notice:', err);
      mpSetPlayingUI(false);
    });
  }
}

function mpTogglePlay() {
  const a = musicPlayer.audio;
  if (!a) return;

  if (a.paused) {
    if (typeof currentAudio !== 'undefined' && currentAudio) {
      const orbAudio = currentAudio;
      currentAudio = null;
      if (typeof fadeOutAudio === 'function') fadeOutAudio(orbAudio);
    }

    const currentTrack = MUSIC_TRACKS[musicPlayer.index] || MUSIC_TRACKS[0];
    if (!a.src || a.src === window.location.href) {
      a.src = currentTrack.src;
      a.currentTime = 0;
    }

    try { a.volume = 0; } catch (_) {}
    mpSetPlayingUI(true);

    const p = a.play();
    if (p !== undefined) {
      p.then(() => {
        mpSetPlayingUI(true);
        mpFadeVolume(1.0, 600);
      }).catch((err) => {
        console.warn('Play error:', err);
        mpSetPlayingUI(false);
      });
    }
  } else {
    mpSetPlayingUI(false);
    mpFadeVolume(0, 200, () => {
      try { a.pause(); } catch (_) {}
      mpSetPlayingUI(false);
    });
  }
}

function mpPrev() {
  const prevIdx = (musicPlayer.index - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  mpSelectAndPlayTrack(prevIdx);
}

function mpNext() {
  const nextIdx = (musicPlayer.index + 1) % MUSIC_TRACKS.length;
  mpSelectAndPlayTrack(nextIdx);
}

// ============================================================================
// IMPROV SESSIONS DRAWER CONTROLLER (PULL UP / PULL DOWN)
// ============================================================================
function openMusicDrawer() {
  const overlay = document.getElementById('mpDrawerOverlay');
  if (!overlay || musicPlayer.isDrawerOpen) return;
  musicPlayer.isDrawerOpen = true;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mp-drawer-open');
  if (typeof triggerHaptic === 'function') triggerHaptic('medium');

  // Freeze the platformer: no momentum, no held keys, no active touches
  vx = 0;
  keys = {};
  if (typeof activeTouchAssignments !== 'undefined') activeTouchAssignments.clear();

  const closeBtn = document.getElementById('mpCloseDrawerBtn');
  if (closeBtn) { try { closeBtn.focus({ preventScroll: true }); } catch (_) {} }
}

function closeMusicDrawer() {
  const overlay = document.getElementById('mpDrawerOverlay');
  if (!overlay) return;
  musicPlayer.isDrawerOpen = false;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mp-drawer-open');
  if (typeof triggerHaptic === 'function') triggerHaptic('light');

  // Reset any sheet drag inline styles
  const sheet = document.getElementById('mpDrawerSheet');
  if (sheet) {
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
  }
  keys = {};
  if (typeof canvas !== 'undefined' && canvas) {
    try { canvas.focus({ preventScroll: true }); } catch (_) {}
  }
}

function initMusicDrawerGestures() {
  const openBtn = document.getElementById('mpPullCue');
  const closeBtn = document.getElementById('mpCloseDrawerBtn');
  const backdrop = document.getElementById('mpDrawerBackdrop');
  const header = document.getElementById('mpDrawerHeader');
  const sheet = document.getElementById('mpDrawerSheet');
  const s4Section = document.getElementById('s4');

  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMusicDrawer();
    });
    // Swipe up on the cue also pulls the player up
    let cueStartY = 0;
    openBtn.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) cueStartY = e.touches[0].clientY;
    }, { passive: true });
    openBtn.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0] && cueStartY - e.changedTouches[0].clientY > 24) {
        if (e.cancelable) e.preventDefault();
        openMusicDrawer();
      }
    }, { passive: false });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicDrawer();
    });
  }

  // Swipe UP on Section 4 to reveal drawer
  if (s4Section) {
    let touchStartY = 0;
    s4Section.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    s4Section.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaY = touchStartY - e.changedTouches[0].clientY;
        if (deltaY > 60 && !musicPlayer.isDrawerOpen) {
          openMusicDrawer();
        }
      }
    }, { passive: true });
  }

  // Swipe / Drag DOWN on Drawer Header or Sheet to dismiss
  if (header && sheet) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onTouchStart = (e) => {
      if (!e.touches || !e.touches[0]) return;
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      sheet.classList.add('dragging');
    };

    const onTouchMove = (e) => {
      if (!isDragging || !e.touches || !e.touches[0]) return;
      currentY = e.touches[0].clientY;
      const delta = currentY - startY;
      if (delta > 0) {
        // Resistance curve
        sheet.style.transform = `translateY(${delta}px)`;
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      sheet.classList.remove('dragging');
      const delta = currentY - startY;
      if (delta > 75) {
        closeMusicDrawer();
      } else {
        sheet.style.transform = '';
      }
    };

    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('touchmove', onTouchMove, { passive: true });
    header.addEventListener('touchend', onTouchEnd, { passive: true });
  }
}

function initMusicPlayer() {
  const playerEl = document.getElementById('musicPlayer');
  if (!playerEl) return;

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

  // Pre-load track 0 immediately
  const initialTrack = MUSIC_TRACKS[0];
  if (musicPlayer.els.title) musicPlayer.els.title.textContent = initialTrack.title;
  if (musicPlayer.els.subtitle) musicPlayer.els.subtitle.textContent = initialTrack.subtitle;
  if (musicPlayer.els.trackNum) musicPlayer.els.trackNum.textContent = '01';
  if (musicPlayer.els.duration) musicPlayer.els.duration.textContent = mpFormatTime(initialTrack.duration);
  if (musicPlayer.els.current) musicPlayer.els.current.textContent = '0:00';
  a.src = initialTrack.src;
  mpHighlightTrack(0);

  a.addEventListener('timeupdate', mpUpdateProgress);
  a.addEventListener('loadedmetadata', mpUpdateProgress);
  a.addEventListener('durationchange', mpUpdateProgress);
  a.addEventListener('canplay', mpUpdateProgress);

  a.addEventListener('play', () => {
    mpSetPlayingUI(true);
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.masterGain) {
      try { ResonanceAudio.masterGain.gain.setValueAtTime(0.04, ResonanceAudio.ctx.currentTime); } catch (_) {}
    }
  });

  a.addEventListener('pause', () => {
    if (!musicPlayer.fadeTimer) {
      mpSetPlayingUI(false);
    }
    if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.masterGain && !ResonanceAudio.isMuted) {
      try { ResonanceAudio.masterGain.gain.setValueAtTime(0.7, ResonanceAudio.ctx.currentTime); } catch (_) {}
    }
  });

  a.addEventListener('ended', () => {
    mpNext();
  });

  const bindControl = (el, action) => {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
      action();
    });
  };

  bindControl(musicPlayer.els.playBtn, mpTogglePlay);
  bindControl(musicPlayer.els.prevBtn, mpPrev);
  bindControl(musicPlayer.els.nextBtn, mpNext);

  if (musicPlayer.els.progress) {
    const handleSeek = (e) => {
      e.stopPropagation();
      const rect = musicPlayer.els.progress.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const track = MUSIC_TRACKS[musicPlayer.index] || initialTrack;
      const dur = (isFinite(a.duration) && a.duration > 0) ? a.duration : (track.duration || 85);
      a.currentTime = frac * dur;
      mpUpdateProgress();
    };

    musicPlayer.els.progress.addEventListener('click', handleSeek);
  }

  // Enhanced mpTracklist event delegation
  if (musicPlayer.els.tracklist) {
    let lastTrackClickTime = 0;

    const handleTracklistInteraction = (e) => {
      const trackEl = e.target.closest('.mp-track');
      if (!trackEl) return;

      const now = performance.now();
      if (now - lastTrackClickTime < 250) return;
      lastTrackClickTime = now;

      e.stopPropagation();
      if (e.cancelable) e.preventDefault();

      const idx = parseInt(trackEl.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < MUSIC_TRACKS.length) {
        if (typeof triggerHaptic === 'function') triggerHaptic('light');
        mpSelectAndPlayTrack(idx);
      }
    };

    musicPlayer.els.tracklist.addEventListener('click', handleTracklistInteraction);
    musicPlayer.els.tracklist.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTracklistInteraction(e);
      }
    });
  }

  initMusicDrawerGestures();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMusicPlayer);
} else {
  initMusicPlayer();
}
// and bespoke reveals for each section.
// ==========================================================================


// ============================================================================
// RABBIT HOLE GALLERY BACKDROP MANAGER
// Modern ambient artwork slideshow & scroll-synced background transitions
// ============================================================================
const rhGalleryManager = {
  images: [
    'https://i.postimg.cc/SsvpXcSN/Untitled-Artwork.png',
    'https://i.postimg.cc/G22ChX1S/Untitled-Artwork-2.png',
    'https://i.postimg.cc/G251Bvcg/Untitled-Artwork-3.png',
    'https://i.postimg.cc/qR5dt2k5/Untitled-Artwork-4.png',
    'https://i.postimg.cc/4dSTKpJM/Untitled-Artwork-5.png',
    'https://i.postimg.cc/nzPtsqHW/Untitled-Artwork-6.png'
  ],
  currentIndex: 0,
  layerA: null,
  layerB: null,
  activeLayer: 'a',
  timer: null,
  preloaded: [],

  init() {
    this.layerA = document.getElementById('rhGalleryLayerA');
    this.layerB = document.getElementById('rhGalleryLayerB');
    if (!this.layerA || !this.layerB) return;

    this.images.forEach(src => {
      try {
        const img = new Image();
        img.src = src;
        this.preloaded.push(img);
      } catch (_) {}
    });

    this.layerA.style.backgroundImage = 'url("' + this.images[0] + '")';
    this.layerA.style.opacity = '1';
    this.layerA.classList.add('active');
    if (this.layerB) {
      this.layerB.style.opacity = '0';
      this.layerB.classList.remove('active');
    }
  },

  showImage(index) {
    if (index === undefined || index === null) return;
    const cleanIndex = ((index % this.images.length) + this.images.length) % this.images.length;
    if (cleanIndex === this.currentIndex && this.layerA && this.layerA.style.backgroundImage) return;
    this.currentIndex = cleanIndex;

    const nextSrc = this.images[this.currentIndex];
    if (this.activeLayer === 'a') {
      if (this.layerB) {
        this.layerB.style.backgroundImage = 'url("' + nextSrc + '")';
        this.layerB.style.opacity = '1';
        this.layerB.classList.add('active');
      }
      if (this.layerA) {
        this.layerA.style.opacity = '0';
        this.layerA.classList.remove('active');
      }
      this.activeLayer = 'b';
    } else {
      if (this.layerA) {
        this.layerA.style.backgroundImage = 'url("' + nextSrc + '")';
        this.layerA.style.opacity = '1';
        this.layerA.classList.add('active');
      }
      if (this.layerB) {
        this.layerB.style.opacity = '0';
        this.layerB.classList.remove('active');
      }
      this.activeLayer = 'a';
    }
  },

  next() {
    this.showImage(this.currentIndex + 1);
  },

  startSlideshow() {
    this.stopSlideshow();
    this.timer = setInterval(() => {
      const rh = document.getElementById('rabbit-hole');
      if (rh && rh.classList.contains('visible')) {
        this.next();
      }
    }, 8500);
  },

  stopSlideshow() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
};

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
    "04 / 07 · The Makers",
    "05 / 07 · Instruments",
    "06 / 07 · Audio Vault",
    "07 / 07 · Road Notes"
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
    if (typeof rhGalleryManager !== 'undefined') rhGalleryManager.showImage(index);
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
          duration: 0.55,
          ease: 'power2.out',
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
        duration: 0.55,
        ease: 'power2.out',
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
    // Native touch scrolling only — no section-snap on swipe.
    // Snap-to-section on every flick made mobile scroll feel aggressive
    // and unpredictable (a small swipe jumped a full chapter).
    // Keyboard arrows / TOC / side nav still jump sections deliberately.
    if (!this.container) return;

    // Optional: very deliberate edge-flick only (almost full-screen, fast)
    // Disabled by default on coarse pointers for predictable reading.
    const allowSnap = false;
    if (!allowSnap) return;

    let startY = 0;
    let startTime = 0;
    let moved = 0;

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startTime = performance.now();
      moved = 0;
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!startY || e.touches.length !== 1) return;
      moved = Math.max(moved, Math.abs(e.touches[0].clientY - startY));
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      if (!startY) return;
      const endY = e.changedTouches[0]?.clientY || startY;
      const deltaY = endY - startY;
      const duration = performance.now() - startTime;
      const velocity = Math.abs(deltaY) / Math.max(1, duration);
      // Require a huge, fast flick (>45% viewport) so normal reading never snaps
      const threshold = Math.max(180, window.innerHeight * 0.45);

      if (Math.abs(deltaY) > threshold && velocity > 0.85 && moved > threshold * 0.8) {
        triggerHaptic('medium');
        if (deltaY < 0) {
          this.scrollToSection(Math.min(this.sections.length - 1, this.currentSectionIndex + 1));
        } else {
          this.scrollToSection(Math.max(0, this.currentSectionIndex - 1));
        }
      }
      startY = 0;
      moved = 0;
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
  if (typeof rhGalleryManager !== 'undefined') rhGalleryManager.init();
}

// ===== RABBIT HOLE SCREEN OPEN / CLOSE =====
function openRabbitHoleScreen() {
  if (endOfRoadState.rabbitHoleShown) return;
  triggerHaptic('medium');
  endOfRoadState.archiveShown = true;
  endOfRoadState.rabbitHoleShown = true;
  endOfRoadState.fading = false;
  endOfRoadState.fade = 0;
  endOfRoadState.screenFade = 1;
  keys = {};
  vx = 0;

  // Particle transition effect
  const transitionOverlay = document.getElementById('rabbitHoleTransition');
  if (transitionOverlay) {
    transitionOverlay.classList.add('active');
    createGoldenParticles();
    setTimeout(() => {
      transitionOverlay.classList.remove('active');
    }, 600);
  }

  const el = document.getElementById('rabbit-hole');
  if (el) {
    el.classList.remove('rabbit-hole-closing');
    el.setAttribute('aria-hidden', 'false');
    void el.offsetWidth;
    setTimeout(() => {
      el.classList.add('visible');
      if (typeof rhGalleryManager !== 'undefined') {
        rhGalleryManager.showImage(0);
        rhGalleryManager.startSlideshow();
      }
      rhScrollManager.reset();
      rhScrollManager.startParallaxLoop();
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
      const closeBtn = document.getElementById('rabbitHoleBackBtn');
      if (closeBtn) closeBtn.focus();
    }, 80);
  }
  document.body.classList.add('rabbit-hole-open');
}

function closeRabbitHoleScreen() {
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
      x = CONTACT_X;
      vx = 0;
      vy = 0;
      y = getGround(x) - ballRadius;
      onGround = true;
      cameraY = 0;
      keys = {};
      document.body.classList.remove('rabbit-hole-open');
      if (typeof canvas !== 'undefined' && canvas) {
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
    x = CONTACT_X;
    vx = 0;
    vy = 0;
    y = getGround(x) - ballRadius;
    onGround = true;
    cameraY = 0;
    keys = {};
    document.body.classList.remove('rabbit-hole-open');
    if (typeof canvas !== 'undefined' && canvas) {
      try { canvas.focus({ preventScroll: true }); } catch (e) {}
    }
  }
}

function createGoldenParticles() {
  const container = document.getElementById('rabbitHoleParticles');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const particle = document.createElement('div');
    particle.className = 'rabbit-hole-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particle.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    const size = 2 + Math.random() * 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    container.appendChild(particle);
  }
}

(function initBackBtn() {
  const btn = document.getElementById('rabbitHoleBackBtn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
      closeRabbitHoleScreen();
    });
  }
  const floatBtn = document.getElementById('rhFloatingLeaveBtn');
  if (floatBtn) {
    floatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
      closeRabbitHoleScreen();
    });
  }
  const enterBtn = document.getElementById('s7EnterRabbitHoleBtn');
  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof triggerHaptic === 'function') triggerHaptic('medium');
      openRabbitHoleScreen();
    });
  }
})();

// Backward compatibility exports
window.openRabbitHoleScreen = openRabbitHoleScreen;
window.closeRabbitHoleScreen = closeRabbitHoleScreen;
window.rhScrollManager = rhScrollManager;
