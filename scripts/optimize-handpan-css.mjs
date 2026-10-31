#!/usr/bin/env node
/**
 * Remove selectors not referenced by Pionier's HTML/JS, then minify the
 * linked stylesheets in the CI workspace. Source CSS in git remains readable.
 * This runs before browser tests and again in the Pages deploy workspace, so
 * tests and the deployed artifact exercise the exact optimized CSS payload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PurgeCSS } from 'purgecss';
import { transform } from 'lightningcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetIndex = process.argv.indexOf('--app-dir');
if (targetIndex >= 0 && !process.argv[targetIndex + 1]) {
  throw new Error('Usage: node scripts/optimize-handpan-css.mjs [--app-dir <directory>]');
}
const app = targetIndex >= 0
  ? path.resolve(process.cwd(), process.argv[targetIndex + 1])
  : path.join(root, 'handpan-app');
const appHtml = path.join(app, 'index.html');
if (!fs.existsSync(appHtml)) throw new Error('Pionier app entry not found: ' + appHtml);
const html = fs.readFileSync(appHtml, 'utf8');
const cssRefs = [...html.matchAll(/href=["'](\.\/[^"']+\.css(?:\?[^"']*)?)["']/g)]
  .map((m) => m[1].split('?')[0]);
const cssFiles = [...new Set(cssRefs)].map((ref) => path.join(app, ref.replace(/^\.\//, '')));
const content = [path.join(app, '**/*.html'), path.join(app, '**/*.js')];
// Runtime classes are included through the complete app JavaScript content
// above. Keep only state tokens that are toggled through shared state helpers.
const safelist = {
  standard: [/^is-/, /^has-/, /^theme-/, /^state-/],
};
function resolveImports(filePath, text, seen = new Set()) {
  const abs = path.resolve(filePath);
  if (seen.has(abs)) return '';
  seen.add(abs);
  return text.replace(/@import\s+url\(['"]?(\.\/[^'")]+)['"]?\)\s*;?/g, (_, ref) => {
    const target = path.resolve(path.dirname(abs), ref);
    if (!fs.existsSync(target)) return '';
    return resolveImports(target, fs.readFileSync(target, 'utf8'), seen);
  });
}

// Expand @import chains so PurgeCSS sees layout/ambient parts (not only shells).
const expandedCss = cssFiles.map((file) => {
  const raw = fs.readFileSync(file, 'utf8');
  const resolved = resolveImports(file, raw);
  return { file, css: resolved };
});
const beforeByPath = new Map(expandedCss.map((item) => [path.resolve(item.file), Buffer.byteLength(item.css)]));
const before = expandedCss.reduce((sum, item) => sum + Buffer.byteLength(item.css), 0);
const purged = await new PurgeCSS().purge({
  content,
  css: expandedCss.map((item) => ({ raw: item.css, name: item.file })),
  safelist,
  keyframes: false,
  fontFace: false,
  variables: false,
});
const byPath = new Map(purged.map((item) => [path.resolve(item.file), item.css]));
const budget = 250_000;
let after = 0;
for (const file of cssFiles) {
  const css = byPath.get(path.resolve(file));
  if (typeof css !== 'string') throw new Error('PurgeCSS did not return output for ' + path.relative(root, file));
  const minified = transform({ filename: file, code: Buffer.from(css), minify: true });
  fs.writeFileSync(file, minified.code);
  const optimizedBytes = Buffer.byteLength(minified.code);
  const originalBytes = beforeByPath.get(path.resolve(file));
  after += optimizedBytes;
  console.log(`${path.relative(root, file)}: ${originalBytes} -> ${optimizedBytes} bytes (saved ${originalBytes - optimizedBytes})`);
}
console.log('Pionier linked CSS: ' + before + ' -> ' + after + ' bytes (' + Math.round((1 - after / before) * 1000) / 10 + '% reduction).');
if (after < budget) {
  console.log(`CSS budget: PASS (${budget - after} bytes headroom; limit < ${budget.toLocaleString()} bytes).`);
} else {
  console.error(`CSS budget: FAIL (${(after - budget + 1).toLocaleString()} bytes over the maximum allowed ${budget - 1} bytes).`);
  process.exitCode = 1;
}
