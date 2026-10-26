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

/** Layout CSS may be an @import shell or split under css-parts/. Always aggregate. */
function readLayoutCss() {
  const partsDir = path.join(root, 'handpan-app/css-parts');
  const partFiles = fs.existsSync(partsDir)
    ? fs.readdirSync(partsDir).filter((n) => n.startsWith('layout-') && n.endsWith('.css')).sort()
    : [];
  if (partFiles.length) {
    return partFiles.map((n) => fs.readFileSync(path.join(partsDir, n), 'utf8')).join('\n');
  }
  const shell = path.join(root, 'handpan-app/pionier-layout.css');
  if (!fs.existsSync(shell)) return '';
  let text = fs.readFileSync(shell, 'utf8');
  text = text.replace(/@import\s+url\(['"]?(\.\/[^'")]+)['"]?\)\s*;?/g, (_, ref) => {
    const target = path.resolve(path.dirname(shell), ref);
    return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  });
  return text;
}

test('legacy root/note-count steppers are retired: markup exists, guards hide them, core cannot grow note count', () => {
  const html = read('handpan-app/index.html');
  const guard = read('handpan-app/phase1-note-count-guard.js');
  const menus = read('handpan-app/looper-side-menus.js');
  const core = (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
  for (const id of ['rootPrev', 'rootNext', 'noteCountPrev', 'noteCountNext', 'rootLabel', 'noteCountLabel']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id} in HTML`);
  }
  for (const m of ['addNote', 'removeNote', 'setNoteCount']) {
    assert.match(guard, new RegExp(`c\\.${m} = function \\(\\) \\{ return false; \\}`), `guard must neutralise core.${m}`);
  }
  for (const id of ['noteCountPrev', 'noteCountNext', 'noteCountLabel']) {
    assert.match(guard, new RegExp(`'${id}'`), `guard must hide #${id}`);
  }
  for (const id of ['rootPrev', 'rootNext']) {
    assert.match(menus, new RegExp(`'${id}'`), `looper-side-menus must hide legacy #${id}`);
  }
  assert.doesNotMatch(core, /wire\('rootDown'/);
  assert.doesNotMatch(core, /wire\('rootUp'/);
  assert.doesNotMatch(core, /wire\('octDown'/);
  assert.doesNotMatch(core, /wire\('octUp'/);
});

test('manual note-count mutators are disabled while the handpan supports 8–13 randomizer notes', () => {
  const core = (read('handpan-app/pionier-core-base.js') + '\n' + read('handpan-app/pionier-core.js'));
  const handpan = read('handpan-app/js/instruments/handpan.js');
  assert.match(core, /addNote\(\)\s*\{\s*return false/);
  assert.match(core, /removeNote\(\)\s*\{\s*return false/);
  assert.match(core, /setNoteCount\(\)\s*\{\s*return false/);
  assert.match(handpan, /const DEFAULT_NOTE_COUNT = 8/);
  assert.match(handpan, /const MIN_RANDOM_NOTE_COUNT = 8/);
  assert.match(handpan, /const MAX_RANDOM_NOTE_COUNT = 13/);
  assert.match(handpan, /setNoteCount\(n\)/);
  assert.doesNotMatch(core, /function changeNoteCount/);
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
  const css = readLayoutCss();
  assert.ok(css.length > 1000, 'layout CSS (including parts) should be substantial');
  const toolbarRules = [...css.matchAll(/#pionierLooperToolbar\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(toolbarRules.some((rule) => /position:\s*relative/.test(rule)), 'toolbar must have a relative-position rule');
  assert.match(css, /#pionierLooperControls\s*,\s*#pionierLooperActions\s*\{[^}]*display:\s*flex/s, 'looper controls must use flex layout');
  const propTop = css.split('/*').map((part) => part.split('*/').slice(-1)[0]).join('');
  assert.doesNotMatch(propTop, /top:\s*25%/);
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
  assert.match(core, /async randomizeSetup\(\)/);
  assert.match(core, /handpan\.noteCount = 8 \+ Math\.floor\(Math\.random\(\) \* 6\)/);
});

test('scale picker opens from the restored scale label', () => {
  const overlay = read('handpan-app/js/overlay-controller.js');
  assert.match(overlay, /getElementById\('scaleLabel'\)/);
  assert.match(overlay, /togglePicker\('scaleMenu'\)/);
  assert.match(overlay, /function togglePicker/);
});

test('Learn system is retired; dice randomizer replaces the entry point; skin palette remains active', () => {
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
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/js/skin-palette.js')), true, 'skin-palette.js should remain');
  assert.equal(fs.existsSync(path.join(root, 'handpan-app/js/ambient-fx.js')), true, 'ambient-fx.js should remain');
});

test('portrait lock does not request deleted CSS patches and all linked stylesheets exist', () => {
  const portrait = read('handpan-app/js/portrait-lock.js');
  assert.doesNotMatch(portrait, /ui-hotfix\.css|android-picker-scroll\.css/);
  const html = read('handpan-app/index.html');
  const refs = [...html.matchAll(/href=["']\.\/([^"'?]+\.css)(?:\?[^"']*)?["']/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, 'expected the four primary Pionier stylesheets');
  for (const ref of refs) assert.equal(fs.existsSync(path.join(root, 'handpan-app', ref)), true, 'missing linked stylesheet: ' + ref);
});
