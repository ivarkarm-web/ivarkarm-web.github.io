#!/usr/bin/env node
/**
 * check-dynamic-assets.mjs
 *
 * Finds every dynamic import(), new Worker(), audioWorklet.addModule(), and
 * fetch('./...') of a local file in handpan-app/*.js and handpan-app/js/**,
 * resolves the URL (including ?v= stamps and BASE logic), and checks that the
 * file exists and is either in the SW SHELL list or intentionally
 * runtime-cached.
 *
 * Reports anything missing or uncached. Exits non-zero if problems found.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'handpan-app');
const SW_PATH = path.join(appDir, 'sw.js');

function read(file) {
  return fs.readFileSync(file, 'utf-8');
}

// ---------- 1. Collect SHELL entries from sw.js ----------
let shellEntries = [];
try {
  const swSource = read(SW_PATH);
  const shellMatch = swSource.match(/const SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (shellMatch) {
    const re = /['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(shellMatch[1]))) shellEntries.push(m[1]);
  }
} catch (e) {
  // sw.js may not exist yet; treat as empty shell
}

const shellSet = new Set(shellEntries);

// ---------- 2. Find dynamic asset references in app JS files ----------
const jsFiles = [];
function collectJs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJs(full);
    else if (entry.name.endsWith('.js')) jsFiles.push(full);
  }
}
collectJs(appDir);

// Patterns to match:
//   import(new URL('./x.js?v=1', BASE).href)
//   import(new URL('./x.js', import.meta.url).href)
//   ctx.audioWorklet.addModule('./x.js?v=1')
//   new Worker('./x.js')
//   fetch('./x.js')
const dynamicRe = /import\s*\(\s*new\s+URL\(\s*['"](\.\/[^'"]+)['"]/g;
const workerRe = /new\s+Worker\(\s*['"](\.\/[^'"]+)['"]/g;
const workletRe = /audioWorklet\.addModule\(\s*['"](\.\/[^'"]+)['"]/g;
const fetchRe = /fetch\(\s*['"](\.\/[^'"]+)['"]/g;

const problems = [];
const checked = new Set();

function checkResolved(resolvedPath, sourceFile, line) {
  // Normalize: strip leading './'
  let normalized = resolvedPath.startsWith('./') ? resolvedPath : './' + resolvedPath;
  // Remove query stamp for file-existence check
  const filePath = normalized.split('?')[0];
  const fullPath = path.join(appDir, filePath.slice(2)); // remove './'

  if (checked.has(normalized)) return;
  checked.add(normalized);

  // 1. Does the file exist?
  if (!fs.existsSync(fullPath)) {
    problems.push({ file: sourceFile, line, asset: normalized, issue: 'file does not exist' });
    return;
  }

  // 2. Is it in the SHELL list?
  if (!shellSet.has(normalized)) {
    problems.push({ file: sourceFile, line, asset: normalized, issue: 'not in SW SHELL' });
  }
}

for (const jsFile of jsFiles) {
  const source = read(jsFile);
  const relSource = path.relative(root, jsFile);

  // Find line numbers for each match
  const lines = source.split('\n');

  // Dynamic imports via new URL(...)
  let m;
  while ((m = dynamicRe.exec(source))) {
    const asset = m[1];
    const lineNo = source.slice(0, m.index).split('\n').length;
    checkResolved(asset, relSource, lineNo);
  }

  // new Worker(...)
  while ((m = workerRe.exec(source))) {
    const asset = m[1];
    const lineNo = source.slice(0, m.index).split('\n').length;
    checkResolved(asset, relSource, lineNo);
  }

  // audioWorklet.addModule(...)
  while ((m = workletRe.exec(source))) {
    const asset = m[1];
    const lineNo = source.slice(0, m.index).split('\n').length;
    checkResolved(asset, relSource, lineNo);
  }

  // fetch('./...')
  while ((m = fetchRe.exec(source))) {
    const asset = m[1];
    const lineNo = source.slice(0, m.index).split('\n').length;
    checkResolved(asset, relSource, lineNo);
  }
}

// ---------- 3. Report ----------
if (problems.length === 0) {
  console.log('OK · all dynamic assets exist and are in SW SHELL · checked', checked.size, 'assets');
  process.exit(0);
}

console.log('PROBLEMS FOUND:');
for (const p of problems) {
  console.log(`  ${p.file}:${p.line} · ${p.asset} · ${p.issue}`);
}
process.exit(1);
