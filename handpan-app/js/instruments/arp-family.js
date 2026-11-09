/**
 * instruments/arp-family.js — 10 cinematic ambient arpeggiators
 *
 * Asymmetric phrasing · micro-tonal drift · darkening diffusion delay
 * Output → local diffusion → instrument bus → master FX
 */
import { Instrument } from '../instrument.js';
import { getSharedScheduler } from '../sound/scheduler.js';

const MAX_PADS = 14;
const VOICE_POOL = 16;

/* ---------- helpers ---------- */

function safeExp(g, v, t) {
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t);
}

function cents() {
  return (Math.random() * 10 - 5); // -5 .. +5
}

function envGain(ctx, t0, {
  peak = 0.18, attack = 0.1, decay = 0.5, sustain = 0.35, release = 2.5, hold = 0.2
} = {}) {
  const g = ctx.createGain();
  const p = Math.max(0.0001, peak);
  g.gain.setValueAtTime(0.0001, t0);
  safeExp(g, p, t0 + Math.max(0.008, attack));
  const tDec = t0 + attack + decay;
  safeExp(g, Math.max(0.0001, p * sustain), tDec);
  g.gain.setValueAtTime(Math.max(0.0001, p * sustain), tDec + hold);
  safeExp(g, 0.0001, tDec + hold + release);
  return g;
}

/** Darkening feedback diffusion delay (per-note local space). */
function diffusion(ctx, t0, {
  delayTime = 0.35,
  feedback = 0.45,
  lpFreq = 2200,
  wet = 0.4,
  stereo = false
} = {}) {
  const input = ctx.createGain();
  input.gain.value = 1;

  const del = ctx.createDelay(2.5);
  del.delayTime.setValueAtTime(delayTime, t0);

  const fb = ctx.createGain();
  fb.gain.setValueAtTime(feedback, t0);
  safeExp(fb, 0.0001, t0 + 4.5);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(lpFreq, t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, lpFreq * 0.35), t0 + 3.5);
  lp.Q.value = 0.5;

  const wetG = ctx.createGain();
  wetG.gain.value = wet;

  input.connect(del);
  del.connect(lp);
  lp.connect(fb);
  fb.connect(del);
  del.connect(wetG);

  // Optional simple ping-pong via delay time wobble on a second line
  if (stereo) {
    const del2 = ctx.createDelay(2.5);
    del2.delayTime.setValueAtTime(delayTime * 1.33, t0);
    const fb2 = ctx.createGain();
    fb2.gain.setValueAtTime(feedback * 0.85, t0);
    safeExp(fb2, 0.0001, t0 + 4.5);
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.setValueAtTime(lpFreq * 0.8, t0);
    const panL = ctx.createStereoPanner();
    panL.pan.setValueAtTime(-0.7, t0);
    const panR = ctx.createStereoPanner();
    panR.pan.setValueAtTime(0.7, t0);
    const w2 = ctx.createGain();
    w2.gain.value = wet * 0.9;

    input.connect(del2);
    del2.connect(lp2);
    lp2.connect(fb2);
    fb2.connect(del2);
    del.connect(panL);
    del2.connect(panR);
    panL.connect(wetG);
    panR.connect(w2);

    return {
      input,
      connect(dest) {
        wetG.connect(dest);
        w2.connect(dest);
      }
    };
  }

  return {
    input,
    connect(dest) {
      wetG.connect(dest);
    }
  };
}

function createLfo(ctx, rateHz, depth) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = rateHz;
  const g = ctx.createGain();
  g.gain.value = depth;
  osc.connect(g);
  osc.start();
  return { osc, out: g, stop() { try { osc.stop(); } catch (_) {} } };
}

function acquireVoice(pool, now) {
  let best = pool[0];
  let bestT = best?.freeAt ?? 0;
  for (let i = 1; i < pool.length; i++) {
    const v = pool[i];
    if ((v.freeAt ?? 0) <= now) return v;
    if ((v.freeAt ?? 0) < bestT) { best = v; bestT = v.freeAt; }
  }
  return best;
}

function scaleFreqs(pitches) {
  return (pitches || []).filter(Boolean).map((p) => p.freq).filter((f) => f > 20 && f < 12000);
}

function pickBase(pitches, zoneIdx) {
  const live = (pitches || []).filter(Boolean);
  if (!live.length) return 0;
  return Math.max(0, Math.min(zoneIdx, live.length - 1));
}

