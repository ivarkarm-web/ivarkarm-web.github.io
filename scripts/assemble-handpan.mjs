#!/usr/bin/env node
/**
 * Assemble handpan-src-*.js template-literal modules into handpan.bundle.js
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../handpan-app/js');
const files = readdirSync(dir)
  .filter((f) => /^handpan-src-\d+\.js$/.test(f))
  .sort((a, b) => {
    const na = +a.match(/(\d+)/)[1];
    const nb = +b.match(/(\d+)/)[1];
    return na - nb;
  });

const parts = files.map((f) => {
  const src = readFileSync(join(dir, f), 'utf8');
  const start = src.indexOf('`') + 1;
  const end = src.rindexOf('`');
  let raw = src.slice(start, end);
  raw = raw.replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\');
  return raw;
});

const out = parts.join('');
writeFileSync(join(dir, 'handpan.bundle.js'), out);
console.log('Assembled', files.length, 'chunks → handpan.bundle.js (', out.length, 'bytes)');
