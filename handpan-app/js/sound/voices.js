/**
 * sound/voices.js — the instrument library.
 *
 * Every voice is a pure function: ({ f, vel, sr, rnd }) → Float32Array.
 * Voices take ANY frequency in Hz, so scales / microtonal layouts are the
 * job of the instrument layer, not the sound engine. Loudness is NOT set
 * here: library.js measures and equalises every rendered note so voices
 * sit together without hand-tuned gain hacks.
 *
 * Families
 *   traditional   — physically-modelled acoustic instruments
 *   hybrid        — acoustic gesture, electronic character
 *   experimental  — textures that only exist in a computer
 */
import {
  TAU, frames, clamp, whiteNoise, biquad, addModes, delayLoop, removeDC, crush
} from './dsp.js';

/* ---------- shared helpers ---------- */

function click(y, sr, rnd, ms, fc, q, amp) {
  const n = Math.min(y.length, frames(sr, ms / 1000 * 6));
  const nz = biquad(whiteNoise(n, rnd), 'bp', fc, q, sr);
  const tau = sr * ms / 1000;
  for (let i = 0; i < n; i++) y[i] += nz[i] * Math.exp(-i / tau) * amp;
}

/** Karplus-Strong pluck, tuned with a fractional-delay allpass. */
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


/* ---------- the voices ---------- */

