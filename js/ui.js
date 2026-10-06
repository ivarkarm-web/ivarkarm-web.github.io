/**
 * ui.js
 * Unified modality system (mobile/desktop), multi-touch controls,
 * music player drawer, video player, rabbit-hole archive managers,
 * navigation handlers, and haptic integration.
 * Depends on: utilities.js (triggerHaptic), audio.js
 */
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
  if (modal.classList.contains('open')) return;
  if (typeof trackEvent === 'function') trackEvent('monograph_open');

  playGoldParticleCurtain({
    count: 16,
    holdMs: 850,
    onMid: () => {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      refreshMonographScrollTriggers();
      try {
        if (typeof ResonanceAudio !== 'undefined') {
          ResonanceAudio.resume();
          ResonanceAudio.playTone(3, 0.45);
        }
      } catch (e) {}
    }
  });
}

function closeDirectMonographModal() {
  const modal = document.getElementById('directMonographModal');
  if (!modal || !modal.classList.contains('open')) return;

  playGoldParticleCurtain({
    count: 14,
    holdMs: 800,
    onMid: () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

function toggleDirectMonographModal() {
  const modal = document.getElementById('directMonographModal');
  if (!modal) return;
  if (modal.classList.contains('open')) closeDirectMonographModal();
  else openDirectMonographModal();
}

const monographToggleBtn = document.getElementById('monographToggleBtn');
const welcomeMonographBtn = document.getElementById('welcomeMonographBtn');
const dmCloseBtn = document.getElementById('dmCloseBtn');
const dmBackdrop = document.getElementById('dmBackdrop');
const dmOpenRhBtn = document.getElementById('dmOpenRhBtn');

let _welcomeMonoLock = false;
function openMonographFromWelcome(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  }
  if (_welcomeMonoLock) return;
  _welcomeMonoLock = true;
  window.setTimeout(() => { _welcomeMonoLock = false; }, 600);

  // Open immediately (no particle wait) so it appears over welcome without Enter
  const modal = document.getElementById('directMonographModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.zIndex = '5200';
    refreshMonographScrollTriggers();
  }
  if (typeof trackEvent === 'function') trackEvent('monograph_open', { from: 'welcome' });
  try {
    if (typeof ResonanceAudio !== 'undefined') {
      ResonanceAudio.resume();
      ResonanceAudio.playTone(3, 0.35);
    }
  } catch (_) {}
}
if (welcomeMonographBtn) {
  welcomeMonographBtn.addEventListener('click', openMonographFromWelcome, true);
  welcomeMonographBtn.addEventListener('pointerup', openMonographFromWelcome, true);
}
if (monographToggleBtn) {
  monographToggleBtn.addEventListener('click', toggleDirectMonographModal);
}
if (dmCloseBtn) dmCloseBtn.addEventListener('click', closeDirectMonographModal);
if (dmBackdrop) dmBackdrop.addEventListener('click', closeDirectMonographModal);
if (dmOpenRhBtn) {
  dmOpenRhBtn.addEventListener('click', () => {
    const modal = document.getElementById('directMonographModal');
    // Close monograph quietly, then run the full Rabbit Hole enter rain
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    const welcome = document.getElementById('welcome');
    if (welcome) {
      welcome.classList.add('hidden');
      welcome.style.opacity = '0';
      welcome.style.pointerEvents = 'none';
      welcome.style.display = 'none';
    }
    if (document.body) document.body.classList.remove('pre-enter');
    gameStarted = true;
    window.setTimeout(() => {
      openRabbitHoleScreen();
    }, 40);
  });
}

// Monograph reader: site navigation (Home, About, ... Rabbit Hole)
// Uses the same section index map as the main path nav so every button works
// even when the top bar only exposes a subset of anchors.
(function initMonographSiteNav() {
  const bar = document.getElementById('dmSiteNav');
  if (!bar) return;

  const SITE_SECTION_INDEX = {
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

  function ensureExperienceStarted() {
    const welcome = document.getElementById('welcome');
    if (welcome) {
      welcome.classList.add('hidden');
      welcome.style.opacity = '0';
      welcome.style.pointerEvents = 'none';
      welcome.style.display = 'none';
    }
    if (document.body) document.body.classList.remove('pre-enter');
    if (typeof gameStarted !== 'undefined') gameStarted = true;
  }

  function closeMonographModal() {
    const modal = document.getElementById('directMonographModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function goToPathSection(hash) {
    ensureExperienceStarted();
    if (typeof musicPlayer !== 'undefined' && musicPlayer.isDrawerOpen && typeof closeMusicDrawer === 'function') {
      closeMusicDrawer();
    }
    if (hash === '#rabbit-hole' || hash === '#archive') {
      window.setTimeout(() => {
        if (typeof openRabbitHoleScreen === 'function') openRabbitHoleScreen();
      }, 40);
      return;
    }
    const index = SITE_SECTION_INDEX[hash];
    if (index === undefined) return;
    window.setTimeout(() => {
      if (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown && typeof closeRabbitHoleScreen === 'function') {
        closeRabbitHoleScreen();
      }
      if (typeof sectionPositions !== 'undefined' && sectionPositions[index]) {
        x = sectionPositions[index].x;
        vx = 0;
        if (typeof getGround === 'function' && typeof ballRadius !== 'undefined') {
          y = getGround(x) - ballRadius;
          onGround = true;
        }
      }
    }, 40);
  }

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-site-target]');
    if (!btn) return;
    const hash = btn.getAttribute('data-site-target');
    if (!hash) return;
    closeMonographModal();
    goToPathSection(hash);
  });
})();

// Monograph reader quick-jump bar
(function initMonographSiteNavScrollCue() {
  const nav = document.getElementById('dmSiteNav');
  const line = nav?.querySelector('.dm-sitenav-flow-line');
  if (!nav || !line) return;

  const updateCue = () => {
    const maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);
    const hasMore = maxScroll > 6;
    const atEnd = hasMore && nav.scrollLeft >= maxScroll - 8;
    const inset = window.matchMedia('(max-width: 600px)').matches ? 19.2 : 35.2;

    // Keep the line attached to the full scrollable navigation content,
    // not just the initially visible viewport (so it continues beneath Rabbit Hole).
    const lineWidth = Math.max(nav.clientWidth - inset, nav.scrollWidth - inset);
    line.style.setProperty('--dm-nav-flow-width', `${lineWidth}px`);

    nav.classList.toggle('dm-sitenav--has-more', hasMore);
    nav.classList.toggle('dm-sitenav--at-end', atEnd);
  };

  nav.addEventListener('scroll', updateCue, { passive: true });
  window.addEventListener('resize', updateCue, { passive: true });
  requestAnimationFrame(updateCue);
})();

