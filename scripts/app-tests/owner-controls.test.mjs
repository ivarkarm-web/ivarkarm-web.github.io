/**
 * Regression: owner phone bugs — control ids and core API surface.
 * Full visual proof remains a browser check; this guards wiring drift.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('HTML exposes rootPrev/Next and noteCountPrev/Next; core binds them', () => {
  const html = read('handpan-app/index.html');
  const core = read('handpan-app/pionier-core.js');
  for (const id of ['rootPrev', 'rootNext', 'noteCountPrev', 'noteCountNext', 'rootLabel', 'noteCountLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id} in HTML`);
  }
  assert.match(core, /for \(const id of \['rootPrev', 'rootPrevDesktop'\]\) wire\(id/);
  assert.match(core, /for \(const id of \['rootNext', 'rootNextDesktop'\]\) wire\(id/);
  assert.match(core, /wire\('noteCountPrev'/);
  assert.match(core, /wire\('noteCountNext'/);
  // Dead ids must not be wired
  assert.doesNotMatch(core, /wire\('rootDown'/);
  assert.doesNotMatch(core, /wire\('rootUp'/);
  assert.doesNotMatch(core, /wire\('octDown'/);
  assert.doesNotMatch(core, /wire\('octUp'/);
});

test('core exposes addNote/removeNote and clamps note count 9–14', () => {
  const core = read('handpan-app/pionier-core.js');
  assert.match(core, /addNote\(\)\s*\{\s*return changeNoteCount\(1\)/);
  assert.match(core, /removeNote\(\)\s*\{\s*return changeNoteCount\(-1\)/);
  assert.match(core, /const MIN = 9/);
  assert.match(core, /const MAX = 14/);
  assert.match(core, /noteCountLabel/);
});

test('overlay-controller owns pickers and boot does not hide Loop Studio', () => {
  const overlay = read('handpan-app/js/overlay-controller.js');
  const boot = read('handpan-app/js/layout-boot.js');
  assert.match(overlay, /closePickers/);
  assert.match(overlay, /pickerBackdrop/);
  assert.match(overlay, /PionierOverlay/);
  assert.match(boot, /bindMobileDrawer/);
  assert.doesNotMatch(boot, /looperRail|looperRecordCluster|looperLayers/);
  assert.doesNotMatch(boot, /positionPickerMenus/);
});

test('looper.css owns relative rail and 52px record; no fixed top:25%', () => {
  const css = read('handpan-app/looper.css');
  assert.match(css, /\.looper-rail\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.looper-btn\s*\{[^}]*width:\s*52px/s);
  // Property must not set top:25% (comments may mention the old bug)
  const propTop = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(propTop, /top:\s*25%/);
});

test('no exclusivity-fix or chrome-fix patch files remain', () => {
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/js/exclusivity-fix.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/chrome-fix.css')), false);
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/chrome-fix-addon.css')), false);
  const html = read('handpan-app/index.html');
  assert.doesNotMatch(html, /exclusivity-fix|chrome-fix/);
});


test('desktop scale, root and octave controls are wired to shared pitch state', () => {
  const html = read('handpan-app/index.html');
  const core = read('handpan-app/pionier-core.js');
  for (const id of ['scalePrevDesktop', 'scaleNextDesktop', 'scaleLabelDesktop', 'rootPrevDesktop', 'rootNextDesktop', 'rootLabelDesktop', 'octavePrev', 'octaveNext', 'octaveLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(core, /for \(const id of \['scalePrev', 'scalePrevDesktop'\]\) wire\(id/);
  assert.match(core, /for \(const id of \['scaleNext', 'scaleNextDesktop'\]\) wire\(id/);
  assert.match(core, /for \(const id of \['rootPrev', 'rootPrevDesktop'\]\) wire\(id/);
  assert.match(core, /for \(const id of \['rootNext', 'rootNextDesktop'\]\) wire\(id/);
  assert.match(core, /wire\('octavePrev'/);
  assert.match(core, /wire\('octaveNext'/);
  assert.match(core, /setOctaveOffset/);
  assert.match(core, /rootLabelDesktop/);
  assert.match(core, /scaleLabelDesktop/);
});

test('scale picker opens from both mobile and desktop scale labels', () => {
  const overlay = read('handpan-app/js/overlay-controller.js');
  assert.match(overlay, /scaleLabelDesktop/);
  assert.match(overlay, /togglePicker\('scaleMenu', e\.currentTarget\)/);
  assert.match(overlay, /function setPickerExpanded/);
});


test('Learn Mode and generated decorative ambience modules are removed', () => {
  for (const path of [
    'handpan-app/js/learn-mode.js',
    'handpan-app/learn-mode.css',
    'handpan-app/learn-lessons.json',
    'handpan-app/js/ambient-fx.js',
    'handpan-app/js/skin-mandala.js',
    'handpan-app/js/customization-catalog.js',
    'handpan-app/js/mandala-canvas.js',
    'handpan-app/js/backdrop-soundscape-bridge.js'
  ]) assert.equal(fs.existsSync(path.join(root, path)), false, path + ' should be retired');
  const shell = read('handpan-app/pionier-app.js');
  assert.doesNotMatch(shell, /learn-mode\.js/);
});