function osc(ctx, type, freq, t0, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.detune.setValueAtTime(detune + cents(), t0);
  return o;
}

/* ---------- voice players (original 5, upgraded) ---------- */

function playAether(ctx, dest, { freq, t0, vel, lfo }) {
  const release = 3.2;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = 700 + vel * 2600;
  filter.frequency.setValueAtTime(bright * 0.35, t0);
  filter.frequency.linearRampToValueAtTime(bright, t0 + 1.1);
  filter.frequency.linearRampToValueAtTime(bright * 0.5, t0 + 2.8);
  if (lfo) try { lfo.connect(filter.frequency); } catch (_) {}

  const g = envGain(ctx, t0, {
    peak: 0.09 + 0.14 * vel, attack: 0.22, decay: 0.7, sustain: 0.4, release, hold: 0.7
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.42, feedback: 0.48, lpFreq: 2400, wet: 0.45 });

  const o1 = osc(ctx, 'triangle', freq, t0);
  const o2 = osc(ctx, 'sine', freq * 2, t0, 8);
  const o3 = osc(ctx, 'sine', freq * 1.498, t0, -6);
  const m1 = ctx.createGain(); m1.gain.value = 0.7;
  const m2 = ctx.createGain(); m2.gain.value = 0.26;
  const m3 = ctx.createGain(); m3.gain.value = 0.12;
  o1.connect(m1); o2.connect(m2); o3.connect(m3);
  m1.connect(filter); m2.connect(filter); m3.connect(filter);
  filter.connect(g);
  g.connect(dest);
  g.connect(diff.input);
  diff.connect(dest);

  const stopAt = t0 + release + 1.2;
  for (const o of [o1, o2, o3]) { o.start(t0); o.stop(stopAt); }
  return stopAt;
}

function playPrism(ctx, dest, { freq, t0, vel }) {
  const release = 2.4;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600 + vel * 4500, t0);
  const g = envGain(ctx, t0, {
    peak: 0.1 + 0.16 * vel, attack: 0.01, decay: 0.3, sustain: 0.22, release, hold: 0.1
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.3 + Math.random() * 0.15, feedback: 0.5, lpFreq: 3200, wet: 0.5 });

  const o1 = osc(ctx, 'triangle', freq, t0);
  const o2 = osc(ctx, 'sine', freq * 2.01, t0, 10);
  const mix = ctx.createGain(); mix.gain.value = 1;
  o1.connect(mix);
  const g2 = ctx.createGain(); g2.gain.value = 0.32; o2.connect(g2); g2.connect(mix);
  mix.connect(filter); filter.connect(g);
  g.connect(dest); g.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 3;
  o1.start(t0); o2.start(t0); o1.stop(stopAt); o2.stop(stopAt);
  return stopAt;
}

function playZen(ctx, dest, { freq, t0, vel, peak }) {
  const release = peak ? 4.0 : 3.0;
  const ratios = [1, 2.76, 5.40, 8.93];
  const amps = [1, 0.55, 0.28, 0.12];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime((peak ? 2000 : 1300) + vel * 2800, t0);
  const g = envGain(ctx, t0, {
    peak: (peak ? 0.14 : 0.1) + 0.1 * vel, attack: 0.3, decay: 1.0, sustain: 0.38, release, hold: 0.5
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.55, feedback: 0.42, lpFreq: 1800, wet: 0.4 });

  const stopAt = t0 + release + 1.5;
  ratios.forEach((r, i) => {
    const beat = (i + 1) * 0.12;
    const o = osc(ctx, 'sine', freq * r - beat, t0);
    const pg = ctx.createGain(); pg.gain.value = amps[i] * (i === 0 ? 1 : 0.5 + 0.5 * vel);
    o.connect(pg); pg.connect(filter); o.start(t0); o.stop(stopAt);
    if (i < 3) {
      const oB = osc(ctx, 'sine', freq * r + beat, t0);
      const pgB = ctx.createGain(); pgB.gain.value = amps[i] * 0.65 * (0.5 + 0.5 * vel);
      oB.connect(pgB); pgB.connect(filter); oB.start(t0); oB.stop(stopAt);
    }
  });
  filter.connect(g); g.connect(dest); g.connect(diff.input); diff.connect(dest);
  return stopAt;
}

