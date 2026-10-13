/**
 * layout-boot.js — rearrange DOM to match the intended layout.
 * Order: topbar → music player → stage (instrument + scale + pan) → looper/clear above controls.
 */
(function layoutBoot() {
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

    // 1) Music player under topbar
    if (backdrop && topbar) {
      const after = instMenu && instMenu.parentElement === app ? instMenu : topbar;
      if (backdrop.previousElementSibling !== after) {
        after.insertAdjacentElement('afterend', backdrop);
      }
    }

    // 2) Stage stack: instrument switch above scale selector, above handpan
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

      if (scaleLabel) {
        scaleLabel.classList.add('stage-scale-btn');
        const prev = document.getElementById('scalePrev');
        const next = document.getElementById('scaleNext');
        if (prev) prev.hidden = true;
        if (next) next.hidden = true;
        if (scaleLabel.parentElement !== bar || (instNav && scaleLabel.previousElementSibling !== instNav)) {
          if (instNav && instNav.parentElement === bar) {
            instNav.insertAdjacentElement('afterend', scaleLabel);
          } else {
            bar.appendChild(scaleLabel);
          }
        }
      }

      if (scaleMenu) {
        scaleMenu.classList.add('stage-scale-menu');
        if (scaleMenu.parentElement !== bar) {
          bar.appendChild(scaleMenu);
        }
      }

      if (scaleBlock) scaleBlock.hidden = true;
    }

    // 3) Looper + clear above controls drawer
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
})();
