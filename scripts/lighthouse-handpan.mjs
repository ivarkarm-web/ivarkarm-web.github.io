#!/usr/bin/env node
/**
 * Source report (formerly ambiguous "lighthouse:app" gate).
 * Reports RAW, READABLE source sizes from handpan-app/. Entry-file budgets
 * (index/core/app) remain enforced. The critical CSS sum is reported against
 * the 250,000-byte PRODUCTION reference as a WARNING when over — it is NOT a
 * production payload failure. The shipped CSS is PurgeCSS'd+minified and gated
 * strictly by check-handpan-production-css.mjs / the build optimizer.
 * See docs/PERFORMANCE-BUDGETS.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetIndex = process.argv.indexOf('--app-dir');
if (targetIndex >= 0 && !process.argv[targetIndex + 1]) {
  throw new Error('Usage: node scripts/lighthouse-handpan.mjs [--app-dir <directory>]');
}
const app = targetIndex >= 0
  ? path.resolve(process.cwd(), process.argv[targetIndex + 1])
  : path.join(root, 'handpan-app');

const budgets = {
  'index.html': 80 * 1024,
  'pionier-core.js': 120 * 1024,
  'pionier-app.js': 80 * 1024,
};

function size(p) {
  return fs.statSync(p).size;
}

let failed = false;
console.log('Pionier SOURCE size report (raw, readable files — not the shipped payload)');
console.log('Directory: ' + path.relative(root, app));
for (const [name, max] of Object.entries(budgets)) {
  const p = path.join(app, name);
  if (!fs.existsSync(p)) {
    console.error('MISSING', name);
    failed = true;
    continue;
  }
  const n = size(p);
  const ok = n <= max;
  console.log((ok ? 'OK' : 'FAIL') + '  ' + name + '  ' + n + ' / ' + max + ' bytes');
  if (!ok) failed = true;
}

const indexPath = path.join(app, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('MISSING index.html; cannot compute CSS report.');
  process.exit(1);
}
const index = fs.readFileSync(indexPath, 'utf8');
const cssRefs = [...index.matchAll(/href=["'](\.\/[^"']+\.css[^"']*)["']/g)].map((m) => m[1].split('?')[0]);
let cssSum = 0;
for (const rel of cssRefs) {
  const p = path.join(app, rel.replace(/^\.\//, ''));
  if (fs.existsSync(p)) cssSum += size(p);
}
const productionReference = 250_000; // strict production limit applies to OPTIMIZED payload
const overRef = cssSum >= productionReference;
console.log((overRef ? 'WARN' : 'OK') + '  raw source CSS sum  ' + cssSum + ' / ' + productionReference + ' bytes production reference (' + cssRefs.length + ' files)');
if (overRef) {
  console.log('      WARNING (source only): raw source CSS exceeds the 250,000-byte production reference.');
  console.log('      This is NOT a production payload failure. Shipped CSS is PurgeCSS\'d+minified and must be strictly < 250,000 bytes (see check-handpan-production-css.mjs / build).');
}

if (failed) {
  console.error('\nSource report failed (entry-file budget exceeded or missing).');
  process.exit(1);
}
console.log('\nSource report complete (entry-file budgets OK). Run check-handpan-production-css.mjs for the strict production payload gate.');