(function initMonographQuickNav() {
  const nav = document.getElementById('dmQuickNav');
  const content = document.getElementById('dmContent');
  if (!nav || !content) return;
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.dm-quicknav-btn');
    if (!btn) return;
    const target = document.getElementById(btn.getAttribute('data-dm-target'));
    if (!target) return;
    const top = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 12;
    content.scrollTo({ top, behavior: 'smooth' });
  });
  const buttons = Array.from(nav.querySelectorAll('.dm-quicknav-btn'));
  content.addEventListener('scroll', () => {
    let current = 0;
    buttons.forEach((b, i) => {
      const t = document.getElementById(b.getAttribute('data-dm-target'));
      if (t && t.getBoundingClientRect().top - content.getBoundingClientRect().top < 80) current = i;
    });
    buttons.forEach((b, i) => b.classList.toggle('active', i === current));
  }, { passive: true });
})();

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
    if (typeof trackEvent === 'function') trackEvent('enter_experience');
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

  function isWelcomeChrome(target) {
    if (!target || !target.closest) return false;
    return !!target.closest(
      '#welcomeMonographBtn, .welcome-monograph, #themeFabMobile, #themeToggleBtn, a, input, select, textarea'
    );
  }

  if (welcome) {
    welcome.addEventListener('click', (e) => {
      if (isWelcomeChrome(e.target)) return;
      if (!gameStarted) startGame();
    });
    welcome.addEventListener('pointerdown', (e) => {
      if (isWelcomeChrome(e.target)) return;
      if (!gameStarted) startGame();
    });
  }
})();

