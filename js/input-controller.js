/**
 * input-controller.js
 * Device modality, touch steering, mobile jump controls and touch input state.
 * Keeps interaction plumbing out of the higher-level UI/archive controller.
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

// ============================================================================
// TOUCH ZONES & FULL-SCREEN TOUCH STEERING
// Touching left half of screen rolls left, touching right half rolls right
// ============================================================================
function handleZoneTouchStart(e) {
  if (document.body.classList.contains('qr-open')) return;
  if (e.target && e.target.closest && e.target.closest('#qrPopup, .qr-popup')) return;
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
  if (document.body.classList.contains('qr-open')) return;
  if (e.target && e.target.closest && e.target.closest('#qrPopup, .qr-popup')) return;
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
  if (document.body.classList.contains('qr-open')) return;
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
  if (document.body.classList.contains('qr-open')) return;
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
