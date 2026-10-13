/**
 * layout-boot.js — rearrange DOM to match the intended layout.
 * Order: topbar → music player → stage (instrument + scale + pan) → looper/clear above controls.
 */
(function layoutBoot() {
  // Ensure extra layout stylesheet is loaded
  if (!document.querySelector('link[data-ui-extras]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './ui-layout-extras.css?v=2';
    link.setAttribute('data-ui-extras', '1');
    document.head.appendChild(link);
  }

  function run() {
    const app = document.getElementById('app');
    if (!app) return;

    const topbar = app.querySelector('.topbar');
    const instMenu = document.getElementById('instrumentMenu');
    const backdrop = document.getElementById('backdropPlayer');
    const stage = app.querySelector('.stage');
    const looperRail = document.getElementById('looperRail');
    const looperClear = document.getElementById('looperClearBtn');
    const drawer = document.getElementById('mobileControlDrawer');
    const pan = document.getElementById('pan');

    if (backdrop && topbar) {
      const after = instMenu && instMenu.parentElement === app ? instMenu : topbar;
      if (backdrop.previousElementSibling !== after) {
        after.insertAdjacentElement('afterend', backdrop);
      }
    }

    if (stage && pan) {
      let bar = document.getElementById('stageScaleBar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'stage-scale-bar';
        bar.id = 'stageScaleBar';
        stage.insertBefore(bar, pan);
      } else if (bar.parentElement !== stage) {
        stage.insertBefore(bar, pan);
      }

      const instNav = document.getElementById('instrumentNav');
      const scaleLabel = document.getElementById('scaleLabel');
      const scaleMenu = document.getElementById('scaleMenu');
      const scaleBlock = document.querySelector('.control-scale');

      if (instNav) {
        instNav.classList.add('stage-instrument-nav');
        if (instNav.parentElement !== bar || bar.firstElementChild !== instNav) {
          bar.insertBefore(instNav, bar.firstChild);
        }
      }

      // Scale nav mirrors instrument-nav: ‹  Scale name ▾  ›
      let scaleNav = document.getElementById('stageScaleNav');
      const prev = document.getElementById('scalePrev');
      const next = document.getElementById('scaleNext');
      if (scaleLabel) {
        scaleLabel.classList.add('stage-scale-btn');
        if (!scaleNav) {
          scaleNav = document.createElement('div');
          scaleNav.id = 'stageScaleNav';
          scaleNav.className = 'stage-scale-nav';
          scaleNav.setAttribute('role', 'group');
          scaleNav.setAttribute('aria-label', 'Scale');
        }
        scaleNav.classList.add('stage-scale-nav');
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

      const noteWrap = document.getElementById('notePlusWrap');
      if (scaleNav || (noteWrap && scaleLabel)) {
        let row = document.getElementById('stageScaleRow');
        if (!row) {
          row = document.createElement('div');
          row.id = 'stageScaleRow';
          row.className = 'stage-scale-row';
        }
        if (row.parentElement !== bar) {
          if (instNav && instNav.parentElement === bar) {
            instNav.insertAdjacentElement('afterend', row);
          } else {
            bar.appendChild(row);
          }
        }
        if (noteWrap) {
          noteWrap.classList.add('stage-note-wrap');
          if (noteWrap.parentElement !== row) row.appendChild(noteWrap);
        }
        if (scaleNav && scaleNav.parentElement !== row) row.appendChild(scaleNav);
      }

      if (scaleMenu) {
        scaleMenu.classList.add('stage-scale-menu');
        if (scaleMenu.parentElement !== bar) bar.appendChild(scaleMenu);
      }
      if (scaleBlock) scaleBlock.hidden = true;
    }

    if (drawer && looperRail && looperRail.nextElementSibling !== drawer) {
      drawer.insertAdjacentElement('beforebegin', looperRail);
    }
    if (drawer && looperClear && looperClear.nextElementSibling !== drawer &&
        looperClear.previousElementSibling !== looperRail) {
      drawer.insertAdjacentElement('beforebegin', looperClear);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 0);
  setTimeout(run, 300);
  setTimeout(run, 1000);

  function ensureCreateUI() {
    const topActions = document.querySelector('.topbar .top-actions');
    if (topActions && !document.getElementById('createLaunch')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill create-launch';
      btn.id = 'createLaunch';
      btn.title = 'Build your own handpan';
      btn.textContent = 'create';
      topActions.prepend(btn);
    }
    if (!document.getElementById('createPage')) {
      const page = document.createElement('section');
      page.className = 'create-page';
      page.id = 'createPage';
      page.setAttribute('aria-hidden', 'true');
      page.setAttribute('aria-label', 'Create your handpan');
      page.innerHTML = '<div class="create-page-inner"><div class="create-page-kicker">Concept</div><h1>Build your own handpan</h1><p>A future workspace where you shape tonefields, pick scales, and design a handpan that feels like yours. This page is a placeholder for that studio.</p><button type="button" class="create-page-back" id="createPageBack">← Back to play</button></div>';
      document.body.appendChild(page);
    }
  }

  function wireCreate() {
    const page = document.getElementById('createPage');
    const openBtn = document.getElementById('createLaunch');
    const backBtn = document.getElementById('createPageBack');
    if (!page || !openBtn || openBtn.dataset.wired === '1') return;
    openBtn.dataset.wired = '1';
    const open = () => {
      page.classList.add('is-active');
      page.setAttribute('aria-hidden', 'false');
      document.body.classList.add('create-active');
      document.getElementById('app')?.classList.add('create-away');
    };
    const close = () => {
      page.classList.remove('is-active');
      page.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('create-active');
      document.getElementById('app')?.classList.remove('create-away');
    };
    openBtn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    backBtn?.addEventListener('click', close);
  }
  ensureCreateUI();
  wireCreate();
  setTimeout(() => { ensureCreateUI(); wireCreate(); }, 200);
  setTimeout(() => { ensureCreateUI(); wireCreate(); }, 600);

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
  positionEffectBubbles();
  setTimeout(positionEffectBubbles, 500);
  setTimeout(positionEffectBubbles, 1500);
})();