// Music player
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
    this.initCardReveals();

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

  CARD_REVEAL_SEL: '.rh-story-card, .rh-story-feature, .rh-artisan-card, .rh-instrument-card, .rh-track-row, .rh-aphorism-item, .rh-patron-card',

  cardRevealCursor: {},
  cardRevealList: {},

  initCardReveals() {
    if (!this.container) return;

    if (this.cardObserver) {
      try { this.cardObserver.disconnect(); } catch (e) {}
      this.cardObserver = null;
    }

    this.cardRevealCursor = {};
    this.cardRevealList = {};

    const sections = this.sections && this.sections.length
      ? this.sections
      : Array.from(this.container.querySelectorAll('.rh-section'));

    sections.forEach((sec) => {
      const secId = sec.id || ('sec-' + (sec.getAttribute('data-section-index') || 'x'));
      const cards = Array.from(sec.querySelectorAll(this.CARD_REVEAL_SEL));
      this.cardRevealCursor[secId] = 0;
      this.cardRevealList[secId] = cards;

      cards.forEach((el, i) => {
        el.classList.add('rh-reveal-item');
        el.classList.remove('rh-card-visible', 'rh-from-left', 'rh-from-right');
        el.dataset.revealSection = secId;
        el.dataset.revealIndex = String(i);
        if (i % 2 === 0) el.classList.add('rh-from-left');
        else el.classList.add('rh-from-right');
        if (i === 0) el.classList.remove('rh-reveal-locked');
        else el.classList.add('rh-reveal-locked');
        // Clear any inline animation left over from earlier builds
        el.style.animation = '';
        el.style.opacity = '';
        el.style.transform = '';
      });
    });

    if (this.reducedMotion) {
      Object.keys(this.cardRevealList).forEach((secId) => {
        this.cardRevealList[secId].forEach((el) => {
          el.classList.add('rh-card-visible');
          el.classList.remove('rh-reveal-locked');
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
        this.cardRevealCursor[secId] = this.cardRevealList[secId].length;
      });
      return;
    }

    // Initial pass (e.g. first card already in view on open)
    this.updateCardReveals();
  },

  /**
   * Sequential reveal driven by scroll position of the *layout* box.
   * Cards stay untransformed until unlocked, so getBoundingClientRect works.
   * Only the next card in each section can become visible; then the cursor advances.
   */
  updateCardReveals() {
    if (!this.container || this.reducedMotion) return;
    if (!this.cardRevealList) return;

    const rootRect = this.container.getBoundingClientRect();
    // Reveal when the card's top crosses ~72% down the Rabbit Hole viewport
    const triggerY = rootRect.top + rootRect.height * 0.72;

    Object.keys(this.cardRevealList).forEach((secId) => {
      const cards = this.cardRevealList[secId];
      if (!cards || !cards.length) return;

      let next = this.cardRevealCursor[secId] || 0;

      // Reveal as many as are already past the trigger (handles fast scrolls)
      while (next < cards.length) {
        const el = cards[next];
        if (!el) break;
        const rect = el.getBoundingClientRect();
        // Card has scrolled up into the reading zone
        if (rect.top < triggerY && rect.bottom > rootRect.top + 8) {
          if (!el.classList.contains('rh-card-visible')) {
            el.classList.remove('rh-reveal-locked');
            // Restart animation cleanly
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
            el.classList.add('rh-card-visible');
          }
          next += 1;
          this.cardRevealCursor[secId] = next;
          if (cards[next]) cards[next].classList.remove('rh-reveal-locked');
        } else {
          break;
        }
      }
    });
  },

  _replayEdgeSlides(sec) {
    // Legacy no-op kept for call sites — per-card observer owns motion now
    if (!sec || !this.cardObserver) return;
    sec.querySelectorAll(this.CARD_REVEAL_SEL).forEach((el) => {
      if (el.classList.contains('rh-card-visible')) return;
      // nudge observer by toggling
      el.classList.remove('rh-card-visible');
    });
  },

  handleScroll() {
    if (!this.container) return;

    // Chapter progression strip is fixed at bottom
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
    this.updateCardReveals();

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
      } else if (rect.top > viewportHeight * 0.78) {
        // Still mostly below — keep parked off-screen so enter anim can play
        sec.classList.remove('in-view', 'scrolled-past');
        sec.classList.add('pending-below');
      } else {
        // Section chrome (headers) may still use .in-view; cards animate via cardObserver
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
        if (isActive) {
          badge.textContent = 'Here';
          badge.classList.add('rh-toc-item-badge--here');
          badge.hidden = false;
        } else if (isCompleted) {
          badge.textContent = 'Read';
          badge.classList.remove('rh-toc-item-badge--here');
          badge.hidden = false;
        } else {
          badge.textContent = '';
          badge.classList.remove('rh-toc-item-badge--here');
          badge.hidden = true;
        }
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
    // No section-level filter/opacity scrub — that blurred and dimmed body text.
    // Chapter motion is handled by CSS card slides (full off-screen enter).
    if (this.reducedMotion || !this.sections.length || !this.container) return;

    this.killScrollTriggers();

    this.sections.forEach((sec) => {
      try {
        gsap.set(sec, { clearProps: 'filter,opacity,x,y,scale,transform' });
        sec.style.filter = 'none';
        sec.style.opacity = '1';
        sec.style.transform = 'none';
        sec.style.pointerEvents = 'auto';
      } catch (e) {}
    });

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
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
    this.initCardReveals();
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
      this.sections.forEach((sec) => {
        try {
          gsap.set(sec, { clearProps: 'filter,opacity,x,y,scale,transform' });
          sec.style.filter = 'none';
          sec.style.opacity = '1';
        } catch (e) {}
      });
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
function openRabbitHoleScreen(opts) {
  if (endOfRoadState.rabbitHoleShown) return;
  opts = opts || {};
  if (typeof trackEvent === 'function') trackEvent('rabbit_hole_open');
  triggerHaptic('medium');
  endOfRoadState.archiveShown = true;
  endOfRoadState.rabbitHoleShown = true;
  endOfRoadState.fading = false;
  endOfRoadState.fade = 0;
  endOfRoadState.screenFade = 1;
  keys = {};
  vx = 0;

  // Dismiss welcome overlay immediately if opening Rabbit Hole from welcome screen or monograph
  const welcome = document.getElementById('welcome');
  if (welcome) {
    welcome.classList.add('hidden');
    welcome.style.opacity = '0';
    welcome.style.pointerEvents = 'none';
    welcome.style.display = 'none';
  }
  if (document.body) {
    document.body.classList.remove('pre-enter');
  }
  if (!gameStarted) {
    gameStarted = true;
    if (typeof ResonanceAudio !== 'undefined') {
      try { ResonanceAudio.init(); } catch (e) {}
    }
  }

  const el = document.getElementById('rabbit-hole');
  document.body.classList.add('rabbit-hole-open');

  const reveal = () => {
    if (!el) return;
    el.classList.remove('rabbit-hole-closing');
    el.setAttribute('aria-hidden', 'false');
    void el.offsetWidth;
    el.classList.add('visible');
    if (typeof rhGalleryManager !== 'undefined') {
      rhGalleryManager.showImage(0);
      rhGalleryManager.startSlideshow();
    }
    rhScrollManager.reset();
    try {
      if (typeof rhScrollManager.initCardReveals === 'function') {
        rhScrollManager.initCardReveals();
      }
    } catch (e) {}
    rhScrollManager.startParallaxLoop();
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
    const closeBtn = document.getElementById('rabbitHoleBackBtn');
    if (closeBtn) {
      try { closeBtn.focus(); } catch (e) {}
    }
  };

  // Iris teleport (rh-portal) already covered the screen — reveal immediately
  if (opts.skipCurtain) {
    reveal();
    return;
  }

  playGoldParticleCurtain({
    count: 20,
    holdMs: 900,
    onMid: reveal
  });
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

    playGoldParticleCurtain({
      count: 14,
      holdMs: 680,
      onMid: () => {
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
      }
    });
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

function createGoldenParticles(options) {
  const container = document.getElementById('rabbitHoleParticles');
  if (!container) return;
  const opts = options || {};
  const count = opts.count || 28;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'rabbit-hole-particle';
    particle.style.left = (Math.random() * 100) + '%';
    particle.style.animationDelay = (Math.random() * 0.4) + 's';
    particle.style.animationDuration = (1.25 + Math.random() * 0.45) + 's';
    const size = 2.2 + Math.random() * 2.4;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.setProperty('--drift', ((Math.random() - 0.5) * 40) + 'px');
    container.appendChild(particle);
  }
}

/** Gold rain curtain from the top of the screen. Shared by Rabbit Hole + Monograph. */
function playGoldParticleCurtain(options) {
  const opts = options || {};
  const holdMs = opts.holdMs != null ? opts.holdMs : 1100;
  const count = opts.count != null ? opts.count : 28;
  const overlay = document.getElementById('rabbitHoleTransition');
  if (!overlay) {
    if (typeof opts.onMid === 'function') opts.onMid();
    if (typeof opts.onDone === 'function') opts.onDone();
    return;
  }
  // Restart cleanly if a previous curtain is still active
  overlay.classList.remove('active');
  void overlay.offsetWidth;
  createGoldenParticles({ count: count });
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  const midAt = Math.min(200, Math.floor(holdMs * 0.22));
  window.setTimeout(() => {
    if (typeof opts.onMid === 'function') opts.onMid();
  }, midAt);

  window.setTimeout(() => {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if (typeof opts.onDone === 'function') opts.onDone();
  }, holdMs);
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
  const storyRhBtn = document.getElementById('storyEnterRabbitHoleBtn');
  if (storyRhBtn) {
    const handleStoryRhClick = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      if (typeof triggerHaptic === 'function') triggerHaptic('medium');
      openRabbitHoleScreen();
    };
    storyRhBtn.addEventListener('click', handleStoryRhClick);
    storyRhBtn.addEventListener('pointerdown', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
    });
    storyRhBtn.addEventListener('touchend', handleStoryRhClick, { passive: false });
  }
  if (enterBtn) {
    const handleEnterBtnClick = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      if (typeof triggerHaptic === 'function') triggerHaptic('medium');
      openRabbitHoleScreen();
    };
    enterBtn.addEventListener('click', handleEnterBtnClick);
    enterBtn.addEventListener('pointerdown', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
    });
    enterBtn.addEventListener('touchend', handleEnterBtnClick, { passive: false });
  }
})();

