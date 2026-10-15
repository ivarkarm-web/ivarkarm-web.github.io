/**
 * pionier-core — local vendored core (no remote CDN fetch / string-patch boot).
 * Loads in-repo source parts and evaluates as a module.
 */
const base = new URL('./js/', import.meta.url);
const parts = await Promise.all(
  [0, 1, 2].map((i) => fetch(new URL(`pionier-core.src.${i}.js`, base)).then((r) => {
    if (!r.ok) throw new Error(`Failed to load pionier-core.src.${i}.js: HTTP ${r.status}`);
    return r.text();
  }))
);
const src = parts.join('');
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
