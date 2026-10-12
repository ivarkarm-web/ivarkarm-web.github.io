/**
 * backdrop-player.js — quiet synthesized beds under the handpan
 * Minimal transport: prev / play-pause / next + volume
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

/** Periodic noise with eased, zero-amplitude boundaries to avoid clicks at loop seams. */
export function createLoopingNoiseBuffer(ctx, seconds = 4) {
  const length = Math.max(8, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const fade = Math.min(Math.floor(ctx.sampleRate * 0.12), Math.floor(length / 4));
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  for (let i = 0; i < fade; i++) {
    const ramp = Math.sin((i / Math.max(1, fade - 1)) * Math.PI / 2);
    data[i] *= ramp;
    data[length - 1 - i] *= ramp;
  }
  data[0] = 0;
  data[length - 1] = 0;
  return buffer;
}

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
      const buf = createLoopingNoiseBuffer(ctx, 4);
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
  ,
  {
    id: 'storm',
    label: 'Storm Front',
    build(ctx, dest) {
      const out = ctx.createGain();
      out.gain.value = 0.065;
      out.connect(dest);
      const rumbleBuffer = createLoopingNoiseBuffer(ctx, 6);
      const rumbleSource = ctx.createBufferSource();
      rumbleSource.buffer = rumbleBuffer;
      rumbleSource.loop = true;
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 260;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.8;
      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(out);
      rumbleSource.start();
      const windBuffer = createLoopingNoiseBuffer(ctx, 5);
      const windSource = ctx.createBufferSource();
      windSource.buffer = windBuffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.35;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.12;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(out);
      windSource.start();
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = 38;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.12;
      sub.connect(subGain);
      subGain.connect(out);
      sub.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 22;
      lfo.connect(lfoGain);
      lfoGain.connect(sub.frequency);
      lfo.start();
      return () => {
        for (const node of [rumbleSource, windSource, sub, lfo]) { try { node.stop(); } catch (_) {} }
        try { out.disconnect(); } catch (_) {}
      };
    }
  },
  {
    id: 'forest-wind',
    label: 'Forest Wind',
    build(ctx, dest) {
      const out = ctx.createGain();
      out.gain.value = 0.035;
      out.connect(dest);
      const source = ctx.createBufferSource();
      source.buffer = createLoopingNoiseBuffer(ctx, 7);
      source.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 650;
      band.Q.value = 0.35;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 1500;
      source.connect(band);
      band.connect(low);
      low.connect(out);
      source.start();
      const gust = ctx.createOscillator();
      gust.type = 'sine';
      gust.frequency.value = 0.09;
      const gustGain = ctx.createGain();
      gustGain.gain.value = 0.022;
      gust.connect(gustGain);
      gustGain.connect(out.gain);
      gust.start();
      const lowWind = ctx.createOscillator();
      lowWind.type = 'sine';
      lowWind.frequency.value = 82;
      const lowWindGain = ctx.createGain();
      lowWindGain.gain.value = 0.12;
      lowWind.connect(lowWindGain);
      lowWindGain.connect(out);
      lowWind.start();
      return () => {
        for (const node of [source, gust, lowWind]) { try { node.stop(); } catch (_) {} }
        try { out.disconnect(); } catch (_) {}
      };
    }
  },
  {
    id: 'ocean-shore',
    label: 'Ocean Shore',
    build(ctx, dest) {
      const out = ctx.createGain();
      out.gain.value = 0.04;
      out.connect(dest);
      const source = ctx.createBufferSource();
      source.buffer = createLoopingNoiseBuffer(ctx, 8);
      source.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 1800;
      source.connect(low);
      low.connect(out);
      const foam = ctx.createBiquadFilter();
      foam.type = 'highpass';
      foam.frequency.value = 1400;
      const foamGain = ctx.createGain();
      foamGain.gain.value = 0.08;
      source.connect(foam);
      foam.connect(foamGain);
      foamGain.connect(out);
      source.start();
      const swell = ctx.createOscillator();
      swell.type = 'sine';
      swell.frequency.value = 0.055;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.018;
      swell.connect(swellGain);
      swellGain.connect(out.gain);
      swell.start();
      return () => {
        for (const node of [source, swell]) { try { node.stop(); } catch (_) {} }
        try { out.disconnect(); } catch (_) {}
      };
    }
  }

];

