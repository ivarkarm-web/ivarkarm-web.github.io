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

  function ensureBackdrop() { return document.getElementById('pickerBackdrop'); }
  function closePickers() { /* Native select popups are controlled by the browser. */ }
  function openPicker() { /* Intentionally unused: selectors are native HTML selects. */ }
  function togglePicker() { /* Intentionally unused: selectors are native HTML selects. */ }

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

  // Match the looper timing bubble: fixed-width, centred on its trigger and opening
  // upward, with the list itself scrolling inside a stable panel.
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
    // Native select elements require no overlay wiring.\n\n    document.addEventListener('keydown', (e) => {
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
