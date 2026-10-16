/**
 * exclusivity-fix.js — FX panel and settings sheet never stack
 * + ensure looper record button has ring/core chrome at 52px
 */
(function exclusivityFix() {
  function closeFx() {
    const fx = document.getElementById('fxPanel');
    if (fx && !fx.hidden) {
      fx.hidden = true;
      document.getElementById('fxPanelOpen')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('fx-panel-open');
    }
  }
  function closeSettings() {
    const sheet = document.getElementById('settingsSheet');
    const backdrop = document.getElementById('settingsSheetBackdrop');
    if (sheet) {
      sheet.classList.remove('is-open');
      sheet.hidden = true;
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.hidden = true;
    }
    document.getElementById('settingsOpenBtn')?.setAttribute('aria-expanded', 'false');
  }

  function wire() {
    const fxOpen = document.getElementById('fxPanelOpen');
    if (fxOpen && !fxOpen.dataset.exclWired) {
      fxOpen.dataset.exclWired = '1';
      fxOpen.addEventListener('click', () => {
        requestAnimationFrame(() => {
          const fx = document.getElementById('fxPanel');
          if (fx && !fx.hidden) closeSettings();
        });
      }, true);
    }

    const setOpen = document.getElementById('settingsOpenBtn');
    if (setOpen && !setOpen.dataset.exclWired) {
      setOpen.dataset.exclWired = '1';
      setOpen.addEventListener('click', () => {
        requestAnimationFrame(() => {
          const sheet = document.getElementById('settingsSheet');
          if (sheet && (!sheet.hidden || sheet.classList.contains('is-open'))) closeFx();
        });
      }, true);
    }

    const fx = document.getElementById('fxPanel');
    if (fx && !fx.dataset.exclObs) {
      fx.dataset.exclObs = '1';
      const mo = new MutationObserver(() => {
        if (!fx.hidden) closeSettings();
      });
      mo.observe(fx, { attributes: true, attributeFilter: ['hidden'] });
    }
    const sheet = document.getElementById('settingsSheet');
    if (sheet && !sheet.dataset.exclObs) {
      sheet.dataset.exclObs = '1';
      const mo = new MutationObserver(() => {
        if (!sheet.hidden || sheet.classList.contains('is-open')) closeFx();
      });
      mo.observe(sheet, { attributes: true, attributeFilter: ['hidden', 'class'] });
    }
  }

  function fixLooperBtn() {
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
    btn.style.setProperty('background', 'transparent', 'important');
    btn.style.setProperty('border', '0', 'important');
  }

  function run() {
    wire();
    fixLooperBtn();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 200);
  setTimeout(run, 800);
  setTimeout(fixLooperBtn, 1500);
})();
