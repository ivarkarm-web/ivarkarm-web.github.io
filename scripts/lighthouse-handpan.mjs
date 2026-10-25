#!/usr/bin/env node
/**
 * Performance gate for handpan-app (Phase 12).
 * Enforces file-size budgets from docs/PERFORMANCE-BUDGETS.md in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const budgets = {
  'index.html': 80 * 1024,
  'pionier-core.js': 120 * 1024,
  'pionier-app.js': 80 * 1024,
};

function size(p) {
  return fs.statSync(p).size;
}

let failed = false;
console.log('Pionier performance budgets (files)');
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

const index = fs.readFileSync(path.join(app, 'index.html'), 'utf8');
const cssRefs = [...index.matchAll(/href=["'](\.\/[^"']+\.css[^"']*)["']/g)].map((m) => m[1].split('?')[0]);
let cssSum = 0;
for (const rel of cssRefs) {
  const p = path.join(app, rel.replace(/^\.\//, ''));
  if (fs.existsSync(p)) cssSum += size(p);
}
const cssBudget = 250 * 1024;
const cssOk = cssSum <= cssBudget;
console.log((cssOk ? 'OK' : 'FAIL') + '  critical CSS sum  ' + cssSum + ' / ' + cssBudget + ' bytes (' + cssRefs.length + ' files)');
if (!cssOk) failed = true;

console.log('File budgets are the CI performance gate (optional local Lighthouse CLI).');

if (failed) {
  console.error('\nPerformance budget failed.');
  process.exit(1);
}
console.log('\nPerformance budgets OK.');
