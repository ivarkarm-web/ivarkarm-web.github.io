/**
 * Phone landscape (v10) — SAFE: class toggle only.
 * No reparenting, no MutationObserver, no inline style on controls.
 * All layout is CSS under body.pionier-landscape.
 */
(function landscapeBoot() {
  function isPhoneLandscape() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches) return true;
        if (window.matchMedia('(orientation: landscape) and (max-height: 600px) and (max-width: 920px)').matches) return true;
      }
    } catch (_) {}
    return window.innerWidth > window.innerHeight && window.innerHeight <= 500;
  }

  let last = null;

  function apply() {
    const on = isPhoneLandscape();
    if (on === last) {
      if (on) kickResize();
      return;
    }
    last = on;

    document.body.classList.toggle('pionier-landscape', on);
    document.documentElement.classList.toggle('pionier-landscape', on);

    if (!on) {
      try {
        if (typeof window.__pionierRelayoutPortrait === 'function') {
          window.__pionierRelayoutPortrait();
        } else if (typeof window.__pionierCenterPan === 'function') {
          window.__pionierCenterPan();
        }
      } catch (_) {}
      setTimeout(() => {
        try {
          if (typeof window.__pionierRelayoutPortrait === 'function') window.__pionierRelayoutPortrait();
          else if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
        } catch (_) {}
      }, 120);
      setTimeout(() => {
        try {
          if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
        } catch (_) {}
      }, 400);
    }

    kickResize();
  }

  function kickResize() {
    document.documentElement.style.setProperty('--viewport-h', window.innerHeight + 'px');
    try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 50);
  }

  function boot() {
    last = null;
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    last = null;
    setTimeout(apply, 60);
    setTimeout(apply, 250);
    setTimeout(apply, 600);
  });
})();
