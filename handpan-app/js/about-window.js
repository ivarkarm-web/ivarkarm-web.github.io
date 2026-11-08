/**
 * about-window.js — About Pionier modal.
 * ES module.
 *
 * Opens a centred, scrollable About window from the top navigation group.
 * Reuses the existing modal conventions (backdrop, Escape, backdrop click,
 * focus restore) without touching audio playback or the instrument state.
 */

const APP_VERSION_URL = './APP_VERSION';
let backdrop = null;
let windowEl = null;
let closeBtn = null;
let versionEl = null;
let btn = null;
let open = false;
let inertState = [];

function $(id) {
  return document.getElementById(id);
}

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
  return { backdrop, window: windowEl, close: closeBtn, btn };
}

function setVersion() {
  if (!versionEl) {
    return;
  }
  try {
    fetch(APP_VERSION_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          return '';
        }
        return response.text();
      })
      .then((text) => {
        const v = (text || '').trim();
        versionEl.textContent = v ? 'Pionier \u00b7 v' + v : 'Pionier';
      })
      .catch(() => {});
  } catch (_) {}
}

function applyInert(nodes, value) {
  nodes.forEach((pair) => {
    const node = pair[0];
    const wasInert = pair[1];
    try {
      node.inert = value ? true : wasInert;
    } catch (_) {}
  });
}

export function openAbout() {
  const els = ensureDom();
  if (!els.btn || !els.backdrop || !els.window || open) {
    return;
  }
  open = true;
  els.btn.setAttribute('aria-expanded', 'true');
  try {
    window.PionierOverlay?.closeAll?.();
  } catch (_) {}
  inertState = [...document.body.children]
    .filter((node) => node !== els.backdrop && node !== els.window && node.tagName !== 'SCRIPT')
    .map((node) => [node, node.inert]);
  applyInert(inertState, true);
  els.backdrop.hidden = false;
  els.backdrop.removeAttribute('hidden');
  els.window.hidden = false;
  els.window.removeAttribute('hidden');
  els.window.setAttribute('aria-hidden', 'false');
  setVersion();
  requestAnimationFrame(() => {
    els.close?.focus?.({ preventScroll: true });
  });
}

export function close() {
  const els = ensureDom();
  if (!open || !els.btn || !els.backdrop || !els.window) {
    return;
  }
  open = false;
  els.btn.setAttribute('aria-expanded', 'false');
  els.backdrop.hidden = true;
  els.backdrop.setAttribute('hidden', '');
  els.window.hidden = true;
  els.window.setAttribute('aria-hidden', 'true');
  applyInert(inertState, false);
  inertState = [];
  els.btn.focus?.({ preventScroll: true });
}

function onKey(event) {
  if (!open) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key === 'Tab') {
    const focusables = [
      ...windowEl.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!focusables.length) {
      return;
    }
    event.preventDefault();
    const idx = focusables.indexOf(document.activeElement);
    if (event.shiftKey) {
      focusables[(idx - 1 + focusables.length) % focusables.length]?.focus?.({
        preventScroll: true,
      });
    } else {
      focusables[(idx + 1) % focusables.length]?.focus?.({ preventScroll: true });
    }
  }
}

export function boot() {
  const els = ensureDom();
  if (!els.btn) {
    return;
  }
  els.btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    open ? close() : openAbout();
  });
  if (els.close) {
    els.close.addEventListener('click', close);
  }
  document.addEventListener('keydown', onKey, true);
  setVersion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