function playShamanic(ctx, dest, { freq, t0, vel }) {
  const release = 2.8;
  const fund = Math.max(40, freq * 0.5);
  const o = osc(ctx, 'sine', fund * 1.12, t0);
  o.frequency.exponentialRampToValueAtTime(fund, t0 + 0.1);
  const body = envGain(ctx, t0, {
    peak: 0.2 + 0.18 * vel, attack: 0.025, decay: 0.2, sustain: 0.22, release, hold: 0.12
  });
  o.connect(body);

  const len = Math.floor(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(110 + vel * 160, t0); bp.Q.value = 0.85;
  const noiseG = envGain(ctx, t0, {
    peak: 0.1 * vel, attack: 0.006, decay: 0.07, sustain: 0, release: 0.12, hold: 0.02
  });
  src.connect(bp); bp.connect(noiseG);

  const diff = diffusion(ctx, t0, { delayTime: 0.6, feedback: 0.4, lpFreq: 900, wet: 0.45 });
  body.connect(dest); noiseG.connect(dest);
  body.connect(diff.input); noiseG.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 4;
  o.start(t0); o.stop(stopAt); src.start(t0); src.stop(t0 + 0.18);
  return stopAt;
}

function playHarp(ctx, dest, { freq, t0, vel }) {
  const release = 2.6;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1300 + vel * 4000, t0);
  const g = envGain(ctx, t0, {
    peak: 0.1 + 0.14 * vel, attack: 0.014, decay: 0.4, sustain: 0.25, release, hold: 0.15
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.38, feedback: 0.4, lpFreq: 2800, wet: 0.38 });

  const stopAt = t0 + release + 1;
  for (const [ratio, amp] of [[1, 1], [2.003, 0.38], [3.01, 0.14], [4.02, 0.05]]) {
    const o = osc(ctx, ratio === 1 ? 'triangle' : 'sine', freq * ratio, t0);
    const pg = ctx.createGain(); pg.gain.value = amp;
    o.connect(pg); pg.connect(filter); o.start(t0); o.stop(stopAt);
  }
  filter.connect(g); g.connect(dest); g.connect(diff.input); diff.connect(dest);
  return stopAt;
}

/* ---------- voice players (new 5) ---------- */

function playSolarNebula(ctx, dest, { freq, t0, vel, lfo }) {
  const release = 4.0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = 500 + vel * 2200;
  filter.frequency.setValueAtTime(bright * 0.3, t0);
  filter.frequency.linearRampToValueAtTime(bright, t0 + 1.6);
  filter.frequency.linearRampToValueAtTime(bright * 0.45, t0 + 3.5);
  if (lfo) try { lfo.connect(filter.frequency); } catch (_) {}

  const g = envGain(ctx, t0, {
    peak: 0.08 + 0.12 * vel, attack: 0.4, decay: 1.0, sustain: 0.45, release, hold: 1.0
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.5, feedback: 0.52, lpFreq: 2000, wet: 0.5 });

  // Warm sub + glass overtones
  const sub = osc(ctx, 'sine', Math.max(40, freq * 0.5), t0);
  const fund = osc(ctx, 'triangle', freq, t0);
  const glass = osc(ctx, 'sine', freq * 2.76, t0, 12);
  const air = osc(ctx, 'sine', freq * 5.4, t0, -8);
  const gs = ctx.createGain(); gs.gain.value = 0.55;
  const gf = ctx.createGain(); gf.gain.value = 0.5;
  const gg = ctx.createGain(); gg.gain.value = 0.2;
  const ga = ctx.createGain(); ga.gain.value = 0.08;
  sub.connect(gs); fund.connect(gf); glass.connect(gg); air.connect(ga);
  gs.connect(filter); gf.connect(filter); gg.connect(filter); ga.connect(filter);
  filter.connect(g); g.connect(dest); g.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 1.5;
  for (const o of [sub, fund, glass, air]) { o.start(t0); o.stop(stopAt); }
  return stopAt;
}

