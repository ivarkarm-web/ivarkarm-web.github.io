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
  assert.match(core, /wire\('rootPrev',\s*\(\)\s*=>\s*\{\s*handpan\.setRootIndex/);
  assert.match(core, /wire\('rootNext',\s*\(\)\s*=>\s*\{\s*handpan\.setRootIndex/);
  assert.match(core, /wire\('noteCountPrev',\s*\(\)\s*=>\s*\{\s*changeNoteCount\(-1\)/);
  assert.match(core, /wire\('noteCountNext',\s*\(\)\s*=>\s*\{\s*changeNoteCount\(1\)/);
  // Dead ids must not be wired
  assert.doesNotMatch(core, /wire\('rootDown'/);
  assert.doesNotMatch(core, /wire\('rootUp'/);
  assert.doesNotMatch(core, /wire\('octDown'/);
  assert.doesNotMatch(core, /wire\('octUp'/);
});

test('core exposes addNote/removeNote and clamps note count 8–13', () => {
  const core = read('handpan-app/pionier-core.js');
  const layout = read('handpan-app/js/pad-layout.js');
  // pad-layout.js documents the range; core mirrors it with local MIN/MAX consts
  assert.match(layout, /export const MIN_NOTES = 8/);
  assert.match(layout, /export const MAX_NOTES = 13/);
  assert.match(core, /addNote\(\)\s*\{\s*return changeNoteCount\(1\)/);
  assert.match(core, /removeNote\(\)\s*\{\s*return changeNoteCount\(-1\)/);
  assert.match(core, /const MIN = 8/);
  assert.match(core, /const MAX = 13/);
  assert.match(core, /noteCountLabel/);
});

test('overlay controller owns pickers and control layout positions the looper toolbar', () => {
  const overlay = read('handpan-app/js/overlay-controller.js');
  const boot = read('handpan-app/js/layout-boot.js');
  assert.match(overlay, /closePickers/);
  assert.match(overlay, /pickerBackdrop/);
  assert.match(overlay, /PionierOverlay/);
  assert.match(overlay, /togglePicker\('scaleMenu'\)/);
  assert.match(boot, /--pan-bottom-gap/);
  assert.match(boot, /looperRail/);
  assert.doesNotMatch(boot, /positionPickerMenus/);
  const controlLayout = read('handpan-app/pionier-control-layout.js');
  assert.match(controlLayout, /appendIfNeeded\(toolbar, loopControls\)/);
  assert.match(controlLayout, /appendIfNeeded\(toolbar, actionGroup\)/);
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


test('scale, root and note-count controls match the restored shared pitch state', () => {
  const html = read('handpan-app/index.html');
  const core = read('handpan-app/pionier-core.js');
  for (const id of ['scalePrev', 'scaleNext', 'scaleLabel', 'rootPrev', 'rootNext', 'rootLabel', 'noteCountPrev', 'noteCountNext', 'noteCountLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(core, /wire\('scalePrev'/);
  assert.match(core, /wire\('scaleNext'/);
  assert.match(core, /wire\('rootPrev'/);
  assert.match(core, /wire\('rootNext'/);
  assert.match(core, /wire\('noteCountPrev'/);
  assert.match(core, /wire\('noteCountNext'/);
  assert.match(core, /function changeNoteCount/);
});

test('scale picker opens from the restored scale label', () => {
  const overlay = read('handpan-app/js/overlay-controller.js');
  assert.match(overlay, /getElementById\('scaleLabel'\)/);
  assert.match(overlay, /togglePicker\('scaleMenu'\)/);
  assert.match(overlay, /function togglePicker/);
});


test('Learn system is retired and dice randomizer replaces the entry point', () => {
  for (const rel of [
    'handpan-app/js/learn-mode.js',
    'handpan-app/learn-mode.css',
    'handpan-app/learn-lessons.json'
  ]) assert.equal(fs.existsSync(path.join(root, rel)), false, rel + ' should be removed');
  const html = read('handpan-app/index.html');
  const shell = read('handpan-app/pionier-app.js');
  assert.match(html, /id="randomizeSetup"/);
  assert.doesNotMatch(html, /id="learnPanel"|id="openLearn"/);
  assert.doesNotMatch(shell, /learn-mode\.js/);
  for (const rel of ['handpan-app/js/ambient-fx.js','handpan-app/js/skin-mandala.js','handpan-app/js/mandala-canvas.js']) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel + ' should remain available');
  }
});
