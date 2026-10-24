/**
 * looper-timing-seams.js — audio-clock metronome, bar-grid first loop, crossfade.
 * Layers on top of CDN looper via window.PionierLooper after mount.
 */
(function () {
  if (window.__pionierLooperTimingSeams) return;
  window.__pionierLooperTimingSeams = true;

  const CLICK_TYPES = [
    { id:'woodblock', wave:'triangle', frequency:1450, duration:.045 },
    { id:'soft-wood', wave:'sine', frequency:950, duration:.055 },
    { id:'rim-click', wave:'square', frequency:2100, duration:.022 },
    { id:'handpan-tap', wave:'sine', frequency:520, duration:.11 },
    { id:'bell', wave:'sine', frequency:1760, duration:.16 },
    { id:'shaker', wave:'sawtooth', frequency:4200, duration:.018 },
    { id:'tick', wave:'square', frequency:1200, duration:.012 },
    { id:'clave', wave:'triangle', frequency:2500, duration:.03 },
    { id:'low-pulse', wave:'sine', frequency:180, duration:.08 },
    { id:'digital', wave:'square', frequency:3000, duration:.018 },
  ];

  function getCtx() {
    try {
      const c = window.PionierCore?.getAudioContext?.();
      if (c && c.state !== 'closed') return c;
    } catch (_) {}
    return null;
  }

  function getMaster() {
    try { return window.HandpanAudio?.getAudioMaster?.() || null; } catch (_) {}
    return null;
  }

  let bpm = 90;
  let beatsPerBar = 4;
  let clickType = 'woodblock';
  let clickMode = 'off';
  let clickNextTime = 0;
  let clickBeatIndex = 0;
  let clickTimer = 0;

  function playClickAt(when, beatIndex) {
    const ctx = getCtx();
    if (!ctx) return;
    const def = CLICK_TYPES.find((c) => c.id === clickType) || CLICK_TYPES[0];
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const accent = (beatIndex % beatsPerBar) === 0;
      osc.type = def.wave || 'sine';
      osc.frequency.value = accent ? def.frequency * 1.12 : def.frequency;
      const t0 = Math.max(when, ctx.currentTime + 0.001);
      const dur = def.duration || 0.04;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      const master = getMaster();
      if (master && (!master.context || master.context === ctx)) g.connect(master);
      else g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  function stopScheduler() {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = 0; }
    clickMode = 'off';
  }

  function runScheduler() {
    clickTimer = 0;
    if (clickMode === 'off') return;
    const ctx = getCtx();
    if (!ctx) { clickTimer = setTimeout(runScheduler, 25); return; }
    const interval = 60 / Math.max(40, bpm);
    const horizon = ctx.currentTime + 0.2;
    while (clickNextTime < horizon) {
      if (clickMode === 'metro') {
        playClickAt(clickNextTime, clickBeatIndex++);
        clickNextTime += interval;
      } else break;
    }
    if (clickMode !== 'off') clickTimer = setTimeout(runScheduler, 25);
  }

  function startMetro() {
    const ctx = getCtx();
    if (!ctx) return;
    stopScheduler();
    clickMode = 'metro';
    clickBeatIndex = 0;
    clickNextTime = ctx.currentTime + 0.05;
    runScheduler();
  }

  function applyLoopCrossfade(buffer, fadeSec) {
    if (!buffer || buffer.length < 64) return;
    const n = buffer.length;
    const fadeSamples = Math.max(8, Math.min(Math.floor((fadeSec || 0.055) * buffer.sampleRate), Math.floor(n / 3)));
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < fadeSamples; i++) {
        const env = i / fadeSamples;
        const a = Math.sin(env * Math.PI * 0.5);
        const b = Math.cos(env * Math.PI * 0.5);
        data[i] = data[i] * a + data[n - fadeSamples + i] * b;
      }
    }
  }

  function barDuration() {
    return beatsPerBar * (60 / Math.max(40, bpm));
  }

  function snapBufferToBars(buffer) {
    const ctx = getCtx();
    if (!ctx || !buffer) return buffer;
    const bar = barDuration();
    const nBars = Math.max(1, Math.round(buffer.duration / bar));
    const targetFrames = Math.max(1, Math.round(nBars * bar * buffer.sampleRate));
    if (targetFrames === buffer.length) return buffer;
    const out = ctx.createBuffer(2, targetFrames, buffer.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const src = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
      const dst = out.getChannelData(ch);
      if (src.length >= targetFrames) dst.set(src.subarray(0, targetFrames));
      else dst.set(src);
    }
    return out;
  }

  const seen = new WeakSet();
  let lastCount = 0;

  function processNewLayers(api) {
    const layers = api.layers;
    if (!layers) return;
    if (layers.length > lastCount) {
      for (let i = lastCount; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer?.buffer || seen.has(layer.buffer)) continue;
        const timing = api.getTimingState?.() || {};
        if (i === 0 && (timing.metronomeOn || timing.countInEnabled || window.__pionierMetroOn)) {
          try {
            const snapped = snapBufferToBars(layer.buffer);
            if (snapped !== layer.buffer) {
              layer.buffer = snapped;
              if (layer.source && !layer.paused) {
                try { layer.source.stop(); } catch (_) {}
                const ctx = getCtx();
                if (ctx && layer.gain) {
                  const src = ctx.createBufferSource();
                  src.buffer = layer.buffer;
                  src.loop = true;
                  src.connect(layer.gain);
                  src.start(ctx.currentTime, 0);
                  layer.source = src;
                  layer.startedAt = ctx.currentTime;
                  layer.offset = 0;
                }
              }
            }
          } catch (_) {}
        }
        try { applyLoopCrossfade(layer.buffer, 0.055); } catch (_) {}
        seen.add(layer.buffer);
      }
    }
    lastCount = layers.length;
    if (layers.length === 0) lastCount = 0;
  }

  function patchApi(api) {
    if (!api || api.__timingSeams) return;
    api.__timingSeams = true;

    const origSetMetro = typeof api.setMetronome === 'function' ? api.setMetronome.bind(api) : null;
    api.setMetronome = function (on) {
      if (origSetMetro) {
        try { origSetMetro(false); } catch (_) {}
      }
      if (on) startMetro();
      else stopScheduler();
    };

    const origSetBpm = typeof api.setBpm === 'function' ? api.setBpm.bind(api) : null;
    api.setBpm = function (value) {
      bpm = Math.max(40, Math.min(200, Math.round(Number(value) || 90)));
      if (origSetBpm) origSetBpm(value);
      if (clickMode === 'metro') startMetro();
    };

    setInterval(() => {
      try {
        const t = api.getTimingState?.();
        if (t?.bpm) bpm = t.bpm;
        if (t?.beatsPerBar) beatsPerBar = t.beatsPerBar;
        if (t?.clickType) clickType = t.clickType;
        if ((t?.metronomeOn || window.__pionierMetroOn) && clickMode === 'off') startMetro();
        if (!t?.metronomeOn && !window.__pionierMetroOn && clickMode === 'metro') stopScheduler();
        wireMetroCapture();
      } catch (_) {}
      processNewLayers(api);
    }, 200);
  }


  // Capture-phase metro toggle so we own scheduling (not setTimeout inside CDN looper).
  function wireMetroCapture() {
    const btn = document.getElementById('looperMetronomeBtn');
    if (!btn || btn.dataset.timingSeamsWired === '1') return;
    btn.dataset.timingSeamsWired = '1';
    btn.addEventListener('pointerup', (e) => {
      const api = window.PionierLooper;
      if (!api) return;
      e.preventDefault();
      e.stopPropagation();
      const t = api.getTimingState?.() || {};
      const next = !(t.metronomeOn || window.__pionierMetroOn);
      try { api.setMetronome?.(false); } catch (_) {}
      if (next) {
        startMetro();
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        try {
          const bpmVal = t.bpm || bpm;
          api.setBpm?.(bpmVal);
        } catch (_) {}
        window.__pionierMetroOn = true;
      } else {
        stopScheduler();
        window.__pionierMetroOn = false;
        btn.classList.remove('is-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    }, true);
  }

  function boot() {
    wireMetroCapture();
    if (window.PionierLooper) patchApi(window.PionierLooper);
  }

  const iv = setInterval(() => {
    if (window.PionierLooper) { patchApi(window.PionierLooper); clearInterval(iv); }
  }, 300);
  setTimeout(() => clearInterval(iv), 15000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