function playAncientEchoes(ctx, dest, { freq, t0, vel }) {
  const release = 3.0;
  // Breathy flute layer
  const nLen = Math.floor(ctx.sampleRate * 0.35);
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1);
  const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
  const nBp = ctx.createBiquadFilter(); nBp.type = 'bandpass';
  nBp.frequency.setValueAtTime(freq * 2.2, t0); nBp.Q.value = 0.7;
  const nG = envGain(ctx, t0, {
    peak: 0.06 + 0.08 * vel, attack: 0.05, decay: 0.2, sustain: 0.15, release: 1.2, hold: 0.15
  });
  nSrc.connect(nBp); nBp.connect(nG);

  // Hollow mallet / wooden body
  const o = osc(ctx, 'sine', freq, t0);
  const o2 = osc(ctx, 'triangle', freq * 2.01, t0);
  const body = envGain(ctx, t0, {
    peak: 0.12 + 0.14 * vel, attack: 0.02, decay: 0.35, sustain: 0.2, release, hold: 0.2
  });
  const m2 = ctx.createGain(); m2.gain.value = 0.25;
  o.connect(body); o2.connect(m2); m2.connect(body);

  const diff = diffusion(ctx, t0, {
    delayTime: 0.48, feedback: 0.55, lpFreq: 1600, wet: 0.55, stereo: true
  });

  nG.connect(dest); body.connect(dest);
  nG.connect(diff.input); body.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 4;
  nSrc.start(t0); nSrc.stop(t0 + 0.4);
  o.start(t0); o2.start(t0); o.stop(stopAt); o2.stop(stopAt);
  return stopAt;
}

function playChronos(ctx, dest, { freq, t0, vel, lfo }) {
  const release = 4.5;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = 400 + vel * 1800;
  filter.frequency.setValueAtTime(200, t0);
  filter.frequency.linearRampToValueAtTime(bright, t0 + 1.8);
  filter.frequency.linearRampToValueAtTime(bright * 0.4, t0 + 4);
  if (lfo) try { lfo.connect(filter.frequency); } catch (_) {}

  const g = envGain(ctx, t0, {
    peak: 0.07 + 0.1 * vel, attack: 0.8, decay: 1.2, sustain: 0.5, release, hold: 1.2
  });
  const diff = diffusion(ctx, t0, { delayTime: 0.7, feedback: 0.4, lpFreq: 1400, wet: 0.4 });

  // Friction string: detuned saw/triangle stack
  const layers = [
    ['sawtooth', freq, 0.4],
    ['triangle', freq * 1.002, 0.35],
    ['sawtooth', freq * 0.998, 0.25],
    ['sine', freq * 2.003, 0.12]
  ];
  const stopAt = t0 + release + 1.5;
  for (const [type, f, amp] of layers) {
    const o = osc(ctx, type, f, t0);
    const pg = ctx.createGain(); pg.gain.value = amp;
    o.connect(pg); pg.connect(filter); o.start(t0); o.stop(stopAt);
  }
  filter.connect(g); g.connect(dest); g.connect(diff.input); diff.connect(dest);
  return stopAt;
}

function playAbyssal(ctx, dest, { freq, t0, vel }) {
  const release = 3.0;
  const subF = Math.min(freq, Math.max(35, freq * 0.5));
  const o = osc(ctx, 'sine', subF * 1.08, t0);
  o.frequency.exponentialRampToValueAtTime(subF, t0 + 0.12);
  const body = envGain(ctx, t0, {
    peak: 0.28 + 0.2 * vel, attack: 0.04, decay: 0.25, sustain: 0.3, release, hold: 0.15
  });
  o.connect(body);

  // Distant clockwork click
  const cLen = Math.floor(ctx.sampleRate * 0.025);
  const cBuf = ctx.createBuffer(1, cLen, ctx.sampleRate);
  const cd = cBuf.getChannelData(0);
  for (let i = 0; i < cLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cLen * 0.2));
  const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
  const cBp = ctx.createBiquadFilter(); cBp.type = 'bandpass';
  cBp.frequency.setValueAtTime(1800 + vel * 1200, t0); cBp.Q.value = 2.5;
  const cG = envGain(ctx, t0, {
    peak: 0.04 + 0.04 * vel, attack: 0.001, decay: 0.02, sustain: 0, release: 0.04, hold: 0.005
  });
  cSrc.connect(cBp); cBp.connect(cG);

  const diff = diffusion(ctx, t0, { delayTime: 0.72, feedback: 0.38, lpFreq: 600, wet: 0.4 });
  body.connect(dest); cG.connect(dest);
  body.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 4;
  o.start(t0); o.stop(stopAt); cSrc.start(t0); cSrc.stop(t0 + 0.05);
  return stopAt;
}

