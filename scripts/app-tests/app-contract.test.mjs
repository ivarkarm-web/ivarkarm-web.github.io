import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'handpan-app');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('handpan app has its required entry surface', () => {
  const html = read('handpan-app/index.html');
  assert.match(html, /<canvas id="hpStage"/);
  assert.match(html, /data-mode="play"/);
  assert.match(html, /data-mode="learn"/);
  assert.match(html, /data-mode="loop"/);
  assert.match(html, /data-mode="ambient"/);
  assert.match(html, /id="loopRecord"/);
  assert.match(html, /id="lessonList"/);
});

test('handpan app keeps the instrument runtime scripts in deterministic order', () => {
  const html = read('handpan-app/index.html');
  const scripts = [
    'js/handpan.js',
    'js/transport.js',
    'js/loop.js',
    'js/learn.js',
    'js/ambient.js',
    'js/app-shell.js'
  ];
  let previous = -1;
  for (const script of scripts) {
    const position = html.indexOf('src="./' + script + '"');
    assert.ok(position > previous, script + ' must load after the previous runtime module');
    previous = position;
    assert.ok(fs.existsSync(path.join(app, script)), script + ' must exist');
  }
});

test('app browser harness is present and targets both required viewports', () => {
  const config = read('playwright.config.mjs');
  const spec = read('scripts/app-tests/handpan.spec.mjs');
  assert.match(config, /390/);
  assert.match(config, /844/);
  assert.match(config, /1280/);
  assert.match(config, /800/);
  assert.match(spec, /Handpan/);
  assert.match(read('handpan-app/index.html'), /type="module" src="\.\/js\/loop\.js"/);
  assert.ok(fs.existsSync(path.join(app, 'js/loop-core.js')));
  assert.ok(fs.existsSync(path.join(app, 'js/audio-core.js')));
});

test('app runtime uses one module loading strategy', () => {
  const html = read('handpan-app/index.html');
  for (const script of ['handpan.js','transport.js','loop.js','learn.js','ambient.js','app-shell.js']) assert.match(html, new RegExp('type="module" src="\\.\\/js\\/' + script.replace('.', '\\.') + '"'));
});

test('app CI workflow installs Chromium and runs every required gate', () => {
  const workflow = read('.github/workflows/app-check.yml');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm install/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /node scripts\/smoke-test\.mjs/);
  assert.match(workflow, /npm run test:app/);
  assert.match(workflow, /npx playwright test/);
});
