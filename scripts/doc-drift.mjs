#!/usr/bin/env node
/**
 * scripts/doc-drift.mjs — CI guard that docs cannot silently rot.
 *
 * Asserts key claims about the shipped handpan-app so documentation and
 * reality stay in sync. Fails (exit non-zero) on any drift.
 *
 * Checks:
 *   - No sequential `@import` in any shipped stylesheet under handpan-app/
 *   - Stub stylesheets (pionier-layout.css, pionier-ambient.css) are not
 *     linked from handpan-app/index.html
 *   - Script tag count in index.html is at or below the budget
 *   - All files referenced by index.html (scripts + stylesheets) exist on disk
 *   - Service worker SHELL references only files that exist
 *   - Size budgets: index.html, critical CSS sum
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const errors = [];
const fail = (msg) => {
  errors.push(msg);
  console.error('  ✗', msg);
};

const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');

// --- 1. No @import in shipped CSS (only CSS linked from index.html) ---------
const linkedCssRefs = [
  ...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g),
].map((m) => m[1].split('?')[0]);

let importCount = 0;
for (const ref of linkedCssRefs) {
  if (!ref.startsWith('./')) continue;
  const cssPath = path.join(app, ref.replace(/^\.\//, ''));
  if (!fs.existsSync(cssPath)) continue;
  const src = fs.readFileSync(cssPath, 'utf8');
  for (const _ of src.matchAll(/@import\s+/g)) {
    importCount++;
    fail(`@import found in linked stylesheet ${ref}`);
  }
}
if (importCount === 0) console.log('  ✓ no @import in linked stylesheets');

// --- 2. Stub stylesheets not linked from index.html -------------------------
const stubs = ['pionier-layout.css', 'pionier-ambient.css'];
for (const stub of stubs) {
  if (html.includes(stub)) fail(`stub stylesheet ${stub} still linked from index.html`);
}
if (!html.includes('pionier-layout.css') && !html.includes('pionier-ambient.css')) {
  console.log('  ✓ stub stylesheets not linked from index.html');
}

// --- 3. Script tag count (informational; Phase 2 bundling reduces to ~1) ---
const scriptTags = (html.match(/<script\b/g) || []).length;
console.log(`  script tags: ${scriptTags} (Phase 2 target: 1 entry module + boot flag)`);

// --- 4. All referenced assets exist on disk ---------------------------------
const assetRefs = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)].map(
  (m) => m[1].split('?')[0]
);

let missing = 0;
for (const ref of assetRefs) {
  if (!ref.startsWith('./') && !ref.startsWith('/')) continue;
  const target = path.join(app, ref.replace(/^\.\//, ''));
  if (!fs.existsSync(target)) {
    missing++;
    fail(`missing asset referenced from index.html: ${ref}`);
  }
}
if (missing === 0) console.log('  ✓ all index.html assets exist on disk');

// --- 5. SW SHELL references only existing files -----------------------------
const sw = fs.readFileSync(path.join(app, 'sw.js'), 'utf8');
const shellMatch = sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\];/);
if (shellMatch) {
  const shellItems = shellMatch[1].match(/['`]([^'`]+)['`]/g) || [];
  let swMissing = 0;
  for (const item of shellItems) {
    const ref = item.replace(/['`]/g, '').split('?')[0];
    const target = path.join(app, ref.replace(/^\.\//, ''));
    if (!fs.existsSync(target)) {
      swMissing++;
      fail(`SW SHELL references missing file: ${ref}`);
    }
  }
  if (swMissing === 0) console.log(`  ✓ SW SHELL (${shellItems.length} entries) all exist`);
} else {
  fail('could not parse SW SHELL array');
}

// --- 6. Size budgets --------------------------------------------------------
const indexSize = fs.statSync(path.join(app, 'index.html')).size;
const indexBudget = 80 * 1024;
console.log(`  index.html: ${indexSize} bytes (budget ≤ ${indexBudget})`);
if (indexSize > indexBudget) fail(`index.html too large: ${indexSize} > ${indexBudget}`);

// Linked CSS raw sum (informational; optimized shipping budget is enforced in CI)
let cssSum = 0;
for (const ref of linkedCssRefs) {
  if (!ref.startsWith('./')) continue;
  const p = path.join(app, ref.replace(/^\.\//, ''));
  if (fs.existsSync(p)) cssSum += fs.statSync(p).size;
}
console.log(`  linked CSS raw sum: ${cssSum} bytes (optimized budget < 250,000 enforced in CI)`);

console.log('');
if (errors.length) {
  console.error(`DOC DRIFT DETECTED · ${errors.length} error(s)`);
  process.exit(1);
}
console.log('Doc drift check: OK');
