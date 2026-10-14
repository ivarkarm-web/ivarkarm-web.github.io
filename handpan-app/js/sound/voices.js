/**
 * sound/voices.js — the instrument library.
 * Every voice is a pure function: ({ f, vel, sr, rnd }) → Float32Array.
 * Families: traditional | hybrid | experimental
 */
import {
  TAU, frames, clamp, whiteNoise, biquad, addModes, delayLoop, removeDC, crush
} from './dsp.js';

function click(y, sr, rnd, ms, fc, q, amp) {
  const n = Math.min(y.length, frames(sr, ms / 1000 * 6));
  const nz = biquad(whiteNoise(n, rnd), 'bp', fc, q, sr);
  const tau = sr * ms / 1000;
  for (let i = 0; i < n; i++) y[i] += nz[i] * Math.exp(-i / tau) * amp;
}

function pluck(f, vel, sr, rnd, o) {
  const D = sr / f;
  const M = Math.ceil(D) + 8;
  let ex = whiteNoise(M, rnd);
  const c = clamp(o.bright, 0.05, 1);
  let lp = 0;
  for (let i = 0; i < M; i++) { lp += c * (ex[i] - lp); ex[i] = lp; }
  const pk = Math.max(1, Math.round(o.pos * D));
  const comb = new Float32Array(M);
  for (let i = 0; i < M; i++) comb[i] = ex[i] - (i >= pk ? ex[i - pk] : 0) * 0.6;
  removeDC(comb);
  const t60 = o.t60 * clamp(Math.pow(220 / f, 0.25), 0.6, 1.4);
  const s = o.s * clamp(500 / f, 0.3, 1);
  return delayLoop(frames(sr, o.len), sr, f, { init: comb, s, t60 });
}

