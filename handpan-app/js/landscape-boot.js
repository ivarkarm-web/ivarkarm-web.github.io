/**
 * Phone landscape layout (v8)
 * Enter: side rails + vertical looper. Exit: hard-clear styles and call layout-boot.
 * No body-wide MutationObserver (that was fighting portrait restore).
 */
(function landscapeBoot() {
  const BTN = '44px';
  const TOUCHED_IDS = [
    'openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn',
    'looperRail', 'looperClearBtn', 'looperCountInBtn', 'looperMetronomeBtn',
    'looperBpmBtn', 'looperSaveBtn', 'looperSyncBtn', 'looperRecordCluster',
    'looperBtn', 'looperLayers',
    'instrumentNav', 'stageScaleRow',
  ];

  function isPhoneLandscape() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches) return true;
        if (window.matchMedia('(orientation: landscape) and (max-height: 640px) and (max-width: 960px)').matches) return true;
      }
    } catch (_) {}
    return window.innerWidth > window.innerHeight && window.innerHeight <= 520;
  }

  function hardClearStyle(el) {
    if (!el) return;
    el.removeAttribute('style');
  }

  function sizeBtn(el) {
    if (!el) return;
    el.style.cssText = [
      'position:relative!important',
      'top:auto!important',
      'left:auto!important',
      'right:auto!important',
      'bottom:auto!important',
      'transform:none!important',
      'margin:0!important',
      'display:flex!important',
      'visibility:visible!important',
      'opacity:1!important',
      'pointer-events:auto!important',
      'width:' + BTN + '!important',
      'height:' + BTN + '!important',
      'min-width:' + BTN + '!important',
      'min-height:' + BTN + '!important',
      'max-width:' + BTN + '!important',
      'max-height:' + BTN + '!important',
      'flex:0 0 ' + BTN + '!important',
      'overflow:visible!important',
      'z-index:1!important',
    ].join(';');
  }

  function ensureRails() {
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

  function enterLandscape() {
    const bar = document.getElementById('stageScaleBar');
    const { left, right } = ensureRails();
    left.hidden = false;
    right.hidden = false;
    if (bar) bar.setAttribute('data-landscape-empty', '1');

    const inst = document.getElementById('instrumentNav');
    const scaleRow = document.getElementById('stageScaleRow');
    const rootRow =
      document.querySelector('.stage-root-row') ||
      document.querySelector('#stageScaleBar .control-row') ||
      document.querySelector('.control-row');
    if (inst) left.appendChild(inst);
    if (scaleRow) left.appendChild(scaleRow);
    if (rootRow) left.appendChild(rootRow);

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

    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (!el) continue;
      sizeBtn(el);
      tools.appendChild(el);
    }

    const layers = document.getElementById('looperLayers');
    if (layers) {
      hardClearStyle(layers);
      layers.style.cssText =
        'display:flex!important;flex-direction:column!important;align-items:center!important;' +
        'gap:6px!important;max-width:44px!important;max-height:min(45dvh,220px)!important;' +
        'overflow-y:auto!important;margin:0!important;visibility:visible!important';
      top.appendChild(layers);
    }

    const looper = document.getElementById('looperRail');
    if (looper) {
      hardClearStyle(looper);
      looper.style.cssText =
        'display:flex!important;flex-direction:column!important;align-items:center!important;' +
        'gap:8px!important;grid:none!important;margin:0!important;width:auto!important;' +
        'visibility:visible!important;opacity:1!important;overflow:visible!important';
      looper.hidden = false;
      right.appendChild(looper);

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
          hardClearStyle(el);
          el.style.cssText =
            'display:flex!important;flex-direction:column!important;align-items:center!important;' +
            'gap:8px!important;width:auto!important;height:auto!important;max-width:none!important;' +
            'max-height:none!important;overflow:visible!important;margin:0!important';
          sizeBtn(document.getElementById('looperBtn'));
        } else {
          sizeBtn(el);
          el.hidden = false;
        }
        looper.appendChild(el);
      }

      const cluster = document.getElementById('looperRecordCluster');
      if (cluster) {
        Array.from(cluster.children).forEach((child) => {
          if (child.id === 'looperBtn') {
            sizeBtn(child);
            return;
          }
          if (child.id && child.tagName === 'BUTTON') {
            sizeBtn(child);
            looper.insertBefore(child, cluster);
          }
        });
      }
    }

    document.documentElement.style.setProperty('--chrome-top', '4px');
    document.documentElement.style.setProperty('--chrome-bottom', '4px');
    document.documentElement.style.setProperty('--pan-bottom-gap', '0px');
  }

  function exitLandscape() {
    clearTimeout(window.__landFixT);
    clearTimeout(window.__landscapeBootT);

    const bar = document.getElementById('stageScaleBar');
    if (bar) bar.removeAttribute('data-landscape-empty');

    for (const id of TOUCHED_IDS) {
      hardClearStyle(document.getElementById(id));
    }
    document.querySelectorAll('.stage-root-row, .control-row, .stage-scale-row').forEach(hardClearStyle);

    const looper = document.getElementById('looperRail');
    if (looper) {
      for (const id of [
        'looperClearBtn', 'looperCountInBtn', 'looperMetronomeBtn',
        'looperBpmBtn', 'looperSaveBtn', 'looperSyncBtn',
        'looperRecordCluster', 'looperLayers',
      ]) {
        const el = document.getElementById(id);
        if (el) looper.appendChild(el);
      }
      hardClearStyle(looper);
      if (bar && looper.parentElement !== bar) bar.appendChild(looper);
    }

    if (bar) {
      const inst = document.getElementById('instrumentNav');
      const scaleRow = document.getElementById('stageScaleRow');
      const rootRow =
        document.querySelector('.stage-root-row') ||
        document.querySelector('.control-row');
      if (inst) bar.appendChild(inst);
      if (scaleRow) bar.appendChild(scaleRow);
      if (rootRow) bar.appendChild(rootRow);
    }

    for (const id of ['openSoundscapes', 'fxPanelOpen', 'settingsOpenBtn']) {
      const el = document.getElementById(id);
      if (!el) continue;
      hardClearStyle(el);
      document.body.appendChild(el);
    }

    document.getElementById('landscapeRightTop')?.remove();
    document.getElementById('landscapeToolStack')?.remove();
    document.getElementById('landscapeLooperTransport')?.remove();

    const left = document.getElementById('stageLeftRail');
    const right = document.getElementById('stageRightRail');
    if (left) left.hidden = true;
    if (right) right.hidden = true;

    document.documentElement.style.removeProperty('--chrome-top');
    document.documentElement.style.removeProperty('--chrome-bottom');
    document.documentElement.style.removeProperty('--pan-bottom-gap');

    const relayout = () => {
      try {
        if (typeof window.__pionierRelayoutPortrait === 'function') {
          window.__pionierRelayoutPortrait();
        } else if (typeof window.__pionierCenterPan === 'function') {
          window.__pionierCenterPan();
        }
      } catch (_) {}
    };
    relayout();
    setTimeout(relayout, 50);
    setTimeout(relayout, 200);
    setTimeout(relayout, 500);
  }

  let lastLand = null;
  let pollTimer = null;

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(() => {
      if (!document.body.classList.contains('pionier-landscape')) {
        stopPoll();
        return;
      }
      const rail = document.getElementById('looperRail');
      const right = document.getElementById('stageRightRail');
      if (!rail || !right) return;
      if (rail.parentElement !== right) {
        enterLandscape();
        return;
      }
      for (const id of ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn']) {
        const el = document.getElementById(id);
        if (el && el.parentElement !== rail && el.parentElement?.id !== 'looperRecordCluster') {
          sizeBtn(el);
          rail.insertBefore(el, document.getElementById('looperRecordCluster') || null);
        } else if (el && el.parentElement === document.getElementById('looperRecordCluster')) {
          sizeBtn(el);
          rail.insertBefore(el, document.getElementById('looperRecordCluster'));
        }
      }
    }, 800);
  }

  function apply() {
    const isLand = isPhoneLandscape();
    if (isLand === lastLand) {
      if (isLand) enterLandscape();
      return;
    }
    lastLand = isLand;

    document.body.classList.toggle('pionier-landscape', isLand);
    document.documentElement.classList.toggle('pionier-landscape', isLand);

    if (isLand) {
      enterLandscape();
      startPoll();
    } else {
      stopPoll();
      exitLandscape();
    }

    document.documentElement.style.setProperty('--viewport-h', window.innerHeight + 'px');
    try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  }

  function schedule() {
    clearTimeout(window.__landscapeBootT);
    window.__landscapeBootT = setTimeout(apply, 60);
  }

  function boot() {
    lastLand = null;
    apply();
    setTimeout(apply, 600);
    setTimeout(apply, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => {
    lastLand = null;
    setTimeout(apply, 80);
    setTimeout(apply, 300);
    setTimeout(apply, 700);
  });
})();
