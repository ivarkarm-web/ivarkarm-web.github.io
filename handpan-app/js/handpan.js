/**
 * handpan.js — 9-note interval-based handpan engine
 *
 * Loads the assembled bundle (handpan.bundle.js) which includes:
 *   - 10 scales as semitone intervals relative to Ding
 *   - 9 radial pads (1 Ding + 8 surrounding)
 *   - Dynamic transposition: baseMidi + octaveOffset
 *   - Seamless remap without interrupting active audio / loops
 *
 * Modular sources: handpan-src-0.js … handpan-src-13.js
 * Standalone scale API: scales.js
 * Rebuild: node scripts/assemble-handpan.mjs
 */
import './handpan.bundle.js';
