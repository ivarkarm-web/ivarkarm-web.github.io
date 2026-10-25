import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repoRoot, 'handpan-app');
const output = path.join(repoRoot, 'dist', 'handpan-app');

await rm(output, { recursive: true, force: true });
await mkdir(path.dirname(output), { recursive: true });
await cp(source, output, {
  recursive: true,
  filter: (src) => !src.split(path.sep).includes('.git')
});

await build({
  configFile: false,
  root: source,
  base: './',
  publicDir: false,
  build: {
    outDir: output,
    emptyOutDir: false,
    assetsDir: 'assets',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: { input: path.join(source, 'index.html') }
  }
});

console.log('Built Pionier app to dist/handpan-app with Vite (JS + CSS minified).');
