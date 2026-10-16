/**
 * layout-boot.js — app chrome layout
 * Top: revealing FX/customization drawer, then looper
 * Bottom: instrument row + scale row
 * Center: handpan in the remaining play area
 */
(function layoutBoot() {
  // ui-layout-extras is linked from index.html (not injected).

  function purgeCreate() {
    document.getElementById('createPage')?.remove();
    document.getElementById('createLaunch')?.remove();
    document.body.classList.remove('create-active');
    document.getElementById('app')?.classList.remove('create-away');
  }

  /**
   * Place #pan in the open play area.
   * Top edge from the visible top dock (never the hidden Controls toggle).
   * Bottom edge of the pan sits ~12px above the bottom control bar.
   * Writes one CSS custom property for the available play height; sizing is CSS-driven.
   */
  /**
   * Pan placement via one CSS custom property (--pan-bottom-gap).
   * Geometry lives in pionier.css (flex/grid + dvh). No inline position on #pan.
   */
  function centerPan() {
    window.__pionierCenterPan = centerPan;
    const bar = document.getElementById('stageScaleBar');
    const dock = document.getElementById('pionierTopDock');
    const root = document.documentElement;
    let topH = 48;
    if (dock) {
      const r = dock.getBoundingClientRect();
      if (r.height > 1) topH = r.bottom;
    }
    let botH = 120;
    if (bar) {
      const r = bar.getBoundingClientRect();
      if (r.height > 1) botH = window.innerHeight - r.top;
    }
    root.style.setProperty('--chrome-top', Math.round(topH) + 'px');
    root.style.setProperty('--chrome-bottom', Math.round(botH) + 'px');
    root.style.setProperty('--pan-bottom-gap', '12px');
    root.style.setProperty('--viewport-h', window.innerHeight + 'px');
    // Clear legacy inline fixed positioning from older centerPan
    const pan = document.getElementById('pan');
    if (pan) {
      ['position','left','right','top','bottom','width','height','transform','max-width','max-height','margin','z-index'].forEach((prop) => {
        pan.style.removeProperty(prop);
      });
    }
  }


  function run() {
    purgeCreate();
    const app = document.getElementById('app');
    if (!app) return;

    const topbar = app.querySelector('.topbar');
    const stage = app.querySelector('.stage');
    const pan = document.getElementById('pan');
    const drawer = document.getElementById('mobileControlDrawer');
    const looperRail = document.getElementById('looperRail');
    const looperClear = document.getElementById('looperClearBtn');

    if (!stage || !pan) return;

    let bar = document.getElementById('stageScaleBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'stage-scale-bar';
      bar.id = 'stageScaleBar';
    }
    if (bar.parentElement !== app || app.firstElementChild !== bar) {
      if (topbar && topbar.parentElement === app) {
        topbar.insertAdjacentElement('afterend', bar);
      } else {
        app.insertBefore(bar, stage);
      }
    }

    // Remove abandoned top-chip row if present
    document.getElementById('topChipRow')?.remove();

    // Bottom bar: looper, then instrument + scale, then root/notes
    const instNav = document.getElementById('instrumentNav');
    if (instNav) {
      instNav.classList.add('stage-instrument-nav');
      if (bar && instNav.parentElement !== bar) bar.appendChild(instNav);
    }

    const scaleLabel = document.getElementById('scaleLabel');
    const scaleMenu = document.getElementById('scaleMenu');
    const prev = document.getElementById('scalePrev');
    const next = document.getElementById('scaleNext');
    const scaleBlock = document.querySelector('.control-scale');

    if (scaleLabel) scaleLabel.classList.add('stage-scale-btn');
    if (prev) {
      prev.hidden = false;
      prev.classList.add('icon-btn', 'stage-scale-step');
      prev.classList.remove('step');
    }
    if (next) {
      next.hidden = false;
      next.classList.add('icon-btn', 'stage-scale-step');
      next.classList.remove('step');
    }

    let scaleRow = document.getElementById('stageScaleRow');
    if (!scaleRow) {
      scaleRow = document.createElement('div');
      scaleRow.id = 'stageScaleRow';
      scaleRow.className = 'stage-scale-row';
    }
    if (bar && scaleRow.parentElement !== bar) bar.appendChild(scaleRow);
    if (scaleBlock) {
      scaleBlock.hidden = false;
      scaleBlock.classList.add('stage-control-scale');
      if (scaleBlock.parentElement !== scaleRow) scaleRow.appendChild(scaleBlock);
    }
    if (scaleMenu) scaleMenu.classList.add('stage-scale-menu');

    const rootRow = document.querySelector('.control-row') || document.querySelector('#mobileControlPanel .control-row');
    if (rootRow && bar) {
      rootRow.classList.add('stage-root-row');
      if (rootRow.parentElement !== bar) bar.appendChild(rootRow);
    }

    const noteWrap = document.getElementById('notePlusWrap');
    // Hide empty CONTROLS toggle when its useful controls live in the bottom bar
    {
      const panelEl = document.getElementById('mobileControlPanel');
      const toggleEl = document.getElementById('mobileControlsToggle');
      if (panelEl && toggleEl && !panelEl.querySelector('.knobs-panel, .effect-knob-wrap, .control-block')) {
        toggleEl.style.display = 'none';
      }
    }

    // note+/- and final ordering handled in ensureBottomBar()
    if (noteWrap) noteWrap.classList.add('stage-note-wrap');

    if (topbar) {
      topbar.classList.add('topbar-collapsed');
      topbar.setAttribute('aria-hidden', 'true');
    }

    let topDock = document.getElementById('pionierTopDock');
    if (!topDock) {
      topDock = document.createElement('section');
      topDock.id = 'pionierTopDock';
      topDock.className = 'pionier-top-dock';
      topDock.setAttribute('aria-label', 'Effects and looper');
      document.body.appendChild(topDock);
    }
    // Keep the fixed dock outside #app so transformed app/stage containers
    // cannot turn viewport positioning into bottom-relative positioning.
    if (topDock.parentElement !== document.body) document.body.appendChild(topDock);
    // Defeat legacy bottom-sheet inline positioning: the FX dock is always
    // pinned to the viewport top, regardless of open/closed drawer state.
    Object.assign(topDock.style, {
      position: 'fixed', top: 'max(4px, env(safe-area-inset-top, 0px))',
      right: '0', bottom: 'auto', left: '0', transform: 'none',
      zIndex: '4000', width: '100%', boxSizing: 'border-box'
    });
    // FX drawer stays in the top dock. Put the looper in the bottom control
    // bar, immediately above the instrument selector; never move it with FX.
    if (drawer && drawer.parentElement !== topDock) topDock.appendChild(drawer);
    if (drawer) {
      Object.assign(drawer.style, {
        position: 'relative', top: 'auto', right: 'auto', bottom: 'auto',
        left: 'auto', transform: 'none', width: '100%', margin: '0',
        zIndex: '4001'
      });
    }
    // The FX drawer belongs in the top dock. The looper belongs in the
    // bottom control stack, directly above the instrument selector.
    if (looperRail && bar) {
      // Always keep looper in the bottom bar
      if (looperRail.parentElement !== bar) {
        bar.insertBefore(looperRail, bar.firstChild);
      }
      Object.assign(looperRail.style, {
        position: 'relative', top: 'auto', right: 'auto', bottom: 'auto',
        left: 'auto', transform: 'none', width: 'auto', margin: '0',
        justifyContent: 'center', zIndex: 'auto'
      });
    }
    // Clear is part of the looper row, not an independently fixed viewport
    // element. This prevents its own late layout from creating a second jump.
    if (looperClear && looperRail && looperClear.parentElement !== looperRail) {
      looperRail.insertBefore(looperClear, looperRail.firstChild);
    }
    if (looperClear) {
      Object.assign(looperClear.style, {
        position: 'relative', top: 'auto', right: 'auto', bottom: 'auto',
        left: 'auto', transform: 'none', zIndex: 'auto',
        width: '34px', height: '34px', margin: '0', pointerEvents: 'auto'
      });
    }
    if (bar && (bar.parentElement !== app || bar.nextElementSibling !== null)) app.appendChild(bar);

    centerPan();
  }

  // Keep the FX dock anchored to the viewport even if legacy UI code tries to
  // restore the drawer's old bottom-sheet position or reparent it.
  function stabilizeFxDock() {
    const dock = document.getElementById('pionierTopDock');
    const drawer = document.getElementById('mobileControlDrawer');
    if (!dock) return;
    if (dock.parentElement !== document.body) document.body.appendChild(dock);
    if (drawer && drawer.parentElement !== dock) dock.appendChild(drawer);
    // Keep FX at the top, but dock the looper above the instrument selector.
    // This guard also corrects late mounts without relocating it to the viewport top.
    const rail = document.getElementById('looperRail');
    const clear = document.getElementById('looperClearBtn');
    const bar = document.getElementById('stageScaleBar');
    const instrumentNav = document.getElementById('instrumentNav');
    if (rail && bar) {
      if (rail.parentElement !== bar) bar.insertBefore(rail, bar.firstChild);
      rail.style.setProperty('position', 'relative', 'important');
      rail.style.setProperty('inset', 'auto', 'important');
      rail.style.setProperty('transform', 'none', 'important');
      rail.style.setProperty('width', 'auto', 'important');
      rail.style.setProperty('margin', '0', 'important');
      rail.style.setProperty('top', 'auto', 'important');
      rail.style.setProperty('right', 'auto', 'important');
      rail.style.setProperty('left', 'auto', 'important');
    }
    if (rail && clear && clear.parentElement !== rail) rail.insertBefore(clear, rail.firstChild);
    if (clear) {
      ['position','top','right','bottom','left','transform','z-index'].forEach((p) => clear.style.setProperty(p, p === 'position' ? 'relative' : (p === 'z-index' ? 'auto' : 'auto'), 'important'));
      clear.style.setProperty('width', '34px', 'important');
      clear.style.setProperty('height', '34px', 'important');
      clear.style.setProperty('min-width', '34px', 'important');
      clear.style.setProperty('min-height', '34px', 'important');
      clear.style.setProperty('flex', '0 0 34px', 'important');
      clear.style.setProperty('margin', '0', 'important');
    }
    ensureBottomBar();
    dock.style.setProperty('position', 'fixed', 'important');
    dock.style.setProperty('top', 'max(4px, env(safe-area-inset-top, 0px))', 'important');
    dock.style.setProperty('right', '0', 'important');
    dock.style.setProperty('bottom', 'auto', 'important');
    dock.style.setProperty('left', '0', 'important');
    dock.style.setProperty('transform', 'none', 'important');
    dock.style.setProperty('z-index', '4000', 'important');
    if (drawer) {
      drawer.style.setProperty('position', 'relative', 'important');
      drawer.style.setProperty('top', 'auto', 'important');
      drawer.style.setProperty('right', 'auto', 'important');
      drawer.style.setProperty('bottom', 'auto', 'important');
      drawer.style.setProperty('left', 'auto', 'important');
      drawer.style.setProperty('transform', 'none', 'important');
      drawer.style.setProperty('width', '100%', 'important');
    }
  }

  ensureFxOpenBtn();
  ensureSoundscapesTopBtn();
  ensureBottomBar();

  const fxDockObserver = new MutationObserver(() => {
    // Skip while a picker is open — reparenting fights the portal menu
    const scaleOpen = document.getElementById('scaleMenu') && !document.getElementById('scaleMenu').hidden;
    const instOpen = document.getElementById('instrumentMenu') && !document.getElementById('instrumentMenu').hidden;
    if (scaleOpen || instOpen) return;
    if (window.__fxDockGuardFrame) return;
    window.__fxDockGuardFrame = requestAnimationFrame(() => {
      window.__fxDockGuardFrame = 0;
      stabilizeFxDock();
    });
  });
  // Observe only the app shell, not every menu item mutation under body
  const appEl = document.getElementById('app') || document.body;
  fxDockObserver.observe(appEl, { childList: true, subtree: false });

  function positionEffectBubbles() {
    document.querySelectorAll('.knob-effect-trigger').forEach((btn) => {
      if (btn.dataset.bubbleWired === '1') return;
      btn.dataset.bubbleWired = '1';
      btn.addEventListener('click', () => {
        setTimeout(() => {
          const id = btn.getAttribute('aria-controls');
          const bubble = id ? document.getElementById(id) : null;
          if (!bubble || bubble.hasAttribute('hidden')) return;
          const r = btn.getBoundingClientRect();
          bubble.style.position = 'fixed';
          bubble.style.left = Math.round(r.left + r.width / 2) + 'px';
          bubble.style.top = Math.max(12, Math.round(r.top - 8)) + 'px';
          bubble.style.bottom = 'auto';
          bubble.style.transform = 'translate(-50%, -100%)';
          bubble.style.zIndex = '2500';
        }, 0);
      });
    });
  }

  // Picker/FX open-close owned by overlay-controller.js



  function ensureFxOpenBtn() {
    let btn = document.getElementById('fxPanelOpen');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'fxPanelOpen';
      btn.className = 'fx-panel-open';
      btn.setAttribute('aria-label', 'Effects');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'fxPanel');
      btn.textContent = 'FX';
      document.body.appendChild(btn);
    }
    btn.hidden = false;
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    return btn;
  }

  /** Move ♫ Soundscapes next to FX (top-right chrome), not inside instrument nav. */
  function ensureSoundscapesTopBtn() {
    const btn = document.getElementById('openSoundscapes');
    if (!btn) return null;
    btn.classList.add('soundscapes-top-btn');
    if (btn.parentElement !== document.body) document.body.appendChild(btn);
    btn.hidden = false;
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    return btn;
  }

  /**
   * Bottom stack (bottom → top of the bar = last → first in flex column):
   *   1. instrument row  — instrument selector (left/flex) + ± notes (right)
   *   2. scale row       — scale selector (left/flex) + base note (right)
   *   3. looper          — above both
   */
  function ensureBottomBar() {
    const bar = document.getElementById('stageScaleBar');
    const rail = document.getElementById('looperRail');
    const instNav = document.getElementById('instrumentNav');
    let scaleRow = document.getElementById('stageScaleRow');
    const rootRow = document.querySelector('.stage-root-row') || document.querySelector('#stageScaleBar .control-row') || document.querySelector('.control-row');
    if (!bar) return;
    document.getElementById('topChipRow')?.remove();
    // Retire the old combined select row
    document.getElementById('stageSelectRow')?.remove();

    // --- Scale row: scale block + base note on the right ---
    if (!scaleRow) {
      scaleRow = document.createElement('div');
      scaleRow.id = 'stageScaleRow';
      scaleRow.className = 'stage-scale-row';
    }
    scaleRow.classList.add('stage-scale-row');
    const scaleBlock = document.querySelector('.control-scale') || document.getElementById('stageScaleRow')?.querySelector('.control-scale');
    if (scaleBlock && scaleBlock.parentElement !== scaleRow) scaleRow.appendChild(scaleBlock);

    // Base note only (notes stepper moves with instrument row)
    let baseOnly = document.getElementById('stageBaseOnly');
    if (!baseOnly) {
      baseOnly = document.createElement('div');
      baseOnly.id = 'stageBaseOnly';
      baseOnly.className = 'stage-base-only';
    }
    if (rootRow) {
      rootRow.classList.add('stage-root-row');
      const halves = rootRow.querySelectorAll('.control-half');
      // First half is Base Note, second is Notes
      if (halves[0] && halves[0].parentElement !== baseOnly) {
        baseOnly.appendChild(halves[0]);
      }
      // Original row shell is empty after redistribute — drop it
      rootRow.remove();
    }
    if (baseOnly.parentElement !== scaleRow) scaleRow.appendChild(baseOnly);

    // --- Instrument row: instrument nav + ± notes on the right ---
    let instRow = document.getElementById('stageInstrumentRow');
    if (!instRow) {
      instRow = document.createElement('div');
      instRow.id = 'stageInstrumentRow';
      instRow.className = 'stage-instrument-row';
    }
    if (instNav && instNav.parentElement !== instRow) instRow.appendChild(instNav);

    // Notes stepper (from original control-row second half) or notePlusWrap
    let notesSlot = document.getElementById('stageNotesSlot');
    if (!notesSlot) {
      notesSlot = document.createElement('div');
      notesSlot.id = 'stageNotesSlot';
      notesSlot.className = 'stage-notes-slot';
    }
    if (rootRow) {
      const halves = rootRow.querySelectorAll('.control-half');
      // After moving base, remaining half is Notes
      const notesHalf = Array.from(rootRow.querySelectorAll('.control-half')).find((h) =>
        h.querySelector('#noteCountLabel, #noteCountPrev, #noteCountNext')
      ) || halves[1];
      if (notesHalf && notesHalf.parentElement !== notesSlot) notesSlot.appendChild(notesHalf);
    }
    const noteWrap = document.getElementById('notePlusWrap');
    if (noteWrap) {
      noteWrap.classList.add('stage-note-wrap');
      noteWrap.hidden = false;
      if (noteWrap.parentElement !== notesSlot) notesSlot.appendChild(noteWrap);
    }
    if (notesSlot.parentElement !== instRow) instRow.appendChild(notesSlot);

    // Order in bar: looper → scale row → instrument row (instrument is lowest)
    if (rail && rail.parentElement !== bar) bar.insertBefore(rail, bar.firstChild);
    if (scaleRow.parentElement !== bar) {
      if (rail && rail.parentElement === bar) rail.after(scaleRow);
      else bar.appendChild(scaleRow);
    }
    if (instRow.parentElement !== bar) bar.appendChild(instRow);

    // Enforce sibling order
    if (rail && rail.parentElement === bar && bar.firstChild !== rail) bar.insertBefore(rail, bar.firstChild);
    if (scaleRow.parentElement === bar && scaleRow.previousElementSibling !== rail) {
      if (rail) rail.after(scaleRow);
      else bar.insertBefore(scaleRow, bar.firstChild);
    }
    if (instRow.parentElement === bar && instRow.previousElementSibling !== scaleRow) {
      scaleRow.after(instRow);
    }

    if (rail) {
      ['position', 'top', 'right', 'bottom', 'left', 'transform'].forEach((prop) => {
        rail.style.setProperty(prop, prop === 'position' ? 'relative' : 'auto', 'important');
      });
      rail.style.setProperty('width', '100%', 'important');
    }
  }

  const boot = () => { run(); ensureFxOpenBtn(); ensureSoundscapesTopBtn(); ensureBottomBar(); positionEffectBubbles(); centerPan(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Run the full layout once only. Duplicate boot passes were reparenting
  // the same controls twice and causing visible startup jumps.
  setTimeout(positionEffectBubbles, 1500);
  setTimeout(centerPan, 100);
  setTimeout(centerPan, 400);
  setTimeout(centerPan, 1200);
  setTimeout(ensureBottomBar, 50);
  setTimeout(ensureBottomBar, 300);
  setTimeout(ensureBottomBar, 1000);
  setTimeout(ensureSoundscapesTopBtn, 80);
  setTimeout(ensureSoundscapesTopBtn, 400);
  window.addEventListener('resize', () => {
    clearTimeout(window.__panCenterT);
    window.__panCenterT = setTimeout(centerPan, 50);
  });
  window.addEventListener('orientationchange', () => setTimeout(centerPan, 200));
})();

/* Keep the published control layer aligned with the current rounded layout. */


  // Record button chrome (ring/core) — source of truth, not a patch file
  (function ensureLooperChrome() {
    function apply() {
      const btn = document.getElementById('looperBtn');
      if (!btn) return;
      if (!btn.querySelector('.looper-btn-core')) {
        btn.className = 'looper-btn looper-record';
        btn.innerHTML =
          '<span class="looper-btn-ring" aria-hidden="true"></span>' +
          '<span class="looper-btn-core" aria-hidden="true"></span>';
      }
      btn.style.setProperty('width', '52px', 'important');
      btn.style.setProperty('height', '52px', 'important');
      btn.style.setProperty('min-width', '52px', 'important');
      btn.style.setProperty('min-height', '52px', 'important');
      btn.style.setProperty('pointer-events', 'auto', 'important');
    }
    apply();
    setTimeout(apply, 200);
    setTimeout(apply, 1000);
  })();
