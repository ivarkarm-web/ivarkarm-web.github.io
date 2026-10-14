/**
 * pionier-surface.js — loads assembled surface parts
 */
const BASE = import.meta.url;
const texts = await Promise.all([0, 1, 2].map(async (i) => {
  const r = await fetch(new URL('./surf-part-' + i + '.js?v=3', BASE));
  if (!r.ok) throw new Error('surf-part-' + i + ' failed: ' + r.status);
  return r.text();
}));
const src = texts.join('');
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* webpackIgnore: true */ url);
URL.revokeObjectURL(url);
export const WORLD_ZONE_INDICES = mod.WORLD_ZONE_INDICES;
export const createSurface = mod.createSurface;
export default mod.default || mod;
