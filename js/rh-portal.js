/**
 * rh-portal.js — end-of-road Rabbit Hole arrival ceremony
 *
 * When the world fades at the end of the road:
 *   1. Title: "You've reached the rabbit hole"
 *   2. Then CTA: "Enter rabbit hole"
 *   3. Iris + gold ring + sparks (same language as handpan Play Me)
 *   4. openRabbitHoleScreen({ skipCurtain: true })
 *
 * Other Enter buttons also route through the iris for a consistent transition.
 */
(function () {
  'use strict';

  var WARP_MS = 1100;
  var CTA_DELAY = 950;
  var SHOW_FADE = 0.62;
  var HIDE_FADE = 0.35;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var root, enterBtn, warp, ring, burst;
  var st = { on: false, cta: false, warping: false };
  var ctaTimer = null;

  function atEndOfRoad() {
    try {
      return typeof endOfRoadState !== 'undefined' &&
        !endOfRoadState.rabbitHoleShown &&
        endOfRoadState.screenFade >= SHOW_FADE;
    } catch (e) { return false; }
  }

  function leftEndOfRoad() {
    try {
      return typeof endOfRoadState === 'undefined' ||
        endOfRoadState.rabbitHoleShown ||
        endOfRoadState.screenFade < HIDE_FADE;
    } catch (e) { return true; }
  }

  function show() {
    if (st.on || st.warping) return;
    st.on = true;
    root.classList.add('is-on');
    root.setAttribute('aria-hidden', 'false');
    clearTimeout(ctaTimer);
    ctaTimer = setTimeout(function () {
      if (!st.on || st.warping) return;
      st.cta = true;
      root.classList.add('is-cta');
      enterBtn.disabled = false;
      enterBtn.tabIndex = 0;
      try { enterBtn.focus({ preventScroll: true }); } catch (e) {}
    }, REDUCED ? 80 : CTA_DELAY);
  }

  function hide() {
    if (!st.on || st.warping) return;
    st.on = false;
    st.cta = false;
    clearTimeout(ctaTimer);
    root.classList.remove('is-on', 'is-cta');
    root.setAttribute('aria-hidden', 'true');
    enterBtn.disabled = true;
    enterBtn.tabIndex = -1;
  }

  function sparks(maxR) {
    if (REDUCED || !burst) return;
    var N = 34;
    for (var i = 0; i < N; i++) {
      var s = document.createElement('i');
      s.className = 'rh-spark';
      var a = Math.random() * Math.PI * 2;
      var dist = maxR * (0.25 + Math.random() * 0.7);
      var tx = Math.cos(a) * dist, ty = Math.sin(a) * dist;
      var dur = 650 + Math.random() * 450;
      var size = 0.5 + Math.random() * 0.9;
      burst.appendChild(s);
      if (s.animate) {
        s.animate([
          { transform: 'translate(0,0) scale(' + size + ')', opacity: 0 },
          { transform: 'translate(' + (tx * 0.18) + 'px,' + (ty * 0.18) + 'px) scale(' + size + ')', opacity: 1, offset: 0.12 },
          { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0.2)', opacity: 0 }
        ], { duration: dur, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', delay: Math.random() * 120, fill: 'forwards' });
      }
    }
  }

  function resetWarp() {
    st.warping = false;
    document.body.classList.remove('rh-warping');
    [warp, ring, burst].forEach(function (el) { if (el) el.classList.remove('is-on'); });
    if (burst) burst.innerHTML = '';
  }

  function irisFrom(el, done) {
    if (st.warping) return;
    st.warping = true;

    var cx, cy;
    if (el && el.getBoundingClientRect) {
      var r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    } else {
      cx = window.innerWidth / 2;
      cy = window.innerHeight / 2;
    }
    var maxR = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 24;

    [warp, ring, burst].forEach(function (node) {
      if (!node) return;
      node.style.setProperty('--rh-x', cx + 'px');
      node.style.setProperty('--rh-y', cy + 'px');
      node.style.setProperty('--rh-r', maxR + 'px');
      node.style.setProperty('--rh-d', (maxR * 2) + 'px');
    });

    document.body.classList.add('rh-warping');
    if (root) root.classList.remove('is-on', 'is-cta');
    if (warp) warp.classList.add('is-on');
    if (ring) ring.classList.add('is-on');
    if (burst) burst.classList.add('is-on');
    sparks(maxR);

    setTimeout(function () {
      if (typeof done === 'function') done();
      // Keep the dark iris up briefly so the RH can paint underneath, then clear
      setTimeout(resetWarp, 80);
    }, REDUCED ? 140 : WARP_MS);
  }

  function openRH() {
    if (typeof openRabbitHoleScreen === 'function') {
      openRabbitHoleScreen({ skipCurtain: true });
    }
  }

  function goFromPortal() {
    if (!st.cta || st.warping) return;
    try { if (typeof trackEvent === 'function') trackEvent('rabbit_hole_portal_enter'); } catch (e) {}
    irisFrom(enterBtn, openRH);
  }

  /** Public: iris then open — used by s7 / story / deep monograph buttons */
  function enterWithWarp(fromEl) {
    if (st.warping) return;
    if (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown) return;
    irisFrom(fromEl || null, openRH);
  }

  function tick() {
    if (st.warping) return;
    if (atEndOfRoad()) show();
    else if (leftEndOfRoad()) hide();
  }

  function boot() {
    root = document.getElementById('rhPortal');
    enterBtn = document.getElementById('rhPortalEnter');
    warp = document.getElementById('rhWarp');
    ring = document.getElementById('rhRing');
    burst = document.getElementById('rhBurst');
    if (!root || !enterBtn || !warp || !ring || !burst) return;

    enterBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      goFromPortal();
    });
    enterBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goFromPortal();
      }
    });

    // Route other Enter buttons through the same iris
    ['s7EnterRabbitHoleBtn', 'storyEnterRabbitHoleBtn', 'dmOpenRhBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      // Capture phase so we run before ui.js handlers that open immediately
      btn.addEventListener('click', function (e) {
        if (st.warping) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (typeof endOfRoadState !== 'undefined' && endOfRoadState.rabbitHoleShown) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        enterWithWarp(btn);
      }, true);
    });

    // Poll world fade (cheap; egg does similar)
    setInterval(tick, 120);
    tick();

    window.enterRabbitHoleWithWarp = enterWithWarp;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
