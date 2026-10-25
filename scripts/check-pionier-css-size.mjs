import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(repoRoot, 'dist', 'handpan-app', 'assets');
const budgetBytes = 250_000;

let files = [];
try {
  files = (await readdir(assetsDir))
    .filter((name) => name.endsWith('.css') && /^index[-.]/.test(name));
} catch {
  console.error('CSS performance gate: dist/handpan-app/assets is missing; run npm run build:app first.');
  process.exit(1);
}

const measured = await Promise.all(files.map(async (name) => ({
  name,
  bytes: (await stat(path.join(assetsDir, name))).size
})));
const total = measured.reduce((sum, file) => sum + file.bytes, 0);

console.log('Minified Pionier CSS bundle sizes:');
for (const file of measured) console.log(`- ${file.name}: ${file.bytes.toLocaleString()} bytes`);
console.log(`Total: ${total.toLocaleString()} bytes / ${budgetBytes.toLocaleString()} byte budget`);

if (!measured.length || total >= budgetBytes) {
  console.error('CSS performance gate failed: expected a minified CSS bundle below 250,000 bytes.');
  process.exit(1);
}
