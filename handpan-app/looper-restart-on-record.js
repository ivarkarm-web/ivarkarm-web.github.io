/**
 * Count-in + record alignment:
 * - When count-in starts, mute all existing loops (silent while counting).
 * - When recording actually starts, unmute and restart every loop from the beginning.
 * - If count-in is cancelled, restore levels without forcing a restart.
 */
(function looperRestartOnRecord() {
  if (window.__pionierLooperRestartOnRecordV2) return;
  window.__pionierLooperRestartOnRecordV2 = true;

  var wasRecording = false;
  var wasCounting = false;
  var mutedForCountIn = false;

  function audioCtx() {
    try {
      if (window.PionierCore && typeof window.PionierCore.getAudioContext === 'function') {
        return window.PionierCore.getAudioContext();
      }
    } catch (e) {}
    return null;
  }

  function layers() {
    var api = window.PionierLooper;
    return api && Array.isArray(api.layers) ? api.layers : [];
  }

  function isCountingIn() {
    var btn = document.getElementById('looperCountInBtn');
    return !!(btn && btn.classList.contains('is-counting'));
  }

  function anySolo(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].solo) return true;
    }
    return false;
  }

  function effectiveLevel(layer, list) {
    if (!layer) return 0;
    if (layer.muted) return 0;
    if (anySolo(list) && !layer.solo) return 0;
    var level = layer.level;
    return Number.isFinite(level) ? level : 1;
  }

  function muteAllLayers() {
    var list = layers();
    if (!list.length) return;
    var ctx = audioCtx();
    var now = ctx ? ctx.currentTime : 0;
    list.forEach(function (layer) {
      if (!layer || !layer.gain) return;
      if (layer.__preMuteLevel == null) {
        try {
          layer.__preMuteLevel = layer.gain.gain.value;
        } catch (e) {
          layer.__preMuteLevel = effectiveLevel(layer, list);
        }
      }
      try {
        if (ctx) layer.gain.gain.setTargetAtTime(0, now, 0.015);
        else layer.gain.gain.value = 0;
      } catch (e2) {
        try { layer.gain.gain.value = 0; } catch (e3) {}
      }
    });
    mutedForCountIn = true;
  }

  function restoreAllLayersGain() {
    var list = layers();
    if (!list.length) return;
    var ctx = audioCtx();
    var now = ctx ? ctx.currentTime : 0;
    list.forEach(function (layer) {
      if (!layer || !layer.gain) return;
      var level = effectiveLevel(layer, list);
      delete layer.__preMuteLevel;
      try {
        if (ctx) layer.gain.gain.setTargetAtTime(level, now, 0.02);
        else layer.gain.gain.value = level;
      } catch (e) {
        try { layer.gain.gain.value = level; } catch (e2) {}
      }
    });
    mutedForCountIn = false;
  }

  function restartAllLayersFromStart() {
    var list = layers();
    if (!list.length) return;
    var ctx = audioCtx();
    if (!ctx) return;

    list.forEach(function (layer) {
      if (!layer || !layer.buffer) return;

      layer.offset = 0;

      if (layer.paused) return;
      if (!layer.gain) return;

      try {
        if (layer.source) {
          try { layer.source.onended = null; } catch (e1) {}
          try { layer.source.stop(); } catch (e2) {}
          try { layer.source.disconnect(); } catch (e3) {}
        }
      } catch (e4) {}

      try {
        var source = ctx.createBufferSource();
        source.buffer = layer.buffer;
        source.loop = true;
        source.connect(layer.gain);
        var now = ctx.currentTime;
        source.start(now, 0);
        layer.source = source;
        layer.startedAt = now;
        layer.offset = 0;
        layer.paused = false;
      } catch (e5) {
        console.warn('[looper-restart] failed to restart layer', e5);
      }
    });

    // Ensure audible again after count-in mute
    restoreAllLayersGain();
  }

  function onRecordStarted() {
    restartAllLayersFromStart();
  }

  function onCountInStarted() {
    muteAllLayers();
  }

  function onCountInEndedWithoutRecord() {
    if (mutedForCountIn) restoreAllLayersGain();
  }

  function poll() {
    var api = window.PionierLooper;
    if (!api || typeof api.getState !== 'function') return;

    var state = api.getState();
    var recording = !!(state && state.recording);
    var counting = isCountingIn();

    // Count-in rising edge → mute existing loops
    if (counting && !wasCounting) {
      onCountInStarted();
    }

    // Count-in falling edge without recording → restore (cancelled)
    if (!counting && wasCounting && !recording) {
      onCountInEndedWithoutRecord();
    }

    // Recording rising edge → restart from start + unmute
    if (recording && !wasRecording) {
      onRecordStarted();
    }

    wasCounting = counting;
    wasRecording = recording;
  }

  document.addEventListener(
    'pointerup',
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('#looperBtn, .looper-btn.looper-record');
      if (!btn) return;

      // Immediate: if count-in is about to run, mute ASAP
      setTimeout(function () {
        if (isCountingIn()) muteAllLayers();
        var api = window.PionierLooper;
        var state = api && api.getState && api.getState();
        if (state && state.recording) onRecordStarted();
      }, 0);
      setTimeout(function () {
        if (isCountingIn()) muteAllLayers();
        var api = window.PionierLooper;
        var state = api && api.getState && api.getState();
        if (state && state.recording) onRecordStarted();
      }, 40);
    },
    true
  );

  setInterval(poll, 50);
})();
