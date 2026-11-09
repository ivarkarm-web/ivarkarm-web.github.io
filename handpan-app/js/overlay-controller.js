/**
 * overlay-controller.js — one open overlay at a time.
 * Owns: instrument menu, scale menu, FX panel and Settings sheet.
 * Instrument and scale share one animated glass scroll-menu shell.
 */
(function overlayController() {
  const PICKER_IDS = ['instrumentMenu', 'scaleMenu'];
  let pickerOutsideHandler = null;
  const TOGGLE_FOR = {
    instrumentMenu: 'instrumentDropdownToggle',
    scaleMenu: 'scaleLabel',
  };

  function isLightTheme() {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    if (document.documentElement.classList.contains('theme-light') ||
        document.body.classList.contains('theme-light') ||
        document.documentElement.dataset.theme === 'light' ||
        document.body.dataset.theme === 'light' ||
        window.PionierSettings?.lightMode === true) return true;
<<<<<<< HEAD
    try {
      const raw = localStorage.getItem('pionier.settings.v2') || localStorage.getItem('pionier.settings.v1');
      if (raw && JSON.parse(raw).lightMode === true) return true;
=======
    if (
      document.documentElement.classList.contains('theme-light') ||
      document.body.classList.contains('theme-light') ||
      document.documentElement.dataset.theme === 'light' ||
      document.body.dataset.theme === 'light' ||
      window.PionierSettings?.lightMode === true
    ) {
      return true;
    }
    try {
      const raw =
        localStorage.getItem('pionier.settings.v2') || localStorage.getItem('pionier.settings.v1');
      if (raw && JSON.parse(raw).lightMode === true) {
        return true;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    try {
      const raw = localStorage.getItem('pionier.settings.v2') || localStorage.getItem('pionier.settings.v1');
      if (raw && JSON.parse(raw).lightMode === true) return true;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    } catch (_) {}
    return false;
  }

  function ensureBackdrop() {
    let bd = document.getElementById('pickerBackdrop');
    if (!bd) {
      bd = document.createElement('button');
      bd.type = 'button';
      bd.id = 'pickerBackdrop';
      bd.className = 'picker-backdrop';
      bd.setAttribute('aria-label', 'Close');
      bd.hidden = true;
      bd.addEventListener('click', () => closeAll());
      document.body.appendChild(bd);
<<<<<<< HEAD
    }
    return bd;
  }

  function clearInlineLayout(el) {
    if (!el || !el.style) return;
    [
      'position', 'left', 'right', 'top', 'bottom', 'width', 'max-width',
      'max-height', 'transform', 'display', 'visibility', 'opacity',
      'pointer-events', 'z-index', 'border-radius',
    ].forEach((p) => el.style.removeProperty(p));
  }

=======
    }
    return bd;
  }

  function clearInlineLayout(el) {
    if (!el || !el.style) return;
    [
      'position', 'left', 'right', 'top', 'bottom', 'width', 'max-width',
      'max-height', 'transform', 'display', 'visibility', 'opacity',
      'pointer-events', 'z-index', 'border-radius',
    ].forEach((p) => el.style.removeProperty(p));
  }

>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
  function closePickers() {
    let restoreToggleId = null;
    PICKER_IDS.forEach((id) => {
      const m = document.getElementById(id);
<<<<<<< HEAD
<<<<<<< HEAD
      if (!m) return;
      if (!m.hidden && TOGGLE_FOR[id]) restoreToggleId = TOGGLE_FOR[id];
=======
      if (!m) {
        return;
      }
      if (!m.hidden && TOGGLE_FOR[id]) {
        restoreToggleId = TOGGLE_FOR[id];
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      if (!m) return;
      if (!m.hidden && TOGGLE_FOR[id]) restoreToggleId = TOGGLE_FOR[id];
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      m.hidden = true;
      m.setAttribute('hidden', '');
      m.classList.remove('is-open', 'picker-sheet', 'picker-popover');
      clearInlineLayout(m);
      m.style.setProperty('display', 'none', 'important');
      const tid = TOGGLE_FOR[id];
<<<<<<< HEAD
<<<<<<< HEAD
      if (tid) document.getElementById(tid)?.setAttribute('aria-expanded', 'false');
    });
    const bd = document.getElementById('pickerBackdrop');
    if (bd) { bd.hidden = true; bd.setAttribute('hidden', ''); bd.style.removeProperty('display'); }
=======
      if (tid) {
        document.getElementById(tid)?.setAttribute('aria-expanded', 'false');
      }
    });
    const bd = document.getElementById('pickerBackdrop');
    if (bd) {
      bd.hidden = true;
      bd.setAttribute('hidden', '');
      bd.style.removeProperty('display');
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      if (tid) document.getElementById(tid)?.setAttribute('aria-expanded', 'false');
    });
    const bd = document.getElementById('pickerBackdrop');
    if (bd) { bd.hidden = true; bd.setAttribute('hidden', ''); bd.style.removeProperty('display'); }
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    if (pickerOutsideHandler) {
      document.removeEventListener('pointerdown', pickerOutsideHandler, true);
      pickerOutsideHandler = null;
    }
    if (restoreToggleId) {
<<<<<<< HEAD
<<<<<<< HEAD
      try { document.getElementById(restoreToggleId)?.focus?.(); } catch (_) {}
    }
  }

  function closeFx() {
    const fx = document.getElementById('fxPanel');
    if (fx) {
      fx.hidden = true;
      clearInlineLayout(fx);
    }
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-fx-open');
  }

  function closeSettings() {
    const sheet = document.getElementById('settingsSheet');
    const backdrop = document.getElementById('settingsSheetBackdrop');
    if (sheet) {
      sheet.classList.remove('is-open');
      sheet.hidden = true;
      sheet.setAttribute('hidden', '');
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.hidden = true;
      backdrop.setAttribute('hidden', '');
    }
    document.getElementById('settingsOpenBtn')?.setAttribute('aria-expanded', 'false');
  }

  function closeAll(except) {
    if (except !== 'pickers') closePickers();
    if (except !== 'fx') closeFx();
    if (except !== 'settings') closeSettings();
  }

=======
      try {
        document.getElementById(restoreToggleId)?.focus?.();
      } catch (_) {}
=======
      try { document.getElementById(restoreToggleId)?.focus?.(); } catch (_) {}
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    }
  }

  function closeFx() {
    const fx = document.getElementById('fxPanel');
    if (fx) {
      fx.hidden = true;
      clearInlineLayout(fx);
    }
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-fx-open');
  }

  function closeSettings() {
    const sheet = document.getElementById('settingsSheet');
    const backdrop = document.getElementById('settingsSheetBackdrop');
    if (sheet) {
      sheet.classList.remove('is-open');
      sheet.hidden = true;
      sheet.setAttribute('hidden', '');
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.hidden = true;
      backdrop.setAttribute('hidden', '');
    }
    document.getElementById('settingsOpenBtn')?.setAttribute('aria-expanded', 'false');
  }

  function closeAll(except) {
    if (except !== 'pickers') closePickers();
    if (except !== 'fx') closeFx();
    if (except !== 'settings') closeSettings();
  }

