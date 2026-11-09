/**
 * scripts/css-aggressive.mjs — Remove ALL !important from CSS.
 *
 * Removes !important from every declaration and adds reason comments.
 * This is aggressive: some visual behavior may change, but CSS syntax
 * remains valid.
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

for (const filePath of files) {
  let source = fs.readFileSync(filePath, 'utf8');

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
  console.log(`${path.basename(filePath)}: removed ${removedCount} !important, added ${reasonCount} reason comments`);
}

console.log('\nDone.');
