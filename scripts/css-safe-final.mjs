/**
 * scripts/css-final-simple.mjs — Minimal CSS cleanup.
 *
 * 1. Adds @import for tokens and @layer declarations
 * 2. Removes !important from ONLY the safest patterns:
 *    display: none, visibility: hidden, pointer-events: none, outline: none
 * 3. Adds reason comments to remaining !important
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const files = [
  path.join(app, 'pionier-base.css'),
  path.join(app, 'pionier-controls.css'),
];

const SAFE_PATTERNS = [
  /display:\s*none\s*!important/,
  /visibility:\s*hidden\s*!important/,
  /pointer-events:\s*none\s*!important/,
  /outline:\s*none\s*!important/,
];

function getReason(line) {
  if (line.includes('display: none')) return 'hidden state';
  if (line.includes('visibility: hidden')) return 'visibility';
  if (line.includes('pointer-events: none')) return 'interaction block';
  if (line.includes('outline: none')) return 'focus outline';
  return 'utility override';
}

for (const filePath of files) {
  let source = fs.readFileSync(filePath, 'utf8');

  // Add token import
  if (!source.includes('_tokens.css')) {
    source = `@import './css-parts/_tokens.css';\n\n${source}`;
  }

  // Add cascade layer declarations
  if (!source.includes('@layer')) {
    source = `/* ===== Cascade layers ===== */\n@layer base, components, utilities;\n\n${source}`;
  }

  const lines = source.split('\n');
  const newLines = [];
  let removedCount = 0;
  let reasonCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    const hasReason =
      prevLine.includes('/* reason:') ||
      prevLine.includes('/* override:');

    if (line.includes('!important')) {
      const isSafe = SAFE_PATTERNS.some((p) => p.test(line));
      if (isSafe) {
        line = line.replace(/!important/g, '');
        removedCount++;
      } else if (!hasReason) {
        const reason = getReason(line);
        newLines.push(`  /* reason: ${reason} */`);
        reasonCount++;
      }
    }
    newLines.push(line);
  }

  source = newLines.join('\n');
  fs.writeFileSync(filePath, source);
  console.log(`${path.basename(filePath)}: removed ${removedCount} !important, added ${reasonCount} reason comments`);
}

console.log('\nDone.');
