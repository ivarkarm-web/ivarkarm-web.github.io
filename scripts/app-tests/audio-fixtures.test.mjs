import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('synthetic fixture generator creates marked non-production WAV fixtures', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'handpan-fixtures-'));
  execFileSync(process.execPath, ['scripts/generate-audio-fixtures.mjs', out], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(path.join(out, 'FIXTURE-ONLY.txt'), 'utf8').includes('Never ship'), true);
  let wavs = 0;
  for (const voice of fs.readdirSync(out)) {
    if (voice === 'FIXTURE-ONLY.txt') continue;
    wavs += fs.readdirSync(path.join(out, voice)).filter((file) => file.endsWith('.wav')).length;
  }
  assert.equal(wavs, 65);
});
