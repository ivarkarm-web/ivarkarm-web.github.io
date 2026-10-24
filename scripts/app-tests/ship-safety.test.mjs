import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve('handpan-app');

function collectJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

test('every shipped PIONIER JavaScript file is substantive and free of placeholder warnings', () => {
  const files = collectJavaScript(APP_ROOT);
  assert.ok(files.length > 0, 'expected shipped JavaScript files to be present');

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(APP_ROOT, file);
    if (Buffer.byteLength(source, 'utf8') < 100) {
      violations.push(`${relative}: only ${Buffer.byteLength(source, 'utf8')} bytes`);
    }
    if (source.toLowerCase().includes('will replace')) {
      violations.push(`${relative}: contains placeholder phrase "will replace"`);
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('synth-only handpan entry points do not load the removed sample bank', () => {
  const index = fs.readFileSync(path.join(APP_ROOT, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(APP_ROOT, 'pionier-app.js'), 'utf8');
  const core = fs.readFileSync(path.join(APP_ROOT, 'pionier-core.js'), 'utf8');

  for (const [label, source] of [['index.html', index], ['pionier-app.js', app], ['pionier-core.js', core]]) {
    assert.doesNotMatch(source, /sample-bank|SampleBank|SAMPLE_MANIFEST_PATH|sounds\/notes/i, `${label} must stay synthesis-only`);
  }
});
