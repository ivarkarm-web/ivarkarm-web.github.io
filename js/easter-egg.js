/**
 * easter-egg.js
 * Hidden Handpan: when the rolling handpan reaches the top of the left hill
 * (the summit where the ball fades out), the site shows "Easter egg found!",
 * then fades in a "Play Me" button. Clicking it freezes all main-site audio and
 * teleports the visitor to handpan.html.
 *
 * Reads (never writes) the existing simulation state:
 *   x, gameStarted            (physics.js)
 *   LEFT_HILL_TOP_X, LEFT_REVEAL_X, leftSecretState   (content.js)
 * Everything else is self-contained, so no existing script is modified.
 */
(function () {
  'use strict';

  var TARGET = './handpan.html';
  var CTA_DELAY_MS = 1500;       // "Easter egg found!" lands first, then the button
  var WARP_MS = 1100;            // matches the CSS iris duration
  var PEAK_PAST_TOP = 30;        // px beyond the hilltop stone, so it never fires on the climb
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var root, playBtn, warp, ring, burst;
  var st = { on: false, cta: false, warping: false, foundLogged: false, prefetched: false };
  var ctaTimer = null;

  // ---------------------------------------------------------------------------
  // Reading the world state (all guarded: if anything is missing, the egg stays hidden)
  // ---------------------------------------------------------------------------
  function worldReady() {
    return typeof x === 'number' &&
      typeof gameStarted !== 'undefined' && gameStarted &&
      typeof leftSecretState !== 'undefined' &&
      typeof LEFT_HILL_TOP_X === 'number' &&
      typeof LEFT_REVEAL_X === 'number';
  }

  function atPeak() {
    // past the hilltop and the ball has fully faded into the secret
    return x <= LEFT_HILL_TOP_X - PEAK_PAST_TOP && leftSecretState.alpha > 0.9;
  }

  function leftPeak() {
    // hysteresis: only retreat once the player has clearly rolled back down
    return x > LEFT_REVEAL_X + 40;
  }

  // ---------------------------------------------------------------------------
  // Show / hide
  // ---------------------------------------------------------------------------
  function prefetchTarget() {
    if (st.prefetched) return;
    st.prefetched = true;
    ['handpan.html', 'handpan.css?v=1', 'js/handpan.js?v=1'].forEach(function (href) {
      try {
        var l = document.createElement('link');
        l.rel = 'prefetch';
        l.href = './' + href;
        document.head.appendChild(l);
      } catch (e) { /* hint only */ }
    });
  }

  function chime() {
    // one soft summit note from the existing procedural audio (respects mute / frozen state)
    try {
      if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.initialized && !ResonanceAudio.isMuted && !st.warping) {
        ResonanceAudio.playTone(9, 0.4, { duration: 3.4 });
      }
    } catch (e) { /* cosmetic */ }
  }

  function show() {
    st.on = true;
    root.classList.add('is-on');
    root.setAttribute('aria-hidden', 'false');
    prefetchTarget();
    chime();
    if (!st.foundLogged) {
      st.foundLogged = true;
      try { if (typeof trackEvent === 'function') trackEvent('easter_egg_found', { id: 'handpan' }); } catch (e) { /* ignore */ }
    }
    clearTimeout(ctaTimer);
    ctaTimer = setTimeout(showCta, REDUCED ? 200 : CTA_DELAY_MS);
  }

  function showCta() {
    if (!st.on) return;
    st.cta = true;
    root.classList.add('is-cta');
    playBtn.disabled = false;
    playBtn.tabIndex = 0;
    playBtn.setAttribute('aria-hidden', 'false');
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

  function tick() {
    if (st.warping) return;
    var ready = worldReady();
    if (!st.on) {
      if (ready && atPeak()) show();
    } else if (!ready || leftPeak()) {
      hide();
    }
  }

  // ---------------------------------------------------------------------------
  // Freeze the main site's audio (procedural ambience + any music / orb / preview tracks)
  // ---------------------------------------------------------------------------
  var frozen = null;   // { media: [{el, wasPlaying}], ctx, prevGain }

  function collectMedia() {
    var list = [];
    function add(el) { if (el && typeof el.pause === 'function' && list.indexOf(el) < 0) list.push(el); }
    try { Array.prototype.forEach.call(document.querySelectorAll('audio, video'), add); } catch (e) { /* ignore */ }
    try { if (typeof currentAudio !== 'undefined') add(currentAudio); } catch (e) { /* ignore */ }
    try { if (typeof musicPlayer !== 'undefined') add(musicPlayer.audio); } catch (e) { /* ignore */ }
    try { if (typeof rhScrollManager !== 'undefined') add(rhScrollManager.activePreviewAudio); } catch (e) { /* ignore */ }
    return list;
  }

  function freezeMainAudio() {
    if (frozen) return;
    frozen = { media: [], ctx: null, prevGain: null };

    collectMedia().forEach(function (el) {
      var playing = false;
      try { playing = !el.paused && !el.ended; } catch (e) { /* ignore */ }
      frozen.media.push({ el: el, wasPlaying: playing });
      try { el.pause(); } catch (e) { /* ignore */ }
    });

    try {
      if (typeof ResonanceAudio !== 'undefined' && ResonanceAudio.ctx) {
        var c = ResonanceAudio.ctx;
        var g = ResonanceAudio.masterGain;
        frozen.ctx = c;
        if (g && c.state === 'running') {
          var now = c.currentTime;
          frozen.prevGain = g.gain.value;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + 0.18);   // fade first: no click
        }
        // Whatever else tries to wake the context while we teleport, put it back to sleep
        c.onstatechange = function () {
          if (frozen && c.state === 'running') { try { c.suspend(); } catch (e) { /* ignore */ } }
        };
        setTimeout(function () {
          if (frozen) { try { c.suspend(); } catch (e) { /* ignore */ } }
        }, 220);
      }
    } catch (e) { /* ignore */ }

    window.__ivarMainAudioFrozen = true;
  }

  // Only used when the browser restores this page from the back/forward cache
  function unfreezeMainAudio() {
    if (!frozen) return;
    var f = frozen;
    frozen = null;
    window.__ivarMainAudioFrozen = false;
    try {
      if (f.ctx) {
        f.ctx.onstatechange = null;
        var p = f.ctx.resume();
        if (p && p.catch) p.catch(function () {});
        var g = (typeof ResonanceAudio !== 'undefined') ? ResonanceAudio.masterGain : null;
        if (g && f.prevGain !== null) {
          var now = f.ctx.currentTime;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(f.prevGain, now + 0.6);
        }
      }
    } catch (e) { /* ignore */ }
    f.media.forEach(function (m) {
      if (!m.wasPlaying) return;
      try { var pr = m.el.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ }
    });
  }

  // ---------------------------------------------------------------------------
  // Teleport
  // ---------------------------------------------------------------------------
  function sparks(cx, cy, maxR) {
    if (REDUCED || !burst || !burst.animate) return;
    var N = 34;
    for (var i = 0; i < N; i++) {
      var s = document.createElement('i');
      s.className = 'egg-spark';
      var a = Math.random() * Math.PI * 2;
      var dist = maxR * (0.25 + Math.random() * 0.7);
      var tx = Math.cos(a) * dist, ty = Math.sin(a) * dist;
      var dur = 650 + Math.random() * 450;
      var size = 0.5 + Math.random() * 0.9;
      burst.appendChild(s);
      s.animate([
        { transform: 'translate(0,0) scale(' + size + ')', opacity: 0 },
        { transform: 'translate(' + (tx * 0.18) + 'px,' + (ty * 0.18) + 'px) scale(' + size + ')', opacity: 1, offset: 0.12 },
        { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0.2)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', delay: Math.random() * 120, fill: 'forwards' });
    }
  }

  function resetWarp() {
    st.warping = false;
    document.body.classList.remove('egg-warping');
    [warp, ring, burst].forEach(function (el) { if (el) el.classList.remove('is-on'); });
    if (burst) burst.innerHTML = '';
  }

  function go() {
    if (st.warping || !st.cta) return;
    st.warping = true;

    var r = playBtn.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var maxR = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 24;

    // 1. the main background track stops the moment the visitor commits
    freezeMainAudio();

    // 2. iris + ring + sparks from the button
    [warp, ring, burst].forEach(function (el) {
      el.style.setProperty('--egg-x', cx + 'px');
      el.style.setProperty('--egg-y', cy + 'px');
      el.style.setProperty('--egg-r', maxR + 'px');
      el.style.setProperty('--egg-d', (maxR * 2) + 'px');
    });
    document.body.classList.add('egg-warping');
    root.classList.remove('is-on', 'is-cta');
    warp.classList.add('is-on');
    ring.classList.add('is-on');
    burst.classList.add('is-on');
    sparks(cx, cy, maxR);

    try { if (typeof trackEvent === 'function') trackEvent('easter_egg_play', { id: 'handpan' }); } catch (e) { /* ignore */ }

    // 3. arrive on the handpan page as the iris closes over the screen
    setTimeout(function () {
      window.location.href = TARGET + '?from=summit';
    }, REDUCED ? 140 : WARP_MS);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function init() {
    root = document.getElementById('eggFound');
    playBtn = document.getElementById('eggPlay');
    warp = document.getElementById('eggWarp');
    ring = document.getElementById('eggRing');
    burst = document.getElementById('eggBurst');
    if (!root || !playBtn || !warp || !ring || !burst) return;   // markup missing: stay inert

    hide();
    playBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(); });

    // Enter confirms when the button is showing and nothing else has focus
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !st.cta || st.warping) return;
      var ae = document.activeElement;
      if (ae && ae !== document.body && /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
      e.preventDefault();
      go();
    });

    setInterval(tick, 90);

    // Back/forward cache: coming back from the handpan page restores this page as it was
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
