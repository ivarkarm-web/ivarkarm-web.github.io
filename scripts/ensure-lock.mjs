#!/usr/bin/env node
/**
 * Reconstruct package-lock.json from scripts/lock-parts/*.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = path.join(root, 'scripts', 'lock-parts');
const out = path.join(root, 'package-lock.json');

const parts = fs.readdirSync(partsDir)
  .filter((f) => /^\d+\.txt$/.test(f))
  .sort((a, b) => Number(a.replace('.txt', '')) - Number(b.replace('.txt', '')));

if (!parts.length) {
  console.error('No lock parts found in scripts/lock-parts/');
  process.exit(1);
}

const body = parts.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('');
JSON.parse(body);
fs.writeFileSync(out, body);
console.log('Wrote package-lock.json (' + body.length + ' bytes) from ' + parts.length + ' parts');
