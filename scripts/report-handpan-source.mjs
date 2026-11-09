#!/usr/bin/env node
/**
 * Source CSS/asset size report for handpan-app (readable source files).
 * This reports raw source bytes. It is NOT a production payload failure when
 * source CSS exceeds the 250,000-byte production reference: the shipped CSS is
 * PurgeCSS'd + minified by optimize-handpan-css.mjs and gated separately by
 * check-handpan-production-css.mjs / the production build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetIndex = process.argv.indexOf('--app-dir');
if (targetIndex >= 0 && !process.argv[targetIndex + 1]) {
  throw new Error('Usage: node scripts/report-handpan-source.mjs [--app-dir <directory>]');
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
console.log('Pionier source size report (raw, readable files)');
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
const productionReference = 250_000;
const overRef = cssSum >= productionReference;
const label = overRef ? 'WARN' : 'OK';
console.log(label + '  raw source CSS sum  ' + cssSum + ' / ' + productionReference + ' bytes reference (' + cssRefs.length + ' files)');
if (overRef) {
  console.log('      Source CSS exceeds the 250,000-byte PRODUCTION reference; this is a source-size warning, not a production payload failure.');
  console.log('      The shipped/optimized CSS is enforced separately (check-handpan-production-css / build optimizer) and must remain < 250,000 bytes.');
} else {
  console.log('      Raw source CSS is within the 250,000-byte production reference.');
}

if (failed) {
  console.error('\nSource report failed (entry-file budget exceeded or missing).');
  process.exit(1);
}
console.log('\nSource report complete (entry-file budgets OK).');
