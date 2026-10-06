/**
 * handpan.js — temporary restore loader
 *
 * Loads the last known-good engine blob from git history so the instrument
 * keeps working while the 9-note interval/transposition refactor is applied.
 *
 * New scale system lives in ./scales.js (already on main):
 *   - 10 interval-based 9-note scales
 *   - baseMidi + octaveOffset transposition
 *   - buildNotes() / shiftRoot() / shiftOctave()
 *
 * Integration of scales.js into this engine is the next step.
 */
const ENGINE_URL =
  'https://raw.githubusercontent.com/ivarkarm-web/ivarkarm-web.github.io/eee19589bc8fb4a68386ebe094cc86a43ba02dc3/handpan-app/js/handpan.js';

const res = await fetch(ENGINE_URL);
if (!res.ok) throw new Error('Failed to load handpan engine: ' + res.status);
const code = await res.text();
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
await import(url);
URL.revokeObjectURL(url);
