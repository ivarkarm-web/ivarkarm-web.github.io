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
  'js/input-controller.js',
  'js/music-data.js',
  'js/music-player.js',
  'js/content.js',
  'js/core.js',
  'js/ui.js',
  'js/scenes.js',
  'js/scene-vegetation.js',
  'js/scenes-effects.js',
  'js/physics.js',
  'js/utilities.js',
  'js/easter-egg.js',
  'js/handpan.js',
  'easter-egg.css',
  'handpan.html',
  'handpan.css',
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

// Artist identity / navigation
if (html.includes('id="contact"') && html.includes('Invite')) ok('Stable #contact anchor and professional Invite label present');
else fail('Contact navigation target or Invite label missing');
if (html.includes('https://www.instagram.com/ivar.karm/') && html.includes('https://www.youtube.com/@IvarKarm')) ok('Artist social identity links present');
else fail('Artist social identity links missing');
if (html.includes('class="contact-pathways"') && html.includes('Live performance') && html.includes('Collaboration')) ok('Professional enquiry pathways present');
else fail('Professional enquiry pathways missing');

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

// Hidden Handpan easter egg
const eggJs = read('js/easter-egg.js') || '';
const hpJs = read('js/handpan.js') || '';
const hpHtml = read('handpan.html') || '';
const hpCss = read('handpan.css') || '';
if (html.includes('id="eggFound"') && html.includes('Easter egg found!') && html.includes('>Play Me<')) ok('Easter egg notice + Play Me markup present');
else fail('Easter egg markup missing from index.html');
if (html.includes('js/easter-egg.js') && html.includes('easter-egg.css')) ok('Easter egg script + stylesheet linked');
else fail('Easter egg not linked from index.html');
if (eggJs.includes('freezeMainAudio') && eggJs.includes('suspend()')) ok('Main audio is frozen before entering the Handpan');
else fail('Easter egg must freeze main audio');
if (/NOTES\s*=\s*\[/.test(hpJs) && ['E3', 'B3', 'D4', 'E4', 'D5', 'E5', 'G5', 'B5'].every((n) => hpJs.includes("'" + n + "'"))) ok('Handpan scale present (E Kurd, 13 notes)');
else fail('Handpan scale incomplete');
if (hpJs.includes('e.repeat') && hpJs.includes('keysDown')) ok('Handpan blocks key-repeat loops');
else fail('Handpan must block key repeat');
if (/touch-action:\s*none/.test(hpCss) && hpHtml.includes('maximum-scale=1')) ok('Handpan touch-action / zoom overrides present');
else fail('Handpan missing touch-action / zoom overrides');
if (/noindex/.test(hpHtml)) ok('Handpan page is noindex (hidden)');
else warn('Handpan page should be noindex');

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


// Architecture: music is a bounded subsystem, not part of the monolithic UI controller.
const musicDataPos = html.indexOf('js/music-data.js');
const musicPlayerPos = html.indexOf('js/music-player.js');
const uiPos = html.indexOf('js/ui.js');
if (musicDataPos >= 0 && musicPlayerPos > musicDataPos && uiPos > musicPlayerPos) ok('Music modules load before UI controller');
else fail('Music module load order is invalid');

const uiSource = read('js/ui.js') || '';
const musicPlayerSource = read('js/music-player.js') || '';
if (!/const\s+MUSIC_TRACKS\s*=/.test(uiSource)) ok('UI controller no longer owns music catalogue');
else fail('UI controller still declares MUSIC_TRACKS');
if (/const\s+MUSIC_TRACKS\s*=/.test(musicPlayerSource) && musicPlayerSource.includes('function initMusicPlayer')) ok('Music player owns catalogue binding and initialization');
else fail('Music player module boundary is incomplete');


const inputPos = html.indexOf('js/input-controller.js');
if (inputPos >= 0 && inputPos < uiPos) ok('Input controller loads before UI controller');
else fail('Input controller load order is invalid');
const inputSource = read('js/input-controller.js') || '';
if (inputSource.includes('const UnifiedModalitySystem') && inputSource.includes('function handleZoneTouchStart')) ok('Input controller owns modality and touch steering');
else fail('Input controller boundary is incomplete');
if (!uiSource.includes('const UnifiedModalitySystem') && !uiSource.includes('function handleZoneTouchStart')) ok('UI controller no longer owns touch input plumbing');
else fail('Touch input plumbing still lives in ui.js');

const vegetationPos = html.indexOf('js/scene-vegetation.js');
const scenesPos = html.indexOf('js/scenes.js');
if (vegetationPos >= 0 && vegetationPos < scenesPos) ok('Vegetation renderer loads before scene orchestration');
else fail('Vegetation renderer load order is invalid');
const scenesSource = read('js/scenes.js') || '';
if (!scenesSource.includes('function drawCypressMid') && !scenesSource.includes('function drawVegNear')) ok('Scene orchestration no longer owns vegetation primitives');
else fail('Vegetation primitives still live in scenes.js');

// Lightweight syntax validation for every JavaScript source file.
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
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  // This test intentionally avoids execution; it catches broken refactors without browser globals.
  try {
    const { spawnSync } = await import('child_process');
    const check = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
    if (check.status === 0) ok(`JS syntax: ${rel}`);
    else fail(`JS syntax: ${rel}${check.stderr ? ' — ' + check.stderr.trim().split('\n')[0] : ''}`);
  } catch (e) {
    warn(`Could not syntax-check ${rel}: ${e.message}`);
  }
}

console.log('');
if (errors.length) {
  console.error(`FAILED · ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`PASSED · ${warnings.length} warning(s)`);
process.exit(0);
