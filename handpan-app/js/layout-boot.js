/**
 * layout-boot.js — app chrome layout
 * Top: revealing FX/customization drawer, then looper
 * Bottom: instrument row + scale row
 * Center: handpan in the remaining play area
 */
(function layoutBoot() {
  if (!document.querySelector('link[data-ui-extras]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './ui-layout-extras.css?v=37';
    link.setAttribute('data-ui-extras', '1');
    document.head.appendChild(link);
  } else {
    const link = document.querySelector('link[data-ui-extras]');
    if (link) link.href = './ui-layout-extras.css?v=37';
  }

  function purgeCreate() {
    document.getElementById('createPage')?.remove();
    document.getElementById('createLaunch')?.remove();
    document.body.classList.remove('create-active');
    document.getElementById('app')?.classList.remove('create-away');
  }

  /** Place #pan in the open play area (midpoint + 5% down). */
  function centerPan() {
    const pan = document.getElementById('pan');
    if (!pan) return;

    // Viewport-safe play area between top chrome and bottom scale bar.
    const bar = document.getElementById('stageScaleBar');
    const topDock = document.getElementById('pionierTopDock');
    const drawer = document.getElementById('mobileControlDrawer');
    const toggle = drawer && drawer.querySelector('.mobile-controls-toggle');
    const topEdge = toggle
      ? toggle.getBoundingClientRect().bottom
      : (topDock ? topDock.getBoundingClientRect().bottom : 48);
    const botEdge = bar
      ? bar.getBoundingClientRect().top
      : (window.innerHeight - 24);
    const safeTop = Math.max(topEdge + 8, 8);
    const safeBot = Math.max(safeTop + 120, botEdge - 8);
    const availH = Math.max(120, safeBot - safeTop);
    const availW = Math.max(120, window.innerWidth - 24);
    const size = Math.min(availW, availH, 680);
    const midY = safeTop + availH * 0.5;

    // Fixed to the viewport so transformed ancestors cannot offset the pan.
    pan.style.setProperty('position', 'fixed', 'important');
    pan.style.setProperty('left', '50%', 'important');
    pan.style.setProperty('top', midY + 'px', 'important');
    pan.style.setProperty('right', 'auto', 'important');
    pan.style.setProperty('bottom', 'auto', 'important');
    pan.style.setProperty('width', size + 'px', 'important');
    pan.style.setProperty('height', size + 'px', 'important');
    pan.style.setProperty('max-width', 'min(92vw, 680px)', 'important');
    pan.style.setProperty('max-height', 'min(70dvh, 680px)', 'important');
    pan.style.setProperty('transform', 'translate(-50%, -50%) translateZ(0)', 'important');
    pan.style.setProperty('margin', '0', 'important');
    pan.style.setProperty('z-index', '2', 'important');
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

    const instNav = document.getElementById('instrumentNav');
    if (instNav) {
      instNav.classList.add('stage-instrument-nav');
      if (instNav.parentElement !== bar) {
        bar.insertBefore(instNav, bar.firstChild);
      }
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

    let row = document.getElementById('stageScaleRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'stageScaleRow';
      row.className = 'stage-scale-row';
    }
    if (row.parentElement !== bar) bar.appendChild(row);

    const noteWrap = document.getElementById('notePlusWrap');

    // Keep the complete scale control (including its menu) together. The picker
    // relies on its original .control-scale ancestry for open/close behavior.
    if (scaleBlock) {
      scaleBlock.hidden = false;
      scaleBlock.classList.add('stage-control-scale');
      if (scaleBlock.parentElement !== row) row.insertBefore(scaleBlock, row.firstChild);
    }
    if (scaleMenu) scaleMenu.classList.add('stage-scale-menu');
    // Root + note count: one tap away in the bottom bar (not buried in drawer)
    const rootRow = document.querySelector('#mobileControlPanel .control-row');
    if (rootRow && bar) {
      rootRow.classList.add('stage-root-row');
      if (rootRow.parentElement !== bar) bar.appendChild(rootRow);
    }
    // Hide empty CONTROLS toggle when its useful controls live in the bottom bar
    {
      const panelEl = document.getElementById('mobileControlPanel');
      const toggleEl = document.getElementById('mobileControlsToggle');
      if (panelEl && toggleEl && !panelEl.querySelector('.knobs-panel, .effect-knob-wrap, .control-block')) {
        toggleEl.style.display = 'none';
      }
    }

    if (noteWrap) {
      noteWrap.classList.add('stage-note-wrap');
      if (noteWrap.parentElement !== row) row.appendChild(noteWrap);
      else if (scaleBlock && noteWrap.previousElementSibling !== scaleBlock) row.appendChild(noteWrap);
    }

    if (instNav && row && instNav.nextElementSibling !== row) {
      bar.appendChild(instNav);
      bar.appendChild(row);
    }

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
    if (looperRail && looperRail.parentElement !== bar) {
      bar.insertBefore(looperRail, instNav && instNav.parentElement === bar ? instNav : bar.firstChild);
    }
    if (looperRail) {
      Object.assign(looperRail.style, {
        position: 'relative', top: 'auto', right: 'auto', bottom: 'auto',
        left: 'auto', transform: 'none', width: '100%', margin: '0',
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
    if (rail && bar && rail.parentElement !== bar) {
      bar.insertBefore(rail, instrumentNav && instrumentNav.parentElement === bar ? instrumentNav : bar.firstChild);
    }
    if (rail) {
      rail.style.setProperty('position', 'relative', 'important');
      rail.style.setProperty('inset', 'auto', 'important');
      rail.style.setProperty('transform', 'none', 'important');
      rail.style.setProperty('width', '100%', 'important');
      rail.style.setProperty('margin', '0', 'important');
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

  const fxDockObserver = new MutationObserver(() => {
    if (window.__fxDockGuardFrame) return;
    window.__fxDockGuardFrame = requestAnimationFrame(() => {
      window.__fxDockGuardFrame = 0;
      stabilizeFxDock();
    });
  });
  fxDockObserver.observe(document.body, { childList: true, subtree: true });

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

  function positionPickerMenus() {
    const instrumentToggle = document.getElementById('instrumentDropdownToggle');
    const instrumentMenu = document.getElementById('instrumentMenu');
    if (instrumentToggle && instrumentMenu && !instrumentMenu.hidden) {
      const r = instrumentToggle.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const openUp = below < 180 && above > below;
      instrumentMenu.style.setProperty('position', 'fixed', 'important');
      instrumentMenu.style.setProperty('left', left + 'px', 'important');
      instrumentMenu.style.setProperty('right', 'auto', 'important');
      instrumentMenu.style.setProperty('width', width + 'px', 'important');
      instrumentMenu.style.setProperty('top', openUp ? 'auto' : (r.bottom + 6) + 'px', 'important');
      instrumentMenu.style.setProperty('bottom', openUp ? (window.innerHeight - r.top + 6) + 'px' : 'auto', 'important');
      instrumentMenu.style.setProperty('max-height', Math.max(120, Math.min(430, openUp ? above : below)) + 'px', 'important');
      instrumentMenu.style.setProperty('z-index', '3201', 'important');
      instrumentMenu.style.setProperty('visibility', 'visible', 'important');
    }
    const scaleToggle = document.getElementById('scaleLabel');
    const scaleMenu = document.getElementById('scaleMenu');
    if (scaleToggle && scaleMenu && !scaleMenu.hidden) {
      const r = scaleToggle.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
      const above = r.top - 12;
      scaleMenu.style.setProperty('position', 'fixed', 'important');
      scaleMenu.style.setProperty('left', left + 'px', 'important');
      scaleMenu.style.setProperty('right', 'auto', 'important');
      scaleMenu.style.setProperty('width', width + 'px', 'important');
      scaleMenu.style.setProperty('top', 'auto', 'important');
      scaleMenu.style.setProperty('bottom', Math.max(12, window.innerHeight - r.top + 6) + 'px', 'important');
      scaleMenu.style.setProperty('max-height', Math.max(120, Math.min(360, above)) + 'px', 'important');
      scaleMenu.style.setProperty('z-index', '3201', 'important');
      scaleMenu.style.setProperty('visibility', 'visible', 'important');
    }
  }

  const boot = () => { run(); positionEffectBubbles(); positionPickerMenus(); };
  const pickerObserver = new MutationObserver(() => requestAnimationFrame(positionPickerMenus));
  const observePickerMenus = () => {
    ['instrumentMenu', 'scaleMenu'].forEach((id) => {
      const menu = document.getElementById(id);
      if (menu && menu.dataset.positionObserved !== '1') {
        menu.dataset.positionObserved = '1';
        pickerObserver.observe(menu, { attributes: true, attributeFilter: ['hidden', 'class'] });
      }
    });
  };
  observePickerMenus();
  setTimeout(observePickerMenus, 250);
  setTimeout(observePickerMenus, 900);
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
  window.addEventListener('resize', () => {
    clearTimeout(window.__panCenterT);
    window.__panCenterT = setTimeout(centerPan, 50);
  });
  window.addEventListener('orientationchange', () => setTimeout(centerPan, 200));
})();

/* Keep the published control layer aligned with the current rounded layout. */


  // FX panel + settings gear placement
  (function wireFxPanel() {
    let openBtn = document.getElementById('fxPanelOpen');
    if (!openBtn) {
      openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.id = 'fxPanelOpen';
      openBtn.className = 'fx-panel-open';
      openBtn.setAttribute('aria-label', 'Open effects');
      openBtn.setAttribute('aria-controls', 'fxPanel');
      openBtn.textContent = 'FX';
      document.body.appendChild(openBtn);
    }
    const panel = document.getElementById('fxPanel');
    const closeBtn = document.getElementById('fxPanelClose');
    function setOpen(open) {
      if (!panel) return;
      panel.hidden = !open;
      openBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('fx-panel-open', open);
    }
    openBtn.addEventListener('click', () => setOpen(panel?.hidden !== false));
    closeBtn?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel && !panel.hidden) setOpen(false);
    });
  })();
