/**
 * backdrop-player.js — quiet synthesized beds under the handpan
 * Minimal transport: prev / play-pause / next + volume
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const TRACKS = [
  {
    id: 'mist',
    label: 'Mist Drone',
    build(ctx, dest) {
      const g = ctx.createGain();
      g.gain.value = 0.045;
      g.connect(dest);
      const freqs = [55, 82.5, 110, 165];
      const nodes = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = 0.22 - i * 0.04;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.02;
        const lg = ctx.createGain();
        lg.gain.value = 4 + i;
        lfo.connect(lg);
        lg.connect(o.frequency);
        o.connect(og);
        og.connect(g);
        o.start();
        lfo.start();
        return () => { try { o.stop(); lfo.stop(); } catch (_) {} };
      });
      return () => nodes.forEach((s) => s());
    }
  },
  {
    id: 'rain',
    label: 'Soft Rain',
    build(ctx, dest) {
      const g = ctx.createGain();
      g.gain.value = 0.028;
      g.connect(dest);
      const bufSize = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      src.connect(bp);
      bp.connect(lp);
      lp.connect(g);
      src.start();
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 49;
      const og = ctx.createGain();
      og.gain.value = 0.35;
      o.connect(og);
      og.connect(g);
      o.start();
      return () => { try { src.stop(); o.stop(); } catch (_) {} };
    }
  },
  {
    id: 'pulse',
    label: 'Warm Pulse',
    build(ctx, dest) {
      const g = ctx.createGain();
      g.gain.value = 0.04;
      g.connect(dest);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 65.4;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 98.0;
      const og = ctx.createGain();
      og.gain.value = 0.55;
      const o2g = ctx.createGain();
      o2g.gain.value = 0.28;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lg = ctx.createGain();
      lg.gain.value = 0.35;
      const base = ctx.createConstantSource();
      base.offset.value = 0.55;
      base.start();
      lfo.connect(lg);
      lg.connect(og.gain);
      base.connect(og.gain);
      o.connect(og);
      o2.connect(o2g);
      og.connect(g);
      o2g.connect(g);
      o.start();
      o2.start();
      lfo.start();
      return () => { try { o.stop(); o2.stop(); lfo.stop(); base.stop(); } catch (_) {} };
    }
  },
  {
    id: 'shimmer',
    label: 'High Shimmer',
    build(ctx, dest) {
      const g = ctx.createGain();
      g.gain.value = 0.022;
      g.connect(dest);
      const stops = [];
      [523.25, 659.25, 783.99, 987.77].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = 0.12;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07 + i * 0.03;
        const lg = ctx.createGain();
        lg.gain.value = 0.1;
        const c = ctx.createConstantSource();
        c.offset.value = 0.08;
        c.start();
        lfo.connect(lg);
        lg.connect(og.gain);
        c.connect(og.gain);
        o.connect(og);
        og.connect(g);
        o.start();
        lfo.start();
        stops.push(() => { try { o.stop(); lfo.stop(); c.stop(); } catch (_) {} });
      });
      const root = ctx.createOscillator();
      root.type = 'triangle';
      root.frequency.value = 87.3;
      const rg = ctx.createGain();
      rg.gain.value = 0.2;
      root.connect(rg);
      rg.connect(g);
      root.start();
      stops.push(() => { try { root.stop(); } catch (_) {} });
      return () => stops.forEach((s) => s());
    }
  },
  {
    id: 'deep',
    label: 'Deep Bed',
    build(ctx, dest) {
      const g = ctx.createGain();
      g.gain.value = 0.05;
      g.connect(dest);
      const stops = [];
      [36.7, 55, 73.4].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = 0.35 - i * 0.08;
        o.connect(og);
        og.connect(g);
        o.start();
        stops.push(() => { try { o.stop(); } catch (_) {} });
      });
      return () => stops.forEach((s) => s());
    }
  }
];

export function mountBackdropPlayer({ root } = {}) {
  const el = root || document.getElementById('backdropPlayer');
  if (!el || el.dataset.mounted === '1') return null;
  el.dataset.mounted = '1';

  const btnPrev = el.querySelector('[data-act="prev"]');
  const btnPlay = el.querySelector('[data-act="play"]');
  const btnNext = el.querySelector('[data-act="next"]');
  const nameEl = el.querySelector('[data-track-name]');
  const volEl = el.querySelector('[data-volume]');

  let index = 0;
  let playing = false;
  let stopCurrent = null;
  let bus = null;
  let volGain = null;

  function ensureGraph() {
    const ctx = getAudioContext();
    const master = getAudioMaster();
    if (!ctx || !master) return null;
    if (!bus) {
      bus = ctx.createGain();
      bus.gain.value = 1;
      volGain = ctx.createGain();
      volGain.gain.value = volEl ? Number(volEl.value) / 100 : 0.55;
      bus.connect(volGain);
      volGain.connect(master);
    }
    return ctx;
  }

  function setLabel() {
    if (nameEl) nameEl.textContent = TRACKS[index].label;
  }

  function setPlayUI() {
    if (!btnPlay) return;
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    btnPlay.textContent = playing ? '\u25AE\u25AE' : '\u25B6';
    btnPlay.classList.toggle('is-playing', playing);
  }

  function stop() {
    if (stopCurrent) {
      try { stopCurrent(); } catch (_) {}
      stopCurrent = null;
    }
  }

  function startTrack() {
    stop();
    const ctx = ensureGraph();
    if (!ctx || !bus) return;
    resumeAudio();
    try {
      stopCurrent = TRACKS[index].build(ctx, bus) || null;
    } catch (err) {
      console.warn('[backdrop] track failed', err);
      stopCurrent = null;
    }
  }

  function play() {
    playing = true;
    startTrack();
    setPlayUI();
  }

  function pause() {
    playing = false;
    stop();
    setPlayUI();
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function next() {
    index = (index + 1) % TRACKS.length;
    setLabel();
    if (playing) startTrack();
  }

  function prev() {
    index = (index - 1 + TRACKS.length) % TRACKS.length;
    setLabel();
    if (playing) startTrack();
  }

  btnPrev?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  btnPlay?.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  btnNext?.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  volEl?.addEventListener('input', () => {
    ensureGraph();
    if (volGain) volGain.gain.value = Number(volEl.value) / 100;
  });

  setLabel();
  setPlayUI();

  return { play, pause, next, prev, tracks: TRACKS };
}
