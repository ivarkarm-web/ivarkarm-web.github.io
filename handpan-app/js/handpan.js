/**
 * handpan.js — 9-note interval-based engine (modular chunked source)
 */
import c0 from './handpan-src-0.js';
import c1 from './handpan-src-1.js';
import c2 from './handpan-src-2.js';
import c3 from './handpan-src-3.js';
import c4 from './handpan-src-4.js';
import c5 from './handpan-src-5.js';
import c6 from './handpan-src-6.js';
import c7 from './handpan-src-7.js';
import c8 from './handpan-src-8.js';
import c9 from './handpan-src-9.js';
import c10 from './handpan-src-10.js';
import c11 from './handpan-src-11.js';
import c12 from './handpan-src-12.js';
import c13 from './handpan-src-13.js';

const code = c0 + c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11 + c12 + c13;
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
await import(url);
URL.revokeObjectURL(url);