function playPrismCascade(ctx, dest, { freq, t0, vel }) {
  const release = 1.8;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2500 + vel * 5500, t0);
  const g = envGain(ctx, t0, {
    peak: 0.08 + 0.12 * vel, attack: 0.004, decay: 0.15, sustain: 0.15, release, hold: 0.05
  });
  const diff = diffusion(ctx, t0, {
    delayTime: 0.22 + Math.random() * 0.12, feedback: 0.48, lpFreq: 4000, wet: 0.55
  });

  const o1 = osc(ctx, 'sine', freq, t0);
  const o2 = osc(ctx, 'triangle', freq * 2.02, t0, 14);
  const m2 = ctx.createGain(); m2.gain.value = 0.3;
  o1.connect(filter); o2.connect(m2); m2.connect(filter);
  filter.connect(g); g.connect(dest); g.connect(diff.input); diff.connect(dest);

  const stopAt = t0 + release + 2.5;
  o1.start(t0); o2.start(t0); o1.stop(stopAt); o2.stop(stopAt);
  return stopAt;
}

/* ---------- arp definitions (10) ---------- */

/**
 * Each def may supply:
 *   rhythmBeats: number[] — beats per pattern step (asymmetric)
 *   polyClocks: [{ every: number, phase?: number }] — fire on multiple grids
 *   bounce: { startBeats, endBeats, steps } — decelerating cascade
 *   nextFireAt on pad state is managed by ArpInstrument
 */

