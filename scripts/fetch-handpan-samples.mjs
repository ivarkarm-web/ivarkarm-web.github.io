#!/usr/bin/env node
/**
 * scripts/fetch-handpan-samples.mjs
 *
 * Pulls dry one-shot handpan hits listed by haganenote/virtual-handpan
 * (actual files live at www.haganenote.com/vst — not in the git tree).
 * SparkFun Digital_Handpan contains no sample WAVs (hardware firmware only).
 *
 * Usage:
 *   node scripts/fetch-handpan-samples.mjs
 *   node scripts/fetch-handpan-samples.mjs --out handpan-app/sounds/notes
 */
import { createWriteStream, mkdirSync, writeFileSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0
  ? join(ROOT, process.argv[outArg + 1])
  : join(ROOT, 'handpan-app/sounds/notes');

const BASE = 'https://www.haganenote.com/vst/';
const FILES = [
  ['C3.mp3', 'C3.mp3', 48, 'C3'],
  ['Cdiesis3.mp3', 'Cs3.mp3', 49, 'C♯3'],
  ['D3.mp3', 'D3.mp3', 50, 'D3'],
  ['Eb3.mp3', 'Eb3.mp3', 51, 'E♭3'],
  ['E3.mp3', 'E3.mp3', 52, 'E3'],
  ['F3.mp3', 'F3.mp3', 53, 'F3'],
  ['Fdiesis3.mp3', 'Fs3.mp3', 54, 'F♯3'],
  ['G3.mp3', 'G3.mp3', 55, 'G3'],
  ['Gdiesis3.mp3', 'Gs3.mp3', 56, 'G♯3'],
  ['A3.mp3', 'A3.mp3', 57, 'A3'],
  ['Bb3.mp3', 'Bb3.mp3', 58, 'B♭3'],
  ['B3.mp3', 'B3.mp3', 59, 'B3'],
  ['C4.mp3', 'C4.mp3', 60, 'C4'],
  ['Cdiesis4.mp3', 'Cs4.mp3', 61, 'C♯4'],
  ['D4.mp3', 'D4.mp3', 62, 'D4'],
  ['Ddiesis4.mp3', 'Ds4.mp3', 63, 'D♯4'],
  ['E4.mp3', 'E4.mp3', 64, 'E4'],
  ['F4.mp3', 'F4.mp3', 65, 'F4'],
  ['Fdiesis4.mp3', 'Fs4.mp3', 66, 'F♯4'],
  ['G4.mp3', 'G4.mp3', 67, 'G4'],
  ['Gdiesis4.mp3', 'Gs4.mp3', 68, 'G♯4'],
  ['A4.mp3', 'A4.mp3', 69, 'A4'],
  ['Bb4.mp3', 'Bb4.mp3', 70, 'B♭4'],
  ['B4.mp3', 'B4.mp3', 71, 'B4'],
  ['C5.mp3', 'C5.mp3', 72, 'C5'],
  ['Db5.mp3', 'Db5.mp3', 73, 'D♭5'],
  ['D5.mp3', 'D5.mp3', 74, 'D5'],
  ['Eb5.mp3', 'Eb5.mp3', 75, 'E♭5'],
  ['E5.mp3', 'E5.mp3', 76, 'E5'],
  ['F5.mp3', 'F5.mp3', 77, 'F5'],
  ['Fdiesis5.mp3', 'Fs5.mp3', 78, 'F♯5']
];

mkdirSync(OUT, { recursive: true });
const samples = [];

for (const [remote, local, midi, pitch] of FILES) {
  const dest = join(OUT, local);
  if (existsSync(dest)) {
    console.log('skip', local);
    samples.push({ file: local, midi, pitch, type: 'one-shot' });
    continue;
  }
  const url = BASE + remote;
  process.stdout.write('GET ' + url + ' … ');
  const res = await fetch(url);
  if (!res.ok) {
    console.log('FAIL', res.status);
    continue;
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log('ok');
  samples.push({
    file: local,
    midi,
    pitch,
    type: 'one-shot',
    source: 'haganenote/virtual-handpan → ' + url
  });
}

samples.sort((a, b) => a.midi - b.midi);
writeFileSync(
  join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      description: 'Dry one-shot handpan note hits (not loops), mapped by MIDI.',
      samples
    },
    null,
    2
  )
);
console.log('Wrote', samples.length, 'samples →', OUT);
