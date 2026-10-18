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
const coreSrc = read('handpan-app/pionier-core.js');
const loopControls = read('handpan-app/js/looper.js');
const loopStyles = read('handpan-app/looper.css');
const serviceWorker = read('handpan-app/sw.js');
read('handpan-app/pionier.css');
read('handpan-app/js/audio-core.js');
read('handpan-app/js/instrument.js');
read('handpan-app/js/gesture.js');
read('handpan-app/js/fx.js');
read('handpan-app/js/instruments/handpan.js');
read('handpan-app/js/instruments/library-family.js');
for (const f of ['dsp', 'voices', 'library', 'space']) read(`handpan-app/js/sound/${f}.js`);
read('handpan-app/js/pionier-surface.js');
const soundscapes = read('handpan-app/js/soundscapes.js');
read('handpan-app/js/mandala-canvas.js');
const noteSampleManifest = JSON.parse(read('handpan-app/sounds/notes/manifest.json'));
const licenseDoc = read('docs/AUDIO-LICENSES.md');
const bundledNoteAudioDir = path.join(root, 'handpan-app/sounds/notes');
const bundledNoteAudio = fs.existsSync(bundledNoteAudioDir)
  ? fs.readdirSync(bundledNoteAudioDir).filter((name) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name))
  : [];
const samples = Array.isArray(noteSampleManifest.samples) ? noteSampleManifest.samples : [];
const ownerCleared =
  noteSampleManifest.status === 'owner-prototype' &&
  /owner/i.test(String(noteSampleManifest.license_note || '')) &&
  /Owner-recorded handpan prototype|D3_v1\.wav/i.test(licenseDoc);

if (samples.length === 0 && bundledNoteAudio.length === 0) {
  ok('No third-party note audio is bundled; synth fallback remains available');
} else if (ownerCleared) {
  const missing = samples
    .map((s) => s.file)
    .filter((file) => file && !fs.existsSync(path.join(bundledNoteAudioDir, file)));
  const listed = new Set(samples.map((s) => s.file).filter(Boolean));
  const extras = bundledNoteAudio.filter((name) => !listed.has(name));
  if (extras.length) {
    fail('Note audio files present without a matching owner-prototype manifest entry: ' + extras.join(', '));
  } else if (bundledNoteAudio.length && missing.length) {
    fail('Owner prototype manifest references missing note files: ' + missing.join(', '));
  } else {
    ok(
      bundledNoteAudio.length
        ? 'Owner-recorded prototype note audio is documented and files match the manifest'
        : 'Owner-prototype note manifest is documented (binaries pending); synth fallback remains'
    );
  }
} else {
  fail('Uncleared note audio is still bundled or referenced by the sample manifest');
}

if (rootHtml.includes('<title>') && rootHtml.includes('</html>')) ok('Portfolio document is present');
else fail('Portfolio HTML document is incomplete');

if (appHtml.includes('id="pan"') && appHtml.includes('id="instrumentDropdownToggle"')) ok('Pionier has its real instrument entry surface');
else fail('Pionier instrument entry surface is missing');

if (/function openTrackPanel/.test(loopControls) && /pendingTap\.index === i/.test(loopControls) && /data-control="delay"/.test(loopControls) && /data-control="cut"/.test(loopControls) && /quantizeWait/.test(loopControls) && /delayWet/.test(loopControls)) ok('Double-tap loop mixer exposes playback, level, delay, cutoff and quantize controls');
else fail('Dedicated loop track mixer wiring is incomplete');
if (/function confirmDeleteLayer/.test(loopControls) && /Delete track/.test(loopControls) && /confirmDeleteLayer\(i\)/.test(loopControls)) ok('Holding a loop opens a delete confirmation; deletion requires a confirm tap');
else fail('Loop hold-to-delete confirmation wiring is incomplete');
if (/\.looper-track-overlay/.test(loopStyles) && /looper\.css\?v=209/.test(appHtml) && /js\/looper\.js\?v=211/.test(shell) && /pionier-v72/.test(serviceWorker)) ok('Loop mixer styles and service-worker cache versions are refreshed');
else fail('Loop mixer cache versions are stale');

// Current shell uses soundscapesPanel + soundscapeAudio (+ optional play control).
if (
  (appHtml.includes('id="soundscapesPanel"') || appHtml.includes('id="soundscapesPage"')) &&
  appHtml.includes('id="soundscapeAudio"') &&
  (appHtml.includes('id="soundscapePlay"') || appHtml.includes('id="mandalaPlay"') || appHtml.includes('id="openSoundscapes"'))
) ok('Soundscapes player markup is present');
else fail('Soundscapes player markup is missing');

const mandala = read('handpan-app/js/mandala-canvas.js');
if (/BEDROOM_SESSIONS/.test(soundscapes) && /pointerdown/.test(soundscapes) && /mediaSession/.test(soundscapes)) ok('Soundscapes Bedroom Sessions player is present');
else fail('Soundscapes Bedroom Sessions player is missing');
if (/createMandalaRenderer/.test(mandala)) ok('Mandala renderer module is present');
else fail('Mandala renderer module is missing');

if (appHtml.includes('name="description"')) ok('Pionier description metadata is present');
else fail('Pionier description metadata is missing');

// Boot: shell imports local pionier-core; loader must not use CDN.
if (/pionier-core\.js/.test(shell) && !/cdn\.jsdelivr\.net|fetch\(GOOD\)|CORE_PATCHES/.test(shell)) {
  ok('Pionier boot uses the local core without runtime source rewriting');
} else {
  fail('Pionier boot still depends on remote source rewriting');
}

if (!/cdn\.jsdelivr\.net/.test(coreSrc) && /window\.PionierCore/.test(coreSrc) && /from ['"]\.\/js\/audio-core\.js(?:\?[^'"]*)?['"]/.test(coreSrc)) {
  ok('Core is a real local ES module (no CDN, no blob loader)');
} else {
  fail('Core is not a real local ES module or still depends on CDN');
}

// Core API lives in the concatenated vendored source, not the thin loader.
if (/window\.PionierCore/.test(coreSrc) && /async function setInstrument/.test(coreSrc)) {
  ok('Core API is exposed in the vendored source');
} else {
  fail('Core API is missing from the vendored source');
}

const instrumentFamilyImports = coreSrc.match(/from ['"]\.\/js\/instruments\/[^'"]+['"]/g) || [];
if (instrumentFamilyImports.length === 2) ok('Instrument registry imports only the handpan and tonal families');
else fail('Unexpected instrument-family imports in the core registry (got ' + instrumentFamilyImports.length + ')');

if (!/ghp_[A-Za-z0-9]{20,}/.test(rootHtml + shell + coreSrc)) ok('No obvious GitHub token in entry source');
else fail('Possible GitHub token in source');

// Syntax-check complete JS modules only — skip intentional source fragments.
const skipSyntax = (rel) => {
  const base = rel.replace(/\\/g, '/');
  return (
    /handpan-src-\d+\.js$/.test(base) ||
    /surf-part-\d+\.js$/.test(base) ||
    /shell-part-\d+/.test(base) ||
    /b64-\d+\.js$/.test(base)
  );
};

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
  if (skipSyntax(rel)) {
    ok('JS fragment skipped (assembled at runtime): ' + rel);
    continue;
  }
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
