/**
 * Production smoke checks for the current portfolio + Pionier deployment.
 * Keep checks tied to the real entry points; detailed browser behavior is
 * covered by scripts/app-tests/handpan.spec.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const checked = [];
const fail = (message) => { errors.push(message); console.error('  ✗', message); };
const ok = (message) => { checked.push(message); console.log('  ✓', message); };
const read = (rel) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { fail('Missing required file: ' + rel); return ''; }
  return fs.readFileSync(full, 'utf8');
};

console.log('\nIvar Karm – Resonance · production smoke test\n');

const rootHtml = read('index.html');
read('styles.css');
read('script.js');
const appHtml = read('handpan-app/index.html');
const shell = read('handpan-app/pionier-app.js');
const core = read('handpan-app/pionier-core.js');
read('handpan-app/pionier.css');
read('handpan-app/js/audio-core.js');
read('handpan-app/js/instrument.js');
read('handpan-app/js/gesture.js');
read('handpan-app/js/fx.js');
read('handpan-app/js/instruments/handpan.js');
read('handpan-app/js/instruments/bird.js');
read('handpan-app/js/instruments/kitchen.js');
read('handpan-app/js/pionier-surface.js');
const soundscapes = read('handpan-app/js/soundscapes.js');
read('handpan-app/js/mandala-canvas.js');

if (rootHtml.includes('<title>') && rootHtml.includes('</html>')) ok('Portfolio document is present');
else fail('Portfolio HTML document is incomplete');
if (appHtml.includes('id="pan"') && appHtml.includes('id="instrumentDropdownToggle"')) ok('Pionier has its real instrument entry surface');
if (appHtml.includes('id="soundscapesPage"') && appHtml.includes('id="mandalaPlay"') && appHtml.includes('id="soundscapeAudio"')) ok('Soundscapes player markup is present');
else fail('Soundscapes player markup is missing');
if (/createMandalaRenderer/.test(soundscapes) && /pointerdown/.test(soundscapes) && /pointerup/.test(soundscapes)) ok('Soundscapes renderer and swipe navigation are present');
else fail('Soundscapes renderer or swipe navigation is missing');
else fail('Pionier instrument entry surface is missing');
if (appHtml.includes('name="description"')) ok('Pionier description metadata is present');
else fail('Pionier description metadata is missing');
if (/pionier-core\.js/.test(shell) && !/cdn\.jsdelivr\.net|fetch\(GOOD\)|new Blob|CORE_PATCHES/.test(shell)) ok('Pionier boot uses the local core without runtime source rewriting');
else fail('Pionier boot still depends on remote source rewriting');
if (/window\.PionierCore/.test(core) && /pionier:learn-note/.test(core)) ok('Core API and lesson note events are exposed');
else fail('Core API or lesson note events are missing');
if (!/ghp_[A-Za-z0-9]{20,}/.test(rootHtml + shell + core)) ok('No obvious GitHub token in entry source');
else fail('Possible GitHub token in source');

const jsFiles = [];
function collectJs(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) collectJs(rel);
    else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(rel);
  }
}
collectJs('.');
for (const rel of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  if (result.status === 0) ok('JS syntax: ' + rel);
  else fail('JS syntax: ' + rel + (result.stderr ? ' — ' + result.stderr.trim().split('\n')[0] : ''));
}

console.log('');
if (errors.length) {
  console.error('FAILED · ' + errors.length + ' error(s), ' + checked.length + ' check(s) passed');
  process.exit(1);
}
console.log('PASSED · ' + checked.length + ' checks');