>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
  /**
   * Android Chrome often fails to scroll flex children when max-height is
   * "inherit" and touch-action is unset. Give the results pane an explicit
   * pixel max-height and pan-y touch handling so lists scroll on Android.
   */
  function applyPickerScrollStyles(menu, maxHeightPx) {
<<<<<<< HEAD
<<<<<<< HEAD
    if (!menu) return;
    const results = menu.querySelector('.picker-results');
    if (!results) return;
=======
    if (!menu) {
      return;
    }
    const results = menu.querySelector('.picker-results');
    if (!results) {
      return;
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!menu) return;
    const results = menu.querySelector('.picker-results');
    if (!results) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    const chromeReserve = 56; // close btn + padding inside the popover
    const resultsMax = Math.max(80, (maxHeightPx || 280) - chromeReserve);
    Object.assign(results.style, {
      display: 'block',
      flex: '1 1 auto',
      flexGrow: '1',
      flexShrink: '1',
      flexBasis: '0',
      minHeight: '0',
      minWidth: '0',
      width: '100%',
      height: 'auto',
      maxHeight: resultsMax + 'px',
      overflowX: 'hidden',
      overflowY: 'scroll',
      overscrollBehavior: 'contain',
      webkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      transform: 'none',
      position: 'relative',
      zIndex: '1',
    });
    // Nudge Android Chrome to create a real scroll layer after layout.
    void results.offsetHeight;
  }

  function placePicker(menu, toggle) {
<<<<<<< HEAD
<<<<<<< HEAD
    if (!menu || !toggle) return;
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
=======
    if (!menu || !toggle) {
      return;
    }
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!menu || !toggle) return;
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    menu.style.removeProperty('display');
    const rect = toggle.getBoundingClientRect();
    const gap = 8;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const width = Math.min(280, vw - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - 12));
    const maxHeight = Math.max(160, Math.min(420, rect.top - 20, vh - 32));
    menu.classList.remove('picker-sheet');
    menu.classList.add('picker-popover', 'looper-bubble-menu', 'is-open');
    menu.hidden = false;
    menu.removeAttribute('hidden');
    Object.assign(menu.style, {
      position: 'fixed',
      zIndex: '7200',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto',
      left: left + 'px',
      right: 'auto',
      top: 'auto',
      bottom: Math.max(12, vh - rect.top + gap) + 'px',
      width: width + 'px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: maxHeight + 'px',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transform: 'none',
      touchAction: 'manipulation',
    });
    applyPickerScrollStyles(menu, maxHeight);
    // Re-apply after content render / close button inject (Android needs a second pass).
    requestAnimationFrame(() => applyPickerScrollStyles(menu, maxHeight));
    setTimeout(() => applyPickerScrollStyles(menu, maxHeight), 50);
  }

  function ensurePickerScrollRegion(menu) {
<<<<<<< HEAD
<<<<<<< HEAD
    if (!menu || menu.querySelector('.picker-results')) return;
=======
    if (!menu || menu.querySelector('.picker-results')) {
      return;
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!menu || menu.querySelector('.picker-results')) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    const close = menu.querySelector(':scope > .picker-close');
    const results = document.createElement('div');
    results.className = 'picker-results picker-results-generated';
    Array.from(menu.children).forEach((child) => {
<<<<<<< HEAD
<<<<<<< HEAD
      if (child === close) return;
=======
      if (child === close) {
        return;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      if (child === close) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      results.appendChild(child);
    });
    menu.appendChild(results);
  }

  function openPicker(menuId) {
    const menu = document.getElementById(menuId);
    const toggle = document.getElementById(TOGGLE_FOR[menuId]);
<<<<<<< HEAD
<<<<<<< HEAD
    if (!menu || !toggle) return;
=======
    if (!menu || !toggle) {
      return;
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!menu || !toggle) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    closeAll('pickers');
    closeFx();
    closeSettings();
    PICKER_IDS.forEach((id) => {
<<<<<<< HEAD
<<<<<<< HEAD
      if (id === menuId) return;
=======
      if (id === menuId) {
        return;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      if (id === menuId) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      const m = document.getElementById(id);
      if (m) {
        m.hidden = true;
        m.classList.remove('is-open', 'picker-sheet', 'picker-popover');
        clearInlineLayout(m);
        document.getElementById(TOGGLE_FOR[id])?.setAttribute('aria-expanded', 'false');
      }
    });
    placePicker(menu, toggle);
    toggle.setAttribute('aria-expanded', 'true');
    if (menuId === 'instrumentMenu' && typeof window.__pionierRenderInstrumentMenu === 'function') {
<<<<<<< HEAD
<<<<<<< HEAD
      try { window.__pionierRenderInstrumentMenu(); } catch (_) {}
=======
      try {
        window.__pionierRenderInstrumentMenu();
      } catch (_) {}
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      try { window.__pionierRenderInstrumentMenu(); } catch (_) {}
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    }
    document.dispatchEvent(new CustomEvent('pionier:picker-open', { detail: { id: menuId } }));
    let closeButton = menu.querySelector(':scope > .picker-close');
    if (!closeButton) {
      closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'picker-close';
      closeButton.setAttribute('aria-label', 'Close selector');
      closeButton.textContent = '\u00d7';
<<<<<<< HEAD
<<<<<<< HEAD
      closeButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closePickers(); });
=======
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePickers();
      });
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      closeButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closePickers(); });
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      menu.prepend(closeButton);
    }
    ensurePickerScrollRegion(menu);
    const bd = ensureBackdrop();
    bd.hidden = true;
    bd.setAttribute('hidden', '');