// Backward compatibility exports
window.openRabbitHoleScreen = openRabbitHoleScreen;
window.closeRabbitHoleScreen = closeRabbitHoleScreen;
window.rhScrollManager = rhScrollManager;


/** Route the improv player into ResonanceAudio's analyser so the world responds to recordings. */
function connectMusicToAnalyser(audioEl) {
  try {
    if (!audioEl || typeof ResonanceAudio === 'undefined') return;
    ResonanceAudio.init();
    if (!ResonanceAudio.ctx || !ResonanceAudio.analyser) return;
    if (audioEl._resonanceConnected) return;
    const src = ResonanceAudio.ctx.createMediaElementSource(audioEl);
    src.connect(ResonanceAudio.analyser);
    // Also to speakers via master
    if (ResonanceAudio.masterGain) src.connect(ResonanceAudio.masterGain);
    else src.connect(ResonanceAudio.ctx.destination);
    audioEl._resonanceConnected = true;
  } catch (e) {
    // MediaElementSource can only be created once; ignore repeats
  }
}

function refreshMonographScrollTriggers() {
  if (typeof ScrollTrigger === 'undefined') return;
  const content = document.getElementById('dmContent');
  if (!content) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { ScrollTrigger.refresh(true); } catch (_) {}
    });
  });
  window.setTimeout(() => { try { ScrollTrigger.refresh(true); } catch (_) {} }, 180);
  window.setTimeout(() => { try { ScrollTrigger.refresh(true); } catch (_) {} }, 700);
}

