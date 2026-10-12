import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'handpan-app');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

test('Pionier entry surface matches the deployed instrument UI', () => {
  const html = read('handpan-app/index.html');
  for (const id of ['app','pan','instrumentDropdownToggle','instrumentMenu','mobileControlDrawer','mobileControlsToggle','mobileControlPanel','soundscapesPage','mandalaWrap','mandalaPlay','soundscapeAudio','scaleLabel','scaleMenu','knobCompress','knobDelay','knobReverb','knobFilter','knobBass','knobLow','knobMid','knobMaster','looperBtn']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing #' + id);
  }
  assert.match(html, /id="pan"[^>]*aria-label="Handpan instrument"/);
});

test('boot chain is local and does not fetch or rewrite executable source at runtime', () => {
  const shell = read('handpan-app/pionier-app.js');
  const core = read('handpan-app/pionier-core.js');
  assert.match(shell, /pionier-core\.js/);
  assert.doesNotMatch(shell, /cdn\.jsdelivr\.net|fetch\(GOOD\)|new Blob|CORE_PATCHES/);
  assert.match(core, /from ['"]\.\/js\/audio-core\.js['"]/);
  assert.match(core, /window\.PionierCore/);
  assert.match(core, /pionier:learn-note/);
  assert.ok(fs.existsSync(path.join(app, 'js/audio-core.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/pionier-surface.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/instruments/handpan.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/soundscapes.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/mandala-canvas.js')));
  assert.match(read('handpan-app/pionier-app.js'), /js\/soundscapes\.js/);
});

test('the app exposes instrument switching, audio controls and mobile drawer hooks', () => {
  const html = read('handpan-app/index.html');
  const core = read('handpan-app/pionier-core.js');
  assert.match(html, /id="voicePrev"/);
  assert.match(html, /id="voiceNext"/);
  assert.match(html, /class="knob-effect-trigger"/);
  assert.match(html, /id="mobileControlsToggle"/);
  assert.match(core, /async function setInstrument\(id\)/);
  assert.match(core, /pointercancel/);
  assert.match(core, /lostpointercapture/);
});

test('browser test harness targets a mobile touch viewport and desktop viewport', () => {
  const config = read('playwright.config.mjs');
  assert.match(config, /390/);
  assert.match(config, /844/);
  assert.match(config, /1280/);
  assert.match(config, /800/);
  assert.match(read('.github/workflows/app-check.yml'), /npx playwright test/);
});
