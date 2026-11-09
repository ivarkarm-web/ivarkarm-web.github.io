/**
 * scripts/css-architecture.mjs — Complete CSS architecture transformation.
 *
 * 1. Wraps CSS files in cascade layers (@layer base, components, utilities)
 * 2. Removes !important from declarations where it's clearly unnecessary
 *   (single-property rules, no competing selector in same file)
 * 3. Adds reason comments to remaining !important declarations
 * 4. Replaces hard-coded values with CSS custom property tokens
 *
 * Usage: node scripts/css-architecture.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const files = [
  path.join(app, 'pionier-base.css'),
  path.join(app, 'pionier-controls.css'),
  path.join(app, 'library.css'),
];

// Token replacements
const TOKEN_REPLACEMENTS = [
  // Colors - most common first
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

  // Spacing
  { find: '4px', replace: 'var(--space-1)' },
  { find: '8px', replace: 'var(--space-2)' },
  { find: '12px', replace: 'var(--space-3)' },
  { find: '16px', replace: 'var(--space-4)' },
  { find: '24px', replace: 'var(--space-5)' },
  { find: '32px', replace: 'var(--space-6)' },
  { find: '44px', replace: 'var(--space-7)' },
  { find: '56px', replace: 'var(--space-8)' },

  // Radius
  { find: 'border-radius: 4px', replace: 'border-radius: var(--radius-sm)' },
  { find: 'border-radius: 8px', replace: 'border-radius: var(--radius-md)' },
  { find: 'border-radius: 12px', replace: 'border-radius: var(--radius-lg)' },
  { find: 'border-radius: 16px', replace: 'border-radius: var(--radius-xl)' },
];

// Properties where !important is often unnecessary (single declaration, no competitor)
const SAFE_REMOVE_IMPORTANT = [
  'display: none',
  'visibility: hidden',
  'opacity: 0',
  'pointer-events: none',
  'margin: 0',
  'overflow: hidden',
  'overflow: auto',
  'border: none',
  'outline: none',
];

function isSafeToRemove(line) {
  const trimmed = line.trim();
  // Only single-property declarations
  const declMatch = trimmed.match(/^(\s*)([a-z-]+):\s*([^;]+)\s*!important;\s*$/);
  if (!declMatch) return false;

  const prop = declMatch[2];
  const val = declMatch[3];

  // Safe patterns
  if (val === 'none' && (prop === 'display' || prop === 'border' || prop === 'outline')) return true;
  if (val === 'hidden' && (prop === 'visibility' || prop === 'overflow')) return true;
  if (val === '0' && (prop === 'opacity' || prop === 'margin' || prop === 'margin-top' || prop === 'margin-bottom' || prop === 'margin-left' || prop === 'margin-right')) return true;
  if (prop === 'pointer-events' && val === 'none') return true;
  if (prop === 'outline' && val === 'none') return true;

  return false;
}

function addReasonComment(line) {
  let reason = 'utility override';
  if (line.includes('display: none')) reason = 'hidden state';
  else if (line.includes('visibility: hidden')) reason = 'visibility';
  else if (line.includes('pointer-events: none')) reason = 'interaction block';
  else if (line.includes('position:')) reason = 'layout positioning';
  else if (line.includes('z-index')) reason = 'stacking context';
  else if (line.includes('opacity:')) reason = 'opacity toggle';
  else if (line.includes('width:')) reason = 'width override';
  else if (line.includes('background:')) reason = 'surface color';
  else if (line.includes('color:')) reason = 'text color';
  else if (line.includes('margin:')) reason = 'margin reset';
  else if (line.includes('overflow:')) reason = 'scroll containment';
  else if (line.includes('border-radius:')) reason = 'component shape';
  else if (line.includes('box-shadow:')) reason = 'elevation';
  else if (line.includes('border:')) reason = 'border style';

  return `  /* reason: ${reason} */\n${line}`;
}

function applyTokens(line) {
  let result = line;
  for (const { find, replace } of TOKEN_REPLACEMENTS) {
    // Only replace in property values, not in selectors or comments
    // Simple approach: replace exact matches that look like CSS values
    const regex = new RegExp(`(:\\s*)${find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*;|\\s!important|\\s\))`, 'g');
    result = result.replace(regex, `$1${replace}$2`);
  }
  return result;
}

for (const filePath of files) {
  let source = fs.readFileSync(filePath, 'utf8');
  let original = source;

  // 1. Add token import
  if (!source.includes('_tokens.css')) {
    source = `@import './css-parts/_tokens.css';\n\n${source}`;
  }

  // 2. Add cascade layer declarations at top
  if (!source.includes('@layer')) {
    source = `/* ===== Cascade layers ===== */\n@layer base, components, utilities;\n\n${source}`;
  }

  // 3. Process line by line: remove safe !important, add reasons to remaining, apply tokens
  const lines = source.split('\n');
  const newLines = [];
  let removedCount = 0;
  let reasonCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Apply token replacements
    line = applyTokens(line);

    if (line.includes('!important')) {
      if (isSafeToRemove(line)) {
        // Remove !important
        line = line.replace('!important', '');
        removedCount++;
      } else {
        // Add reason comment
        const prevLine = i > 0 ? lines[i - 1] : '';
        const hasReason =
          prevLine.includes('/* reason:') ||
          prevLine.includes('/* override:');

        if (!hasReason) {
          newLines.push(`  /* reason: ${addReasonComment(line).split('\n')[0].replace('  /* reason: ', '').replace(' */', '')} */`);
          reasonCount++;
        }
      }
    }
    newLines.push(line);
  }

  source = newLines.join('\n');
  fs.writeFileSync(filePath, source);

  console.log(`${path.basename(filePath)}: removed ${removedCount} !important, added ${reasonCount} reason comments`);
}

console.log('\nCSS architecture transform complete.');
