/**
 * layout-boot.js — app chrome layout
 * Top bar: two stacked rows
 *   1) instrument selector
 *   2) scale selector + note count
 * Center: handpan
 * Bottom: looper above FX controls
 */
(function layoutBoot() {
  if (!document.querySelector('link[data-ui-extras]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './ui-layout-extras.css?v=11';
    link.setAttribute('data-ui-extras', '1');
    document.head.appendChild(link);
  } else {
    const link = document.querySelector('link[data-ui-extras]');
    if (link) link.href = './ui-layout-extras.css?v=11';
  }

  function purgeCreate() {
    document.getElementById('createPage')?.remove();
    document.getElementById('createLaunch')?.remove();
    document.body.classList.remove('create-active');
    document.getElementById('app')?.classList.remove('create-away');
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

    let scaleNav = document.getElementById('stageScaleNav');
    if (scaleLabel) {
      scaleLabel.classList.add('stage-scale-btn');
      if (!scaleNav) {
        scaleNav = document.createElement('div');
        scaleNav.id = 'stageScaleNav';
        scaleNav.className = 'stage-scale-nav';
        scaleNav.setAttribute('role', 'group');
        scaleNav.setAttribute('aria-label', 'Scale');
      }
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
      if (prev && prev.parentElement !== scaleNav) scaleNav.appendChild(prev);
      if (scaleLabel.parentElement !== scaleNav) scaleNav.appendChild(scaleLabel);
      if (next && next.parentElement !== scaleNav) scaleNav.appendChild(next);
    }

    let row = document.getElementById('stageScaleRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'stageScaleRow';
      row.className = 'stage-scale-row';
    }
    if (row.parentElement !== bar) bar.appendChild(row);

    const noteWrap = document.getElementById('notePlusWrap');

    if (scaleNav) {
      scaleNav.classList.add('stage-scale-nav');
      if (scaleNav.parentElement !== row || row.firstElementChild !== scaleNav) {
        row.insertBefore(scaleNav, row.firstChild);
      }
    }
    if (noteWrap) {
      noteWrap.classList.add('stage-note-wrap');
      if (noteWrap.parentElement !== row) {
        row.appendChild(noteWrap);
      } else if (scaleNav && noteWrap.previousElementSibling !== scaleNav) {
        row.appendChild(noteWrap);
      }
    }

    if (instNav && row && instNav.nextElementSibling !== row) {
      bar.appendChild(instNav);
      bar.appendChild(row);
    }

    if (scaleMenu) {
      scaleMenu.classList.add('stage-scale-menu');
      if (scaleMenu.parentElement !== bar) bar.appendChild(scaleMenu);
    }
    if (scaleBlock) scaleBlock.hidden = true;

    if (topbar) {
      topbar.classList.add('topbar-collapsed');
      topbar.setAttribute('aria-hidden', 'true');
    }

    if (drawer && looperRail && looperRail.nextElementSibling !== drawer) {
      drawer.insertAdjacentElement('beforebegin', looperRail);
    }
    if (drawer && looperClear && looperClear.nextElementSibling !== drawer &&
        looperClear.previousElementSibling !== looperRail) {
      drawer.insertAdjacentElement('beforebegin', looperClear);
    }
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

  const boot = () => { run(); positionEffectBubbles(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 0);
  setTimeout(boot, 300);
  setTimeout(boot, 1000);
  setTimeout(positionEffectBubbles, 1500);
})();
