/**
 * Radial waveform + playhead on looper layer circles (Loopify-style).
 * Reads window.PionierLooper.layers; paints into each .looper-circle button.
 */
(function () {
  if (window.__pionierLooperCircleProgress) return;
  window.__pionierLooperCircleProgress = true;

  const BINS = 48;
  const peakCache = new WeakMap();

  function computePeaks(buffer) {
    if (!buffer) return new Array(BINS).fill(0.08);
    if (peakCache.has(buffer)) return peakCache.get(buffer);
    const ch = buffer.getChannelData(0);
    const len = ch.length;
    const peaks = new Array(BINS);
    const step = Math.max(1, Math.floor(len / BINS));
    let max = 0.12;
    for (let i = 0; i < BINS; i++) {
      let peak = 0;
      const start = i * step;
      const end = Math.min(len, start + step);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > peak) peak = v;
      }
      const n = Math.min(1, peak * 2.4);
      peaks[i] = n;
      if (n > max) max = n;
    }
    for (let i = 0; i < BINS; i++) peaks[i] = Math.max(0.06, peaks[i] / max);
    peakCache.set(buffer, peaks);
    return peaks;
  }

  function drawRadial(canvas, peaks, progress01, opts) {
    if (!canvas || !peaks) return;
    const size = canvas.clientWidth || 42;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(28, Math.round(size * dpr));
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    const cx = px / 2;
    const cy = px / 2;
    const outer = px * 0.46;
    const inner = px * 0.22;
    const n = peaks.length;
    const muted = !!opts.muted;
    const paused = !!opts.paused;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((i + 0.72) / n) * Math.PI * 2;
      const t = (i + 0.5) / n;
      const lit = t <= progress01;
      const h = inner + (outer - inner) * peaks[i];
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner);
      g.lineTo(cx + Math.cos(a0) * h, cy + Math.sin(a0) * h);
      g.lineTo(cx + Math.cos(a1) * h, cy + Math.sin(a1) * h);
      g.lineTo(cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner);
      g.closePath();
      if (muted) g.fillStyle = 'rgba(180,180,190,0.22)';
      else if (paused) g.fillStyle = lit ? 'rgba(210,195,150,0.35)' : 'rgba(255,255,255,0.10)';
      else g.fillStyle = lit ? 'rgba(246,218,132,0.95)' : 'rgba(212,176,74,0.28)';
      g.fill();
    }
    if (!paused && !muted) {
      const ang = -Math.PI / 2 + progress01 * Math.PI * 2;
      g.strokeStyle = 'rgba(255,240,200,0.95)';
      g.lineWidth = Math.max(1.2, px * 0.03);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * (inner * 0.85), cy + Math.sin(ang) * (inner * 0.85));
      g.lineTo(cx + Math.cos(ang) * (outer + px * 0.02), cy + Math.sin(ang) * (outer + px * 0.02));
      g.stroke();
    }
  }

  function getCtx() {
    try {
      const c = window.PionierCore?.getAudioContext?.();
      if (c && c.state !== 'closed') return c;
    } catch (_) {}
    return null;
  }

  function layerPhase(layer, now) {
    if (!layer?.buffer) return 0;
    const dur = layer.buffer.duration || 1;
    if (layer.paused) return ((layer.offset || 0) % dur + dur) % dur;
    return ((now - (layer.startedAt || now)) % dur + dur) % dur;
  }

  function anySolo(layers) {
    return layers.some((l) => l.solo);
  }

  function effectiveMuted(layer, layers) {
    if (layer.muted) return true;
    if (anySolo(layers) && !layer.solo) return true;
    return false;
  }

  function ensureChrome(btn, index) {
    if (btn.dataset.radialReady === '1') return btn._radialCanvas;
    btn.dataset.radialReady = '1';
    btn.style.setProperty('--i', String(index));
    if (!btn.querySelector('.looper-circle-progress')) {
      const ring = document.createElement('span');
      ring.className = 'looper-circle-progress';
      ring.setAttribute('aria-hidden', 'true');
      btn.insertBefore(ring, btn.firstChild);
    }
    let canvas = btn.querySelector('.looper-circle-wave');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'looper-circle-wave';
      canvas.setAttribute('aria-hidden', 'true');
      btn.insertBefore(canvas, btn.querySelector('.looper-circle-core') || null);
    }
    let core = btn.querySelector('.looper-circle-core');
    if (!core) {
      core = document.createElement('span');
      core.className = 'looper-circle-core';
      core.textContent = String(index + 1);
      btn.appendChild(core);
    } else if (!/^\d+$/.test((core.textContent || '').trim())) {
      core.textContent = String(index + 1);
    }
    btn._radialCanvas = canvas;
    return canvas;
  }

  let raf = 0;
  let lastLayerCount = -1;

  function tick() {
    raf = requestAnimationFrame(tick);
    const api = window.PionierLooper;
    const layers = api?.layers;
    const rail = document.getElementById('looperLayers');
    if (!rail || !layers) return;

    const buttons = rail.querySelectorAll('.looper-circle');
    if (buttons.length !== lastLayerCount) {
      lastLayerCount = buttons.length;
      buttons.forEach((b) => { delete b.dataset.radialReady; });
    }
    if (!buttons.length) return;

    const ctx = getCtx();
    const now = ctx?.currentTime ?? performance.now() / 1000;
    const masterDur = layers[0]?.buffer?.duration || 0;
    const beat = masterDur > 0 ? masterDur / 4 : 0;

    buttons.forEach((btn, i) => {
      const layer = layers[i];
      if (!layer || !layer.buffer) return;
      const canvas = ensureChrome(btn, i);
      const dur = layer.buffer.duration || 1;
      const phase = layerPhase(layer, now);
      const p = Math.max(0, Math.min(1, phase / dur));
      btn.style.setProperty('--progress', String(p));
      const muted = effectiveMuted(layer, layers);
      btn.classList.toggle('is-dimmed', muted);
      btn.classList.toggle('is-paused', !!layer.paused);
      btn.classList.toggle('is-playing', !layer.paused);
      if (beat > 0.02 && !layer.paused && !muted) {
        btn.classList.toggle('is-beat', (phase % beat) < Math.min(0.09, beat * 0.18));
      } else {
        btn.classList.remove('is-beat');
      }
      const peaks = computePeaks(layer.buffer);
      drawRadial(canvas, peaks, p, { paused: !!layer.paused, muted });
    });
  }

  function boot() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 800);
  setTimeout(boot, 2500);
})();
