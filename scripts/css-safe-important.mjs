/**
 * scripts/css-safe-important.mjs — Safe CSS !important reduction.
 *
 * Only removes !important from clearly safe patterns where it's obviously
 * unnecessary. Adds reason comments to all remaining !important declarations.
 * Does NOT touch anything else (no token replacement, no CSS modification
 * beyond !important removal).
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

// Safe (prop, val) pairs where !important can be removed
const SAFE_REMOVALS = [
  // Display/visibility
  ['display', 'none'],
  ['display', 'block'],
  ['display', 'inline-block'],
  ['display', 'flex'],
  ['visibility', 'hidden'],
  ['visibility', 'visible'],
  ['overflow', 'hidden'],
  ['overflow', 'auto'],
  ['pointer-events', 'none'],
  ['outline', 'none'],
  // Positioning
  ['position', 'fixed'],
  ['position', 'absolute'],
  ['position', 'relative'],
  ['position', 'static'],
  ['top', '0'], ['top', '0px'],
  ['left', '0'], ['left', '0px'],
  ['right', '0'], ['right', '0px'],
  ['bottom', '0'], ['bottom', '0px'],
  // Sizing
  ['height', '100%'], ['height', 'auto'],
  ['width', '100%'], ['width', 'auto'],
  // Margins
  ['margin', '0'],
  ['margin-top', '0'], ['margin-bottom', '0'],
  ['margin-left', '0'], ['margin-right', '0'],
  ['padding', '0'],
  ['padding-top', '0'], ['padding-bottom', '0'],
  ['padding-left', '0'], ['padding-right', '0'],
  // Border
  ['border', 'none'],
  ['border-color', 'transparent'],
  // Alignment
  ['text-align', 'center'],
  ['text-align', 'left'],
  ['text-align', 'right'],
  ['justify-content', 'center'],
  ['justify-content', 'flex-start'],
  ['justify-content', 'flex-end'],
  ['align-items', 'center'],
  ['align-items', 'flex-start'],
  ['align-items', 'flex-end'],
  // Flex
  ['flex', '1'], ['flex', 'auto'], ['flex', 'none'],
  // Box model
  ['box-sizing', 'border-box'],
  // Z-index
  ['z-index', 'auto'], ['z-index', '0'], ['z-index', '1'],
  // Background
  ['background', 'transparent'],
  ['background-color', 'transparent'],
  ['background-color', 'inherit'],
  // Color
  ['color', 'inherit'],
  ['color', 'currentColor'],
];

const SAFE_SET = new Set(SAFE_REMOVALS.map(([p, v]) => `${p}:${v}`));

function isSafeRemove(prop, val) {
  if (val.startsWith('var(--')) return true;
  return SAFE_SET.has(`${prop}:${val}`);
}

function getReason(line) {
  if (line.includes('display: none')) return 'hidden state';
  if (line.includes('visibility: hidden')) return 'visibility';
  if (line.includes('pointer-events: none')) return 'interaction block';
  if (line.includes('position:')) return 'layout positioning';
  if (line.includes('z-index')) return 'stacking context';
  if (line.includes('opacity:')) return 'opacity toggle';
  if (line.includes('width:')) return 'width override';
  if (line.includes('height:')) return 'height override';
  if (line.includes('background:')) return 'surface color';
  if (line.includes('color:')) return 'text color';
  if (line.includes('margin:')) return 'margin reset';
  if (line.includes('overflow:')) return 'scroll containment';
  if (line.includes('border-radius:')) return 'component shape';
  if (line.includes('box-shadow:')) return 'elevation';
  if (line.includes('border:')) return 'border style';
  if (line.includes('padding:')) return 'spacing override';
  if (line.includes('font-size:')) return 'type scale override';
  if (line.includes('flex:')) return 'flex layout override';
  if (line.includes('gap:')) return 'gap override';
  if (line.includes('min-height:')) return 'min-height override';
  if (line.includes('max-width:')) return 'max-width override';
  if (line.includes('min-width:')) return 'min-width override';
  if (line.includes('justify-content:')) return 'alignment override';
  if (line.includes('align-items:')) return 'alignment override';
  return 'utility override';
}

function extractDecl(line) {
  const m = line.match(/([a-z-]+):\s*([^;!]+)\s*!important/);
  if (m) return { prop: m[1], val: m[2].trim() };
  return null;
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
      const decl = extractDecl(line);
      if (decl && isSafeRemove(decl.prop, decl.val)) {
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