export const VOICES = [
  {
    id: 'handpan', name: 'Handpan', family: 'traditional',
    desc: 'Modal model of a tuned steel shell.',
    sr: 44100, tail: 4.6, fade: [0.001, 0.4], trim: 0, send: { rev: 0.3, dly: 0.12 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 4.6));
      const b = 0.35 + 0.65 * vel;
      addModes(y, sr, [
        [f - 0.28, 1, 4.6], [f + 0.28, 0.85, 4.2],
        [f * 2.004 - 0.4, 0.4 * b + 0.06, 3.2], [f * 2.004 + 0.4, 0.3 * b + 0.04, 2.6],
        [f * 3.012, 0.24 * b, 2.0], [f * 4.03, 0.07 * b, 1.0], [f * 5.96, 0.03 * b, 0.5]
      ], 0.0015);
      click(y, sr, rnd, 7, f * 1.8 + 300, 1.4, 0.35 * vel);
      return y;
    }
  },
  {
    id: 'koto', name: 'Koto', family: 'traditional',
    desc: 'Plucked string with hard tsume attack.',
    sr: 44100, tail: 4.0, fade: [0.001, 0.35], trim: 0, send: { rev: 0.25, dly: 0.18 }, pan: -0.12,
    render({ f, vel, sr, rnd }) {
      const y = pluck(f, vel, sr, rnd, { bright: 0.45 + 0.5 * vel, pos: 0.11, t60: 3.4, s: 0.5, len: 4.0 });
      click(y, sr, rnd, 4, 3200, 1.2, 0.12 + 0.2 * vel);
      return y;
    }
  },
  {
    id: 'harp', name: 'Harp', family: 'traditional',
    desc: 'Softer rounder string, longer sustain.',
    sr: 44100, tail: 5.0, fade: [0.001, 0.45], trim: 0, send: { rev: 0.32, dly: 0.14 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      return pluck(f, vel, sr, rnd, { bright: 0.3 + 0.35 * vel, pos: 0.24, t60: 5.4, s: 0.42, len: 5.0 });
    }
  },
  {
    id: 'kalimba', name: 'Kalimba', family: 'traditional',
    desc: 'Cantilever tine with sharp 6.27x partials.',
    sr: 44100, tail: 3.6, fade: [0.001, 0.3], trim: 0, send: { rev: 0.22, dly: 0.2 }, pan: 0.05,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.6));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1, 2.8], [f * 6.267, 0.36 * b, 0.75], [f * 17.55, 0.12 * b, 0.2], [f * 2.0, 0.1, 1.2]], 0.001);
      click(y, sr, rnd, 3, 2600, 1.0, 0.22 * vel);
      return y;
    }
  },
  {
    id: 'bowl', name: 'Singing Bowl', family: 'traditional',
    desc: 'Bronze bowl with inharmonic beating partials.',
    sr: 32000, tail: 7.5, fade: [0.02, 1.2], trim: 0, send: { rev: 0.55, dly: 0.1 }, pan: 0,
    render({ f, vel, sr }) {
      const y = new Float32Array(frames(sr, 7.5));
      const R = [1, 2.71, 5.15, 8.46, 12.1], A = [1, 0.6, 0.3, 0.14, 0.05], T = [7.2, 5.2, 3.6, 2.3, 1.4];
      const modes = [];
      R.forEach((r, k) => {
        const a = A[k] * (k ? (0.5 + 0.5 * vel) : 1), d = 0.18 + 0.14 * k;
        modes.push([f * r - d, a, T[k]], [f * r + d, a * 0.8, T[k] * 0.9]);
      });
      return addModes(y, sr, modes, 0.35);
    }
  },
  {
    id: 'breath', name: 'Breath Flute', family: 'traditional',
    desc: 'Closed-pipe waveguide driven by shaped breath noise.',
    sr: 32000, tail: 4.6, fade: [0.05, 0.7], trim: 0, send: { rev: 0.45, dly: 0.25 }, pan: -0.05,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 4.6);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 2.5, 300, 6000), 0.6, sr);
      const fl = biquad(whiteNoise(n, rnd), 'lp', 7, 0.7, sr);
      let flMax = 1e-6;
      for (let i = 0; i < n; i++) flMax = Math.max(flMax, Math.abs(fl[i]));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        nz[i] *= Math.min(1, t / 0.35) * (0.75 + 0.35 * fl[i] / flMax) * 0.03;
      }
      const tube = delayLoop(n, sr, f, { mult: 2, sign: -1, s: 0.35, t60: 1.2, input: nz });
      let r = 0;
      for (let i = 0; i < n; i++) r += tube[i] * tube[i];
      r = Math.sqrt(r / n);
      const w = TAU * f / sr;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        tube[i] += r * 0.7 * Math.sin(w * i * (1 + 0.004 * Math.sin(TAU * 4.8 * t) * Math.min(1, t / 1.2))) * Math.min(1, t / 0.4);
      }
      return biquad(tube, 'lp', 1800 + 3500 * vel, 0.7, sr);
    }
  },
  {
    id: 'tine', name: 'Tine Piano', family: 'hybrid',
    desc: 'FM electric-piano tine with short metallic bark.',
    sr: 44100, tail: 4.6, fade: [0.001, 0.4], trim: 0, send: { rev: 0.25, dly: 0.15 }, pan: 0.08,
    render({ f, vel, sr }) {
      const n = frames(sr, 4.6), y = new Float32Array(n), w = TAU * f / sr, I0 = 1.2 + 2.4 * vel, tau = 4.4 / 6.908;
      for (let i = 0; i < n; i++) {
        const t = i / sr, I = I0 * Math.exp(-t / 0.4) + 0.12, bark = 0.9 * Math.exp(-t / 0.025), ph = w * i;
        y[i] = (Math.sin(ph + I * Math.sin(ph) + bark * Math.sin(14 * ph)) + 0.3 * Math.sin(ph * 1.003 + 0.5 * I * Math.sin(ph * 1.003))) * Math.exp(-t / tau);
      }
      return y;
    }
  },
  {
    id: 'musicbox', name: 'Music Box', family: 'hybrid',
    desc: 'Free-free bar partials, bit-crushed for nostalgic sparkle.',
    sr: 44100, tail: 3.2, fade: [0.001, 0.3], trim: 0, send: { rev: 0.35, dly: 0.3 }, pan: 0.15,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.2)), b = 0.5 + 0.5 * vel;
      addModes(y, sr, [[f, 1, 2.2], [f * 2.756, 0.5 * b, 1.1], [f * 5.404, 0.3 * b, 0.55], [f * 8.933, 0.12 * b, 0.3]], 0.001);
      click(y, sr, rnd, 2, 4200, 1.0, 0.1 * vel);
      crush(y, 7, 2);
      return biquad(y, 'lp', 9000, 0.7, sr);
    }
  },
  {
    id: 'choir', name: 'Choir', family: 'experimental',
    desc: 'Three detuned ah voices from a formant envelope.',
    sr: 24000, tail: 5.0, fade: [0.6, 1.3], trim: 0, send: { rev: 0.6, dly: 0.2 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 5.0), y = new Float32Array(n);
      const shift = clamp(Math.pow(f / 260, 0.3), 0.8, 1.6);
      const F = [800 * shift, 1150 * shift, 2900 * shift], BW = [130, 150, 260], G = [1, 0.55, 0.18];
      const K = Math.max(2, Math.min(Math.floor(sr * 0.44 / f), 36));
      const amp = new Float32Array(K + 1);
      for (let k = 1; k <= K; k++) {
        const fk = k * f; let a = 0.05;
        for (let j = 0; j < 3; j++) a += G[j] * Math.exp(-0.5 * Math.pow((fk - F[j]) / BW[j], 2));
        amp[k] = a / Math.pow(k, 0.7);
      }
      for (const cents of [-9, 0, 8]) {
        const det = Math.pow(2, cents / 1200), vph = rnd() * TAU;
        const cphi = new Float64Array(K + 1), sphi = new Float64Array(K + 1);
        for (let k = 1; k <= K; k++) { const p = rnd() * TAU; cphi[k] = Math.cos(p); sphi[k] = Math.sin(p); }
        let phase = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          phase += TAU * f * det * (1 + 0.0045 * clamp((t - 0.4) / 0.8, 0, 1) * Math.sin(TAU * 5.2 * t + vph)) / sr;
          const c = Math.cos(phase), sn = Math.sin(phase);
          let re = 1, im = 0, acc = 0;
          for (let k = 1; k <= K; k++) {
            const nr = re * c - im * sn; im = re * sn + im * c; re = nr;
            acc += amp[k] * (im * cphi[k] + re * sphi[k]);
          }
          y[i] += acc;
        }
      }
      return y;
    }
  },
  {
    id: 'drone', name: 'Open-Fifth Drone', family: 'experimental',
    desc: 'Root and fifth as slowly breathing detuned partials.',
    sr: 22050, tail: 7.5, fade: [1.4, 2.2], trim: 0, send: { rev: 0.6, dly: 0.05 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 7.5), y = new Float32Array(n);
      const bases = [[f, 10, 1.0], [f * 1.4983, 5, 0.28]];
      for (const cents of [-6, 0, 5]) {
        const det = Math.pow(2, cents / 1200);
        for (const [base, K, g] of bases) {
          for (let k = 1; k <= K; k++) {
            const fk = base * det * k;
            if (fk > sr * 0.44) break;
            const a = g / Math.pow(k, 1.4 - 0.5 * vel), w = TAU * fk / sr, wl = TAU * (0.05 + rnd() * 0.25) / sr;
            let zr = Math.cos(rnd() * TAU), zi = Math.sin(rnd() * TAU), lr = Math.cos(rnd() * TAU), li = Math.sin(rnd() * TAU);
            const cw = Math.cos(w), sw = Math.sin(w), cl = Math.cos(wl), sl = Math.sin(wl);
            for (let i = 0; i < n; i++) {
              y[i] += a * (1 + 0.45 * li) * zi;
              const nzr = zr * cw - zi * sw; zi = zr * sw + zi * cw; zr = nzr;
              const nlr = lr * cl - li * sl; li = lr * sl + li * cl; lr = nlr;
            }
          }
        }
      }
      return y;
    }
  },
  {
    id: 'cloud', name: 'Grain Cloud', family: 'experimental',
    desc: 'Swarm of tiny sine grains around the note.',
    sr: 22050, tail: 6.5, fade: [0.8, 1.6], trim: 0, send: { rev: 0.7, dly: 0.3 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 6.5), y = new Float32Array(n), ratios = [1, 2, 3, 1, 1.5, 4];
      const count = Math.floor((10 + 8 * vel) * 5.5);
      for (let g = 0; g < count; g++) {
        const t0 = Math.floor((0.05 + rnd() * 5.0) * sr), len = Math.floor((0.15 + rnd() * 0.3) * sr);
        const fr = f * ratios[Math.floor(rnd() * ratios.length)] * Math.pow(2, (rnd() * 16 - 8) / 1200);
        if (fr > sr * 0.44) continue;
        const a = 0.3 + 0.7 * rnd(), w = TAU * fr / sr, p = rnd() * TAU;
        for (let i = 0; i < len && t0 + i < n; i++) {
          const h = 0.5 - 0.5 * Math.cos(TAU * i / len);
          y[t0 + i] += a * h * (Math.sin(w * i + p) + 0.35 * Math.sin(2 * w * i + 2 * p));
        }
      }
      return y;
    }
  },
  /* BATCH 1 metallic */
  {
    id: 'tibetan', name: 'Tibetan Singing Bowl', family: 'traditional',
    desc: 'Deep bronze bowl with inharmonic beating partials.',
    sr: 32000, tail: 9.0, fade: [0.04, 1.6], trim: 0, send: { rev: 0.62, dly: 0.08 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 9.0));
      const R = [1, 2.76, 5.40, 8.93, 12.6, 17.1], A = [1, 0.72, 0.38, 0.18, 0.08, 0.03], T = [8.6, 6.4, 4.4, 2.8, 1.7, 0.9];
      const b = 0.35 + 0.65 * vel, modes = [];
      R.forEach((r, k) => {
        const a = A[k] * (k === 0 ? 1 : b), beat = 0.12 + 0.1 * k + rnd() * 0.04;
        modes.push([f * r - beat, a, T[k]], [f * r + beat, a * 0.82, T[k] * 0.92]);
      });
      addModes(y, sr, modes, 0.45 - 0.32 * vel);
      click(y, sr, rnd, 9, f * 2.2 + 400, 1.6, 0.18 * vel);
      return biquad(y, 'lp', 1800 + 5200 * vel, 0.65, sr);
    }
  },
  {
    id: 'tongue', name: 'Steel Tongue Drum', family: 'traditional',
    desc: 'Boxier handpan cousin with shorter decay.',
    sr: 44100, tail: 3.8, fade: [0.001, 0.35], trim: 0, send: { rev: 0.28, dly: 0.14 }, pan: 0.04,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.8)), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f - 0.15, 1.0, 3.4], [f + 0.15, 0.88, 3.1], [f * 2.002, 0.32 * b + 0.05, 2.0], [f * 2.99, 0.14 * b, 1.15], [f * 4.02, 0.05 * b, 0.55]], 0.002);
      click(y, sr, rnd, 5, f * 1.5 + 280, 1.2, 0.28 * vel);
      return biquad(y, 'lp', 1400 + 4200 * vel, 0.75, sr);
    }
  },
  {
    id: 'crystal_kalimba', name: 'Crystal Kalimba', family: 'traditional',
    desc: 'Pure glassy tine pluck.',
    sr: 44100, tail: 2.8, fade: [0.001, 0.22], trim: 0, send: { rev: 0.3, dly: 0.22 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 2.8)), b = 0.35 + 0.65 * vel;
      addModes(y, sr, [[f, 1.0, 2.2], [f * 2.0, 0.12 * b, 0.9], [f * 6.27, 0.22 * b, 0.45], [f * 12.3, 0.06 * b, 0.12]], 0.0008);
      click(y, sr, rnd, 2.5, 3800 + 1200 * vel, 1.1, 0.16 * vel);
      return biquad(y, 'lp', 2200 + 7000 * vel, 0.6, sr);
    }
  },
  {
    id: 'ice_chime', name: 'Ice Chime', family: 'hybrid',
    desc: 'Fragile glass-like strike.',
    sr: 44100, tail: 2.4, fade: [0.0005, 0.18], trim: 0, send: { rev: 0.4, dly: 0.28 }, pan: 0.18,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 2.4)), b = 0.3 + 0.7 * vel;
      addModes(y, sr, [[f, 1.0, 1.6], [f * 2.41, 0.45 * b, 0.7], [f * 3.92, 0.22 * b, 0.35], [f * 6.15, 0.1 * b, 0.18], [f * 9.4, 0.04 * b, 0.08]], 0.0004);
      click(y, sr, rnd, 2, 5200 + 2000 * vel, 2.2, 0.35 * vel);
      return biquad(y, 'lp', 2800 + 9000 * vel, 0.55, sr);
    }
  },
  {
    id: 'windchimes', name: 'Zen Windchimes', family: 'experimental',
    desc: 'Primary pitch plus scattered ultra-high metallic transients.',
    sr: 44100, tail: 4.2, fade: [0.002, 0.5], trim: 0, send: { rev: 0.5, dly: 0.25 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 4.2)), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 0.7, 3.2], [f * 2.01, 0.2 * b, 1.6], [f * 3.05, 0.08 * b, 0.7]], 0.003);
      click(y, sr, rnd, 3, f * 3 + 600, 1.5, 0.12 * vel);
      const count = 4 + Math.floor(6 * vel);
      for (let g = 0; g < count; g++) {
        const t0 = Math.floor((0.02 + rnd() * 2.8) * sr), len = Math.floor((0.08 + rnd() * 0.35) * sr);
        const fr = f * (2.5 + rnd() * 6.5) * Math.pow(2, (rnd() * 20 - 10) / 1200);
        if (fr > sr * 0.44) continue;
        const a = (0.12 + 0.25 * rnd()) * b, w = TAU * fr / sr, p = rnd() * TAU;
        for (let i = 0; i < len && t0 + i < y.length; i++) y[t0 + i] += a * Math.exp(-i / (sr * 0.08)) * Math.sin(w * i + p);
      }
      return biquad(y, 'lp', 3000 + 8000 * vel, 0.5, sr);
    }
  },
  /* BATCH 2 ambient pads */
  {
    id: 'mist_drone', name: 'Mist Drone', family: 'experimental',
    desc: 'Deep undulating sub-bass pad.',
    sr: 22050, tail: 8.0, fade: [1.2, 2.0], trim: 0, send: { rev: 0.7, dly: 0.08 }, pan: 0,
    render({ f, vel, sr }) {
      const n = frames(sr, 8.0), y = new Float32Array(n), b = 0.45 + 0.55 * vel;
      addModes(y, sr, [[f * 0.5, 0.9, 7.5], [f, 1.0, 7.0], [f * 1.498, 0.28 * b, 5.5], [f * 2.0, 0.12 * b, 4.0]], 1.0);
      for (let i = 0; i < n; i++) y[i] *= 0.72 + 0.28 * Math.sin(TAU * 0.07 * (i / sr));
      return biquad(y, 'lp', 180 + 480 * vel, 0.6, sr);
    }
  },
  {
    id: 'aether', name: 'Aether Shimmer', family: 'experimental',
    desc: 'High glassy detuned pad.',
    sr: 32000, tail: 7.0, fade: [0.9, 1.8], trim: 0, send: { rev: 0.65, dly: 0.22 }, pan: 0.05,
    render({ f, vel, sr }) {
      const n = frames(sr, 7.0), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      for (const cents of [-8, 0, 7]) {
        const det = Math.pow(2, cents / 1200);
        addModes(y, sr, [[f * det, 0.55, 6.2], [f * 2.003 * det, 0.28 * b, 4.5], [f * 3.01 * det, 0.1 * b, 2.8]], 0.85);
      }
      for (let i = 0; i < n; i++) { const t = i / sr; y[i] *= 1 + 0.04 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 1.5); }
      return biquad(y, 'lp', 2400 + 5000 * vel, 0.55, sr);
    }
  },
  {
    id: 'aurora', name: 'Aurora Borealis', family: 'experimental',
    desc: 'Warm shifting triangle pad.',
    sr: 24000, tail: 7.5, fade: [1.0, 1.9], trim: 0, send: { rev: 0.68, dly: 0.15 }, pan: -0.04,
    render({ f, vel, sr }) {
      const n = frames(sr, 7.5), y = new Float32Array(n), b = 0.35 + 0.65 * vel, modes = [];
      for (let k = 1; k <= 7; k += 2) modes.push([f * k, (1 / (k * k)) * (k === 1 ? 1 : b), 7.2 - k * 0.5]);
      modes.push([f * 1.498, 0.2 * b, 5.0]);
      addModes(y, sr, modes, 0.95);
      for (let i = 0; i < n; i++) y[i] *= 0.75 + 0.25 * Math.sin(TAU * 0.04 * (i / sr) + 1.2);
      return biquad(biquad(y, 'hp', 80 + 40 * vel, 0.7, sr), 'lp', 1600 + 3200 * vel, 0.65, sr);
    }
  },
  {
    id: 'celestial_bow', name: 'Celestial Bow', family: 'experimental',
    desc: 'Slowly evolving bow swell.',
    sr: 32000, tail: 8.5, fade: [1.5, 2.2], trim: 0, send: { rev: 0.72, dly: 0.18 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 8.5), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1.0, 8.0], [f * 2.005, 0.35 * b, 6.0], [f * 3.01, 0.14 * b, 4.0], [f * 4.98, 0.06 * b, 2.5]], 1.6);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 1.8, 200, 4000), 2.5, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, swell = Math.min(1, t / 1.8);
        y[i] = y[i] * swell + nz[i] * (0.08 * b * swell * (0.6 + 0.4 * Math.sin(TAU * 3.2 * t)));
      }
      return biquad(y, 'lp', 2000 + 4500 * vel, 0.6, sr);
    }
  },
  {
    id: 'sub_hum', name: 'Subterranean Hum', family: 'experimental',
    desc: 'Ultra-low sine drone.',
    sr: 22050, tail: 9.0, fade: [1.6, 2.4], trim: 0, send: { rev: 0.55, dly: 0.04 }, pan: 0,
    render({ f, vel, sr }) {
      const n = frames(sr, 9.0), y = new Float32Array(n), root = Math.min(f, f * 0.5), sub = Math.max(30, root * 0.5);
      addModes(y, sr, [[sub, 1.0, 8.5], [root, 0.7, 7.5], [root * 1.5, 0.18 * vel, 5.0]], 1.4);
      for (let i = 0; i < n; i++) y[i] *= 0.85 + 0.15 * Math.sin(TAU * 0.06 * (i / sr));
      return biquad(y, 'lp', 120 + 280 * vel, 0.8, sr);
    }
  },
  /* BATCH 3 strings */
  {
    id: 'ambient_cello', name: 'Ambient Cello', family: 'traditional',
    desc: 'Dark sustained cello pad with soft bow grain.',
    sr: 32000, tail: 7.5, fade: [0.9, 1.8], trim: 0, send: { rev: 0.58, dly: 0.12 }, pan: -0.06,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 7.5), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1.0, 7.0], [f * 2.002, 0.55 * b, 5.5], [f * 3.01, 0.28 * b, 4.0], [f * 4.02, 0.12 * b, 2.8], [f * 5.05, 0.05 * b, 1.6]], 1.1);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 2.2, 180, 3500), 1.4, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, swell = Math.min(1, t / 0.7);
        y[i] = y[i] * swell * (1 + 0.004 * Math.sin(TAU * 5.1 * t) * Math.min(1, t / 1.0)) + nz[i] * (0.06 * b * swell * (0.55 + 0.45 * Math.sin(TAU * 2.8 * t)));
      }
      return biquad(y, 'lp', 900 + 2800 * vel, 0.7, sr);
    }
  },
  {
    id: 'pizzicato', name: 'Pizzicato Dream', family: 'traditional',
    desc: 'Soft plucked string with woody body.',
    sr: 44100, tail: 3.2, fade: [0.001, 0.28], trim: 0, send: { rev: 0.35, dly: 0.2 }, pan: 0.08,
    render({ f, vel, sr, rnd }) {
      const y = pluck(f, vel, sr, rnd, { bright: 0.22 + 0.28 * vel, pos: 0.28, t60: 2.6, s: 0.48, len: 3.2 });
      click(y, sr, rnd, 6, clamp(f * 0.9, 90, 400), 0.9, 0.14 * vel);
      return biquad(y, 'lp', 1600 + 3600 * vel, 0.65, sr);
    }
  },
  {
    id: 'guzheng', name: 'Guzheng', family: 'traditional',
    desc: 'Chinese zither — bright attack, silvery bloom.',
    sr: 44100, tail: 4.2, fade: [0.001, 0.35], trim: 0, send: { rev: 0.3, dly: 0.22 }, pan: -0.1,
    render({ f, vel, sr, rnd }) {
      const y = pluck(f, vel, sr, rnd, { bright: 0.5 + 0.45 * vel, pos: 0.09, t60: 3.8, s: 0.38, len: 4.2 });
      const spark = new Float32Array(y.length);
      addModes(spark, sr, [[f * 2.01, 0.18 * vel, 1.2], [f * 3.02, 0.08 * vel, 0.6]], 0.002);
      for (let i = 0; i < y.length; i++) y[i] += spark[i];
      click(y, sr, rnd, 3, 2800 + 1500 * vel, 1.3, 0.16 * vel);
      return biquad(y, 'lp', 2200 + 6000 * vel, 0.55, sr);
    }
  },
  {
    id: 'sitar_air', name: 'Sitar Air', family: 'traditional',
    desc: 'Sympathetic buzz under sustained sitar fundamental.',
    sr: 32000, tail: 6.5, fade: [0.5, 1.4], trim: 0, send: { rev: 0.5, dly: 0.18 }, pan: 0.04,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 6.5), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1.0, 6.0], [f * 2.01, 0.4 * b, 4.0], [f * 3.05, 0.18 * b, 2.5], [f * 4.12, 0.08 * b, 1.4], [f * 5.2, 0.04 * b, 0.8]], 0.4);
      addModes(y, sr, [[f * 1.5, 0.12 * b, 5.0], [f * 2.0, 0.1 * b, 4.5], [f * 2.25, 0.06 * b, 3.0]], 0.8);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 4, 400, 5000), 3.0, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, swell = Math.min(1, t / 0.45);
        y[i] = y[i] * swell + nz[i] * (0.04 * b * swell * Math.exp(-t / 2.5));
      }
      return biquad(y, 'lp', 1800 + 4200 * vel, 0.6, sr);
    }
  },
  {
    id: 'silk_violin', name: 'Silk Violin', family: 'traditional',
    desc: 'Soft high string pad with silk-smooth bow.',
    sr: 32000, tail: 6.0, fade: [0.7, 1.5], trim: 0, send: { rev: 0.55, dly: 0.16 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 6.0), y = new Float32Array(n), b = 0.35 + 0.65 * vel;
      addModes(y, sr, [[f, 1.0, 5.5], [f * 2.003, 0.48 * b, 4.2], [f * 3.01, 0.2 * b, 2.8], [f * 4.02, 0.08 * b, 1.6]], 0.9);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 3.5, 500, 6000), 1.8, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, swell = Math.min(1, t / 0.55);
        y[i] = y[i] * swell * (1 + 0.005 * Math.sin(TAU * 5.8 * t) * Math.min(1, t / 0.9)) + nz[i] * (0.035 * b * swell);
      }
      return biquad(y, 'lp', 2200 + 5000 * vel, 0.55, sr);
    }
  },
  /* BATCH 4 woodwinds */
  {
    id: 'shakuhachi', name: 'Shakuhachi', family: 'traditional',
    desc: 'Japanese bamboo flute — breathy hollow pipe.',
    sr: 32000, tail: 5.0, fade: [0.12, 0.9], trim: 0, send: { rev: 0.48, dly: 0.22 }, pan: -0.05,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 5.0);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 2.8, 250, 5500), 0.55, sr);
      const fl = biquad(whiteNoise(n, rnd), 'lp', 6, 0.7, sr);
      let flMax = 1e-6;
      for (let i = 0; i < n; i++) flMax = Math.max(flMax, Math.abs(fl[i]));
      for (let i = 0; i < n; i++) nz[i] *= Math.min(1, i / sr / 0.28) * (0.7 + 0.4 * fl[i] / flMax) * (0.028 + 0.02 * vel);
      const tube = delayLoop(n, sr, f, { mult: 2, sign: -1, s: 0.32, t60: 1.4, input: nz });
      let r = 0;
      for (let i = 0; i < n; i++) r += tube[i] * tube[i];
      r = Math.sqrt(r / n) || 1e-6;
      const w = TAU * f / sr;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        tube[i] += r * 0.75 * Math.sin(w * i * (1 + 0.005 * Math.sin(TAU * 4.6 * t) * Math.min(1, t / 1.0))) * Math.min(1, t / 0.35);
      }
      return biquad(tube, 'lp', 1400 + 3200 * vel, 0.65, sr);
    }
  },
  {
    id: 'duduk', name: 'Duduk', family: 'traditional',
    desc: 'Armenian double-reed — nasal mid warmth.',
    sr: 32000, tail: 6.0, fade: [0.35, 1.2], trim: 0, send: { rev: 0.52, dly: 0.15 }, pan: 0.04,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 6.0), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1.0, 5.5], [f * 2.0, 0.45 * b, 4.0], [f * 3.0, 0.18 * b, 2.5], [f * 4.0, 0.07 * b, 1.4]], 0.7);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 1.6, 200, 2500), 1.2, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, swell = Math.min(1, t / 0.5);
        y[i] = y[i] * swell * (1 + 0.006 * Math.sin(TAU * 5.0 * t) * Math.min(1, t / 1.2)) + nz[i] * (0.05 * b * swell);
      }
      return biquad(biquad(y, 'bp', clamp(f * 1.4, 180, 1200), 0.9, sr), 'lp', 1800 + 2500 * vel, 0.7, sr);
    }
  },
  {
    id: 'native_flute', name: 'Native Flute', family: 'traditional',
    desc: 'Open flute — pure tone, airy chiff.',
    sr: 32000, tail: 4.8, fade: [0.08, 0.85], trim: 0, send: { rev: 0.45, dly: 0.2 }, pan: -0.08,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 4.8), y = new Float32Array(n), b = 0.35 + 0.65 * vel;
      addModes(y, sr, [[f, 1.0, 4.4], [f * 2.005, 0.22 * b, 2.8], [f * 3.01, 0.06 * b, 1.4]], 0.25);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 3.2, 400, 5000), 0.8, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        y[i] = y[i] * Math.min(1, t / 0.2) * (1 + 0.004 * Math.sin(TAU * 4.2 * t) * Math.min(1, t / 0.8)) + nz[i] * (Math.exp(-t / 0.08) * (0.12 + 0.1 * vel) + 0.02 * b * Math.min(1, t / 0.2));
      }
      return biquad(y, 'lp', 2000 + 4000 * vel, 0.6, sr);
    }
  },
  {
    id: 'ocarina', name: 'Ocarina', family: 'traditional',
    desc: 'Ceramic whistle — pure sine-led, soft chiff.',
    sr: 44100, tail: 2.6, fade: [0.02, 0.35], trim: 0, send: { rev: 0.38, dly: 0.18 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 2.6), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      addModes(y, sr, [[f, 1.0, 2.2], [f * 2.0, 0.08 * b, 0.9], [f * 3.0, 0.03 * b, 0.4]], 0.04);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 2.5, 300, 4000), 1.0, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        y[i] = (y[i] + nz[i] * 0.06 * vel) * Math.min(1, t / 0.04) * Math.exp(-t / 0.85);
      }
      return biquad(y, 'lp', 2500 + 3500 * vel, 0.7, sr);
    }
  },
  {
    id: 'pan_pipes', name: 'Pan Pipes', family: 'traditional',
    desc: 'Andean pan flute — detuned ranks, bright chiff.',
    sr: 32000, tail: 3.4, fade: [0.03, 0.45], trim: 0, send: { rev: 0.42, dly: 0.25 }, pan: 0.06,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 3.4), y = new Float32Array(n), b = 0.4 + 0.6 * vel;
      for (const cents of [-6, 5]) {
        const det = Math.pow(2, cents / 1200);
        addModes(y, sr, [[f * det, 0.7, 3.0], [f * 2.01 * det, 0.15 * b, 1.4]], 0.08);
      }
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 3.5, 500, 6000), 0.9, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        y[i] = (y[i] + nz[i] * Math.exp(-t / 0.06) * (0.14 + 0.12 * vel)) * Math.min(1, t / 0.05) * Math.exp(-t / 1.1);
      }
      return biquad(y, 'lp', 2200 + 4500 * vel, 0.55, sr);
    }
  },
  /* ---- BATCH 5: World Percussion ---- */
  {
    id: 'marimba', name: 'Marimba', family: 'traditional',
    desc: 'Wooden bar mallet strike — warm fundamental, soft odd harmonics, short woody decay.',
    sr: 44100, tail: 2.8, fade: [0.001, 0.25], trim: 0, send: { rev: 0.28, dly: 0.12 }, pan: 0.06,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 2.8));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f, 1.0, 2.2],
        [f * 3.92, 0.28 * b, 0.7],
        [f * 9.1, 0.08 * b, 0.25],
        [f * 2.0, 0.06 * b, 0.9]
      ], 0.001);
      click(y, sr, rnd, 4, 1800 + 800 * vel, 1.1, 0.2 * vel);
      return biquad(y, 'lp', 2000 + 4500 * vel, 0.65, sr);
    }
  },
  {
    id: 'mbira', name: 'Mbira', family: 'traditional',
    desc: 'Shona thumb piano — metallic tine pluck with buzzing overtones and a bright sparkle.',
    sr: 44100, tail: 3.0, fade: [0.001, 0.28], trim: 0, send: { rev: 0.3, dly: 0.2 }, pan: -0.08,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.0));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f, 1.0, 2.4],
        [f * 6.27, 0.32 * b, 0.55],
        [f * 17.5, 0.1 * b, 0.15],
        [f * 2.01, 0.12 * b, 1.0]
      ], 0.0008);
      const nz = biquad(whiteNoise(frames(sr, 0.15), rnd), 'bp', clamp(f * 5, 800, 6000), 2.0, sr);
      for (let i = 0; i < nz.length && i < y.length; i++)
        y[i] += nz[i] * 0.12 * vel * Math.exp(-i / (sr * 0.04));
      click(y, sr, rnd, 2.5, 3200 + 1000 * vel, 1.2, 0.18 * vel);
      return biquad(y, 'lp', 2400 + 5500 * vel, 0.55, sr);
    }
  },
  {
    id: 'frame_drum', name: 'Frame Drum', family: 'traditional',
    desc: 'Hand frame drum — skin thud on low notes, rim ring on higher tones.',
    sr: 44100, tail: 2.2, fade: [0.001, 0.2], trim: 0, send: { rev: 0.25, dly: 0.08 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 2.2);
      const y = new Float32Array(n);
      const b = 0.35 + 0.65 * vel;
      addModes(y, sr, [
        [f * 0.55, 1.0, 1.6],
        [f, 0.55 * b, 1.1],
        [f * 1.59, 0.22 * b, 0.6],
        [f * 2.14, 0.1 * b, 0.35]
      ], 0.002);
      const nz = biquad(whiteNoise(Math.min(n, frames(sr, 0.08)), rnd), 'bp', 400 + 600 * vel, 0.8, sr);
      for (let i = 0; i < nz.length; i++)
        y[i] += nz[i] * (0.35 * vel) * Math.exp(-i / (sr * 0.025));
      click(y, sr, rnd, 5, 180 + 120 * vel, 0.7, 0.4 * vel);
      return biquad(y, 'lp', 800 + 2200 * vel, 0.75, sr);
    }
  },
  {
    id: 'gamelan', name: 'Gamelan', family: 'traditional',
    desc: 'Indonesian metallophone — bright inharmonic bar, shimmering sustain, golden strike.',
    sr: 44100, tail: 4.0, fade: [0.002, 0.4], trim: 0, send: { rev: 0.4, dly: 0.18 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 4.0));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f, 1.0, 3.4],
        [f * 2.76, 0.45 * b, 2.0],
        [f * 5.15, 0.2 * b, 1.0],
        [f * 8.0, 0.08 * b, 0.45],
        [f * 1.02, 0.3, 2.8]
      ], 0.0015);
      click(y, sr, rnd, 3, 2800 + 1500 * vel, 1.5, 0.22 * vel);
      return biquad(y, 'lp', 2500 + 6000 * vel, 0.55, sr);
    }
  },
  {
    id: 'tabla', name: 'Tabla', family: 'traditional',
    desc: 'North Indian tabla — deep bayan thud on low notes, bright dayan ring on high notes.',
    sr: 44100, tail: 2.0, fade: [0.001, 0.18], trim: 0, send: { rev: 0.22, dly: 0.1 }, pan: -0.05,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 2.0);
      const y = new Float32Array(n);
      const b = 0.4 + 0.6 * vel;
      const bayan = f < 120;
      if (bayan) {
        addModes(y, sr, [[f * 0.7, 1.0, 1.4], [f, 0.4 * b, 0.8], [f * 1.8, 0.12 * b, 0.35]], 0.003);
        click(y, sr, rnd, 8, 90 + 40 * vel, 0.6, 0.5 * vel);
      } else {
        addModes(y, sr, [[f, 1.0, 1.5], [f * 2.05, 0.25 * b, 0.7], [f * 3.1, 0.1 * b, 0.3]], 0.001);
        click(y, sr, rnd, 3, 2000 + 1500 * vel, 1.4, 0.25 * vel);
      }
      const nz = biquad(whiteNoise(Math.min(n, frames(sr, 0.06)), rnd), 'bp', bayan ? 200 : 2500, 1.0, sr);
      for (let i = 0; i < nz.length; i++)
        y[i] += nz[i] * (0.2 * vel) * Math.exp(-i / (sr * 0.02));
      return biquad(y, 'lp', (bayan ? 600 : 2800) + 3000 * vel, 0.7, sr);
    }
  }
];

export const VOICE_MAP = new Map(VOICES.map((v) => [v.id, v]));
export const voiceIds = () => VOICES.map((v) => v.id);
