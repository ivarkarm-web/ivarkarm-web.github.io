#!/usr/bin/env node
/**
 * Strict production CSS payload gate.
 * Enforces: optimized (PurgeCSS + minified) critical CSS linked by the app
 * entry must be strictly below 250,000 bytes. This measures the actual files
 * present in --app-dir (the deployment/build artifact), NOT raw source.
 *
 * Safety: if --app-dir resolves to the git-tracked source handpan-app/ tree,
 * --in-place-optimized is required to prove the caller has already optimized
 * those files in place (CI ephemeral checkout pattern). Without it, the gate
 * refuses to avoid accidentally measuring unoptimized source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceTree = path.resolve(root, 'handpan-app');

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  if (!process.argv[i + 1]) throw new Error('Missing value for ' + name);
  return process.argv[i + 1];
}

const appDirArg = argValue('--app-dir');
const app = appDirArg ? path.resolve(process.cwd(), appDirArg) : null;
const inPlaceOptimized = process.argv.includes('--in-place-optimized');
const BUDGET = 250_000; // strict: optimized CSS must be < 250,000 bytes

if (!app) {
  throw new Error('Usage: node scripts/check-handpan-production-css.mjs --app-dir <directory> [--in-place-optimized]\n' +
    'Example (local build artifact): --app-dir dist/handpan-app\n' +
    'Example (CI in-place optimized checkout): --app-dir handpan-app --in-place-optimized');
}

const isSourceTree = path.resolve(app) === sourceTree;
if (isSourceTree && !inPlaceOptimized) {
  console.error('Production CSS gate refused: --app-dir points at the source handpan-app/ tree without --in-place-optimized.');
  console.error('This guard prevents accidentally measuring unoptimized source CSS as a production payload.');
  console.error('Use --app-dir dist/handpan-app for a build artifact, or run optimize-handpan-css.mjs --allow-source first and pass --in-place-optimized in an ephemeral CI checkout.');
  process.exit(1);
}

const indexPath = path.join(app, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('MISSING index.html in ' + path.relative(root, app));
  process.exit(1);
}
const index = fs.readFileSync(indexPath, 'utf8');
const cssRefs = [...index.matchAll(/href=["'](\.\/[^"']+\.css[^"']*)["']/g)].map((m) => m[1].split('?')[0]);

let cssSum = 0;
const missing = [];
for (const rel of cssRefs) {
  const p = path.join(app, rel.replace(/^\.\//, ''));
  if (!fs.existsSync(p)) { missing.push(rel); continue; }
  cssSum += fs.statSync(p).size;
}
if (missing.length) {
  console.error('MISSING CSS files: ' + missing.join(', '));
  process.exit(1);
}

const context = isSourceTree ? 'in-place optimized source tree (CI artifact)' : 'build artifact';
console.log('Pionier PRODUCTION CSS gate (strict, optimized payload)');
console.log('Directory: ' + path.relative(root, app) + ' [' + context + ']');
const ok = cssSum < BUDGET;
console.log((ok ? 'PASS' : 'FAIL') + '  optimized critical CSS sum  ' + cssSum + ' / ' + BUDGET + ' bytes (' + cssRefs.length + ' files)');
if (!ok) {
  console.error('Production CSS payload must be strictly below ' + BUDGET.toLocaleString() + ' bytes.');
  process.exit(1);
}
console.log('Production CSS budget OK (' + (BUDGET - cssSum) + ' bytes headroom).');
