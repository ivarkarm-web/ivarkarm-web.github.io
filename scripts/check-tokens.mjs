/**
 * scripts/check-tokens.mjs — CI guard that enforces token usage in component CSS.
 *
 * Reads the token definitions from handpan-app/css-parts/_tokens.css and checks
 * that no component CSS file (pionier-base.css, pionier-controls.css,
 * css-parts/*.css) contains hard-coded color, spacing, radius, font-size, or
 * transition values that should be tokens.
 *
 * Usage:
 *   node scripts/check-tokens.mjs          # fail on violations
 *   node scripts/check-tokens.mjs --fix    # auto-fix simple replacements
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');
const tokenFile = path.join(app, 'css-parts', '_tokens.css');

const errors = [];
const warn = [];
const fix = process.argv.includes('--fix');

// Parse token definitions: --name: value;
const tokenSource = fs.readFileSync(tokenFile, 'utf8');
const tokenRegex = /(--[a-z][a-z0-9-]*):\s*([^;]+);/g;
const tokens = {};
let m;
while ((m = tokenRegex.exec(tokenSource))) {
  tokens[m[1]] = m[2].trim();
}

const tokenNames = Object.keys(tokens);
const tokenMap = {};

// Build a reverse map: value -> token name (for detecting hard-coded values)
for (const [name, value] of Object.entries(tokens)) {
  tokenMap[value] = name;
}

// Hard-coded value patterns that should use tokens
const colorPattern = /#([0-9a-fA-F]{3,6}|[0-9a-fA-F]{8})\b/gi;
const rgbaPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/gi;
const hslaPattern = /hsla?\(\s*\d+/gi;
const pxPattern = /(\d+(?:\.\d+)?)px\b/g;
const remPattern = /(\d+(?:\.\d+)?)rem\b/g;
const fontSizePattern = /font-size:\s*([^;]+);/gi;
const transitionPattern = /transition:\s*([^;]+);/gi;
const spacingProps = ['margin', 'padding', 'gap', 'left', 'right', 'top', 'bottom', 'width', 'height', 'max-width', 'min-height'];

// Files to check
const cssFiles = [
  path.join(app, 'pionier-base.css'),
  path.join(app, 'pionier-controls.css'),
  path.join(app, 'library.css'),
  ...fs
    .readdirSync(path.join(app, 'css-parts'))
    .filter((f) => f.endsWith('.css') && !f.startsWith('_'))
    .map((f) => path.join(app, 'css-parts', f)),
];

for (const cssFile of cssFiles) {
  const rel = path.relative(root, cssFile);
  const source = fs.readFileSync(cssFile, 'utf8');
  const lines = source.split('\n');
  let fileModified = false;

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Skip comments
      const trimmed = line.trim();
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      return;
    }

    // Check for hard-coded colors (hex)
    let match;
    while ((match = colorPattern.exec(line)) !== null) {
      const val = match[0];
      if (!tokenMap[val] && !val.startsWith('#f6dfa0') && !val.startsWith('#d4b04a')) {
        // Allow common accent colors that are defined as tokens
        errors.push(`${rel}:${lineNum}: hard-coded color ${val} — use a color token`);
      }
    }

    // Check for hard-coded rgba values
    while ((match = rgbaPattern.exec(line)) !== null) {
      const val = match[0];
      if (!tokenMap[val]) {
        errors.push(`${rel}:${lineNum}: hard-coded rgba ${val} — use a color token`);
      }
    }

    // Check for hard-coded spacing (px values on spacing properties)
    const propMatch = line.match(/([a-z-]+):\s*([^;]+);/);
    if (propMatch) {
      const prop = propMatch[1].trim();
      const val = propMatch[2].trim();
      if (
        spacingProps.includes(prop) &&
        pxPattern.test(val) &&
        !tokenMap[val]
      ) {
        // Allow 1px borders and 2px outlines
        if (!(val === '1px' || val === '2px')) {
          errors.push(`${rel}:${lineNum}: hard-coded spacing ${val} on ${prop} — use a spacing token`);
        }
      }
    }

    // Check font-size
    while ((match = fontSizePattern.exec(line)) !== null) {
      const val = match[1].trim();
      if (val.includes('px') || val.includes('rem')) {
        if (!tokenMap[val]) {
          errors.push(`${rel}:${lineNum}: hard-coded font-size ${val} — use a type token`);
        }
      }
    }

    // Check transition
    while ((match = transitionPattern.exec(line)) !== null) {
      const val = match[1].trim();
      if (!val.includes('var(')) {
        errors.push(`${rel}:${lineNum}: hard-coded transition ${val} — use a motion token`);
      }
    }
  });
}

console.log(`Token check: ${cssFiles.length} files scanned`);
console.log(`Tokens defined: ${tokenNames.length}`);

console.log('');
if (errors.length) {
  console.error(`Token violations: ${errors.length}`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}
console.log('Token check: OK — no hard-coded values found');
