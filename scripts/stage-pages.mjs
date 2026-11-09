#!/usr/bin/env node
/**
 * Stage the deployable repository site into dist/ while preserving its URL tree.
 * Existing files in dist/ are kept so Vite's generated root files take priority.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist');

const excludedDirs = new Set([
  '.git', '.agents', '.codex', '.aws', '.github',
  'node_modules', 'dist', 'build', 'coverage', 'test-results',
  'playwright-report', '__pycache__', '.pytest_cache', '.next',
]);
const excludedRootDirs = new Set(['scripts', 'docs', 'public']);
const excludedFiles = new Set([
  'package.json', 'package-lock.json', 'vite.config.ts',
  'playwright.config.mjs', 'playwright.measure.config.mjs',
  'handpan-app/APP_VERSION',
]);
let copied = 0;
let preserved = 0;

function shouldSkip(rel, entry) {
  const parts = rel.split(path.sep);
  const base = entry.name;
  if (entry.isDirectory()) {
    if (excludedDirs.has(base)) return true;
    if (parts.length === 1 && excludedRootDirs.has(base)) return true;
    if (parts.length >= 2 && parts[0] === 'handpan-app' && parts[1] === 'sounds' && base === 'fixtures') return true;
    return false;
  }
  if (base.startsWith('.env')) return true;
  if (base === '.gitignore' || base === '.DS_Store' || base === 'Thumbs.db') return true;
  if (/\.(?:log|pyc|tmp)$/.test(base) || /\.md$/i.test(base)) return true;
  if (/^handpan-src-\d+\.js$/.test(base) || base === 'handpan.bundle.js') return true;
  if (excludedFiles.has(rel.split(path.sep).join('/'))) return true;
  if (parts[0] === 'handpan-app' && base === 'VERSION.txt') return true;
  if (rel === path.join('handpan-app', 'js', 'sound', 'preview.html')) return true;
  if (rel === path.join('handpan-app', 'js', 'sound', 'render-voices.mjs')) return true;
  return false;
}

async function copyTree(srcDir, relDir = '') {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const rel = relDir ? path.join(relDir, entry.name) : entry.name;
    if (shouldSkip(rel, entry)) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(outDir, rel);
    if (entry.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      await copyTree(src, rel);
      continue;
    }
    if (!entry.isFile()) continue;

    // Keep the processed entry and any assets Vite already emitted.
    try {
      await fs.access(dest);
      preserved += 1;
      continue;
    } catch {}
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    copied += 1;
  }
}

await fs.mkdir(outDir, { recursive: true });
await copyTree(root);
console.log(`Staged website into ${path.relative(root, outDir)}: ${copied} copied, ${preserved} Vite output files preserved.`);
