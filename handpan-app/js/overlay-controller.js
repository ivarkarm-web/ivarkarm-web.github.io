/**
 * overlay-controller.js — one open overlay at a time.
 * Owns: instrument menu, scale menu, FX panel, Settings sheet, Soundscapes.
 * Instrument and scale share one animated glass scroll-menu shell.
 */
(function overlayController() {
  const PICKER_IDS = ['instrumentMenu', 'scaleMenu'];
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
    PICKER_IDS.forEach((id) => {
      const m = document.getElementById(id);
      if (!m) return;
      m.hidden = true;
      m.setAttribute('hidden', '');
      m.classList.remove('is-open', 'picker-sheet', 'picker-popover');
      clearInlineLayout(m);
      // Force closed even if a prior open left display:block inline
      m.style.setProperty('display', 'none', 'important');
      const tid = TOGGLE_FOR[id];
      if (tid) document.getElementById(tid)?.setAttribute('aria-expanded', 'false');
    });
    const bd = document.getElementById('pickerBackdrop');
    if (bd) {
      bd.hidden = true;
      bd.setAttribute('hidden', '');
      bd.style.removeProperty('display');
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

  function placePicker(menu, toggle) {
    if (!menu || !toggle) return;
    if (menu.parentElement !== document.body) document.body.appendChild(menu);

    // Instrument and scale lists are deliberately immersive: the same glass,
    // spring-in feel as the FX preset dropdown, but with room to browse the full library.
    menu.classList.remove('picker-popover');
    menu.classList.add('picker-sheet', 'is-open');
    menu.hidden = false;
    menu.removeAttribute('hidden');
    menu.style.removeProperty('display');
    menu.style.setProperty('display', 'flex', 'important');
    menu.style.position = 'fixed';
    menu.style.zIndex = '5200';
    menu.style.visibility = 'visible';
    menu.style.opacity = '1';
    menu.style.pointerEvents = 'auto';
    menu.style.left = 'max(8px, env(safe-area-inset-left))';
    menu.style.right = 'max(8px, env(safe-area-inset-right))';
    menu.style.top = 'max(10px, env(safe-area-inset-top))';
    menu.style.bottom = 'max(10px, env(safe-area-inset-bottom))';
    menu.style.width = 'auto';
    menu.style.maxWidth = 'none';
    menu.style.maxHeight = 'none';
    menu.style.transform = 'none';
    menu.style.borderRadius = '20px';
    menu.style.overflow = 'hidden';
    menu.style.flexDirection = 'column';
    menu.style.background = isLightTheme() ? 'rgba(250,248,244,.97)' : 'rgba(16,16,19,.94)';
    menu.style.backgroundColor = isLightTheme() ? 'rgba(250,248,244,.97)' : 'rgba(16,16,19,.94)';
    menu.style.color = isLightTheme() ? '#24221e' : '#e6e0d2';
    menu.style.borderColor = isLightTheme() ? 'rgba(52,44,28,.16)' : 'rgba(226,195,117,.24)';
    menu.style.boxShadow = '0 24px 80px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.04)';
    menu.style.webkitOverflowScrolling = 'touch';
    menu.style.overscrollBehavior = 'contain';

    // One universal scroll region; no legacy search input or competing scroll container.
    const results = menu.querySelector('.picker-results');
    if (results) {
      results.style.flex = '1 1 auto';
      results.style.minHeight = '0';
      results.style.overflowY = 'auto';
      results.style.overscrollBehavior = 'contain';
      results.style.webkitOverflowScrolling = 'touch';
    }
  }

  function ensurePickerScrollRegion(menu) {
    if (!menu || menu.querySelector('.picker-results')) return;
    const search = menu.querySelector(':scope > .picker-search');
    const close = menu.querySelector(':scope > .picker-close');
    const results = document.createElement('div');
    results.className = 'picker-results picker-results-generated';
    Array.from(menu.children).forEach((child) => {
      if (child === search || child === close) return;
      results.appendChild(child);
    });
    menu.appendChild(results);
  }

  function openPicker(menuId) {
    const menu = document.getElementById(menuId);
    const toggle = document.getElementById(TOGGLE_FOR[menuId]);
    if (!menu || !toggle) return;
    closeAll('pickers');
    // Close other pickers only was wrong — close everything else first
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
    // Ensure instrument list is fresh when opening
    if (menuId === 'instrumentMenu' && typeof window.__pionierRenderInstrumentMenu === 'function') {
      try { window.__pionierRenderInstrumentMenu(); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent('pionier:picker-open', { detail: { id: menuId } }));
    // Use a compact close affordance in the same animated glass menu, rather than
    // forcing people to tap the dimmed backdrop to dismiss a long picker.
    let closeButton = menu.querySelector(':scope > .picker-close');
    if (!closeButton) {
      closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'picker-close';
      closeButton.setAttribute('aria-label', 'Close selector');
      closeButton.textContent = '×';
      closeButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closePickers(); });
      menu.prepend(closeButton);
    }
    ensurePickerScrollRegion(menu);
    const bd = ensureBackdrop();
    bd.hidden = false;
    bd.removeAttribute('hidden');
    // Focus active item if present, else first menuitem
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
    // Ensure audio graph + knobs exist, then repaint canvases
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

  // Public API
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
      // Render items if core already loaded
      if (typeof window.PionierCore?.draw === 'function') {
        /* core may refresh labels */
      }
      togglePicker('instrumentMenu');
    }, true);
    document.getElementById('scaleLabel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePicker('scaleMenu');
    }, true); // capture so we win over other handlers

    // Close pickers when an item is chosen (event delegation)
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('#instrumentMenu [role="menuitem"], #instrumentMenu button')) {
        // Let the item handler run first
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
          document.getElementById(TOGGLE_FOR[openId])?.focus?.();
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

    // FX open/close — single owner
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
    // Never leave the main app translated away without soundscapes open
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
  // Safety net for stuck backdrop / translated app after rapid switches
  setInterval(recoverChrome, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recoverChrome();
  });
})();
