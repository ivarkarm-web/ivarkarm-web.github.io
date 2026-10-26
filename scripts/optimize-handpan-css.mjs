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
import { transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');
const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');
const cssRefs = [...html.matchAll(/href=["'](\.\/[^"']+\.css(?:\?[^"']*)?)["']/g)]
  .map((m) => m[1].split('?')[0]);
const cssFiles = [...new Set(cssRefs)].map((ref) => path.join(app, ref.replace(/^\.\//, '')));
const content = [path.join(app, '**/*.html'), path.join(app, '**/*.js')];
const safelist = {
  standard: [
    /^is-/, /^has-/, /^theme-/, /^state-/, /^pionier-/, /^fx-/, /^looper-/,
    /^soundscape-/, /^instrument-/, /^scale-/, /^note-/, /^knob-/, /^control-/,
    /^app-/, /^pan-/, /^welcome-/, /^tonefield-/, /^tone-field-/,
    /^(active|open|hidden|playing|recording|selected|disabled|muted|loading|error|ready|visible|on|off)$/,
  ],
};
const before = cssFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const purged = await new PurgeCSS().purge({
  content,
  css: cssFiles,
  safelist,
  keyframes: false,
  fontFace: false,
  variables: false,
});
const byPath = new Map(purged.map((item) => [path.resolve(item.file), item.css]));
let after = 0;
for (const file of cssFiles) {
  const css = byPath.get(path.resolve(file));
  if (typeof css !== 'string') throw new Error('PurgeCSS did not return output for ' + path.relative(root, file));
  const minified = await transform(css, { loader: 'css', minify: true, legalComments: 'none' });
  fs.writeFileSync(file, minified.code);
  after += Buffer.byteLength(minified.code);
  console.log(path.relative(root, file) + ': ' + Buffer.byteLength(minified.code) + ' bytes');
}
console.log('Pionier linked CSS: ' + before + ' -> ' + after + ' bytes (' + Math.round((1 - after / before) * 1000) / 10 + '% reduction).');
console.log('Budget: strictly under 250,000 bytes.');
