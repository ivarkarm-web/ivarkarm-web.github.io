/**
 * soundscapes.js — scale-aware ambient landscapes for Pionier
 *
 * Three independent layers:
 *   Back  — drone / pulse / arp (rhythmic harmonic support)
 *   Pad   — soft / warm / deep (sustained atmospheric pad)
 *   Nature — rain / stream / forest / birds / storm / jungle
 */
import { getAudioContext, createBus, resumeAudio } from './audio-core.js';

/**
 * @param {{ getNotes: () => Array<{freq:number, midi?:number, name?:string}>, ensureAudio?: () => boolean }} opts
 */
export function createSoundscapes(opts = {}) {
  const getNotes = opts.getNotes || (() => []);
  const ensureAudio = opts.ensureAudio || (() => !!getAudioContext());

  let backingBus = null;
  let padBus = null;
  let natureBus = null;

  let backingMode = 'off';
  let padMode = 'off';
  let natureMode = 'off';

  let backingGain = 0.22;
  let padGain = 0.2;
  let natureGain = 0.24;

  let musicTimer = null;
  let musicStep = 0;
  let padTimer = null;
  let padStep = 0;
  let natureNodes = [];
  let natureTimers = [];

  function ctx() {
    return getAudioContext();
  }

  function ensureBuses() {
    if (!ensureAudio()) return false;
    const c = ctx();
    if (!c) return false;
    if (!backingBus) backingBus = createBus('soundscape-backing', 0);
    if (!padBus) padBus = createBus('soundscape-pad', 0);
    if (!natureBus) natureBus = createBus('soundscape-nature', 0);
    return !!(backingBus && padBus && natureBus);
  }

  function ramp(gainNode, value, time = 0.2) {
    const c = ctx();
    if (!gainNode || !c) return;
    const t = c.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setTargetAtTime(Math.max(0, Math.min(0.7, value)), t, time);
  }

  function clearNature() {
    for (const id of natureTimers) clearTimeout(id);
    natureTimers = [];
    for (const n of natureNodes) {
      try {
        if (n.stop) n.stop();
      } catch (_) {}
      try {
        if (n.disconnect) n.disconnect();
      } catch (_) {}
    }
    natureNodes = [];
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    musicStep = 0;
  }

  function stopPad() {
    if (padTimer) {
      clearInterval(padTimer);
      padTimer = null;
    }
    padStep = 0;
  }

  function freqs() {
    return (getNotes() || [])
      .map((n) => n.freq)
      .filter((f) => typeof f === 'number' && f > 20 && f < 8000);
  }

  function tone(bus, freq, level, dur, type = 'sine', when = null) {
    const c = ctx();
    if (!c || !bus || !freq) return;
    const t = when == null ? c.currentTime : when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.06);
  }

  function makeNoise(kind, seconds) {
    const c = ctx();
    const len = Math.max(1, Math.floor(c.sampleRate * seconds));
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.035 * w) / 1.035;
        d[i] = last * 3.1;
      } else if (kind === 'pink') {
        last = 0.985 * last + 0.015 * w;
        d[i] = last * 3.2;
      } else {
        d[i] = w;
      }
    }
    const s = c.createBufferSource();
    s.buffer = b;
    s.loop = true;
    return s;
  }

  function noiseLayer(bus, kind, cut, q, level) {
    const c = ctx();
    if (!c || !bus) return;
    const s = makeNoise(kind, 2);
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = 'lowpass';
    f.frequency.value = cut;
    f.Q.value = q || 0.2;
    g.gain.value = level;
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start();
    natureNodes.push(s, f, g);
  }

  // ── Back: drone / pulse / arp ─────────────────────────────────
  function musicTick() {
    if (backingMode === 'off' || !backingBus) return;
    const f = freqs();
    if (!f.length) return;
    const root = f[0];
    const now = ctx().currentTime;

    if (backingMode === 'drone') {
      if (musicStep % 8 === 0) {
        tone(backingBus, root * 0.5, 0.05, 3.6, 'sine', now);
        tone(backingBus, root, 0.026, 3.2, 'triangle', now);
      }
    } else if (backingMode === 'pulse') {
      const seq = [0, 2, 4, 2, 5, 4, 2, 1];
      const i = seq[musicStep % seq.length] % f.length;
      tone(backingBus, f[i], 0.05, 0.58, 'sine', now);
    } else if (backingMode === 'arp') {
      const seq = [0, 2, 4, 7, 4, 2, 1, 3];
      const i = seq[musicStep % seq.length] % f.length;
      tone(backingBus, f[i], 0.042, 0.45, 'triangle', now);
    }
    musicStep += 1;
  }

  function setBacking(mode) {
    const next = ['off', 'drone', 'pulse', 'arp'].includes(mode) ? mode : 'off';
    backingMode = next;
    stopMusic();
    if (next === 'off') {
      if (backingBus) ramp(backingBus, 0, 0.28);
      return;
    }
    if (!ensureBuses()) return;
    resumeAudio();
    ramp(backingBus, backingGain, 0.35);
    musicTick();
    const interval = next === 'arp' ? 420 : next === 'pulse' ? 620 : 900;
    musicTimer = setInterval(musicTick, interval);
  }

  // ── Pad: soft / warm / deep (sustained, scale-aware) ──────────
  function padTick() {
    if (padMode === 'off' || !padBus) return;
    const f = freqs();
    if (!f.length) return;
    const root = f[0];
    const now = ctx().currentTime;

    // Re-trigger long tones every ~16 steps so they evolve with scale changes
    if (padStep % 16 !== 0) {
      padStep += 1;
      return;
    }

    if (padMode === 'soft') {
      tone(padBus, root * 0.5, 0.032, 7.2, 'sine', now);
      tone(padBus, f[Math.min(2, f.length - 1)], 0.018, 6.8, 'sine', now);
    } else if (padMode === 'warm') {
      tone(padBus, root * 0.5, 0.038, 6.5, 'triangle', now);
      tone(padBus, root, 0.022, 6.2, 'sine', now);
      tone(padBus, f[Math.min(4, f.length - 1)], 0.016, 5.8, 'triangle', now);
    } else if (padMode === 'deep') {
      tone(padBus, root * 0.5, 0.045, 8.0, 'sine', now);
      tone(padBus, root * 0.25, 0.028, 7.5, 'sine', now);
      tone(padBus, f[Math.min(3, f.length - 1)], 0.014, 6.5, 'triangle', now);
    }
    padStep += 1;
  }

  function setPad(mode) {
    const next = ['off', 'soft', 'warm', 'deep'].includes(mode) ? mode : 'off';
    padMode = next;
    stopPad();
    if (next === 'off') {
      if (padBus) ramp(padBus, 0, 0.28);
      return;
    }
    if (!ensureBuses()) return;
    resumeAudio();
    ramp(padBus, padGain, 0.4);
    padTick();
    padTimer = setInterval(padTick, 900);
  }

  // ── Nature ────────────────────────────────────────────────────
  function chirp() {
    if (!['birds', 'forest', 'jungle'].includes(natureMode)) return;
    const freq = 900 + Math.random() * 1700;
    tone(natureBus, freq, 0.016, 0.11, 'sine');
    natureTimers.push(setTimeout(chirp, 1400 + Math.random() * 4200));
  }

  function thunder() {
    if (natureMode !== 'storm') return;
    const c = ctx();
    if (!c || !natureBus) return;
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, now);
    o.frequency.exponentialRampToValueAtTime(28, now + 2.5);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);
    o.connect(g);
    g.connect(natureBus);
    o.start(now);
    o.stop(now + 2.8);
    natureNodes.push(o, g);
    natureTimers.push(setTimeout(thunder, 8000 + Math.random() * 16000));
  }

  function setNature(mode) {
    const next = ['off', 'rain', 'stream', 'forest', 'birds', 'storm', 'jungle'].includes(mode)
      ? mode
      : 'off';
    natureMode = next;
    clearNature();
    if (next === 'off') {
      if (natureBus) ramp(natureBus, 0, 0.28);
      return;
    }
    if (!ensureBuses()) return;
    resumeAudio();
    ramp(natureBus, natureGain, 0.4);

    if (next === 'rain') {
      noiseLayer(natureBus, 'pink', 6800, 0.12, 0.026);
      noiseLayer(natureBus, 'pink', 1800, 0.25, 0.01);
    } else if (next === 'stream') {
      noiseLayer(natureBus, 'brown', 2600, 0.5, 0.045);
      noiseLayer(natureBus, 'pink', 5200, 0.18, 0.014);
    } else if (next === 'forest') {
      noiseLayer(natureBus, 'pink', 2400, 0.2, 0.012);
      chirp();
    } else if (next === 'birds') {
      chirp();
    } else if (next === 'storm') {
      noiseLayer(natureBus, 'brown', 1200, 0.5, 0.038);
      noiseLayer(natureBus, 'pink', 3600, 0.16, 0.014);
      thunder();
    } else if (next === 'jungle') {
      noiseLayer(natureBus, 'pink', 3000, 0.24, 0.018);
      noiseLayer(natureBus, 'brown', 900, 0.3, 0.014);
      chirp();
    }
  }

  function setBackingLevel(v) {
    backingGain = Math.max(0, Math.min(0.7, Number(v) || 0));
    if (backingMode !== 'off' && backingBus) ramp(backingBus, backingGain, 0.12);
  }

  function setPadLevel(v) {
    padGain = Math.max(0, Math.min(0.7, Number(v) || 0));
    if (padMode !== 'off' && padBus) ramp(padBus, padGain, 0.12);
  }

  function setNatureLevel(v) {
    natureGain = Math.max(0, Math.min(0.7, Number(v) || 0));
    if (natureMode !== 'off' && natureBus) ramp(natureBus, natureGain, 0.12);
  }

  /** Call when scale / root / octave changes so layers stay in tune. */
  function syncScale() {
    // freqs() is live on next tick — no restart needed
  }

  function stopAll() {
    setBacking('off');
    setPad('off');
    setNature('off');
  }

  return {
    setBacking,
    setPad,
    setNature,
    setBackingLevel,
    setPadLevel,
    setNatureLevel,
    syncScale,
    stopAll,
    get state() {
      return {
        backing: backingMode,
        pad: padMode,
        nature: natureMode,
        backingGain,
        padGain,
        natureGain
      };
    }
  };
}
