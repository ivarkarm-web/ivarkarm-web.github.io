// Usage: node render-voices.mjs [outDir]
// Renders every voice at 3 pitches, prints loudness / pitch-accuracy / NaN checks and writes WAVs.
import fs from 'node:fs';
import path from 'node:path';
import { renderNote, TARGET_RMS_DB } from './library.js';
import { VOICES } from './voices.js';
import { rmsRange, peakOf, gainToDb } from './dsp.js';

const outDir = process.argv[2];
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const PITCHES = [110, 261.63, 880];
const SKIP_PITCH = new Set(['cloud']); // stochastic texture

function wav(data, sr) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  return b;
}

// spectral pitch estimate: Hann-windowed DFT scan within +-60 cents of f on the loudest 0.5 s
function estimatePitch(x, sr, f) {
  const win = Math.round(sr * 0.5), hop = Math.round(sr * 0.25);
  let bestA = 0, bestR = -1;
  for (let a = 0; a + win < x.length; a += hop) {
    const r = rmsRange(x, a, a + win);
    if (r > bestR) { bestR = r; bestA = a; }
  }
  const seg = new Float64Array(win);
  for (let i = 0; i < win; i++) seg[i] = x[bestA + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / win));
  const mag = (fr) => {
    const w = 2 * Math.PI * fr / sr; let re = 0, im = 0;
    const c = Math.cos(w), s = Math.sin(w); let zr = 1, zi = 0;
    for (let i = 0; i < win; i++) { re += seg[i] * zr; im += seg[i] * zi; const nr = zr * c - zi * s; zi = zr * s + zi * c; zr = nr; }
    return re * re + im * im;
  };
  let bf = f, bm = -1;
  for (let c = -60; c <= 60; c += 1) { const fr = f * Math.pow(2, c / 1200); const m = mag(fr); if (m > bm) { bm = m; bf = fr; } }
  return bf;
}

console.log(`target RMS ${TARGET_RMS_DB} dBFS (loudest 1.5 s)\n`);
console.log('voice      f(Hz)   peak   rms1.5s  cents-err   ms   nan');
let worstCents = 0, bad = 0;
for (const v of VOICES) {
  for (const f of PITCHES) {
    const t0 = performance.now();
    const { data, sr } = renderNote(v.id, f, 0.7);
    const ms = Math.round(performance.now() - t0);
    let nan = false;
    for (let i = 0; i < data.length; i++) if (!Number.isFinite(data[i])) { nan = true; break; }
    let rms = 0;
    for (let a = 0; a + sr * 1.5 < data.length; a += sr * 0.25) rms = Math.max(rms, rmsRange(data, a, a + sr * 1.5));
    let cents = '—';
    if (!SKIP_PITCH.has(v.id)) {
      const est = estimatePitch(data, sr, f);
      const c = 1200 * Math.log2(est / f);
      cents = c.toFixed(1);
      if (Math.abs(c) > 15) bad++;
      worstCents = Math.max(worstCents, Math.abs(c));
    }
    if (nan) bad++;
    console.log(
      v.id.padEnd(10), String(f).padEnd(7), peakOf(data).toFixed(2).padEnd(6),
      gainToDb(rms).toFixed(1).padStart(6), ' ', String(cents).padStart(8), ' ', String(ms).padStart(4), ' ', nan ? 'NAN' : 'ok'
    );
    if (outDir) fs.writeFileSync(path.join(outDir, `${v.id}_${f}.wav`), wav(data, sr));
  }
}
console.log(`\nworst pitch error: ${worstCents.toFixed(1)} cents, problems: ${bad}`);
process.exit(bad ? 1 : 0);
