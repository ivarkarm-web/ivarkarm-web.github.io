/**
 * scenes-enhance.js — spawn left hint + richer section text reveals
 * Load AFTER js/scenes.js
 */
(function () {
  'use strict';

  window.updateSpawnLeftHint = function updateSpawnLeftHint() {
    const el = document.getElementById('spawnLeftHint');
    if (!el) return;
    if (typeof gameStarted === 'undefined' || !gameStarted) {
      el.classList.remove('is-visible', 'is-fading');
      return;
    }
    const nearSpawn = typeof x === 'number' && x > -80 && x < 420;
    const exploredLeft = typeof x === 'number' && x < 20;
    if (exploredLeft) {
      el.classList.add('is-fading');
      el.classList.remove('is-visible');
    } else if (nearSpawn) {
      el.classList.add('is-visible');
      el.classList.remove('is-fading');
    } else {
      el.classList.add('is-fading');
      el.classList.remove('is-visible');
    }
  };

  window.revealSectionContent = function revealSectionContent(sectionEl) {
    if (typeof gsap === 'undefined' || !sectionEl) return;
    const hairline = sectionEl.querySelector('.hairline');
    const eyebrow = sectionEl.querySelector('.eyebrow');
    const heading = sectionEl.querySelector('h1, h2');
    const rest = sectionEl.querySelectorAll(
      '.lead, .subtitle, .subtext, p:not(.lead), .story-entry, .music-player'
    );
    const partnerCards = sectionEl.querySelectorAll('.partner-card');
    const all = [hairline, eyebrow, heading, ...rest, ...partnerCards].filter(Boolean);
    if (!all.length) return;
    gsap.killTweensOf(all);

    const isPartners = sectionEl.id === 's5';
    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (eyebrow) {
      tl.fromTo(eyebrow,
        { opacity: 0, y: 10, filter: 'blur(6px)' },
        { opacity: 0.9, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power3.out', clearProps: 'filter' },
        0
      );
    }

    if (hairline) {
      tl.fromTo(hairline,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 0.65, duration: 0.65, ease: 'power3.out' },
        eyebrow ? 0.12 : 0
      );
    }

    if (heading) {
      tl.fromTo(heading,
        { clipPath: 'inset(0 0 110% 0)', y: 22, opacity: 1 },
        { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 0.95, ease: 'expo.out' },
        hairline ? 0.18 : (eyebrow ? 0.14 : 0)
      );
    }

    if (rest.length) {
      tl.fromTo(rest,
        { opacity: 0, y: 18, filter: 'blur(5px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.72,
          ease: 'power3.out',
          stagger: 0.09,
          clearProps: 'filter'
        },
        heading ? 0.38 : 0.2
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
  };

  function tickHint() {
    if (typeof window.updateSpawnLeftHint === 'function') {
      try { window.updateSpawnLeftHint(); } catch (_) {}
    }
    requestAnimationFrame(tickHint);
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(tickHint);
  }
})();
