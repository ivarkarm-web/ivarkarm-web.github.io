/**
 * sound/dsp.js — low-level DSP primitives for the Pionier sound library.
 *
 * Everything here is pure: Float32Array in, Float32Array out. No Web Audio,
 * no DOM, so the same code runs in the browser and in Node for testing.
 */
export const TAU = Math.PI * 2;

/** Small deterministic RNG (xorshift32) so a given note always renders identically. */
export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const frames = (sr, sec) => Math.max(1, Math.round(sr * sec));
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(g, 1e-9));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function whiteNoise(n, rnd) {
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = rnd() * 2 - 1;
  return y;
}

/** RBJ biquad. type: 'lp' | 'hp' | 'bp' (constant 0 dB peak). */
export function biquad(x, type, fc, q, sr) {
  fc = clamp(fc, 10, sr * 0.45);
  const w0 = TAU * fc / sr;
  const c = Math.cos(w0);
  const al = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  const a1 = (-2 * c) / a0;
  const a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Modal synthesis: add a bank of exponentially-decaying sinusoids into y.
 * modes: [[freqHz, amplitude, t60Seconds, phase?], ...]
 * atk: raised-cosine attack in seconds.
 */
export function addModes(y, sr, modes, atk = 0.002) {
  const n = y.length;
  const atkN = Math.max(1, atk * sr);
  for (const m of modes) {
    const f = m[0], a = m[1], t60 = m[2], ph = m[3] || 0;
    if (!(f > 0) || f > sr * 0.46 || !a) continue;
    const w = TAU * f / sr;
    const d = Math.pow(0.001, 1 / (t60 * sr));
    const lim = Math.min(n, Math.floor(t60 * sr * 1.7));
    let env = a;
    for (let i = 0; i < lim; i++) {
      const g = i < atkN ? 0.5 - 0.5 * Math.cos(Math.PI * i / atkN) : 1;
      y[i] += env * g * Math.sin(w * i + ph);
      env *= d;
    }
  }
  return y;
}

/**
 * Recirculating delay line with fractional-delay allpass tuning.
 * Used for Karplus-Strong plucks (init = excitation) and for blown tubes
 * (input = breath noise, sign = -1, mult = 2 for a closed pipe).
 * The loop is tuned so the fundamental lands on f.
 */
export function delayLoop(len, sr, f, o = {}) {
  const mult = o.mult || 1;
  const s = o.s ?? 0.5;               // 2-tap loop lowpass: (1-s)*x[n] + s*x[n-1]
  const sign = o.sign || 1;
  const t60 = o.t60 || 3;
  const g = Math.pow(0.001, 1 / (t60 * f * mult));
  const D = sr / (f * mult) - s;
  const N = Math.max(2, Math.floor(D - 0.5));
  const delta = D - N;                // in [0.5, 1.5)
  const eta = (1 - delta) / (1 + delta);
  const line = new Float32Array(N);
  if (o.init) line.set(o.init.subarray(0, Math.min(N, o.init.length)));
  const y = new Float32Array(len);
  let idx = 0, prev = 0, apx = 0, apy = 0;
  const input = o.input;
  for (let i = 0; i < len; i++) {
    const out = line[idx];
    const filt = (1 - s) * out + s * prev;
    prev = out;
    const ap = eta * filt + apx - eta * apy;
    apx = filt; apy = ap;
    const val = sign * g * ap + (input ? input[i] : 0);
    line[idx] = val;
    idx = idx + 1 === N ? 0 : idx + 1;
    y[i] = input ? val : out;
  }
  return y;
}

export function removeDC(y) {
  let m = 0;
  for (let i = 0; i < y.length; i++) m += y[i];
  m /= y.length;
  for (let i = 0; i < y.length; i++) y[i] -= m;
  return y;
}

/** Raised-cosine fade in / out (seconds). */
export function fadeEdges(y, sr, inS, outS) {
  const a = Math.min(y.length, Math.round(inS * sr));
  const b = Math.min(y.length, Math.round(outS * sr));
  for (let i = 0; i < a; i++) y[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
  for (let i = 0; i < b; i++) y[y.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / b);
  return y;
}

export function softClip(y, drive = 1) {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * drive) * k;
  return y;
}

/** Bit + sample-rate reduction (music-box / lo-fi character). */
export function crush(y, bits, hold) {
  const q = Math.pow(2, bits - 1);
  let held = 0;
  for (let i = 0; i < y.length; i++) {
    if (i % hold === 0) held = Math.round(y[i] * q) / q;
    y[i] = held;
  }
  return y;
}

export function peakOf(y) {
  let p = 0;
  for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); if (a > p) p = a; }
  return p;
}

export function rmsRange(y, a, b) {
  a = Math.max(0, a | 0); b = Math.min(y.length, b | 0);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += y[i] * y[i];
  return Math.sqrt(s / (b - a));
}

/** Stereo reverb impulse response: decaying noise that darkens as it fades. */
export function reverbIR(sr, seconds, seed = 7, darkness = 0.85) {
  const n = frames(sr, seconds);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    const rnd = makeRng(seed + ch * 101);
    const y = out[ch];
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const c = 0.9 * Math.pow(1 - t, 1.6) * (1 - darkness) + 0.06 + 0.55 * Math.pow(1 - t, 3) * (1 - darkness);
      lp += c * ((rnd() * 2 - 1) - lp);
      const env = Math.pow(0.001, i / (n * 0.92));
      const pre = i < sr * 0.012 ? i / (sr * 0.012) : 1;
      y[i] = lp * env * pre * 3.2;
    }
  }
  return out;
}
