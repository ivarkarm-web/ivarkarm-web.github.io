/**
 * overlay-controller.js — one open overlay at a time.
 * Owns: instrument menu, scale menu, FX panel, Settings sheet, Soundscapes.
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
    if (document.documentElement.classList.contains('theme-light') ||
        document.body.classList.contains('theme-light') ||
        document.documentElement.dataset.theme === 'light' ||
        document.body.dataset.theme === 'light' ||
        window.PionierSettings?.lightMode === true) return true;
    try {
      const raw = localStorage.getItem('pionier.settings.v2') || localStorage.getItem('pionier.settings.v1');
      if (raw && JSON.parse(raw).lightMode === true) return true;
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

  function closePickers() {
    let restoreToggleId = null;
    PICKER_IDS.forEach((id) => {
      const m = document.getElementById(id);
      if (!m) return;
      if (!m.hidden && TOGGLE_FOR[id]) restoreToggleId = TOGGLE_FOR[id];
      m.hidden = true;
      m.setAttribute('hidden', '');
      m.classList.remove('is-open', 'picker-sheet', 'picker-popover');
      clearInlineLayout(m);
      m.style.setProperty('display', 'none', 'important');
      const tid = TOGGLE_FOR[id];
      if (tid) document.getElementById(tid)?.setAttribute('aria-expanded', 'false');
    });
    const bd = document.getElementById('pickerBackdrop');
    if (bd) { bd.hidden = true; bd.setAttribute('hidden', ''); bd.style.removeProperty('display'); }
    if (pickerOutsideHandler) {
      document.removeEventListener('pointerdown', pickerOutsideHandler, true);
      pickerOutsideHandler = null;
    }
    if (restoreToggleId) {
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

  function closeSoundscapes() {
    const panel = document.getElementById('soundscapesPanel') || document.getElementById('soundscapesPage');
    if (panel) {
      panel.hidden = true;
      panel.classList.remove('is-active', 'is-open');
      panel.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('soundscapes-active');
    document.getElementById('app')?.classList.remove('soundscapes-away');
  }

  function closeAll(except) {
    if (except !== 'pickers') closePickers();
    if (except !== 'fx') closeFx();
    if (except !== 'settings') closeSettings();
    if (except !== 'soundscapes') closeSoundscapes();
  }

  /**
   * Android Chrome often fails to scroll flex children when max-height is
   * "inherit" and touch-action is unset. Give the results pane an explicit
   * pixel max-height and pan-y touch handling so lists scroll on Android.
   */
  function applyPickerScrollStyles(menu, maxHeightPx) {
    if (!menu) return;
    const results = menu.querySelector('.picker-results');
    if (!results) return;
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
    if (!menu || !toggle) return;
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    menu.style.removeProperty('display');
    const rect = toggle.getBoundingClientRect();
    const gap = 8;
    const vw = document.documentElement.clientWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
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
    if (!menu || menu.querySelector('.picker-results')) return;
    const close = menu.querySelector(':scope > .picker-close');
    const results = document.createElement('div');
    results.className = 'picker-results picker-results-generated';
    Array.from(menu.children).forEach((child) => {
      if (child === close) return;
      results.appendChild(child);
    });
    menu.appendChild(results);
  }

  function openPicker(menuId) {
    const menu = document.getElementById(menuId);
    const toggle = document.getElementById(TOGGLE_FOR[menuId]);
    if (!menu || !toggle) return;
    closeAll('pickers');
    closeFx();
    closeSettings();
    closeSoundscapes();
    PICKER_IDS.forEach((id) => {
      if (id === menuId) return;
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
      try { window.__pionierRenderInstrumentMenu(); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent('pionier:picker-open', { detail: { id: menuId } }));
    let closeButton = menu.querySelector(':scope > .picker-close');
    if (!closeButton) {
      closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'picker-close';
      closeButton.setAttribute('aria-label', 'Close selector');
      closeButton.textContent = '\u00d7';
      closeButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closePickers(); });
      menu.prepend(closeButton);
    }
    ensurePickerScrollRegion(menu);
    const bd = ensureBackdrop();
    bd.hidden = true;
    bd.setAttribute('hidden', '');
    if (pickerOutsideHandler) document.removeEventListener('pointerdown', pickerOutsideHandler, true);
    pickerOutsideHandler = (event) => {
      const target = event.target;
      if (target instanceof Node && (menu.contains(target) || toggle.contains(target))) return;
      closePickers();
    };
    document.addEventListener('pointerdown', pickerOutsideHandler, true);
    requestAnimationFrame(() => {
      const active = menu.querySelector('[role="menuitem"].is-active, [aria-current="true"]');
      const first = menu.querySelector('[role="menuitem"], button.scale-menu-item, button:not(.picker-close)');
      (active || first)?.focus?.({ preventScroll: true });
    });
  }

  function togglePicker(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
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
    if (!panel) return;
    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.style.removeProperty('display');
    document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-fx-open');
    try { window.PionierCore?.ensureAudio?.(); } catch (_) {}
    try { window.PionierCore?.paintFxKnobs?.(); } catch (_) {}
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
    closeSoundscapes,
    openPicker,
    togglePicker,
    openFx,
    toggleFx,
    ensureBackdrop,
  };

  function wire() {
    ensureBackdrop();

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

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
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
        const ss = document.getElementById('soundscapesPanel') || document.getElementById('soundscapesPage');
        if (ss && !ss.hidden && ss.classList.contains('is-active')) {
          e.preventDefault();
          closeSoundscapes();
          try { document.getElementById('openSoundscapes')?.focus?.(); } catch (_) {}
          return;
        }
        closeAll();
        return;
      }

      if (!openId) return;
      const menu = document.getElementById(openId);
      if (!menu) return;
      const items = [...menu.querySelectorAll('[role="menuitem"], button.scale-menu-item')].filter(
        (el) => el.offsetParent !== null
      );
      if (!items.length) return;
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
    const ss = document.getElementById('soundscapesPanel') || document.getElementById('soundscapesPage');
    const ssOpen = ss && !ss.hidden && (ss.classList.contains('is-active') || ss.classList.contains('is-open'));
    if (!ssOpen) {
      document.body.classList.remove('soundscapes-active');
      document.getElementById('app')?.classList.remove('soundscapes-away');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  setInterval(recoverChrome, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recoverChrome();
  });
})();
