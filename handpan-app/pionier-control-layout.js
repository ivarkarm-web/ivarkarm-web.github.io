/* PIONIER UI recovery: normalize existing controls into stable semantic rows.
   This only reparents existing DOM controls; audio and control event handlers remain attached. */
(function () {
  'use strict';
  if (window.__pionierLayoutRecoveryV14) return;
  window.__pionierLayoutRecoveryV14 = true;

  var scheduled = false;
  var observer = null;

  function make(tag, id, className) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tag);
      if (id) el.id = id;
      if (className) el.className = className;
    } else if (className && !el.classList.contains(className)) {
      el.classList.add(className);
    }
    return el;
  }

  function appendIfNeeded(parent, child) {
    if (parent && child && child.parentElement !== parent) parent.appendChild(child);
  }

  function welcomeIsVisible() {
    var welcome = document.getElementById('pionierWelcome');
    return !!(welcome && !welcome.hidden &&
      getComputedStyle(welcome).display !== 'none' &&
      getComputedStyle(welcome).visibility !== 'hidden' &&
      welcome.getAttribute('aria-hidden') !== 'true');
  }

  function arrange() {
    scheduled = false;
    if (welcomeIsVisible()) return;

    var app = document.getElementById('app');
    var topbar = app && app.querySelector('.topbar');
    var rail = document.getElementById('looperRail');
    if (!app || !topbar || !rail) return;

    var selectors = make('div', 'pionierSelectorRow', 'pionier-selector-stack');
    var scaleRow = make('div', 'pionierScaleRow', 'pionier-selector-row pionier-scale-row');
    var instrumentRow = make('div', 'pionierInstrumentRow', 'pionier-selector-row pionier-instrument-row');
    var dock = make('div', 'pionierBottomDock', 'pionier-bottom-dock');
    var instrumentGroup = make('div', 'pionierInstrumentGroup', 'pionier-selector-group pionier-instrument-group');
    var scaleGroup = make('div', 'pionierScaleGroup', 'pionier-selector-group pionier-scale-group');
    var toolbar = make('div', 'pionierLooperToolbar', 'pionier-looper-toolbar');
    var loopControls = make('div', 'pionierLooperControls', 'pionier-looper-controls');
    var actionGroup = make('div', 'pionierLooperActions', 'pionier-looper-actions');
    var tracks = make('div', 'pionierTrackRow', 'pionier-track-row');

    appendIfNeeded(app, dock);
    appendIfNeeded(dock, selectors);
    appendIfNeeded(selectors, scaleRow);
    appendIfNeeded(selectors, instrumentRow);
    appendIfNeeded(scaleRow, scaleGroup);
    appendIfNeeded(instrumentRow, instrumentGroup);
    appendIfNeeded(dock, toolbar);
    appendIfNeeded(dock, tracks);
    appendIfNeeded(toolbar, loopControls);
    appendIfNeeded(toolbar, actionGroup);

    var nav = document.getElementById('instrumentNav');
    var voicePrev = document.getElementById('voicePrev');
    var voiceNext = document.getElementById('voiceNext');
    var instrumentToggle = document.getElementById('instrumentDropdownToggle');
    var randomize = document.getElementById('randomizeSetup');
    [voicePrev, instrumentToggle, voiceNext, randomize].forEach(function (el) {
      appendIfNeeded(instrumentGroup, el);
    });
    if (nav && nav !== instrumentGroup && nav.children.length === 0) nav.remove();

    var scaleBlock = app.querySelector('.control-scale');
    var rootLabel = document.getElementById('rootLabel');
    var rootBlock = rootLabel && rootLabel.closest('.control-block');
    if (rootBlock && rootBlock.querySelector('#noteCountLabel')) rootBlock = null;
    appendIfNeeded(scaleGroup, scaleBlock);
    appendIfNeeded(scaleGroup, rootBlock);

    var clear = document.getElementById('looperClearBtn');
    var recordCluster = document.getElementById('looperRecordCluster');
    appendIfNeeded(loopControls, clear);
    var utilityGroup = document.getElementById('looperUtilityControls');
    if (utilityGroup) {
      // The legacy looper stylesheet positions timing controls only while they
      // are children of #looperRail. Once the rail is hidden and controls are
      // docked, that wrapper's old sizing/position rules no longer match.
      // Flatten the existing buttons into the visible left toolbar group so
      // each receives the dock's explicit touch-target and visibility rules.
      Array.prototype.slice.call(utilityGroup.children).forEach(function (control) {
        appendIfNeeded(loopControls, control);
      });
      if (utilityGroup.parentElement) utilityGroup.remove();
    }
    ['looperCountInBtn', 'looperMetronomeBtn', 'looperBpmBtn', 'looperSaveBtn'].forEach(function (id) {
      var control = document.getElementById(id);
      if (control) appendIfNeeded(loopControls, control);
    });
    appendIfNeeded(toolbar, recordCluster);

    var soundscapes = document.getElementById('openSoundscapes');
    var fx = document.getElementById('fxPanelOpen');
    var customize = document.getElementById('settingsOpenBtn');
    [soundscapes, fx, customize].forEach(function (el) { appendIfNeeded(actionGroup, el); });

    var layers = document.getElementById('looperLayers');
    appendIfNeeded(tracks, layers);

    // Keep menus at app level so transformed/overflowing selector rows cannot clip them.
    var scaleMenu = document.getElementById('scaleMenu');
    var instrumentMenu = document.getElementById('instrumentMenu');
    if (scaleMenu && scaleMenu.parentElement !== app) app.appendChild(scaleMenu);
    if (instrumentMenu && instrumentMenu.parentElement !== app) app.appendChild(instrumentMenu);

    app.classList.add('pionier-layout-recovered');
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(arrange);
  }

  function boot() {
    schedule();
    if (observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pionier:welcome-closed', schedule);
    var enter = document.getElementById('enterPionier');
    if (enter) enter.addEventListener('click', function () {
      setTimeout(schedule, 0);
      setTimeout(schedule, 180);
      setTimeout(schedule, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
