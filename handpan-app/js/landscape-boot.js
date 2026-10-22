/**
 * Phone landscape layout (v7)
 * Keep #looperRail visible as a vertical column (never display:none —
 * looper.js re-parents controls into it). Force all timing + record controls.
 */
(function landscapeBoot() {
  const BTN = '44px';

  function isPhoneLandscape() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 640;
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

  function sizeCircle(el) {
    if (!el) return;
    const s = el.style;
    s.setProperty('position', 'relative', 'important');
    s.setProperty('top', 'auto', 'important');
    s.setProperty('left', 'auto', 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
    s.setProperty('inset', 'auto', 'important');
    s.setProperty('transform', 'none', 'important');
    s.setProperty('margin', '0', 'important');
    s.setProperty('margin-left', '0', 'important');
    s.setProperty('grid-column', 'auto', 'important');
    s.setProperty('grid-row', 'auto', 'important');
    s.setProperty('display', 'flex', 'important');
    s.setProperty('visibility', 'visible', 'important');
    s.setProperty('opacity', '1', 'important');
    s.setProperty('pointer-events', 'auto', 'important');
    s.setProperty('width', BTN, 'important');
    s.setProperty('height', BTN, 'important');
    s.setProperty('min-width', BTN, 'important');
    s.setProperty('min-height', BTN, 'important');
    s.setProperty('max-width', BTN, 'important');
    s.setProperty('max-height', BTN, 'important');
    s.setProperty('flex', '0 0 ' + BTN, 'important');
    s.setProperty('overflow', 'visible', 'important');
    s.setProperty('z-index', '1', 'important');
  }

  function clearBoxConstraints(el) {
    if (!el) return;
    const s = el.style;
    s.setProperty('position', 'relative', 'important');
    s.setProperty('top', 'auto', 'important');
    s.setProperty('left', 'auto', 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
    s.setProperty('margin', '0', 'important');
    s.setProperty('margin-left', '0', 'important');
    s.setProperty('width', 'auto', 'important');
    s.setProperty('height', 'auto', 'important');
    s.setProperty('min-width', '0', 'important');
    s.setProperty('min-height', '0', 'important');
    s.setProperty('max-width', 'none', 'important');
    s.setProperty('max-height', 'none', 'important');
    s.setProperty('flex', '0 0 auto', 'important');
    s.setProperty('overflow', 'visible', 'important');
    s.setProperty('display', 'flex', 'important');
    s.setProperty('visibility', 'visible', 'important');
    s.setProperty('opacity', '1', 'important');
  }

  function ensureRightStructure(right) {
    let top = document.getElementById('landscapeRightTop');
    if (!top) {
      top = document.createElement('div');
      top.id = 'landscapeRightTop';
      top.className = 'landscape-right-top';
    }
    if (top.parentElement !== right) right.insertBefore(top, right.firstChild);

    let tools = document.getElementById('landscapeToolStack');
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'landscapeToolStack';
      tools.className = 'landscape-tool-stack';
    }
    if (tools.parentElement !== top) top.appendChild(tools);

    return { top, tools };
  }

  function placeLandscapeChrome(left, right) {
    const { top, tools } = ensureRightStructure(right);

    const inst = document.getElementById('instrumentNav');
    const scaleRow =
      document.getElementById('stageScaleRow') ||
      document.querySelector('.stage-scale-row');
    const rootRow =
      document.querySelector('.stage-root-row') ||
      document.querySelector('#stageScaleBar .control-row') ||
      document.querySelector('.control-row');
    if (inst) left.appendChild(inst);
    if (scaleRow) left.appendChild(scaleRow);
    if (rootRow) left.appendChild(rootRow);

    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (!el) continue;
      sizeCircle(el);
      tools.appendChild(el);
    }

    const layers = document.getElementById('looperLayers');
    if (layers) {
      clearBoxConstraints(layers);
      layers.style.setProperty('flex-direction', 'column', 'important');
      layers.style.setProperty('align-items', 'center', 'important');
      layers.style.setProperty('gap', '6px', 'important');
      layers.style.setProperty('max-width', BTN, 'important');
      layers.style.setProperty('max-height', 'min(50dvh, 240px)', 'important');
      layers.style.setProperty('overflow-y', 'auto', 'important');
      layers.style.setProperty('overflow-x', 'hidden', 'important');
      top.appendChild(layers);
    }

    const looper = document.getElementById('looperRail');
    if (!looper) return;

    clearBoxConstraints(looper);
    looper.style.setProperty('display', 'flex', 'important');
    looper.style.setProperty('flex-direction', 'column', 'important');
    looper.style.setProperty('flex-flow', 'column nowrap', 'important');
    looper.style.setProperty('align-items', 'center', 'important');
    looper.style.setProperty('justify-content', 'flex-start', 'important');
    looper.style.setProperty('gap', '8px', 'important');
    looper.style.setProperty('grid', 'none', 'important');
    looper.style.setProperty('grid-template-columns', 'none', 'important');
    looper.style.setProperty('width', 'auto', 'important');
    looper.style.setProperty('max-width', '100%', 'important');
    looper.hidden = false;
    looper.removeAttribute('hidden');
    right.appendChild(looper);

    const cluster = document.getElementById('looperRecordCluster');
    const order = [
      'looperClearBtn',
      'looperCountInBtn',
      'looperMetronomeBtn',
      'looperBpmBtn',
      'looperSaveBtn',
      'looperSyncBtn',
      'looperRecordCluster',
    ];

    for (const id of order) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (id === 'looperRecordCluster') {
        clearBoxConstraints(el);
        el.style.setProperty('flex-direction', 'column', 'important');
        el.style.setProperty('align-items', 'center', 'important');
        el.style.setProperty('gap', '8px', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
        sizeCircle(document.getElementById('looperBtn'));
      } else {
        sizeCircle(el);
        el.hidden = false;
        el.removeAttribute('hidden');
      }
      looper.appendChild(el);
    }

    if (cluster) {
      Array.from(cluster.children).forEach((child) => {
        if (child.id === 'looperBtn') {
          sizeCircle(child);
          return;
        }
        if (child.id && child.id.startsWith('looper')) {
          sizeCircle(child);
          looper.insertBefore(child, cluster);
        }
      });
    }
  }

  function restorePortraitChrome() {
    const bar = document.getElementById('stageScaleBar');
    if (!bar) return;
    bar.removeAttribute('data-landscape-empty');

    const looper = document.getElementById('looperRail');
    if (looper) {
      looper.style.cssText = '';
      for (const id of [
        'looperClearBtn',
        'looperCountInBtn',
        'looperMetronomeBtn',
        'looperBpmBtn',
        'looperSaveBtn',
        'looperSyncBtn',
        'looperRecordCluster',
        'looperLayers',
      ]) {
        const el = document.getElementById(id);
        if (el) {
          el.style.cssText = '';
          looper.appendChild(el);
        }
      }
      const btn = document.getElementById('looperBtn');
      if (btn) btn.style.cssText = '';
      if (looper.parentElement !== bar) bar.appendChild(looper);
    }

    const inst = document.getElementById('instrumentNav');
    const scaleRow = document.getElementById('stageScaleRow');
    const rootRow =
      document.querySelector('.stage-root-row') ||
      document.querySelector('.control-row');
    if (inst && inst.parentElement !== bar) bar.appendChild(inst);
    if (scaleRow && scaleRow.parentElement !== bar) bar.appendChild(scaleRow);
    if (rootRow && rootRow.parentElement !== bar) bar.appendChild(rootRow);

    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.cssText = '';
      document.body.appendChild(el);
    }

    document.getElementById('landscapeRightTop')?.remove();
    document.getElementById('landscapeToolStack')?.remove();
    document.getElementById('landscapeLooperTransport')?.remove();
  }

  let lastLand = null;
  let observer = null;

  function watch() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (!document.body.classList.contains('pionier-landscape')) return;
    observer = new MutationObserver(() => {
      if (!document.body.classList.contains('pionier-landscape')) return;
      clearTimeout(window.__landFixT);
      window.__landFixT = setTimeout(() => {
        const { left, right } = ensureSideRails();
        placeLandscapeChrome(left, right);
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
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
      placeLandscapeChrome(left, right);
      watch();
      document.documentElement.style.setProperty('--chrome-top', '4px');
      document.documentElement.style.setProperty('--chrome-bottom', '4px');
      document.documentElement.style.setProperty('--pan-bottom-gap', '0px');
    } else if (changed) {
      if (observer) {
        observer.disconnect();
        observer = null;
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
    setTimeout(kick, 150);
    setTimeout(kick, 500);
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 40);
  }

  function boot() {
    apply();
    [100, 300, 700, 1200, 2000, 3500, 5000].forEach((ms) => setTimeout(apply, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    setTimeout(apply, 50);
    setTimeout(apply, 250);
    setTimeout(apply, 600);
  });
})();