/* Monograph chapter reveals — restrained, reliable discovery.
   Text is revealed with opacity/translation only; images use a single wipe.
   The opening Eastern Estonia image stays at natural scale. */
(function initMonographScrollReveals(){
  const sections=document.querySelectorAll('.dm-scroll-reveal');
  const scroller=document.getElementById('dmContent');
  if(!sections.length||!scroller||typeof gsap==='undefined'||typeof ScrollTrigger==='undefined')return;
  gsap.registerPlugin(ScrollTrigger);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach(section=>{
    const bg=section.querySelector('.dm-origin-bg');
    const img=section.querySelector('.dm-origin-bg img');
    const contents=Array.from(section.querySelectorAll('.dm-origin-content'));
    if(!bg||!img||!contents.length)return;

    const isSharedOpening=section.classList.contains('dm-scroll-reveal--shared-bg');

    if(reduced){
      gsap.set([bg,img,...contents],{clearProps:'all'});
      contents.forEach(c=>{
        gsap.set(c.querySelectorAll('.dm-sec-tag,h3,p'),{clearProps:'all'});
        gsap.set(c,{'--dm-reveal-line-scale':1,'--dm-reveal-line-opacity':1});
      });
      return;
    }

    gsap.set(bg,{clipPath:'inset(0 100% 0 0)',scale:1});
    gsap.set(img,{scale:isSharedOpening?1:1.012,xPercent:0,yPercent:0});

    // Keep the shared Eastern Estonia image as one continuous discovery.
    // Its two text blocks are sequenced inside the same timeline so their
    // geometry cannot fight over ScrollTrigger state.
    const tl=gsap.timeline({paused:true,defaults:{overwrite:'auto'}});
    tl.to(bg,{clipPath:'inset(0 0% 0 0)',duration:.9,ease:'power2.out'},0)
      .to(img,{scale:1,duration:1.05,ease:'power2.out'},0);

    contents.forEach((content,i)=>{
      const tag=content.querySelector('.dm-sec-tag');
      const heading=content.querySelector('h3');
      const paragraph=content.querySelector('p');
      const textEls=[tag,heading,paragraph].filter(Boolean);
      const startAt=isSharedOpening ? (i===0?.22:1.25) : .18;

      gsap.set(content,{autoAlpha:1,y:0});
      gsap.set(textEls,{
        autoAlpha:0,
        y:el=>el.matches('h3')?30:(el.matches('.dm-sec-tag')?18:24),
        filter:'blur(4px)',
        clipPath:'none'
      });
      gsap.set(content,{'--dm-reveal-line-scale':0,'--dm-reveal-line-opacity':0});

      tl.to(content,{
        '--dm-reveal-line-scale':1,
        '--dm-reveal-line-opacity':1,
        duration:.55,
        ease:'power2.out'
      },startAt);

      if(tag) tl.to(tag,{autoAlpha:1,y:0,filter:'blur(0px)',duration:.5,ease:'power2.out'},startAt+.10);
      if(heading) tl.to(heading,{autoAlpha:1,y:0,filter:'blur(0px)',duration:.62,ease:'power2.out'},startAt+.18);
      if(paragraph) tl.to(paragraph,{autoAlpha:1,y:0,filter:'blur(0px)',duration:.68,ease:'power2.out'},startAt+.28);
    });

    ScrollTrigger.create({
      trigger:section,
      scroller,
      start:'top 78%',
      end:'bottom 18%',
      invalidateOnRefresh:true,
      onEnter:()=>tl.play(),
      onEnterBack:()=>tl.play(),
      onLeaveBack:()=>tl.reverse()
    });

    if(!isSharedOpening){
      gsap.to(img,{
        yPercent:1,
        ease:'none',
        scrollTrigger:{
          trigger:section,
          scroller,
          start:'top bottom',
          end:'bottom top',
          scrub:3,
          invalidateOnRefresh:true
        }
      });
    }
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>ScrollTrigger.refresh(true)));
})();