export const VOICES = [
  {
    id: 'handpan', name: 'Handpan', family: 'traditional',
    desc: 'Modal model of a tuned steel shell: fundamental, octave and compound fifth with slow beating.',
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
    desc: 'Plucked string with a hard tsume pick attack and bright, quick-blooming overtones.',
    sr: 44100, tail: 4.0, fade: [0.001, 0.35], trim: 0, send: { rev: 0.25, dly: 0.18 }, pan: -0.12,
    render({ f, vel, sr, rnd }) {
      const y = pluck(f, vel, sr, rnd, { bright: 0.45 + 0.5 * vel, pos: 0.11, t60: 3.4, s: 0.5, len: 4.0 });
      click(y, sr, rnd, 4, 3200, 1.2, 0.12 + 0.2 * vel);
      return y;
    }
  },
  {
    id: 'harp', name: 'Harp', family: 'traditional',
    desc: 'Softer, rounder string: plucked nearer the middle with longer sustain.',
    sr: 44100, tail: 5.0, fade: [0.001, 0.45], trim: 0, send: { rev: 0.32, dly: 0.14 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      return pluck(f, vel, sr, rnd, { bright: 0.3 + 0.35 * vel, pos: 0.24, t60: 5.4, s: 0.42, len: 5.0 });
    }
  },
  {
    id: 'kalimba', name: 'Kalimba', family: 'traditional',
    desc: 'Cantilever tine: the sharp 6.27x and 17.5x partials of a struck metal bar, short and woody.',
    sr: 44100, tail: 3.6, fade: [0.001, 0.3], trim: 0, send: { rev: 0.22, dly: 0.2 }, pan: 0.05,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.6));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f, 1, 2.8], [f * 6.267, 0.36 * b, 0.75], [f * 17.55, 0.12 * b, 0.2], [f * 2.0, 0.1, 1.2]
      ], 0.001);
      click(y, sr, rnd, 3, 2600, 1.0, 0.22 * vel);
      return y;
    }
  },
  {
    id: 'bowl', name: 'Singing Bowl', family: 'traditional',
    desc: 'Struck-and-bloomed bronze bowl: inharmonic partials in beating pairs, long glassy tail.',
    sr: 32000, tail: 7.5, fade: [0.02, 1.2], trim: 0, send: { rev: 0.55, dly: 0.1 }, pan: 0,
    render({ f, vel, sr }) {
      const y = new Float32Array(frames(sr, 7.5));
      const R = [1, 2.71, 5.15, 8.46, 12.1];
      const A = [1, 0.6, 0.3, 0.14, 0.05];
      const T = [7.2, 5.2, 3.6, 2.3, 1.4];
      const modes = [];
      R.forEach((r, k) => {
        const a = A[k] * (k ? (0.5 + 0.5 * vel) : 1);
        const d = 0.18 + 0.14 * k;
        modes.push([f * r - d, a, T[k]], [f * r + d, a * 0.8, T[k] * 0.9]);
      });
      return addModes(y, sr, modes, 0.35);
    }
  },
  {
    id: 'breath', name: 'Breath Flute', family: 'traditional',
    desc: 'Closed-pipe waveguide driven by shaped breath noise — hollow, shakuhachi-like.',
    sr: 32000, tail: 4.6, fade: [0.05, 0.7], trim: 0, send: { rev: 0.45, dly: 0.25 }, pan: -0.05,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 4.6);
      const nz = biquad(whiteNoise(n, rnd), 'bp', clamp(f * 2.5, 300, 6000), 0.6, sr);
      const fl = biquad(whiteNoise(n, rnd), 'lp', 7, 0.7, sr);
      let flMax = 1e-6;
      for (let i = 0; i < n; i++) flMax = Math.max(flMax, Math.abs(fl[i]));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const swell = Math.min(1, t / 0.35);
        nz[i] *= swell * (0.75 + 0.35 * fl[i] / flMax) * 0.03;
      }
      const tube = delayLoop(n, sr, f, { mult: 2, sign: -1, s: 0.35, t60: 1.2, input: nz });
      let r = 0;
      for (let i = 0; i < n; i++) r += tube[i] * tube[i];
      r = Math.sqrt(r / n);
      const w = TAU * f / sr;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const vib = 1 + 0.004 * Math.sin(TAU * 4.8 * t) * Math.min(1, t / 1.2);
        tube[i] += r * 0.7 * Math.sin(w * i * vib) * Math.min(1, t / 0.4);
      }
      return biquad(tube, 'lp', 1800 + 3500 * vel, 0.7, sr);
    }
  },
  {
    id: 'tine', name: 'Tine Piano', family: 'hybrid',
    desc: 'FM electric-piano tine with a short metallic bark — the warm electric heart of the library.',
    sr: 44100, tail: 4.6, fade: [0.001, 0.4], trim: 0, send: { rev: 0.25, dly: 0.15 }, pan: 0.08,
    render({ f, vel, sr }) {
      const n = frames(sr, 4.6);
      const y = new Float32Array(n);
      const w = TAU * f / sr;
      const I0 = 1.2 + 2.4 * vel;
      const tau = 4.4 / 6.908;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const I = I0 * Math.exp(-t / 0.4) + 0.12;
        const bark = 0.9 * Math.exp(-t / 0.025);
        const ph = w * i;
        const a = Math.sin(ph + I * Math.sin(ph) + bark * Math.sin(14 * ph));
        const b = 0.3 * Math.sin(ph * 1.003 + 0.5 * I * Math.sin(ph * 1.003));
        y[i] = (a + b) * Math.exp(-t / tau);
      }
      return y;
    }
  },
  {
    id: 'musicbox', name: 'Music Box', family: 'hybrid',
    desc: 'Free-free bar partials, bit-crushed and sample-held for a worn, nostalgic sparkle.',
    sr: 44100, tail: 3.2, fade: [0.001, 0.3], trim: 0, send: { rev: 0.35, dly: 0.3 }, pan: 0.15,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.2));
      const b = 0.5 + 0.5 * vel;
      addModes(y, sr, [
        [f, 1, 2.2], [f * 2.756, 0.5 * b, 1.1], [f * 5.404, 0.3 * b, 0.55], [f * 8.933, 0.12 * b, 0.3]
      ], 0.001);
      click(y, sr, rnd, 2, 4200, 1.0, 0.1 * vel);
      crush(y, 7, 2);
      return biquad(y, 'lp', 9000, 0.7, sr);
    }
  },
  {
    id: 'choir', name: 'Choir', family: 'experimental',
    desc: 'Three detuned "ah" voices built additively from a formant envelope, with late vibrato.',
    sr: 24000, tail: 5.0, fade: [0.6, 1.3], trim: 0, send: { rev: 0.6, dly: 0.2 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 5.0);
      const y = new Float32Array(n);
      const shift = clamp(Math.pow(f / 260, 0.3), 0.8, 1.6);
      const F = [800 * shift, 1150 * shift, 2900 * shift];
      const BW = [130, 150, 260];
      const G = [1, 0.55, 0.18];
      const K = Math.max(2, Math.min(Math.floor(sr * 0.44 / f), 36));
      const amp = new Float32Array(K + 1);
      for (let k = 1; k <= K; k++) {
        const fk = k * f;
        let a = 0.05;
        for (let j = 0; j < 3; j++) a += G[j] * Math.exp(-0.5 * Math.pow((fk - F[j]) / BW[j], 2));
        amp[k] = a / Math.pow(k, 0.7);
      }
      for (const cents of [-9, 0, 8]) {
        const det = Math.pow(2, cents / 1200);
        const vph = rnd() * TAU;
        const cphi = new Float64Array(K + 1), sphi = new Float64Array(K + 1);
        for (let k = 1; k <= K; k++) { const p = rnd() * TAU; cphi[k] = Math.cos(p); sphi[k] = Math.sin(p); }
        let phase = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const vib = 1 + 0.0045 * clamp((t - 0.4) / 0.8, 0, 1) * Math.sin(TAU * 5.2 * t + vph);
          phase += TAU * f * det * vib / sr;
          const c = Math.cos(phase), sn = Math.sin(phase);
          let re = 1, im = 0, acc = 0;
          for (let k = 1; k <= K; k++) {
            const nr = re * c - im * sn;
            im = re * sn + im * c; re = nr;
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
    desc: 'Root and fifth as slowly breathing detuned partials — the floor of a soundscape.',
    sr: 22050, tail: 7.5, fade: [1.4, 2.2], trim: 0, send: { rev: 0.6, dly: 0.05 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 7.5);
      const y = new Float32Array(n);
      const bases = [[f, 10, 1.0], [f * 1.4983, 5, 0.28]];
      for (const cents of [-6, 0, 5]) {
        const det = Math.pow(2, cents / 1200);
        for (const [base, K, g] of bases) {
          for (let k = 1; k <= K; k++) {
            const fk = base * det * k;
            if (fk > sr * 0.44) break;
            const a = g / Math.pow(k, 1.4 - 0.5 * vel);
            const w = TAU * fk / sr;
            const wl = TAU * (0.05 + rnd() * 0.25) / sr;
            let p = rnd() * TAU, q = rnd() * TAU;
            let zr = Math.cos(p), zi = Math.sin(p), lr = Math.cos(q), li = Math.sin(q);
            const cw = Math.cos(w), sw = Math.sin(w), cl = Math.cos(wl), sl = Math.sin(wl);
            for (let i = 0; i < n; i++) {
              y[i] += a * (1 + 0.45 * li) * zi;
              const nzr = zr * cw - zi * sw; zi = zr * sw + zi * cw; zr = nzr;
              const nlr = lr * cl - li * sl; li = lr * sl + li * cl; lr = nlr;
              if ((i & 4095) === 4095) {
                const m = 1 / Math.hypot(zr, zi), m2 = 1 / Math.hypot(lr, li);
                zr *= m; zi *= m; lr *= m2; li *= m2;
              }
            }
          }
        }
      }
      return y;
    }
  },
  {
    id: 'cloud', name: 'Grain Cloud', family: 'experimental',
    desc: 'A swarm of tiny sine grains scattered around the note, its octave and fifth.',
    sr: 22050, tail: 6.5, fade: [0.8, 1.6], trim: 0, send: { rev: 0.7, dly: 0.3 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const n = frames(sr, 6.5);
      const y = new Float32Array(n);
      const ratios = [1, 2, 3, 1, 1.5, 4];
      const count = Math.floor((10 + 8 * vel) * 5.5);
      for (let g = 0; g < count; g++) {
        const t0 = Math.floor((0.05 + rnd() * 5.0) * sr);
        const len = Math.floor((0.15 + rnd() * 0.3) * sr);
        const fr = f * ratios[Math.floor(rnd() * ratios.length)] * Math.pow(2, (rnd() * 16 - 8) / 1200);
        if (fr > sr * 0.44) continue;
        const a = 0.3 + 0.7 * rnd();
        const w = TAU * fr / sr;
        const p = rnd() * TAU;
        for (let i = 0; i < len && t0 + i < n; i++) {
          const h = 0.5 - 0.5 * Math.cos(TAU * i / len);
          y[t0 + i] += a * h * (Math.sin(w * i + p) + 0.35 * Math.sin(2 * w * i + 2 * p));
        }
      }
      return y;
    }
  },
  /* ---- BATCH 1: Core Metallic Textures ---- */
  {
    id: 'tibetan', name: 'Tibetan Singing Bowl', family: 'traditional',
    desc: 'Deep bronze bowl with inharmonic beating partials and a long glassy bloom; harder strikes brighten the upper rim modes.',
    sr: 32000, tail: 9.0, fade: [0.04, 1.6], trim: 0, send: { rev: 0.62, dly: 0.08 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 9.0));
      const R = [1, 2.76, 5.40, 8.93, 12.6, 17.1];
      const A = [1, 0.72, 0.38, 0.18, 0.08, 0.03];
      const T = [8.6, 6.4, 4.4, 2.8, 1.7, 0.9];
      const b = 0.35 + 0.65 * vel;
      const modes = [];
      R.forEach((r, k) => {
        const a = A[k] * (k === 0 ? 1 : b);
        const beat = 0.12 + 0.1 * k + rnd() * 0.04;
        modes.push([f * r - beat, a, T[k]]);
        modes.push([f * r + beat, a * 0.82, T[k] * 0.92]);
      });
      const atk = 0.45 - 0.32 * vel;
      addModes(y, sr, modes, atk);
      click(y, sr, rnd, 9, f * 2.2 + 400, 1.6, 0.18 * vel);
      return biquad(y, 'lp', 1800 + 5200 * vel, 0.65, sr);
    }
  },
  {
    id: 'tongue', name: 'Steel Tongue Drum', family: 'traditional',
    desc: 'Boxier cousin of the handpan: fewer high partials, shorter decay, contained shell resonance.',
    sr: 44100, tail: 3.8, fade: [0.001, 0.35], trim: 0, send: { rev: 0.28, dly: 0.14 }, pan: 0.04,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 3.8));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f - 0.15, 1.0, 3.4],
        [f + 0.15, 0.88, 3.1],
        [f * 2.002, 0.32 * b + 0.05, 2.0],
        [f * 2.99, 0.14 * b, 1.15],
        [f * 4.02, 0.05 * b, 0.55]
      ], 0.002);
      click(y, sr, rnd, 5, f * 1.5 + 280, 1.2, 0.28 * vel);
      return biquad(y, 'lp', 1400 + 4200 * vel, 0.75, sr);
    }
  },
  {
    id: 'crystal_kalimba', name: 'Crystal Kalimba', family: 'traditional',
    desc: 'Pure glassy tine pluck — sine-led fundamental with brief crystalline partials and rapid decay.',
    sr: 44100, tail: 2.8, fade: [0.001, 0.22], trim: 0, send: { rev: 0.3, dly: 0.22 }, pan: 0.1,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 2.8));
      const b = 0.35 + 0.65 * vel;
      addModes(y, sr, [
        [f, 1.0, 2.2],
        [f * 2.0, 0.12 * b, 0.9],
        [f * 6.27, 0.22 * b, 0.45],
        [f * 12.3, 0.06 * b, 0.12]
      ], 0.0008);
      click(y, sr, rnd, 2.5, 3800 + 1200 * vel, 1.1, 0.16 * vel);
      return biquad(y, 'lp', 2200 + 7000 * vel, 0.6, sr);
    }
  },
  {
    id: 'ice_chime', name: 'Ice Chime', family: 'hybrid',
    desc: 'Fragile glass-like strike: sharp transient, sparse high-Q partials, short cold sustain.',
    sr: 44100, tail: 2.4, fade: [0.0005, 0.18], trim: 0, send: { rev: 0.4, dly: 0.28 }, pan: 0.18,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 2.4));
      const b = 0.3 + 0.7 * vel;
      addModes(y, sr, [
        [f, 1.0, 1.6],
        [f * 2.41, 0.45 * b, 0.7],
        [f * 3.92, 0.22 * b, 0.35],
        [f * 6.15, 0.1 * b, 0.18],
        [f * 9.4, 0.04 * b, 0.08]
      ], 0.0004);
      click(y, sr, rnd, 2, 5200 + 2000 * vel, 2.2, 0.35 * vel);
      return biquad(y, 'lp', 2800 + 9000 * vel, 0.55, sr);
    }
  },
  {
    id: 'windchimes', name: 'Zen Windchimes', family: 'experimental',
    desc: 'Primary pitch plus scattered ultra-high metallic transients that drift around the struck note.',
    sr: 44100, tail: 4.2, fade: [0.002, 0.5], trim: 0, send: { rev: 0.5, dly: 0.25 }, pan: 0,
    render({ f, vel, sr, rnd }) {
      const y = new Float32Array(frames(sr, 4.2));
      const b = 0.4 + 0.6 * vel;
      addModes(y, sr, [
        [f, 0.7, 3.2],
        [f * 2.01, 0.2 * b, 1.6],
        [f * 3.05, 0.08 * b, 0.7]
      ], 0.003);
      click(y, sr, rnd, 3, f * 3 + 600, 1.5, 0.12 * vel);
      const count = 4 + Math.floor(6 * vel);
      for (let g = 0; g < count; g++) {
        const t0 = Math.floor((0.02 + rnd() * 2.8) * sr);
        const len = Math.floor((0.08 + rnd() * 0.35) * sr);
        const fr = f * (2.5 + rnd() * 6.5) * Math.pow(2, (rnd() * 20 - 10) / 1200);
        if (fr > sr * 0.44) continue;
        const a = (0.12 + 0.25 * rnd()) * b;
        const w = TAU * fr / sr;
        const p = rnd() * TAU;
        for (let i = 0; i < len && t0 + i < y.length; i++) {
          const h = Math.exp(-i / (sr * 0.08));
          y[t0 + i] += a * h * Math.sin(w * i + p);
        }
      }
      return biquad(y, 'lp', 3000 + 8000 * vel, 0.5, sr);
    }
  }
];

export const VOICE_MAP = new Map(VOICES.map((v) => [v.id, v]));
export const voiceIds = () => VOICES.map((v) => v.id);