const ARP_DEFS = [
  {
    id: 'aether_ripple', name: 'Aether Ripple',
    desc: 'Lush shimmer pad — floating dotted phrasing, Root→5th→Oct→2oct.',
    bpm: 60, mode: 'loop',
    rhythmBeats: [1.5, 0.5, 1.0, 1.0, 1.5, 0.5, 2.0, 1.0],
    pattern(_b, step) {
      const map = [0, 0, 4, 4, 7, 7, 12, 12];
      return { rel: map[step % 8], velMul: 0.7 + 0.05 * (step % 4) };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 220;
      if (rel <= 0) return freqs[baseIdx];
      if (rel <= 4) return freqs[Math.min(baseIdx + Math.max(2, Math.floor(freqs.length * 0.4)), freqs.length - 1)];
      if (rel <= 7) return freqs[baseIdx] * 2;
      return freqs[baseIdx] * 4;
    },
    play: playAether, lfoRate: 0.06, lfoDepth: 160
  },
  {
    id: 'prism_shards', name: 'Prism Shards',
    desc: 'Glassy ambient plucks with darkening echo trails.',
    bpm: 78, mode: 'loop',
    rhythmBeats: [0.75, 0.75, 1.5, 0.5, 0.5, 1.0, 0.75, 1.25],
    pattern(_b, step) {
      return { rel: 0, velMul: 0.55 + 0.35 * ((step * 13) % 5) / 5, randomWalk: true };
    },
    resolve(freqs, baseIdx, _r, walk) {
      if (!freqs.length) return 440;
      return freqs[Math.max(0, Math.min(freqs.length - 1, walk ?? baseIdx))];
    },
    play: playPrism, lfoRate: 0.1, lfoDepth: 80
  },
  {
    id: 'zen_pendulum', name: 'Zen Pendulum',
    desc: 'Singing-bowl pendulum with multi-bar metallic ring.',
    bpm: 52, mode: 'loop',
    rhythmBeats: [2.0, 1.5, 2.0, 2.5, 2.0, 1.5],
    pattern(_b, step) {
      const seq = [0, 1, 2, 3, 2, 1];
      const s = seq[step % 6];
      return { rel: s, velMul: s === 3 ? 1 : 0.6 + s * 0.08, peak: s === 3 };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 330;
      return freqs[Math.min(baseIdx + rel, freqs.length - 1)];
    },
    play: playZen, lfoRate: 0.045, lfoDepth: 110
  },
  {
    id: 'shamanic_pulse', name: 'Shamanic Pulse',
    desc: 'Soft organic heartbeat with distant darkening echo.',
    bpm: 68, mode: 'loop',
    rhythmBeats: [1.5, 0.5, 1.0, 0.75, 1.25, 1.0, 0.5, 1.5],
    pattern(_b, step, bar) {
      // Keep most hits but with asymmetric spacing already in rhythm
      const accent = step % 8 === 0 || step % 8 === 4;
      return {
        rel: 0,
        velMul: accent ? 0.95 : 0.55,
        pitchShift: Math.floor(bar / 4) % 2 === 1 ? -0.5 : 0
      };
    },
    resolve(freqs, baseIdx, _r, _w, pitchShift = 0) {
      if (!freqs.length) return 80;
      const f = freqs[Math.min(baseIdx, Math.floor(freqs.length * 0.35))];
      return f * Math.pow(2, pitchShift / 12);
    },
    play: playShamanic, lfoRate: 0.04, lfoDepth: 35
  },
  {
    id: 'harp_cascade', name: 'Harp Cascade',
    desc: 'Rolling up/down scale cascade with long string tails.',
    bpm: 72, mode: 'loop',
    rhythmBeats: [0.5, 0.5, 0.75, 0.5, 0.5, 1.0, 0.5, 0.5, 0.75, 0.5, 0.5, 1.25],
    pattern(_b, step) {
      const s = step % 12;
      const rel = s < 6 ? s : (11 - s);
      return { rel, velMul: 0.85 - Math.abs(rel - 2.5) * 0.06 };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 440;
      return freqs[Math.min(baseIdx + rel, freqs.length - 1)];
    },
    play: playHarp, lfoRate: 0.08, lfoDepth: 60
  },
  /* ---- NEW 5 ---- */
  {
    id: 'solar_nebula', name: 'Solar Nebula',
    desc: 'Polyrhythmic shimmer pad — 3-against-4 dual wave, 4s release.',
    bpm: 56, mode: 'loop',
    // Dual clocks: fire on every 3 sixteenths AND every 4 sixteenths
    polyClocks: [{ every: 3, phase: 0 }, { every: 4, phase: 1 }],
    pattern(_b, step) {
      const map = [0, 4, 7, 12, 7, 4];
      return { rel: map[step % 6], velMul: 0.65 + 0.1 * (step % 3) };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 200;
      if (rel <= 0) return freqs[baseIdx];
      if (rel <= 4) return freqs[Math.min(baseIdx + Math.max(2, Math.floor(freqs.length * 0.35)), freqs.length - 1)];
      if (rel <= 7) return freqs[baseIdx] * 2;
      return freqs[baseIdx] * 4;
    },
    play: playSolarNebula, lfoRate: 0.05, lfoDepth: 200
  },
  {
    id: 'ancient_echoes', name: 'Ancient Echoes',
    desc: 'Breathy flute + wooden mallet improvisation with ping-pong delay.',
    bpm: 58, mode: 'loop',
    rhythmBeats: [2.0, 1.0, 1.5, 2.5, 1.0, 2.0],
    pattern(_b, step) {
      // Skip random scale intervals (improvised pendulum)
      const jumps = [0, 1, 3, 2, 4, 1, 3, 0, 2, 5, 3, 1];
      const rel = jumps[step % jumps.length];
      return { rel, velMul: 0.55 + 0.35 * Math.random() };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 300;
      return freqs[Math.min(baseIdx + rel, freqs.length - 1)];
    },
    play: playAncientEchoes, lfoRate: 0.07, lfoDepth: 50
  },
  {
    id: 'chronos_string', name: 'Chronos String Swell',
    desc: 'Slow overlapping bowed swells — Root / sus4 / 7th of the scale.',
    bpm: 48, mode: 'loop',
    rhythmBeats: [3.0, 3.5, 4.0],
    pattern(_b, step) {
      // 0 = root, ~4th degree, ~7th-ish degree within scale array
      const map = [0, 3, 5];
      return { rel: map[step % 3], velMul: 0.75 };
    },
    resolve(freqs, baseIdx, rel) {
      if (!freqs.length) return 220;
      const i = Math.min(baseIdx + rel, freqs.length - 1);
      return freqs[i];
    },
    play: playChronos, lfoRate: 0.035, lfoDepth: 140
  },
  {
    id: 'abyssal_pulse', name: 'Abyssal Pulse',
    desc: 'Deep cinematic sub-bass clockwork — low-register heartbeat anchor.',
    bpm: 64, mode: 'loop',
    rhythmBeats: [1.5, 0.5, 2.0, 1.0, 0.75, 1.25],
    pattern(_b, step) {
      const accent = step % 6 === 0;
      return { rel: 0, velMul: accent ? 1 : 0.5, forceLow: true };
    },
    resolve(freqs, baseIdx) {
      if (!freqs.length) return 55;
      // Stay in low register (approx D2–D3)
      let f = freqs[Math.min(baseIdx, Math.floor(freqs.length * 0.3))];
      while (f > 160) f *= 0.5;
      while (f < 40) f *= 2;
      return f;
    },
    play: playAbyssal, lfoRate: 0.03, lfoDepth: 25
  },
  {
    id: 'prism_cascade', name: 'Prism Cascade',
    desc: 'Crystalline micro-notes — bouncing-ball tempo that slows then loops.',
    bpm: 90, mode: 'loop',
    bounce: { steps: 12, startBeats: 0.2, endBeats: 1.4 },
    pattern(_b, step) {
      return { rel: 0, velMul: 0.7 - (step % 12) * 0.04, randomPick: true };
    },
    resolve(freqs, baseIdx, _r, walk) {
      if (!freqs.length) return 600;
      if (walk != null) return freqs[walk];
      return freqs[Math.floor(Math.random() * freqs.length)];
    },
    play: playPrismCascade, lfoRate: 0.12, lfoDepth: 70
  }
];

