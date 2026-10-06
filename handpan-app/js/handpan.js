/**
 * handpan.js — bootstrap: assembles the full 9-note interval-based instrument engine.
 * Source is split across handpan-src-a.js / handpan-src-b.js for transport limits.
 */
import { P1 } from './handpan-src-a.js';
import { P2 } from './handpan-src-b.js';

const code = P1 + P2;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
import(url).finally(() => URL.revokeObjectURL(url));
