/**
 * Phone landscape layout (v6) — reliable vertical chrome.
 * Overrides fixed FX/settings positioning; dual top columns for tools + tracks.
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

  function freeFromFixed(el) {
    if (!el) return;
    const props = {
      position: 'relative',
      top: 'auto',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
      margin: '0',
      'margin-left': '0',
      'margin-right': '0',
      inset: 'auto',
      'grid-column': 'auto',
      'grid-row': 'auto',
      display: 'flex',
      visibility: 'visible',
      opacity: '1',
      'pointer-events': 'auto',
      width: BTN,
      height: BTN,
      'min-width': BTN,
      'min-height': BTN,
      'max-width': BTN,
      'max-height': BTN,
      flex: '0 0 ' + BTN,
      'z-index': '1',
    };
    for (const [k, v] of Object.entries(props)) {
      el.style.setProperty(k, v, 'important');
    }
  }

  function ensureRightStructure(right) {
    let top = document.getElementById('landscapeRightTop');
    if (!top) {
      top = document.createElement('div');
      top.id = 'landscapeRightTop';
      top.className = 'landscape-right-top';
    }
    right.appendChild(top);

    let tools = document.getElementById('landscapeToolStack');
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'landscapeToolStack';
      tools.className = 'landscape-tool-stack';
    }
    top.appendChild(tools);

    let transport = document.getElementById('landscapeLooperTransport');
    if (!transport) {
      transport = document.createElement('div');
      transport.id = 'landscapeLooperTransport';
      transport.className = 'landscape-looper-transport';
    }
    right.appendChild(transport);

    return { top, tools, transport };
  }

  function placeLandscapeChrome(left, right) {
    const { top, tools, transport } = ensureRightStructure(right);

    const inst = document.getElementById('instrumentNav');
    const scaleRow =
      document.getElementById('stageScaleRow') ||
      document.querySelector('.stage-scale-row') ||
      document.querySelector('.control-scale')?.parentElement;
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
      freeFromFixed(el);
      tools.appendChild(el);
    }

    const layers = document.getElementById('looperLayers');
    if (layers) {
      freeFromFixed(layers);
      layers.style.setProperty('width', 'auto', 'important');
      layers.style.setProperty('height', 'auto', 'important');
      layers.style.setProperty('max-width', BTN, 'important');
      layers.style.setProperty('max-height', 'min(65dvh, 320px)', 'important');
      layers.style.setProperty('min-height', '0', 'important');
      layers.style.setProperty('display', 'flex', 'important');
      layers.style.setProperty('flex-direction', 'column', 'important');
      layers.style.setProperty('align-items', 'center', 'important');
      layers.style.setProperty('gap', '6px', 'important');
      layers.style.setProperty('overflow-y', 'auto', 'important');
      layers.style.setProperty('overflow-x', 'hidden', 'important');
      layers.style.setProperty('flex', '0 0 auto', 'important');
      top.appendChild(layers);
    }

    const looper = document.getElementById('looperRail');
    const cluster = document.getElementById('looperRecordCluster');
    if (cluster) {
      for (const id of ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn', 'looperSyncBtn']) {
        const el = document.getElementById(id);
        if (el) {
          freeFromFixed(el);
          transport.appendChild(el);
        }
      }
    }
    for (const id of ['looperClearBtn', 'looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn']) {
      const el = document.getElementById(id);
      if (!el) continue;
      freeFromFixed(el);
      transport.appendChild(el);
    }
    if (cluster) {
      freeFromFixed(cluster);
      cluster.style.setProperty('width', 'auto', 'important');
      cluster.style.setProperty('height', 'auto', 'important');
      cluster.style.setProperty('max-width', 'none', 'important');
      cluster.style.setProperty('max-height', 'none', 'important');
      cluster.style.setProperty('display', 'flex', 'important');
      cluster.style.setProperty('flex-direction', 'column', 'important');
      cluster.style.setProperty('align-items', 'center', 'important');
      cluster.style.setProperty('gap', '8px', 'important');
      freeFromFixed(document.getElementById('looperBtn'));
      transport.appendChild(cluster);
    }

    if (looper) {
      looper.style.setProperty('display', 'none', 'important');
      if (looper.parentElement !== right) right.appendChild(looper);
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

  function watch(right) {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (!right || !document.body.classList.contains('pionier-landscape')) return;
    observer = new MutationObserver(() => {
      if (!document.body.classList.contains('pionier-landscape')) return;
      clearTimeout(window.__landFixT);
      window.__landFixT = setTimeout(() => {
        const { left } = ensureSideRails();
        placeLandscapeChrome(left, right);
      }, 50);
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
      watch(right);
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
    setTimeout(kick, 450);
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 40);
  }

  function boot() {
    apply();
    [100, 350, 800, 1500, 2500, 4000].forEach((ms) => setTimeout(apply, ms));
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
