/**
 * easter-egg.js
 * Hidden Handpan: when the rolling handpan reaches the top of the left hill
 * (the summit where the ball fades out), the site shows "Easter egg found!",
 * then fades in a "Play Me" button. Clicking it freezes all main-site audio and
 * teleports the visitor to the handpan app.
 *
 * Reads (never writes) the existing simulation state:
 *   x, gameStarted            (physics.js)
 *   LEFT_HILL_TOP_X, LEFT_REVEAL_X, leftSecretState   (content.js)
 */
(function () {
  'use strict';

  var TARGET = './handpan-app/';
  var CTA_DELAY_MS = 1500;
  var WARP_MS = 1100;
  var PEAK_PAST_TOP = 30;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var root, playBtn, warp, ring, burst;
  var st = { on: false, cta: false, warping: false, foundLogged: false, prefetched: false };
  var ctaTimer = null;

  function worldReady() {
    return typeof x === 'number' &&
      typeof gameStarted !== 'undefined' && gameStarted &&
      typeof leftSecretState !== 'undefined' &&
      typeof LEFT_HILL_TOP_X === 'number' &&
      typeof LEFT_REVEAL_X === 'number';
  }

  function atPeak() {
    return x <= LEFT_HILL_TOP_X - PEAK_PAST_TOP && leftSecretState.alpha > 0.9;
  }

  function leftPeak() {
    return x > LEFT_REVEAL_X + 40;
  }

  function prefetchTarget() {
    if (st.prefetched) return;
    st.prefetched = true;
    try {
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = TARGET;
      document.head.appendChild(l);
    } catch (_) {}
  }

  function show() {
    if (st.on) return;
    st.on = true;
    root.classList.add('is-on');
    root.setAttribute('aria-hidden', 'false');
    prefetchTarget();
    if (!st.foundLogged) {
      st.foundLogged = true;
      try {
        if (typeof trackEvent === 'function') trackEvent('easter_egg_found', { place: 'left_hill_summit' });
      } catch (_) {}
    }
    try {
      if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.isInitialized && !ResonanceAudio.isMuted && !st.warping) {
        ResonanceAudio.playTone(9, 0.4, { duration: 0.9 });
      }
    } catch (_) {}
    clearTimeout(ctaTimer);
    ctaTimer = setTimeout(function () {
      if (!st.on || st.warping) return;
      st.cta = true;
      root.classList.add('is-cta');
      playBtn.disabled = false;
      playBtn.tabIndex = 0;
      playBtn.setAttribute('aria-hidden', 'false');
    }, REDUCED ? 200 : CTA_DELAY_MS);
  }

  function hide() {
    st.on = false;
    st.cta = false;
    clearTimeout(ctaTimer);
    root.classList.remove('is-on', 'is-cta');
    root.setAttribute('aria-hidden', 'true');
    playBtn.disabled = true;
    playBtn.tabIndex = -1;
    playBtn.setAttribute('aria-hidden', 'true');
  }

  function resetWarp() {
    st.warping = false;
    if (warp) {
      warp.classList.remove('is-on');
      warp.setAttribute('aria-hidden', 'true');
    }
    if (ring) ring.classList.remove('is-on');
    if (burst) burst.classList.remove('is-on');
  }

  function freezeMainAudio() {
    try {
      if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.mute) ResonanceAudio.mute();
    } catch (_) {}
    try {
      if (typeof currentAudio !== 'undefined' && currentAudio && !currentAudio.paused) {
        currentAudio.pause();
      }
    } catch (_) {}
  }

  function unfreezeMainAudio() {
    try {
      if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.unmute) ResonanceAudio.unmute();
    } catch (_) {}
  }

  function go() {
    if (st.warping) return;
    st.warping = true;
    freezeMainAudio();
    if (warp) {
      warp.classList.add('is-on');
      warp.setAttribute('aria-hidden', 'false');
    }
    if (ring) ring.classList.add('is-on');
    if (burst) burst.classList.add('is-on');
    try {
      if (typeof trackEvent === 'function') trackEvent('easter_egg_enter', { target: 'handpan_app' });
    } catch (_) {}
    setTimeout(function () {
      window.location.href = TARGET + '?from=summit';
    }, REDUCED ? 140 : WARP_MS);
  }

  function tick() {
    if (st.warping) return;
    var ready = worldReady();
    if (!st.on) {
      if (ready && atPeak()) show();
    } else {
      if (!ready || leftPeak()) hide();
    }
  }

  function init() {
    window.__eggBooted = true;
    root = document.getElementById('eggFound');
    playBtn = document.getElementById('eggPlay');
    warp = document.getElementById('eggWarp');
    ring = document.getElementById('eggRing');
    burst = document.getElementById('eggBurst');
    if (!root || !playBtn || !warp || !ring || !burst) return;

    hide();
    playBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      go();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !st.cta || st.warping) return;
      var ae = document.activeElement;
      if (ae && ae !== document.body && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
      e.preventDefault();
      go();
    });

    setInterval(tick, 90);

    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      resetWarp();
      hide();
      unfreezeMainAudio();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
