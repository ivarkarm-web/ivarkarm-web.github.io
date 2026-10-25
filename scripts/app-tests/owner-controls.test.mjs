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

test('legacy root/note-count steppers are retired: markup exists, guards hide them, core cannot grow note count', () => {
  const html = read('handpan-app/index.html');
  const guard = read('handpan-app/phase1-note-count-guard.js');
  const menus = read('handpan-app/looper-side-menus.js');
  const core = (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
  for (const id of ['rootPrev', 'rootNext', 'noteCountPrev', 'noteCountNext', 'rootLabel', 'noteCountLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id} in HTML`);
  }
  // Note count is scale-driven only: the guard neutralises every mutator and hides the UI.
  for (const m of ['addNote', 'removeNote', 'setNoteCount']) {
    assert.match(guard, new RegExp(`c\\.${m} = function \\(\\) \\{ return false; \\}`), `guard must neutralise core.${m}`);
  }
  for (const id of ['noteCountPrev', 'noteCountNext', 'noteCountLabel']) {
    assert.match(guard, new RegExp(`'${id}'`), `guard must hide #${id}`);
  }
  for (const id of ['rootPrev', 'rootNext']) {
    assert.match(menus, new RegExp(`'${id}'`), `looper-side-menus must hide legacy #${id}`);
  }
  // Dead ids must not be wired
  assert.doesNotMatch(core, /wire\('rootDown'/);
  assert.doesNotMatch(core, /wire\('rootUp'/);
  assert.doesNotMatch(core, /wire\('octDown'/);
  assert.doesNotMatch(core, /wire\('octUp'/);
});

test('core exposes addNote/removeNote and clamps note count 8–13', () => {
  const core = (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
  const layout = read('handpan-app/js/pad-layout.js');
  // pad-layout.js documents the range; core mirrors it with local MIN/MAX consts
  assert.match(layout, /export const MIN_NOTES = 6/);
  assert.match(layout, /export const MAX_NOTES = 16/);
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

test('consolidated layout CSS owns the relative looper toolbar and fixed-size controls', () => {
  const css = read('handpan-app/pionier-layout.css');
  assert.match(css, /#pionierLooperToolbar\\s*\\{[^}]*position:\\s*relative/s);
  assert.match(css, /#pionierLooperControls[^}]*\\{[^}]*display:\\s*flex/s);
  // Property must not set top:25% (comments may mention the old bug)
  const propTop = css.split('/*').map((part) => part.split('*/').slice(-1)[0]).join('');
  assert.doesNotMatch(propTop, /top:\\s*25%/);
});

test('no exclusivity-fix or chrome-fix patch files remain', () => {
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/js/exclusivity-fix.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/chrome-fix.css')), false);
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/chrome-fix-addon.css')), false);
  const html = read('handpan-app/index.html');
  assert.doesNotMatch(html, /exclusivity-fix|chrome-fix/);
});


test('scale picker and labels are wired through the scale selector and core label updates', () => {
  const html = read('handpan-app/index.html');
  const core = (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
  const selector = read('handpan-app/js/scale-selector.js');
  for (const id of ['scaleLabel', 'rootLabel', 'noteCountLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(selector, /export function mountScaleSelector/);
  assert.match(core, /function updateLabels/);
  assert.match(core, /getElementById\('scaleLabel'\)/);
  assert.match(core, /getElementById\('rootLabel'\)/);
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