/* ---------- ArpInstrument ---------- */

class ArpInstrument extends Instrument {
  constructor(def) {
    super({
      id: def.id, name: def.name, description: def.desc,
      category: 'arp', polyphony: MAX_PADS,
      compatibleFx: ['compressor', 'delay', 'reverb', 'filter']
    });
    this.def = def;
    this.pitches = [];
    this.scheduler = null;
    this._unsub = null;
    this._pads = new Map();
    this._voicePool = [];
    this._lfo = null;
    this.glow = new Float32Array(MAX_PADS);
    this.zoneFlash = new Float32Array(MAX_PADS);
    this.heldPad = new Uint8Array(MAX_PADS);
    this.lastStrikeAt = new Map();
  }

  async activate(audioCtx, bus) {
    await super.activate(audioCtx, bus);
    this.scheduler = getSharedScheduler(audioCtx, { bpm: this.def.bpm });
    this.scheduler.setBpm(this.def.bpm);
    if (!this.scheduler.isRunning) this.scheduler.start();
    if (!this._lfo && this.def.lfoRate) {
      this._lfo = createLfo(audioCtx, this.def.lfoRate, this.def.lfoDepth || 100);
    }
    this._voicePool = Array.from({ length: VOICE_POOL }, () => ({ freeAt: 0 }));
    if (!this._unsub) {
      this._unsub = this.scheduler.onTick((ev) => this._onClock(ev));
    }
  }

  deactivate() {
    this.dampAll();
    if (this._unsub) { this._unsub(); this._unsub = null; }
    if (this._lfo) { this._lfo.stop(); this._lfo = null; }
    super.deactivate();
  }

  setMusicalContext(notes) {
    const list = (notes || []).slice(0, MAX_PADS);
    this.pitches = new Array(MAX_PADS).fill(null);
    list.forEach((n, i) => {
      const idx = n.index != null && n.index >= 0 && n.index < MAX_PADS ? n.index : i;
      this.pitches[idx] = { midi: n.midi, freq: n.freq, name: n.name, kind: n.kind, index: idx };
    });
  }

  getNotes() { return this.pitches.filter(Boolean).slice(); }

  noteOn(gesture = {}, zone = {}) {
    if (!this.audioCtx || !this.bus) return;
    if (!this.ready) this._ready = true;
    const idx = zone.index ?? zone.idx ?? 0;
    if (idx < 0 || idx >= MAX_PADS) return;

    const vel = Math.max(0.12, Math.min(1, gesture.velocity ?? 0.72));
    const baseIdx = pickBase(this.pitches, idx);
    const now = this.audioCtx.currentTime;

    this._pads.set(idx, {
      idx, baseIdx, vel, walk: baseIdx, step: 0, released: false,
      nextFireAt: now, // asymmetric / bounce schedule
      bouncePhase: 0
    });
    this.heldPad[idx] = 1;
    this.glow[idx] = Math.min(1, 0.5 + vel * 0.45);
    this.zoneFlash[idx] = zone.radial ?? 0.4;
    this.lastStrikeAt.set(idx, performance.now());

    if (this.scheduler && !this.scheduler.isRunning) this.scheduler.start();
    this._trigger(this._pads.get(idx), now + 0.01, 0, 0);
    this._advanceSchedule(this._pads.get(idx), now + 0.01);
  }

  noteOff(idx) {
    this.heldPad[idx] = 0;
    if (this.glow[idx] > 0.15) this.glow[idx] = Math.min(this.glow[idx], 0.28);
    const state = this._pads.get(idx);
    if (state) state.released = true;
  }

  noteMove(idx, gesture = {}) {
    if (idx < 0 || idx >= MAX_PADS || !this.heldPad[idx]) return;
    const p = Math.max(0, Math.min(1, gesture.pressure || gesture.force || 0));
    this.glow[idx] = Math.min(1, Math.max(this.glow[idx], 0.25 + p * 0.5));
  }

