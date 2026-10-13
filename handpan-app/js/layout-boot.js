/**
 * layout-boot.js — rearrange DOM to match the intended layout without a full HTML rewrite.
 * Order: topbar → music player → stage (scale + pan) → looper/clear above controls.
 */
(function layoutBoot() {
  function run() {
    const app = document.getElementById('app');
    if (!app || app.dataset.layoutBoot === '1') return;
    app.dataset.layoutBoot = '1';

    const topbar = app.querySelector('.topbar');
    const instMenu = document.getElementById('instrumentMenu');
    const backdrop = document.getElementById('backdropPlayer');
    const stage = app.querySelector('.stage');
    const looperRail = document.getElementById('looperRail');
    const looperClear = document.getElementById('looperClearBtn');
    const drawer = document.getElementById('mobileControlDrawer');
    const pan = document.getElementById('pan');

    // 1) Move music player under topbar
    if (backdrop && topbar) {
      const after = instMenu && instMenu.parentElement === app ? instMenu : topbar;
      after.insertAdjacentElement('afterend', backdrop);
    }

    // 2) Scale chooser above handpan
    if (stage && pan) {
      let bar = document.getElementById('stageScaleBar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'stage-scale-bar';
        bar.id = 'stageScaleBar';
        stage.insertBefore(bar, pan);
      }
      const scaleBlock = document.querySelector('.control-scale');
      const scaleLabel = document.getElementById('scaleLabel');
      const scaleMenu = document.getElementById('scaleMenu');
      if (scaleLabel && scaleLabel.parentElement !== bar) {
        scaleLabel.classList.add('stage-scale-btn');
        const prev = document.getElementById('scalePrev');
        const next = document.getElementById('scaleNext');
        if (prev) prev.hidden = true;
        if (next) next.hidden = true;
        bar.appendChild(scaleLabel);
      }
      if (scaleMenu && scaleMenu.parentElement !== bar) {
        scaleMenu.classList.add('stage-scale-menu');
        bar.appendChild(scaleMenu);
      }
      if (scaleBlock) scaleBlock.hidden = true;
    }

    // 3) Looper + clear above Controls drawer
    if (drawer && looperRail) drawer.insertAdjacentElement('beforebegin', looperRail);
    if (drawer && looperClear) drawer.insertAdjacentElement('beforebegin', looperClear);
  }

  function patchCore() {
    const core = window.PionierCore;
    if (!core || core.__scalePatched) return;
    if (typeof core.setScaleIndex === 'function') {
      core.__scalePatched = true;
      return;
    }
    if (!core.handpan) return;
    core.setScaleIndex = function (i) {
      core.handpan.setScaleIndex(i);
      try {
        core.handpan.rebuildNotes?.();
        const scaleEl = document.getElementById('scaleLabel');
        const rootEl = document.getElementById('rootLabel');
        const octEl = document.getElementById('octLabel');
        if (scaleEl && core.handpan.scaleLabel) {
          scaleEl.textContent = core.handpan.scaleLabel.replace(/\s*▾\s*$/, '') + ' ▾';
        }
        if (rootEl && core.handpan.rootLabel) rootEl.textContent = core.handpan.rootLabel;
        if (octEl) {
          const o = core.handpan.octaveOffset ?? 0;
          octEl.textContent = o === 0 ? '0' : o > 0 ? '+' + o : String(o);
        }
        core.draw?.();
        try { window.dispatchEvent(new Event('resize')); } catch (_) {}
      } catch (err) {
        console.warn('[layout-boot] setScaleIndex patch', err);
      }
    };
    core.__scalePatched = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 0);
  setTimeout(run, 300);
  setTimeout(patchCore, 200);
  setTimeout(patchCore, 800);
})();
