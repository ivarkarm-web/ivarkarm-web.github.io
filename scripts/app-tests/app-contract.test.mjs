import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'handpan-app');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function readCoreSource() {
  return (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
}

test('Pionier entry surface matches the deployed instrument UI', () => {
  const html = read('handpan-app/index.html');
  // Current local shell: instrument surface + soundscapes panel (not the retired full knob shell).
  for (const id of [
    'app',
    'pan',
    'instrumentDropdownToggle',
    'instrumentMenu',
    'mobileControlDrawer',
    'mobileControlsToggle',
    'mobileControlPanel',
    'openSoundscapes',
    'soundscapesPanel',
    'soundscapeAudio',
    'scaleLabel',
    'scaleMenu',
    'looperRail',
    'looperBtn',
    'voicePrev',
    'voiceNext',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing #' + id);
  }
  assert.match(html, /id="pan"[^>]*aria-label="Handpan instrument"/);
});

test('handpan voices are synthesized locally without a note-sample bank', () => {
  const handpan = read('handpan-app/js/instruments/handpan.js');
  assert.match(handpan, /engineKind: 'procedural'/);
  assert.doesNotMatch(handpan, /NoteSampleBank|sampleBank|sounds\\/notes|recordedScale/);
  assert.ok(!fs.existsSync(path.join(app, 'js/note-sample-bank.js')));
  assert.ok(!fs.existsSync(path.join(app, 'sounds/notes')));
});

test('boot chain is local and does not fetch or rewrite executable source at runtime', () => {
  const shell = read('handpan-app/pionier-app.js');
  const coreSrc = readCoreSource();

  assert.match(shell, /pionier-core\.js/);
  assert.doesNotMatch(shell, /cdn\.jsdelivr\.net|fetch\(GOOD\)|CORE_PATCHES/);
  assert.doesNotMatch(coreSrc, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(coreSrc, /createObjectURL|Blob\(\[src\]/);

  // Vendored source carries the real module graph and public API.
  assert.match(coreSrc, /from ['"]\.\/js\/audio-core\.js(?:\?[^'"]*)?['"]/);
  assert.match(coreSrc, /window\.PionierCore/);
  assert.match(coreSrc, /async function setInstrument\(id\)/);

  assert.ok(fs.existsSync(path.join(app, 'js/audio-core.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/pionier-surface.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/instruments/handpan.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/soundscapes.js')));
  assert.match(read('handpan-app/pionier-app.js'), /js\/soundscapes\.js/);
});

test('the app exposes instrument switching, audio controls and mobile drawer hooks', () => {
  const html = read('handpan-app/index.html');
  const coreSrc = readCoreSource();

  assert.match(html, /id="voicePrev"/);
  assert.match(html, /id="voiceNext"/);
  assert.match(html, /id="mobileControlsToggle"/);
  assert.match(html, /id="mobileControlDrawer"/);

  // FX knobs are wired in core (DOM may be injected by settings/layout modules).
  assert.match(coreSrc, /knobCompress/);
  assert.match(coreSrc, /async function setInstrument\(id\)/);
  assert.match(coreSrc, /pointercancel/);
  assert.match(coreSrc, /lostpointercapture/);
});

test('browser test harness targets a mobile touch viewport and desktop viewport', () => {
  const config = read('playwright.config.mjs');
  assert.match(config, /390/);
  assert.match(config, /844/);
  assert.match(config, /1280/);
  assert.match(config, /800/);
  assert.match(read('.github/workflows/app-check.yml'), /npx playwright test/);
});
