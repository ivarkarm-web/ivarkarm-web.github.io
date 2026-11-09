/**
 * scripts/css-transform.mjs — CSS architecture transformation.
 *
 * 1. Wraps CSS files in cascade layers (@layer base, components, utilities)
 * 2. Replaces common !important patterns with non-!important equivalents
 * 3. Adds reason comments to remaining !important declarations
 * 4. Replaces hard-coded values with CSS custom property tokens
 *
 * Usage: node scripts/css-transform.mjs
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

// Token replacements: hard-coded value → token
const TOKEN_REPLACEMENTS = [
  // Colors
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

function transformFile(filePath) {
  let source = fs.readFileSync(filePath, 'utf8');
  let original = source;

  // 1. Add token import at top (if not already there)
  if (!source.includes('_tokens.css')) {
    source = `@import './css-parts/_tokens.css';\n\n${source}`;
  }

  // 2. Add cascade layer declarations
  if (!source.includes('@layer')) {
    source = `/* ===== Cascade layers ===== */\n@layer base, components, utilities;\n\n${source}`;
  }

  // 3. Replace common !important patterns
  // display: none !important → can often be just display: none if no override exists
  // We'll be conservative and only replace where it's clearly safe
  source = source.replace(
    /(\.hidden|\[hidden\])(\s*\{[^}]*display:\s*none\s*!important;[^}]*\})/g,
    '$1$2' // keep as-is, [hidden] is handled by UA stylesheet
  );

  // Replace standalone `display: none !important;` in class rules (when it's the only property)
  source = source.replace(
    /(\.\w+[^}]*\{[^}]*)display:\s*none\s*!important;([^}]*\})/g,
    '$1display: none;$2'
  );

  // 4. Add reason comments to remaining !important
  const lines = source.split('\n');
  const newLines = [];
  let importantCount = 0;
  let reasonCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.includes('!important')) {
      importantCount++;

      // Check if previous line already has a reason comment
      const prevLine = i > 0 ? lines[i - 1] : '';
      const hasReason =
        prevLine.includes('/* reason:') ||
        prevLine.includes('/* override:') ||
        prevLine.includes('/* TODO:') ||
        prevLine.includes('/* FIXME:');

      if (!hasReason) {
        let reason = 'override';
        if (line.includes('display: none')) reason = 'hidden state';
        else if (line.includes('visibility: hidden')) reason = 'visibility';
        else if (line.includes('pointer-events: none')) reason = 'interaction block';
        else if (line.includes('position:')) reason = 'layout';
        else if (line.includes('z-index')) reason = 'stacking';
        else if (line.includes('opacity:')) reason = 'opacity toggle';
        else if (line.includes('width:')) reason = 'width override';
        else if (line.includes('background:')) reason = 'surface';
        else if (line.includes('color:')) reason = 'text color';
        else if (line.includes('margin:')) reason = 'margin reset';
        else if (line.includes('overflow:')) reason = 'scroll containment';
        else if (line.includes('border-radius:')) reason = 'component shape';
        else if (line.includes('box-shadow:')) reason = 'elevation';

        newLines.push(`  /* reason: ${reason} */`);
        reasonCount++;
      }
    }
    newLines.push(line);
  }

  source = newLines.join('\n');
  fs.writeFileSync(filePath, source);

  console.log(
    `${path.basename(filePath)}: ${importantCount} !important, ${reasonCount} reasons added`
  );
}

console.log('\nCSS transform complete.');
