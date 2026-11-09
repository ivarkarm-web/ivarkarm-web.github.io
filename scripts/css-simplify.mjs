/**
 * scripts/css-simplify.mjs — CSS architecture transform.
 *
 * 1. Adds @layer declarations and wraps CSS in layers
 * 2. Removes !important from clearly safe patterns
 * 3. Adds reason comments to remaining !important
 * 4. Applies token replacements for common values
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const files = [path.join(app, 'pionier-base.css'), path.join(app, 'pionier-controls.css')];

const TOKEN_REPLACEMENTS = [
  { find: '#070708', replace: 'var(--color-bg)' },
  { find: '#1c1b1a', replace: 'var(--color-surface)' },
  { find: '#2a2824', replace: 'var(--color-surface-hover)' },
  { find: '#3a3834', replace: 'var(--color-surface-active)' },
  { find: '#e6e0d2', replace: 'var(--color-text)' },
  { find: '#f0ebe3', replace: 'var(--color-text-muted)' },
  { find: '#8a867e', replace: 'var(--color-text-faint)' },
  { find: '#d4b04a', replace: 'var(--color-accent)' },
  { find: '#f6dfa0', replace: 'var(--color-accent-hover)' },
  { find: '#e1cc8b', replace: 'var(--color-accent-active)' },
  { find: '#ffffff', replace: 'var(--color-text)' },
  { find: '#fff', replace: 'var(--color-text)' },
  { find: '#24221e', replace: 'var(--color-text)' },
  { find: '4px', replace: 'var(--space-1)' },
  { find: '8px', replace: 'var(--space-2)' },
  { find: '12px', replace: 'var(--space-3)' },
  { find: '16px', replace: 'var(--space-4)' },
  { find: '24px', replace: 'var(--space-5)' },
  { find: '32px', replace: 'var(--space-6)' },
  { find: '44px', replace: 'var(--space-7)' },
  { find: '56px', replace: 'var(--space-8)' },
  { find: 'border-radius: 4px', replace: 'border-radius: var(--radius-sm)' },
  { find: 'border-radius: 8px', replace: 'border-radius: var(--radius-md)' },
  { find: 'border-radius: 12px', replace: 'border-radius: var(--radius-lg)' },
  { find: 'border-radius: 16px', replace: 'border-radius: var(--radius-xl)' },
];

// Properties where !important is often unnecessary
const SAFE_PROPS = new Set([
  'display',
  'visibility',
  'opacity',
  'pointer-events',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'overflow',
  'border',
  'outline',
]);

function isSafeRemove(prop, val) {
  if (!SAFE_PROPS.has(prop)) return false;
  if (prop === 'display' && val === 'none') return true;
  if (prop === 'visibility' && val === 'hidden') return true;
  if (prop === 'overflow' && val === 'hidden') return true;
  if (prop === 'opacity' && val === '0') return true;
  if (prop === 'pointer-events' && val === 'none') return true;
  if (prop === 'outline' && val === 'none') return true;
  if (prop.startsWith('margin') && val === '0') return true;
  if (prop === 'border' && val === 'none') return true;
  if (prop === 'position' && (val === 'fixed' || val === 'absolute' || val === 'relative'))
    return true;
  if (
    prop.startsWith('top') ||
    prop.startsWith('left') ||
    prop.startsWith('right') ||
    prop.startsWith('bottom')
  ) {
    if (val === '0' || val === '0px') return true;
  }
  if (prop === 'height' && val === '100%') return true;
  if (prop === 'width' && val === '100%') return true;
  return false;
}

function getReason(line) {
  if (line.includes('display: none')) return 'hidden state';
  if (line.includes('visibility: hidden')) return 'visibility';
  if (line.includes('pointer-events: none')) return 'interaction block';
  if (line.includes('position:')) return 'layout positioning';
  if (line.includes('z-index')) return 'stacking context';
  if (line.includes('opacity:')) return 'opacity toggle';
  if (line.includes('width:')) return 'width override';
  if (line.includes('background:')) return 'surface color';
  if (line.includes('color:')) return 'text color';
  if (line.includes('margin:')) return 'margin reset';
  if (line.includes('overflow:')) return 'scroll containment';
  if (line.includes('border-radius:')) return 'component shape';
  if (line.includes('box-shadow:')) return 'elevation';
  if (line.includes('border:')) return 'border style';
  return 'utility override';
}

function applyTokens(line) {
  let result = line;
  for (const { find, replace } of TOKEN_REPLACEMENTS) {
    result = result.split(find).join(replace);
  }
  return result;
}

for (const filePath of files) {
  let source = fs.readFileSync(filePath, 'utf8');

  // 1. Add token import
  if (!source.includes('_tokens.css')) {
    source = `@import './css-parts/_tokens.css';\n\n${source}`;
  }

  // 2. Add cascade layer declarations
  if (!source.includes('@layer')) {
    source = `/* ===== Cascade layers ===== */\n@layer base, components, utilities;\n\n${source}`;
  }

  // 3. Process lines
  const lines = source.split('\n');
  const newLines = [];
  let removedCount = 0;
  let reasonCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    const hasReason = prevLine.includes('/* reason:') || prevLine.includes('/* override:');

    line = applyTokens(line);

    if (line.includes('!important')) {
      // Match property: value !important within the line (not just entire line)
      const declMatch = line.match(/([a-z-]+):\s*(none|hidden|0)\s*!important;/);
      if (declMatch && isSafeRemove(declMatch[1], declMatch[2])) {
        line = line.replace('!important', '');
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
  console.log(
    `${path.basename(filePath)}: removed ${removedCount} !important, added ${reasonCount} reason comments`
  );
}

console.log('\nDone.');
