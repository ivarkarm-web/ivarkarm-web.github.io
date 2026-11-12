/**
 * about-window.js — About Pionier modal.
 *
 * Opens a centred, scrollable About window from the top navigation group.
 * Reuses the existing modal conventions (backdrop, Escape, backdrop click,
 * focus restore) without touching audio playback or the instrument state.
 */
(function aboutWindow() {
  'use strict';

  var APP_RELEASE_VERSION = '1.0.0';
  var backdrop = null;
  var windowEl = null;
  var closeBtn = null;
  var versionEl = null;
  var btn = null;
  var open = false;
  var inertState = [];

  function $(id) { return document.getElementById(id); }

  function ensureDom() {
    backdrop = $('aboutBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'aboutBackdrop';
      backdrop.className = 'about-backdrop';
      backdrop.setAttribute('aria-label', 'Close');
      backdrop.hidden = true;
      backdrop.addEventListener('click', close);
      document.body.appendChild(backdrop);
    }
    windowEl = $('aboutWindow');
    if (!windowEl) {
      windowEl = document.createElement('div');
      windowEl.id = 'aboutWindow';
      windowEl.className = 'about-window';
      windowEl.setAttribute('role', 'dialog');
      windowEl.setAttribute('aria-modal', 'true');
      windowEl.setAttribute('aria-labelledby', 'aboutTitle');
      windowEl.hidden = true;
      windowEl.innerHTML =
        '<div class="about-header">' +
        '  <h2 id="aboutTitle">About Pionier</h2>' +
        '  <button type="button" class="about-close" id="aboutClose" aria-label="Close about window">\u00D7</button>' +
        '</div>' +
        '<div class="about-body">' +
        '  <h3>Pionier</h3>' +
        '  <p>An instrument for exploration.</p>' +
        '  <p>Pionier is a digital musical playground for exploring handpan-inspired sounds, world instruments, scales and ambient textures.</p>' +
        '  <h3>Explore</h3>' +
        '  <ul>' +
        '    <li>Instruments and musical scales.</li>' +
        '    <li>Touch-based playing and expression.</li>' +
        '    <li>Effects and sound design.</li>' +
        '    <li>Looping and layering.</li>' +
        '    <li>Generative musical ideas and soundscapes.</li>' +
        '  </ul>' +
        '  <h3>How to play</h3>' +
        '  <ul>' +
        '    <li>Tap to create sound.</li>' +
        '    <li>Hold to sustain where supported.</li>' +
        '    <li>Slide to explore expression where supported.</li>' +
        '    <li>Experiment with different scales and instruments.</li>' +
        '    <li>Build compositions using the looper and creative tools.</li>' +
        '  </ul>' +
        '  <h3>About</h3>' +
        '  <p>Pionier is an independent musical experiment built around exploration, listening and creative freedom.</p>' +
        '  <p class="about-version">Version <span id="aboutVersion"></span></p>' +
        '</div>';
      document.body.appendChild(windowEl);
    }
    closeBtn = $('aboutClose');
    versionEl = $('aboutVersion');
    btn = $('aboutBtn');
    return { backdrop: backdrop, window: windowEl, close: closeBtn, btn: btn };
  }

  function setVersion() {
    if (!versionEl) return;
    versionEl.textContent = 'Pionier ' + APP_RELEASE_VERSION;
  }

  function applyInert(nodes, value) {
    nodes.forEach(function (pair) {
      var node = pair[0], wasInert = pair[1];
      try { node.inert = value ? true : wasInert; } catch (_) {}
    });
  }

  function openAbout() {
    var els = ensureDom();
    if (!els.btn || !els.backdrop || !els.window || open) return;
    open = true;
    els.btn.setAttribute('aria-expanded', 'true');
    try { window.PionierOverlay?.closeAll?.(); } catch (_) {}
    inertState = [].slice.call(document.body.children).filter(function (node) {
      return node !== els.backdrop && node !== els.window && node.tagName !== 'SCRIPT';
    }).map(function (node) { return [node, node.inert]; });
    applyInert(inertState, true);
    els.backdrop.hidden = false; els.backdrop.removeAttribute('hidden');
    els.window.hidden = false; els.window.removeAttribute('hidden');
    els.window.setAttribute('aria-hidden', 'false');
    setVersion();
    requestAnimationFrame(function () { els.close?.focus?.({ preventScroll: true }); });
  }

  function close() {
    var els = ensureDom();
    if (!open || !els.btn || !els.backdrop || !els.window) return;
    open = false;
    els.btn.setAttribute('aria-expanded', 'false');
    els.backdrop.hidden = true; els.backdrop.setAttribute('hidden', '');
    els.window.hidden = true; els.window.setAttribute('aria-hidden', 'true');
    applyInert(inertState, false);
    inertState = [];
    els.btn.focus?.({ preventScroll: true });
  }

  function onKey(event) {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Tab') {
      var focusables = [].slice.call(windowEl.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      event.preventDefault();
      var idx = focusables.indexOf(document.activeElement);
      if (event.shiftKey) {
        focusables[(idx - 1 + focusables.length) % focusables.length]?.focus?.({ preventScroll: true });
      } else {
        focusables[(idx + 1) % focusables.length]?.focus?.({ preventScroll: true });
      }
    }
  }

  function boot() {
    var els = ensureDom();
    if (!els.btn) return;
    els.btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      open ? close() : openAbout();
    });
    if (els.close) els.close.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    setVersion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