<<<<<<< HEAD
<<<<<<< HEAD
    if (pickerOutsideHandler) document.removeEventListener('pointerdown', pickerOutsideHandler, true);
    pickerOutsideHandler = (event) => {
      const target = event.target;
      if (target instanceof Node && (menu.contains(target) || toggle.contains(target))) return;
=======
    if (pickerOutsideHandler) {
      document.removeEventListener('pointerdown', pickerOutsideHandler, true);
    }
    pickerOutsideHandler = (event) => {
      const target = event.target;
      if (target instanceof Node && (menu.contains(target) || toggle.contains(target))) {
        return;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (pickerOutsideHandler) document.removeEventListener('pointerdown', pickerOutsideHandler, true);
    pickerOutsideHandler = (event) => {
      const target = event.target;
      if (target instanceof Node && (menu.contains(target) || toggle.contains(target))) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      closePickers();
    };
    document.addEventListener('pointerdown', pickerOutsideHandler, true);
    requestAnimationFrame(() => {
      const active = menu.querySelector('[role="menuitem"].is-active, [aria-current="true"]');
<<<<<<< HEAD
<<<<<<< HEAD
      const first = menu.querySelector('[role="menuitem"], button.scale-menu-item, button:not(.picker-close)');
=======
      const first = menu.querySelector(
        '[role="menuitem"], button.scale-menu-item, button:not(.picker-close)'
      );
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      const first = menu.querySelector('[role="menuitem"], button.scale-menu-item, button:not(.picker-close)');
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      (active || first)?.focus?.({ preventScroll: true });
    });
  }

  function togglePicker(menuId) {
    const menu = document.getElementById(menuId);
<<<<<<< HEAD
<<<<<<< HEAD
    if (!menu) return;
=======
    if (!menu) {
      return;
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!menu) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    if (!menu.hidden && menu.classList.contains('is-open')) {
      closePickers();
      document.getElementById(TOGGLE_FOR[menuId])?.focus?.();
    } else {
      openPicker(menuId);
    }
  }

  function openFx() {
    closeAll('fx');
    const panel = document.getElementById('fxPanel');
<<<<<<< HEAD
<<<<<<< HEAD
    if (!panel) return;
=======
    if (!panel) {
      return;
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!panel) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.style.removeProperty('display');
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-fx-open');
<<<<<<< HEAD
<<<<<<< HEAD
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    try { window.PionierCore?.paintFxKnobs?.(); } catch (_) {}
=======
    try {
      window.PionierCore?.ensureAudio?.();
    } catch (_) {}
    try {
      window.PionierCore?.paintFxKnobs?.();
    } catch (_) {}
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    try { window.PionierCore?.paintFxKnobs?.(); } catch (_) {}
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
  }

  function toggleFx() {
    const panel = document.getElementById('fxPanel');
    if (panel && !panel.hidden) {
      closeFx();
      document.getElementById('fxPanelOpen')?.focus?.();
    } else {
      openFx();
    }
  }

  window.PionierOverlay = {
    closeAll,
    closePickers,
    closeFx,
    closeSettings,
    openPicker,
    togglePicker,
    openFx,
    toggleFx,
    ensureBackdrop,
  };

  function wire() {
    ensureBackdrop();

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
    document.getElementById('instrumentDropdownToggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePicker('instrumentMenu');
    }, true);
    document.getElementById('scaleLabel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePicker('scaleMenu');
    }, true);
<<<<<<< HEAD

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
=======
    document.getElementById('instrumentDropdownToggle')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePicker('instrumentMenu');
      },
      true
    );
    document.getElementById('scaleLabel')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePicker('scaleMenu');
      },
      true
    );

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) {
        return;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      if (t.closest('#instrumentMenu [role="menuitem"], #instrumentMenu button')) {
        setTimeout(() => {
          closePickers();
          document.getElementById('instrumentDropdownToggle')?.focus?.();
        }, 0);
      }
      if (t.closest('#scaleMenu [role="menuitem"], #scaleMenu button.scale-menu-item')) {
        setTimeout(() => {
          closePickers();
          document.getElementById('scaleLabel')?.focus?.();
        }, 0);
      }
    });

    document.addEventListener('keydown', (e) => {
      const openId = PICKER_IDS.find((id) => {
        const m = document.getElementById(id);
        return m && !m.hidden;
      });

      if (e.key === 'Escape') {
        if (openId) {
          e.preventDefault();
          closePickers();
          return;
        }
        const fxEditor = document.getElementById('fxEditor');
        if (fxEditor && !fxEditor.hidden) {
          e.preventDefault();
          document.getElementById('fxEditorClose')?.click();
          return;
        }
        const fx = document.getElementById('fxPanel');
        if (fx && !fx.hidden) {
          e.preventDefault();
          closeFx();
          return;
        }
        closeAll();
        return;
      }

<<<<<<< HEAD
<<<<<<< HEAD
      if (!openId) return;
      const menu = document.getElementById(openId);
      if (!menu) return;
      const items = [...menu.querySelectorAll('[role="menuitem"], button.scale-menu-item')].filter(
        (el) => el.offsetParent !== null
      );
      if (!items.length) return;
=======
      if (!openId) {
        return;
      }
=======
      if (!openId) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      const menu = document.getElementById(openId);
      if (!menu) return;
      const items = [...menu.querySelectorAll('[role="menuitem"], button.scale-menu-item')].filter(
        (el) => el.offsetParent !== null
      );
<<<<<<< HEAD
      if (!items.length) {
        return;
      }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
      if (!items.length) return;
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
      const idx = items.indexOf(document.activeElement);

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = items[(idx + 1 + items.length) % items.length];
        next?.focus?.();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = items[(idx - 1 + items.length) % items.length];
        prev?.focus?.();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus?.();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus?.();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement && items.includes(document.activeElement)) {
          e.preventDefault();
          document.activeElement.click();
        }
      }
    });

    const fxOpen = document.getElementById('fxPanelOpen');
    const fxClose = document.getElementById('fxPanelClose');
    if (fxOpen && !fxOpen.dataset.overlayWired) {
      fxOpen.dataset.overlayWired = '1';
      fxOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFx();
      });
    }
    if (fxClose && !fxClose.dataset.overlayWired) {
      fxClose.dataset.overlayWired = '1';
      fxClose.addEventListener('click', () => {
        closeFx();
        document.getElementById('fxPanelOpen')?.focus?.();
      });
    }
  }

  function recoverChrome() {
    const anyPickerOpen = PICKER_IDS.some((id) => {
      const m = document.getElementById(id);
      return m && !m.hidden;
    });
    if (!anyPickerOpen) {
      const bd = document.getElementById('pickerBackdrop');
      if (bd && !bd.hidden) {
        bd.hidden = true;
        bd.setAttribute('hidden', '');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  setInterval(recoverChrome, 1500);
  document.addEventListener('visibilitychange', () => {
<<<<<<< HEAD
<<<<<<< HEAD
    if (!document.hidden) recoverChrome();
=======
    if (!document.hidden) {
      recoverChrome();
    }
>>>>>>> parent of 163cd411 (phase-2 build architecture: ES modules, Vite bundling, hashed assets, looper split)
=======
    if (!document.hidden) recoverChrome();
>>>>>>> parent of 217ab58e (phase-1 safety net: lint, format, CSP, debug guard, doc drift)
  });
})();
