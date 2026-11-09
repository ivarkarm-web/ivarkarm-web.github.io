/**
 * scripts/css-finalize.mjs — Final CSS architecture transformation.
 *
 * Removes !important from all declarations, adds cascade layers,
 * token imports, and reason comments to remaining ones.
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
  { find: '56px', replace: 'var(--space-8)' },
  { find: '44px', replace: 'var(--space-7)' },
  { find: '32px', replace: 'var(--space-6)' },
  { find: '24px', replace: 'var(--space-5)' },
  { find: '16px', replace: 'var(--space-4)' },
  { find: '12px', replace: 'var(--space-3)' },
  { find: '8px', replace: 'var(--space-2)' },
  { find: '4px', replace: 'var(--space-1)' },
  { find: 'border-radius: 16px', replace: 'border-radius: var(--radius-xl)' },
  { find: 'border-radius: 12px', replace: 'border-radius: var(--radius-lg)' },
  { find: 'border-radius: 8px', replace: 'border-radius: var(--radius-md)' },
  { find: 'border-radius: 4px', replace: 'border-radius: var(--radius-sm)' },
];

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

function applyTokens(line) {
  let result = line;
  for (const { find, replace } of TOKEN_REPLACEMENTS) {
    result = result.split(find).join(replace);
  }
  return result;
}

function extractDecl(line) {
  const m = line.match(/([a-z-]+):\s*([^;!]+)\s*!important/);
  if (m) return { prop: m[1], val: m[2].trim() };
  return null;
}

for (const filePath of files) {
  let source = fs.readFileSync(filePath, 'utf8');

  if (!source.includes('_tokens.css')) {
    source = `@import './css-parts/_tokens.css';\n\n${source}`;
  }

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
    const hasReason = prevLine.includes('/* reason:') || prevLine.includes('/* override:');

    line = applyTokens(line);

    if (line.includes('!important')) {
      const decl = extractDecl(line);
      line = line.replace(/!important/g, '');
      removedCount++;
      if (!hasReason) {
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
