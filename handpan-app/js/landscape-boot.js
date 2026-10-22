/**
 * Phone landscape layout (v2)
 * Left rail: instrument, scale, base note, note count (no arrow steppers)
 * Right rail: tool stack (soundscapes/FX/settings) + vertical looper
 * Pan stays height-driven; kicks resize so canvas DPR recovers on rotate-back.
 */
(function landscapeBoot() {
  function isPhoneLandscape() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 560;
  }

  function ensureSideRails() {
    let left = document.getElementById('stageLeftRail');
    let right = document.getElementById('stageRightRail');
    if (!left) {
      left = document.createElement('aside');
      left.id = 'stageLeftRail';
      left.className = 'stage-side-rail stage-side-rail-left';
      left.setAttribute('aria-label', 'Instrument controls');
      left.hidden = true;
      document.body.appendChild(left);
    }
    if (!right) {
      right = document.createElement('aside');
      right.id = 'stageRightRail';
      right.className = 'stage-side-rail stage-side-rail-right';
      right.setAttribute('aria-label', 'Performance controls');
      right.hidden = true;
      document.body.appendChild(right);
    }
    return { left, right };
  }

  function placeRightChrome(el) {
    if (!el) return;
    el.style.setProperty('position', 'relative', 'important');
    el.style.setProperty('top', 'auto', 'important');
    el.style.setProperty('left', 'auto', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
  }

  function restorePortraitChrome() {
    const bar = document.getElementById('stageScaleBar');
    if (!bar) return;
    bar.removeAttribute('data-landscape-empty');

    const looper = document.getElementById('looperRail');
    const inst = document.getElementById('instrumentNav');
    const scaleRow = document.getElementById('stageScaleRow');
    const rootRow =
      document.querySelector('.stage-root-row') ||
      document.querySelector('.control-row');

    if (looper && looper.parentElement !== bar) bar.appendChild(looper);
    if (inst && inst.parentElement !== bar) bar.appendChild(inst);
    if (scaleRow && scaleRow.parentElement !== bar) bar.appendChild(scaleRow);
    if (rootRow && rootRow.parentElement !== bar) bar.appendChild(rootRow);

    const tools = document.getElementById('landscapeToolStack');
    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) document.body.appendChild(el);
    }
    tools?.remove();
  }

  let lastLand = null;

  function apply() {
    const isLand = isPhoneLandscape();
    const changed = lastLand !== isLand;
    lastLand = isLand;

    document.body.classList.toggle('pionier-landscape', isLand);
    document.documentElement.classList.toggle('pionier-landscape', isLand);

    const bar = document.getElementById('stageScaleBar');
    const { left, right } = ensureSideRails();

    if (isLand) {
      left.hidden = false;
      right.hidden = false;
      if (bar) bar.setAttribute('data-landscape-empty', '1');

      const inst = document.getElementById('instrumentNav');
      const scaleRow = document.getElementById('stageScaleRow');
      const rootRow =
        document.querySelector('.stage-root-row') ||
        document.querySelector('#stageScaleBar .control-row') ||
        document.querySelector('.control-row');
      const looper = document.getElementById('looperRail');

      if (inst) left.appendChild(inst);
      if (scaleRow) left.appendChild(scaleRow);
      if (rootRow) left.appendChild(rootRow);
      let tools = document.getElementById('landscapeToolStack');
      if (!tools) {
        tools = document.createElement('div');
        tools.id = 'landscapeToolStack';
        tools.className = 'landscape-tool-stack';
      }
      if (tools.parentElement !== right) right.appendChild(tools);
      for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
        const el = document.getElementById(id);
        if (!el) continue;
        placeRightChrome(el);
        tools.appendChild(el);
      }
      if (looper) {
        ['position', 'top', 'right', 'bottom', 'left', 'transform', 'width'].forEach((prop) => {
          looper.style.setProperty(
            prop,
            prop === 'position' ? 'relative' : prop === 'width' ? 'auto' : 'auto',
            'important'
          );
        });
        looper.style.setProperty('display', 'flex', 'important');
        looper.style.setProperty('flex-direction', 'column', 'important');
        looper.style.setProperty('align-items', 'center', 'important');
        right.appendChild(tools);
        right.appendChild(looper);
      }

      document.documentElement.style.setProperty('--chrome-top', '8px');
      document.documentElement.style.setProperty('--chrome-bottom', '8px');
      document.documentElement.style.setProperty('--pan-bottom-gap', '0px');
    } else if (changed) {
      left.hidden = true;
      right.hidden = true;
      restorePortraitChrome();
      try {
        if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
      } catch (_) {}
    }

    document.documentElement.style.setProperty('--viewport-h', window.innerHeight + 'px');

    const kick = () => {
      try {
        window.dispatchEvent(new Event('resize'));
      } catch (_) {}
    };
    requestAnimationFrame(kick);
    setTimeout(kick, 100);
    setTimeout(kick, 320);
    setTimeout(kick, 700);
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 40);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      setTimeout(apply, 150);
      setTimeout(apply, 500);
      setTimeout(apply, 1400);
    });
  } else {
    apply();
    setTimeout(apply, 150);
    setTimeout(apply, 500);
    setTimeout(apply, 1400);
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    setTimeout(apply, 60);
    setTimeout(apply, 200);
    setTimeout(apply, 450);
  });
})();
