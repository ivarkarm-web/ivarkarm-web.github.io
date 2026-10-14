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
    link.href = './ui-layout-extras.css?v=18';
    link.setAttribute('data-ui-extras', '1');
    document.head.appendChild(link);
  } else {
    const link = document.querySelector('link[data-ui-extras]');
    if (link) link.href = './ui-layout-extras.css?v=18';
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
    const stage = document.querySelector('.stage');
    if (!pan || !stage) return;

    const bar = document.getElementById('stageScaleBar');
    const topDock = document.getElementById('pionierTopDock');
    const stageRect = stage.getBoundingClientRect();
    const topEdge = topDock ? topDock.getBoundingClientRect().bottom : stageRect.top;
    const botEdge = bar ? bar.getBoundingClientRect().top - 8 : window.innerHeight - 24;

    const span = botEdge - topEdge;
    // 50% center + 5% of the open span downward
    const midY = topEdge + span * 0.55;
    const topInStage = midY - stageRect.top;

    pan.style.position = 'absolute';
    pan.style.left = '50%';
    pan.style.setProperty('top', topInStage + 'px', 'important');
    pan.style.transform = 'translate(-50%, -50%) translateZ(0)';
    pan.style.margin = '0';
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
      app.insertBefore(topDock, stage);
    }
    // Keep the entire reveal drawer intact: its FX knobs and the customization
    // gear/sheet must travel together rather than extracting the knobs from it.
    // Re-append on every boot, even when already docked: an earlier run may
    // have left the looper before the FX drawer in DOM order.
    if (drawer) topDock.appendChild(drawer);
    if (looperRail) topDock.appendChild(looperRail);
    if (looperClear && looperRail && looperClear.parentElement !== looperRail) looperRail.appendChild(looperClear);
    if (bar && (bar.parentElement !== app || bar.nextElementSibling !== null)) app.appendChild(bar);

    centerPan();
  }

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
  setTimeout(boot, 0);
  setTimeout(boot, 300);
  setTimeout(boot, 1000);
  setTimeout(positionEffectBubbles, 1500);
  setTimeout(centerPan, 100);
  setTimeout(centerPan, 400);
  setTimeout(centerPan, 1200);
  const drawerObserver = new MutationObserver(() => requestAnimationFrame(centerPan));
  const observeDrawer = () => {
    const drawer = document.getElementById('mobileControlDrawer');
    if (drawer && !drawer.dataset.panObserved) {
      drawer.dataset.panObserved = '1';
      drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class'] });
    }
  };
  observeDrawer();
  setTimeout(observeDrawer, 250);
  setTimeout(observeDrawer, 900);

  window.addEventListener('resize', () => {
    clearTimeout(window.__panCenterT);
    window.__panCenterT = setTimeout(centerPan, 50);
  });
  window.addEventListener('orientationchange', () => setTimeout(centerPan, 200));
})();
