/**
 * overlay-controller.js — one open overlay at a time.
 * Owns: instrument menu, scale menu, FX panel, Settings sheet, Soundscapes.
 * Mechanism: [hidden] + optional .is-open class; clears inline layout styles on close.
 */
(function overlayController() {
  const PICKER_IDS = ['instrumentMenu', 'scaleMenu'];
  const TOGGLE_FOR = {
    instrumentMenu: 'instrumentDropdownToggle',
    scaleMenu: 'scaleLabel',
  };
  const TOGGLES_FOR = {
    instrumentMenu: ['instrumentDropdownToggle'],
    scaleMenu: ['scaleLabel', 'scaleLabelDesktop'],
  };
  function setPickerExpanded(menuId, expanded) {
    (TOGGLES_FOR[menuId] || [TOGGLE_FOR[menuId]]).forEach((id) => {
      if (id) document.getElementById(id)?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

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
      setPickerExpanded(id, false);
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

    // Prefer bottom sheet on phones, tablets in portrait, touch devices, or short viewports.
    // Previous 700px breakpoint left many real phones (and 750px emulators) on the broken popover path.
    const isPhone =
      window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerHeight < 720;

    menu.classList.remove('picker-sheet', 'picker-popover');
    menu.classList.add(isPhone ? 'picker-sheet' : 'picker-popover');
    menu.classList.add('is-open');
    menu.hidden = false;
    menu.removeAttribute('hidden');

    // Solid portal styles so the menu never inherits a transparent/zero-opacity state.
    // Clear any display:none !important left by closePickers.
    menu.style.removeProperty('display');
    menu.style.setProperty('display', 'block', 'important');
    menu.style.position = 'fixed';
    menu.style.zIndex = '5200';
    menu.style.visibility = 'visible';
    menu.style.opacity = '1';
    menu.style.pointerEvents = 'auto';
    const lightTheme = isLightTheme();
    const pickerSurface = lightTheme ? '#faf8f4' : 'rgba(12, 12, 14, 0.98)';
    const pickerText = lightTheme ? '#24221e' : '#e6e0d2';
    menu.style.setProperty('background', pickerSurface, 'important');
    menu.style.setProperty('background-color', pickerSurface, 'important');
    menu.style.setProperty('background-image', 'none', 'important');
    menu.style.setProperty('color', pickerText, 'important');
    menu.style.setProperty('border-color', lightTheme ? 'rgba(52,44,28,0.14)' : 'rgba(230,224,210,0.18)', 'important');
    menu.style.setProperty('box-shadow', lightTheme
      ? '0 16px 42px rgba(43,35,20,0.16)'
      : '0 20px 60px rgba(0,0,0,0.55)', 'important');
    // Picker options can carry their own legacy dark inline styles; normalize every
    // visible option whenever the portal opens, not just the menu container.
    if (lightTheme) {
      menu.querySelectorAll('button, [role="menuitem"], [role="option"]').forEach((item) => {
        item.style.setProperty('color', '#302d27', 'important');
        item.style.setProperty('background-color', 'transparent', 'important');
        item.style.setProperty('background-image', 'none', 'important');
        item.style.setProperty('border-color', 'transparent', 'important');
        item.style.setProperty('box-shadow', 'none', 'important');
      });
    }
    menu.style.overflowY = 'auto';
    menu.style.webkitOverflowScrolling = 'touch';

    if (isPhone) {
      menu.style.left = '0';
      menu.style.right = '0';
      menu.style.bottom = '0';
      menu.style.top = 'auto';
      menu.style.width = '100%';
      menu.style.maxWidth = '100%';
      menu.style.maxHeight = 'min(55dvh, 420px)';
      menu.style.borderRadius = '16px 16px 0 0';
      menu.style.transform = 'none';
    } else if (menu.id === 'scaleMenu') {
      // The landscape reference uses a wide scale browser while keeping the
      // left tuning sidebar visible. Do not constrain this menu to a 320px popover.
      menu.style.left = '20vw';
      menu.style.right = '12px';
      menu.style.width = 'auto';
      menu.style.maxWidth = 'none';
      menu.style.top = '100px';
      menu.style.bottom = '90px';
      menu.style.maxHeight = 'none';
      menu.style.height = 'auto';
      menu.style.transform = 'none';
      menu.style.borderRadius = '20px';
    } else {
      const r = toggle.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
      // Open upward above the toggle (bottom bar lives at the viewport bottom).
      const spaceAbove = Math.max(120, r.top - 16);
      menu.style.left = left + 'px';
      menu.style.right = 'auto';
      menu.style.width = width + 'px';
      menu.style.maxWidth = width + 'px';
      menu.style.top = 'auto';
      menu.style.bottom = Math.max(12, window.innerHeight - r.top + 8) + 'px';
      menu.style.maxHeight = Math.min(360, spaceAbove) + 'px';
      menu.style.transform = 'none';
      menu.style.borderRadius = '12px';
    }
  }

  function openPicker(menuId, preferredToggle = null) {
    const menu = document.getElementById(menuId);
    const toggle = preferredToggle || document.getElementById(TOGGLE_FOR[menuId]);
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
        setPickerExpanded(id, false);
      }
    });
    placePicker(menu, toggle);
    setPickerExpanded(menuId, true);
    // Ensure instrument list is fresh when opening
    if (menuId === 'instrumentMenu' && typeof window.__pionierRenderInstrumentMenu === 'function') {
      try { window.__pionierRenderInstrumentMenu(); } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent('pionier:picker-open', { detail: { id: menuId } }));
    const bd = ensureBackdrop();
    bd.hidden = false;
    bd.removeAttribute('hidden');
    // Focus active item if present, else first menuitem
    requestAnimationFrame(() => {
      const active = menu.querySelector('[role="menuitem"].is-active, [aria-current="true"]');
      const first = menu.querySelector('[role="menuitem"], button.scale-menu-item, button');
      (active || first)?.focus?.();
    });
  }

  function togglePicker(menuId, preferredToggle = null) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    if (!menu.hidden && menu.classList.contains('is-open')) {
      closePickers();
      (preferredToggle || document.getElementById(TOGGLE_FOR[menuId]))?.focus?.();
    } else {
      openPicker(menuId, preferredToggle);
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
    for (const toggleId of ['scaleLabel', 'scaleLabelDesktop']) {
      document.getElementById(toggleId)?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePicker('scaleMenu', e.currentTarget);
      }, true); // capture so we win over other handlers
    }

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
    document.querySelectorAll('.fx-circle-knob[data-fx]').forEach((button) => {
      if (button.dataset.overlayWired) return;
      button.dataset.overlayWired = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const panel = document.getElementById('fxPanel');
        if (!panel) return;
        const fx = button.dataset.fx || 'filter';
        const active = panel.dataset.activeFx || 'filter';
        if (!panel.hidden && active === fx) {
          closeFx();
          return;
        }
        if (panel.hidden) openFx();
        panel.dataset.activeFx = fx;
        const title = document.getElementById('fxPanelTitle');
        if (title) title.textContent = ({ filter: 'Filter', delay: 'Delay', reverb: 'Reverb', env: 'Envelope' })[fx] || 'Effects';
        document.querySelectorAll('.fx-circle-knob[data-fx]').forEach((item) => {
          item.classList.toggle('is-active', item === button);
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
      });
    });
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
