/**
 * Smoke checks for production readiness (no browser required).
 * Run: node scripts/smoke-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

function ok(msg) { console.log('  ✓', msg); }
function fail(msg) { errors.push(msg); console.error('  ✗', msg); }
function warn(msg) { warnings.push(msg); console.warn('  !', msg); }

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    fail(`Missing file: ${rel}`);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

console.log('\nIvar Karm – Resonance · smoke test\n');

// Required files
const required = [
  'index.html',
  'styles.css',
  'script.js',
  'js/analytics.js',
  'js/audio.js',
  'js/content.js',
  'js/core.js',
  'js/ui.js',
  'js/scenes.js',
  'js/scenes-effects.js',
  'js/physics.js',
  'js/utilities.js',
  'og-cover.jpg',
  'sitemap.xml',
  'robots.txt',
  'assets/partners/godan.jpg',
  'assets/partners/heka.jpg',
  'assets/partners/namana.jpg'
];
required.forEach((f) => {
  if (fs.existsSync(path.join(root, f))) ok(f);
  else fail(`Missing ${f}`);
});

const html = read('index.html') || '';
const analytics = read('js/analytics.js') || '';
const audio = read('js/audio.js') || '';
const scenes = read('js/scenes.js') || '';

// SEO
if (html.includes('og-cover.jpg')) ok('OG image points to JPG');
else fail('og:image should use og-cover.jpg');
if (html.includes('assets/partners/godan.jpg')) ok('Partner logos self-hosted');
else warn('Partner logos may still use external host');
if (html.includes('id="memoryShardHud"')) ok('Memory shard HUD present');
else fail('Missing memoryShardHud');
if (html.includes('name="description"')) ok('Meta description present');
else fail('Missing meta description');
if (html.includes('rel="canonical"')) ok('Canonical URL present');
else warn('No canonical link');

// Analytics
if (analytics.includes('IvarAnalytics') && analytics.includes('track(')) ok('Analytics API present');
else fail('Analytics API incomplete');
if (analytics.includes('doNotTrack') || analytics.includes('globalPrivacyControl')) ok('Respects DNT/GPC');
else warn('No DNT/GPC handling');

// Audio reactivity
if (audio.includes('updateBands')) ok('ResonanceAudio.updateBands exists');
else fail('Missing updateBands');

// Discoveries not suppressed
if (scenes.includes('function showMemoryShard') && !scenes.match(/showMemoryShard\(stone\)\s*\{\s*return/)) {
  ok('Memory shards not suppressed');
} else {
  fail('showMemoryShard appears suppressed');
}

// Critical IDs
['welcomeEnter', 'game', 'rabbit-hole', 'directMonographModal', 'qrPopup', 'mpAudio', 'tipButton'].forEach((id) => {
  if (html.includes(`id="${id}"`)) ok(`#${id}`);
  else fail(`Missing #${id}`);
});

// No pending visitor labels in TOC (best-effort)
if (/rh-toc-item-badge">Pending</.test(html)) fail('Visitor-facing Pending badge still in HTML');
else ok('No Pending TOC badges in HTML');

// Secrets heuristic
const allText = html + (read('js/ui.js') || '');
if (/ghp_[A-Za-z0-9]{20,}/.test(allText)) fail('Possible GitHub token in source');
else ok('No obvious GitHub token in scanned source');

console.log('');
if (errors.length) {
  console.error(`FAILED · ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`PASSED · ${warnings.length} warning(s)`);
process.exit(0);