  dampAll() {
    this.heldPad.fill(0);
    for (const s of this._pads.values()) s.released = true;
    this._pads.clear();
  }

  tickGlow() {
    let active = false;
    for (let i = 0; i < MAX_PADS; i++) {
      if (this.glow[i] > 0.001) { this.glow[i] *= this.heldPad[i] ? 0.95 : 0.88; active = true; }
      else this.glow[i] = 0;
      if (this.zoneFlash[i] > 0.001) { this.zoneFlash[i] *= 0.87; active = true; }
      else this.zoneFlash[i] = 0;
    }
    return active;
  }

  /** Compute next inter-onset interval in seconds for this pad. */
  _stepDuration(state) {
    const def = this.def;
    const bpm = this.scheduler?.bpm || def.bpm || 72;
    const beat = 60 / bpm;

    if (def.bounce) {
      const { steps, startBeats, endBeats } = def.bounce;
      const i = state.bouncePhase % steps;
      const t = i / Math.max(1, steps - 1);
      // Ease-out: fast → slow (bouncing ball)
      const beats = startBeats + (endBeats - startBeats) * (t * t);
      return beats * beat;
    }

    if (def.rhythmBeats && def.rhythmBeats.length) {
      const beats = def.rhythmBeats[state.step % def.rhythmBeats.length];
      return beats * beat;
    }

    // polyClocks handled in _onClock via grid; default quarter
    return beat;
  }

  _advanceSchedule(state, fromTime) {
    const dur = this._stepDuration(state);
    state.nextFireAt = fromTime + dur;
    if (this.def.bounce) {
      state.bouncePhase = (state.bouncePhase + 1) % (this.def.bounce.steps || 12);
    }
  }

  _onClock(ev) {
    if (!this._pads.size) return;
    const def = this.def;

    for (const state of [...this._pads.values()]) {
      if (state.released) {
        this._pads.delete(state.idx);
        continue;
      }

      // Polyrhythmic dual clocks (Solar Nebula)
      if (def.polyClocks) {
        let fire = false;
        for (const clk of def.polyClocks) {
          const every = clk.every || 4;
          const phase = clk.phase || 0;
          if ((ev.step + phase) % every === 0) fire = true;
        }
        if (fire) {
          state.step += 1;
          this._trigger(state, ev.time, state.step, ev.bar);
        }
        continue;
      }

      // Asymmetric / bounce: fire when wall-clock reaches nextFireAt
      if (ev.time + 0.001 >= state.nextFireAt) {
        state.step += 1;
        this._trigger(state, Math.max(ev.time, state.nextFireAt), state.step, ev.bar);
        this._advanceSchedule(state, Math.max(ev.time, state.nextFireAt));
      }
    }
  }

  _trigger(state, time, patternStep, bar) {
    const def = this.def;
    const freqs = scaleFreqs(this.pitches);
    if (!freqs.length) return;

    const pat = def.pattern(state.baseIdx, patternStep, bar) || {};
    if (pat.skip) return;

    if (pat.randomWalk) {
      const len = freqs.length;
      const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() < 0.25 ? 1 : 0));
      state.walk = Math.max(0, Math.min(len - 1, (state.walk ?? state.baseIdx) + delta));
    }
    if (pat.randomPick) {
      state.walk = Math.floor(Math.random() * freqs.length);
    }

    const freq = def.resolve(freqs, state.baseIdx, pat.rel ?? 0, state.walk, pat.pitchShift ?? 0);
    const vel = Math.max(0.08, Math.min(1, state.vel * (pat.velMul ?? 1)));
    const slot = acquireVoice(this._voicePool, time);

    try {
      const stopAt = def.play(this.audioCtx, this.bus, {
        freq, t0: time, vel, peak: !!pat.peak, lfo: this._lfo?.out || null
      });
      if (slot) slot.freeAt = Math.max(slot.freeAt || 0, stopAt || time + 4);
    } catch (e) {
      console.warn('[arp] voice', def.id, e);
    }

    this.glow[state.idx] = Math.min(1, 0.35 + vel * 0.55);
    this.zoneFlash[state.idx] = 0.45;
  }
}

export function createArpInstruments() {
  return ARP_DEFS.map((def) => new ArpInstrument(def));
}

export { ARP_DEFS };
