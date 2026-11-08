#!/usr/bin/env node
/**
 * CI guard: fail on circular imports and on imports of removed modules.
 *
 * Checks:
 *   - No circular ES-module imports within handpan-app/
 *   - No imports of removed/dead modules (catch-mode.js, etc.)
 *   - No imports of deleted stub stylesheets (pionier-layout.css, pionier-ambient.css)
 *
 * Usage: node scripts/ci-guard.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'handpan-app');

const errors = [];
const fail = (msg) => { errors.push(msg); console.error('  ✗', msg); };

// Modules that have been removed and must not be imported.
const REMOVED_MODULES = [
  'catch-mode.js',
  'pionier-layout.css',
  'pionier-ambient.css',
  'learn-mode.js',
  'learn-mode.css',
];

// Collect all JS/MJS source files under handpan-app/ (excluding node_modules/dist).
const jsFiles = [];
function collectJs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectJs(full);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      jsFiles.push(full);
    }
  }
}
collectJs(appDir);

// Build a map: absolute file path -> set of imported specifiers.
const imports = new Map();
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const deps = new Set();
  // Match both static `from './x'` and dynamic `import('./x')` / `new URL('./x')`.
  const re = /(?:from|import\s*\(?|new URL\()\s*['"](\.\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    let p = m[1];
    // Strip ?v= query stamps.
    p = p.replace(/\?v=\d+/, '');
    deps.add(p);
  }
  imports.set(file, deps);
}

// Resolve a specifier relative to the importing file.
function resolve(importingFile, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const resolved = path.resolve(path.dirname(importingFile), spec);
  // Try as-is, then with .js, then with /index.js.
  const candidates = [resolved, resolved + '.js', resolved + '/index.js'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// --- Check 1: Removed module imports ---
for (const [file, deps] of imports) {
  for (const dep of deps) {
    for (const removed of REMOVED_MODULES) {
      if (dep.includes(removed)) {
        fail(path.relative(root, file) + ' imports removed module: ' + dep);
      }
    }
  }
}

// --- Check 2: Circular imports ---
// Build adjacency list using resolved file paths.
const adj = new Map();
for (const [file, deps] of imports) {
  const resolved = new Set();
  for (const dep of deps) {
    const r = resolve(file, dep);
    if (r) resolved.add(r);
  }
  adj.set(file, resolved);
}

function hasCycle(start) {
  const visited = new Set();
  const stack = new Set();
  function dfs(node) {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    stack.add(node);
    const neighbors = adj.get(node) || new Set();
    for (const nb of neighbors) {
      if (dfs(nb)) return true;
    }
    stack.delete(node);
    visited.add(node);
    return false;
  }
  return dfs(start);
}

const circular = new Set();
for (const file of adj.keys()) {
  if (hasCycle(file)) circular.add(file);
}
for (const f of circular) {
  fail('Circular import detected: ' + path.relative(root, f));
}

console.log('');
if (errors.length) {
  console.error('CI guard failed: ' + errors.length + ' error(s)');
  process.exit(1);
}
console.log('CI guard: OK (' + jsFiles.length + ' modules checked, 0 circular imports, 0 removed imports)');
