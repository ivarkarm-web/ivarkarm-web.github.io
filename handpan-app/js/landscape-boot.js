/**
 * Phone landscape layout (v3) — cohesive vertical side menus.
 */
(function landscapeBoot() {
  function isPhoneLandscape() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 600;
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
    el.style.setProperty('margin', '0', 'important');
  }

  /** Flatten looper into a pure vertical list on the rail. */
  function verticalizeLooper(rail) {
    if (!rail) return;
    const cluster = document.getElementById('looperRecordCluster');
    const ids = [
      'looperClearBtn',
      'looperCountInBtn',
      'looperMetronomeBtn',
      'looperBpmBtn',
      'looperSaveBtn',
      'looperRecordCluster',
      'looperLayers',
    ];
    if (cluster) {
      for (const id of ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn', 'looperSyncBtn']) {
        const el = document.getElementById(id);
        if (el && el.parentElement === cluster) {
          rail.insertBefore(el, cluster);
        }
      }
    }
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.parentElement !== rail) rail.appendChild(el);
      placeRightChrome(el);
      el.style.setProperty('grid-column', 'auto', 'important');
      el.style.setProperty('grid-row', 'auto', 'important');
      el.style.setProperty('margin-left', '0', 'important');
    }
    rail.style.setProperty('display', 'flex', 'important');
    rail.style.setProperty('flex-direction', 'column', 'important');
    rail.style.setProperty('align-items', 'center', 'important');
    if (cluster) {
      cluster.style.setProperty('display', 'flex', 'important');
      cluster.style.setProperty('flex-direction', 'column', 'important');
      cluster.style.setProperty('flex-flow', 'column nowrap', 'important');
      cluster.style.setProperty('align-items', 'center', 'important');
      cluster.style.setProperty('pointer-events', 'auto', 'important');
    }
    const layers = document.getElementById('looperLayers');
    if (layers) {
      layers.style.setProperty('display', 'flex', 'important');
      layers.style.setProperty('flex-direction', 'column', 'important');
      layers.style.setProperty('align-items', 'center', 'important');
    }
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

    const cluster = document.getElementById('looperRecordCluster');
    if (cluster && looper) {
      for (const id of ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn']) {
        const el = document.getElementById(id);
        if (el && el.parentElement === looper) {
          el.style.removeProperty('margin');
          el.style.removeProperty('grid-column');
          el.style.removeProperty('grid-row');
        }
      }
      ['display', 'flex-direction', 'flex-flow', 'align-items', 'pointer-events'].forEach((p) => {
        cluster.style.removeProperty(p);
      });
      looper.style.removeProperty('display');
      looper.style.removeProperty('flex-direction');
      looper.style.removeProperty('align-items');
    }

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
      right.appendChild(tools);
      for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
        const el = document.getElementById(id);
        if (!el) continue;
        placeRightChrome(el);
        tools.appendChild(el);
      }

      if (looper) {
        placeRightChrome(looper);
        right.appendChild(looper);
        verticalizeLooper(looper);
      }

      document.documentElement.style.setProperty('--chrome-top', '6px');
      document.documentElement.style.setProperty('--chrome-bottom', '6px');
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
      setTimeout(apply, 2200);
    });
  } else {
    apply();
    setTimeout(apply, 150);
    setTimeout(apply, 500);
    setTimeout(apply, 1400);
    setTimeout(apply, 2200);
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    setTimeout(apply, 60);
    setTimeout(apply, 200);
    setTimeout(apply, 450);
  });
})();
