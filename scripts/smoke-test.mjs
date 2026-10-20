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

if (/export function mountLooper/.test(loopControls) && /startRecording|recording/.test(loopControls) && /clearAll/.test(loopControls)) ok('Looper mounts with record/play/clear surface');
else fail('Looper mount or record/clear surface is incomplete');
if (!/repository-loop-save/.test(loopControls) && !/uploadLoopToRepository/.test(loopControls)) ok('Looper does not import community upload modules');
else fail('Looper still references community upload modules');
if (/\.looper-/.test(loopStyles) && /looper\.css\?v=\d+/.test(appHtml) && /pionier-v\d+/.test(serviceWorker)) ok('Looper styles and service-worker declare cache versions');
else fail('Looper styles or service-worker cache versions missing');

const scaleSelector = read('handpan-app/js/scale-selector.js');
if ((/Search instruments/.test(coreSrc) || /instrumentMenu/.test(appHtml) || /instrumentDropdownToggle/.test(appHtml)) && (/Search scales/.test(scaleSelector) || /scaleMenu/.test(appHtml) || /scaleLabel/.test(appHtml))) ok('Instrument and scale pickers are present');
else fail('Scale/instrument picker wiring is incomplete');
if (/scale-menu\.css\?v=\d+/.test(appHtml) && /pionier-app\.js\?v=\d+/.test(appHtml) && /pionier-v\d+/.test(serviceWorker)) ok('Picker assets use versioned cache stamps');
else fail('Picker asset cache versions are stale');

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


const fxEditor = read('handpan-app/js/fx-editor.js');
if (/pionier:fx-editor-open/.test(coreSrc) && /lastTapAt/.test(coreSrc) && /fxEditorCurve/.test(fxEditor) && /fxEditorPresets/.test(fxEditor) && /fx-settings-shortcut/.test(appHtml)) ok('FX settings shortcuts and touch-safe curve editor wiring are present');
else fail('FX editor shortcut, curve, or preset wiring is missing');
if ((appHtml.match(/class="fx-settings-shortcut"/g) || []).length === 4) ok('All four effects expose an S shortcut to advanced settings');
else fail('Expected S shortcuts for Comp, Delay, Reverb, and Filter');
if (appHtml.includes('id="randomizeSetup"') && !appHtml.includes('id="learnPanel"') && !shell.includes('learn-mode.js') && !shell.includes('learn-mode.css')) ok('Learn system is removed and the dice randomizer replaces it');
else fail('Learn removal or randomizer replacement is incomplete');
if (/looperBtn|looper-btn/.test(loopControls) && /looperClearBtn|looper-clear/.test(loopControls + appHtml)) ok('Looper record and clear controls are present');
else fail('Looper record/clear controls are incomplete');
if (appHtml.includes('looper.css?') && /pionier-v\d+/.test(serviceWorker)) ok('Looper CSS and service worker declare cache versions');
else fail('Looper CSS or service worker cache versions missing');

// Phase A–D scope lock + budgets
if (!/repository-loop-save/.test(serviceWorker) && !/community-api/.test(serviceWorker)) ok('Service worker shell does not reference community upload modules');
else fail('Service worker still references community upload modules');
if (!appHtml.includes('soundscapeCommunityTab') && !appHtml.includes('User-Created')) ok('Community User-Created UI is absent from index');
else fail('Community User-Created UI still present in index');
if (!/fetchCommunitySongs/.test(soundscapes) && !/repository-loop-save/.test(soundscapes)) ok('Soundscapes module is owner Bedroom Sessions only');
else fail('Soundscapes still imports community song APIs');
if (fs.existsSync(path.join(root, 'handpan-app/js/app-state.js'))) ok('Unified app-state module is present');
else fail('app-state.js missing');
if (/getAmbientBus/.test(coreSrc) && /instrumentBus/.test(coreSrc)) ok('Core exposes separated instrument and ambient buses');
else fail('Separated audio buses missing from core');
const budget = (rel, maxKb) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { fail('Budget target missing: ' + rel); return; }
  const kb = fs.statSync(full).size / 1024;
  if (kb <= maxKb) ok(rel + ' size ' + kb.toFixed(1) + ' KB ≤ ' + maxKb + ' KB');
  else fail(rel + ' size ' + kb.toFixed(1) + ' KB exceeds budget ' + maxKb + ' KB');
};
budget('handpan-app/index.html', 80);
budget('handpan-app/pionier-core.js', 120);
budget('handpan-app/pionier-app.js', 80);

const presetCounts = ['Vocal Glue','Punchy Drums','Parallel Crush','Bass Tightener','Acoustic Strummer','Mastering Limiter','Snare Smasher','Sustain Builder','Sidechain Duck','Subtle Leveler','Slapback Echo','Dotted Eighth','Tape Saturation','Ping-Pong','Stereo Widener','Ambient Wash','Modulated Echo','Dub Echo','Quarter Note Lead','Trippy Reverse','Studio Room','Vocal Plate','Cathedral Hall','Spring Tank','Gated Snare','Shimmer Pad','Ambiance / Glue','Concert Hall','Tiled Bathroom','Deep Abyss','Telephone / Lo-Fi','Sub Bass Cut','HF Brilliance','Club Next Door','Auto-Wah / Envelope','Sweeping LFO LPF','Phaser Sweep','Vocal Formant','Crisp Vinyl','The Kill Switch'];
if (presetCounts.every((name) => fxEditor.includes(`label:'${name}'`)) && (fxEditor.match(/label:'(?:Vocal Glue|Slapback Echo|Studio Room|Telephone \/ Lo-Fi)'/g) || []).length === 4) ok('FX editor includes all 40 named presets across four effect types');
else fail('FX preset library is incomplete');
if (fxEditor.includes('fx-editor-preset-select') && appHtml.includes('fx-editor-header-compact') && !appHtml.includes('RESPONSE CURVE') && !appHtml.includes('Drag the point to shape it')) ok('FX editor uses a preset dropdown and a simplified curve layout');
else fail('FX editor dropdown or compact layout is missing');
if (/setTargetAtTime/.test(read('handpan-app/js/fx.js')) && /settings\.threshold/.test(read('handpan-app/js/fx.js')) && /settings\.feedback/.test(read('handpan-app/js/fx.js')) && /settings\.resonance/.test(read('handpan-app/js/fx.js'))) ok('FX editor parameters are wired to the live audio modules');
else fail('FX editor parameters are not wired to the live audio modules');

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
