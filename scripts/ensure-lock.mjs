#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = path.join(root, 'scripts', 'lock-parts');
const out = path.join(root, 'package-lock.json');
const parts = fs.readdirSync(partsDir)
  .filter((f) => /^\d+\.b64$/.test(f))
  .sort((a, b) => Number(a.replace('.b64', '')) - Number(b.replace('.b64', '')));
if (!parts.length) { console.error('No lock parts'); process.exit(1); }
const b64 = parts.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8').trim()).join('');
const text = gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
JSON.parse(text);
fs.writeFileSync(out, text);
console.log('Wrote package-lock.json (' + text.length + ' bytes) from ' + parts.length + ' parts');