export const BACKDROP_TRACKS = TRACKS;

export function mountBackdropPlayer({ root } = {}) {
  const el = root || document.getElementById('backdropPlayer');
  if (!el || el.dataset.mounted === '1') return null;
  el.dataset.mounted = '1';

  const btnPrev = el.querySelector('[data-act="prev"]');
  const btnPlay = el.querySelector('[data-act="play"]');
  const btnNext = el.querySelector('[data-act="next"]');
  const nameEl = el.querySelector('[data-track-name]');
  const volEl = el.querySelector('[data-volume]');
  const btnMute = el.querySelector('[data-act="mute"]');

  let index = 0;
  let playing = false;
  let muted = false;
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
    el.dataset.trackId = TRACKS[index].id;
  }

  function setVolume() {
    const volume = volEl ? Number(volEl.value) / 100 : 0.55;
    if (volGain) volGain.gain.value = muted ? 0 : volume;
    el.dataset.muted = String(muted);
    if (btnMute) {
      btnMute.setAttribute('aria-pressed', String(muted));
      btnMute.setAttribute('aria-label', muted ? 'Unmute background audio' : 'Mute background audio');
      btnMute.textContent = muted ? '◌' : '♪';
    }
  }

  function setPlayUI() {
    if (!btnPlay) return;
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    btnPlay.textContent = playing ? '\u25AE\u25AE' : '\u25B6';
    btnPlay.classList.toggle('is-playing', playing);
    el.dataset.playing = String(playing);
  }

  function stop() {
    if (stopCurrent) {
      try { stopCurrent(); } catch (_) {}
      stopCurrent = null;
    }
  }

  function buildTrack(trackIndex, ctx) {
    try {
      stopCurrent = TRACKS[trackIndex].build(ctx, bus) || null;
      if (!stopCurrent) throw new Error('Track did not return a stop handler');
      el.dataset.error = 'false';
      return true;
    } catch (err) {
      console.warn('[backdrop] track failed', TRACKS[trackIndex]?.id, err);
      stopCurrent = null;
      return false;
    }
  }

  function startTrack() {
    stop();
    const ctx = ensureGraph();
    if (!ctx || !bus) {
      el.dataset.error = 'true';
      return false;
    }
    resumeAudio();
    if (buildTrack(index, ctx)) return true;
    if (index !== 0) {
      index = 0;
      setLabel();
      if (buildTrack(index, ctx)) return true;
    }
    el.dataset.error = 'true';
    return false;
  }

  function play() {
    playing = true;
    if (!startTrack()) playing = false;
    setPlayUI();
    setVolume();
  }

  function pause() {
    playing = false;
    stop();
    setPlayUI();
  }

  function toggleMute() {
    muted = !muted;
    setVolume();
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function next() {
    index = (index + 1) % TRACKS.length;
    setLabel();
    if (playing && !startTrack()) { playing = false; setPlayUI(); }
  }

  function prev() {
    index = (index - 1 + TRACKS.length) % TRACKS.length;
    setLabel();
    if (playing && !startTrack()) { playing = false; setPlayUI(); }
  }

  btnPrev?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  btnPlay?.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  btnNext?.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  btnMute?.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });
  volEl?.addEventListener('input', () => { ensureGraph(); setVolume(); });

  setLabel();
  setPlayUI();
  setVolume();
  el.dataset.error = 'false';

  const api = {
    play, pause, next, prev, toggleMute, tracks: TRACKS,
    getState: () => ({ playing, muted, trackId: TRACKS[index].id, volume: volEl ? Number(volEl.value) : 55, error: el.dataset.error === 'true' })
  };
  if (typeof window !== 'undefined') window.PionierBackdropPlayer = api;
  return api;
}
