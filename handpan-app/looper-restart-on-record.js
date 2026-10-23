/**
 * When the user starts recording a new loop layer, restart every existing
 * layer from the beginning so overdubs stay aligned to the top of the cycle.
 */
(function looperRestartOnRecord() {
  if (window.__pionierLooperRestartOnRecord) return;
  window.__pionierLooperRestartOnRecord = true;

  var wasRecording = false;

  function audioCtx() {
    try {
      if (window.PionierCore && typeof window.PionierCore.getAudioContext === 'function') {
        return window.PionierCore.getAudioContext();
      }
    } catch (e) {}
    return null;
  }

  function restartAllLayersFromStart() {
    var api = window.PionierLooper;
    if (!api || !Array.isArray(api.layers) || !api.layers.length) return;
    var ctx = audioCtx();
    if (!ctx) return;

    api.layers.forEach(function (layer) {
      if (!layer || !layer.buffer) return;

      // Always reset logical playhead
      layer.offset = 0;

      if (layer.paused) {
        // Stay paused, but resume will start at 0
        return;
      }

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
        // Match default looper behavior: loop unless explicitly non-looping serial
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

    try {
      // Refresh circle progress UI if the looper exposes a re-render path later
      if (typeof api.renderCircles === 'function') api.renderCircles();
    } catch (e6) {}
  }

  function poll() {
    var api = window.PionierLooper;
    if (!api || typeof api.getState !== 'function') return;
    var state = api.getState();
    var recording = !!(state && state.recording);
    if (recording && !wasRecording) {
      // Rising edge: record just started
      restartAllLayersFromStart();
    }
    wasRecording = recording;
  }

  // Also catch the press early so restart happens before audio is captured
  document.addEventListener(
    'pointerup',
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('#looperBtn, .looper-btn.looper-record');
      if (!btn) return;
      // Defer slightly so looper can flip recording=true, then force restart
      setTimeout(function () {
        var api = window.PionierLooper;
        var state = api && api.getState && api.getState();
        if (state && state.recording) restartAllLayersFromStart();
      }, 0);
      setTimeout(function () {
        var api = window.PionierLooper;
        var state = api && api.getState && api.getState();
        if (state && state.recording) restartAllLayersFromStart();
      }, 30);
    },
    true
  );

  setInterval(poll, 80);
})();
