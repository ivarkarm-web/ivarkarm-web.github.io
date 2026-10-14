/**
 * pionier-core — emergency restore loader
 * Loads the last known-good core from a pinned commit, rewrites the
 * library-family import to v=3 (metallic batch), and executes it as a module
 * with relative imports resolved against this app origin.
 */
const PIN = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@fb1421d50a622911b6de9d94976d1e7481997858/handpan-app/pionier-core.js';

const res = await fetch(PIN);
if (!res.ok) throw new Error('Failed to restore pionier-core: HTTP ' + res.status);
let src = await res.text();

// Use the live library-family (includes metallic batch 1 voices)
src = src.replace(/library-family\.js\?v=\d+/g, 'library-family.js?v=3');

// Surface: two-pass pads + stronger skins + LED
src = src.replace(/pionier-surface\.js\?v=\d+/g, 'pionier-surface.js?v=102');

// Disable vertical pitch-bend drag (was detuning held notes)
src = src.replace(/moved\.pitchBendNorm = bendNorm;/g, 'moved.pitchBendNorm = 0;');
src = src.replace(/moved\.pitchBend = bendNorm \* range;/g, 'moved.pitchBend = 0;');

// Disable slide portamento/glide between pads (stable pitch per strike)
src = src.replace(
  /if \(!sharedPrev && !sharedTarget && prevIdx != null && typeof inst\.glideTo === 'function'\) \{[\s\S]*?\}/,
  'if (false) { /* glide disabled */ }'
);

// Resolve relative imports against the live handpan-app origin (not the CDN)
const base = new URL('.', import.meta.url).href;
src = src.replace(/from (['"])\.\//g, (m, q) => 'from ' + q + base);

const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
let mod;
try {
  mod = await import(/* webpackIgnore: true */ url);
} finally {
  URL.revokeObjectURL(url);
}

const core = mod?.default || window.PionierCore;
export default core;
