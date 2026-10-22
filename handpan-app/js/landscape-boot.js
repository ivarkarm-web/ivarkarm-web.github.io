/**
 * Phone landscape layout (v4) — enforce cohesive vertical side menus.
 * Re-applies after looper mount (MutationObserver) so grid CSS cannot win.
 */
(function landscapeBoot() {
  const BTN = '44px';

  function isPhoneLandscape() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 620;
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

  function resetPos(el) {
    if (!el) return;
    const s = el.style;
    s.setProperty('position', 'relative', 'important');
    s.setProperty('top', 'auto', 'important');
    s.setProperty('left', 'auto', 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
    s.setProperty('transform', 'none', 'important');
    s.setProperty('margin', '0', 'important');
    s.setProperty('margin-left', '0', 'important');
    s.setProperty('grid-column', 'auto', 'important');
    s.setProperty('grid-row', 'auto', 'important');
  }

  function sizeBtn(el) {
    if (!el) return;
    resetPos(el);
    el.style.setProperty('width', BTN, 'important');
    el.style.setProperty('height', BTN, 'important');
    el.style.setProperty('min-width', BTN, 'important');
    el.style.setProperty('min-height', BTN, 'important');
    el.style.setProperty('max-width', BTN, 'important');
    el.style.setProperty('max-height', BTN, 'important');
    el.style.setProperty('flex', '0 0 ' + BTN, 'important');
  }

  function verticalizeLooper(rail) {
    if (!rail) return;
    const cluster = document.getElementById('looperRecordCluster');

    if (cluster) {
      for (const id of ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn', 'looperSyncBtn']) {
        const el = document.getElementById(id);
        if (el && el.parentElement !== rail) {
          rail.insertBefore(el, cluster);
        }
      }
    }

    const order = [
      'looperClearBtn',
      'looperCountInBtn',
      'looperMetronomeBtn',
      'looperBpmBtn',
      'looperSaveBtn',
      'looperRecordCluster',
      'looperLayers',
    ];
    for (const id of order) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.parentElement !== rail) rail.appendChild(el);
      if (id === 'looperRecordCluster' || id === 'looperLayers') resetPos(el);
      else sizeBtn(el);
    }

    rail.style.setProperty('display', 'flex', 'important');
    rail.style.setProperty('flex-direction', 'column', 'important');
    rail.style.setProperty('flex-flow', 'column nowrap', 'important');
    rail.style.setProperty('align-items', 'center', 'important');
    rail.style.setProperty('justify-content', 'flex-start', 'important');
    rail.style.setProperty('gap', '8px', 'important');
    rail.style.setProperty('grid', 'none', 'important');
    rail.style.setProperty('grid-template-columns', 'none', 'important');

    if (cluster) {
      cluster.style.setProperty('display', 'flex', 'important');
      cluster.style.setProperty('flex-direction', 'column', 'important');
      cluster.style.setProperty('flex-flow', 'column nowrap', 'important');
      cluster.style.setProperty('align-items', 'center', 'important');
      cluster.style.setProperty('gap', '8px', 'important');
      cluster.style.setProperty('pointer-events', 'auto', 'important');
      cluster.style.setProperty('margin', '0', 'important');
      sizeBtn(document.getElementById('looperBtn'));
    }

    const layers = document.getElementById('looperLayers');
    if (layers) {
      layers.style.setProperty('display', 'flex', 'important');
      layers.style.setProperty('flex-direction', 'column', 'important');
      layers.style.setProperty('flex-flow', 'column nowrap', 'important');
      layers.style.setProperty('align-items', 'center', 'important');
      layers.style.setProperty('gap', '6px', 'important');
      layers.style.setProperty('margin', '0', 'important');
      layers.style.setProperty('margin-left', '0', 'important');
      layers.style.setProperty('max-width', BTN, 'important');
      layers.querySelectorAll('.looper-circle').forEach((c) => {
        c.style.setProperty('margin', '0', 'important');
        c.style.setProperty('margin-left', '0', 'important');
      });
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

    if (looper) {
      ['display', 'flex-direction', 'flex-flow', 'align-items', 'justify-content', 'gap', 'grid', 'grid-template-columns'].forEach((p) => {
        looper.style.removeProperty(p);
      });
      const cluster = document.getElementById('looperRecordCluster');
      if (cluster) {
        ['display', 'flex-direction', 'flex-flow', 'align-items', 'gap', 'pointer-events', 'margin'].forEach((p) => {
          cluster.style.removeProperty(p);
        });
      }
      for (const id of ['looperClearBtn', 'looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn', 'looperBtn', 'looperLayers']) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.cssText = '';
      }
    }

    const tools = document.getElementById('landscapeToolStack');
    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) document.body.appendChild(el);
      if (el) {
        ['position', 'top', 'left', 'right', 'bottom', 'transform', 'margin', 'width', 'height'].forEach((p) => {
          el.style.removeProperty(p);
        });
      }
    }
    tools?.remove();
  }

  let lastLand = null;
  let looperObserver = null;

  function watchLooper(rail) {
    if (looperObserver) {
      looperObserver.disconnect();
      looperObserver = null;
    }
    if (!rail || !document.body.classList.contains('pionier-landscape')) return;
    looperObserver = new MutationObserver(() => {
      if (!document.body.classList.contains('pionier-landscape')) return;
      clearTimeout(window.__landLooperFixT);
      window.__landLooperFixT = setTimeout(() => verticalizeLooper(rail), 30);
    });
    looperObserver.observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  }

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
        sizeBtn(el);
        tools.appendChild(el);
      }

      if (looper) {
        resetPos(looper);
        right.appendChild(looper);
        verticalizeLooper(looper);
        watchLooper(looper);
      }

      document.documentElement.style.setProperty('--chrome-top', '4px');
      document.documentElement.style.setProperty('--chrome-bottom', '4px');
      document.documentElement.style.setProperty('--pan-bottom-gap', '0px');
    } else if (changed) {
      if (looperObserver) {
        looperObserver.disconnect();
        looperObserver = null;
      }
      left.hidden = true;
      right.hidden = true;
      restorePortraitChrome();
      try {
        if (typeof window.__pionierCenterPan === 'function') window.__pionierCenterPan();
      } catch (_) {}
    }

    document.documentElement.style.setProperty('--viewport-h', window.innerHeight + 'px');

    const kick = () => {
      try { window.dispatchEvent(new Event('resize')); } catch (_) {}
    };
    requestAnimationFrame(kick);
    setTimeout(kick, 120);
    setTimeout(kick, 400);
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 40);
  }

  function boot() {
    apply();
    [120, 400, 900, 1600, 2800].forEach((ms) => setTimeout(apply, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    setTimeout(apply, 50);
    setTimeout(apply, 200);
    setTimeout(apply, 500);
  });
})();
