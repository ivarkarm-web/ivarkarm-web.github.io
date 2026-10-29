/**
 * TonePad v44 entry — infinity carousel + Clear (assembled from chunks).
 */
import { c0 } from './tonepad_chunk_0.js?v=1';
import { c1 } from './tonepad_chunk_1.js?v=1';
import { c2 } from './tonepad_chunk_2.js?v=1';
import { c3 } from './tonepad_chunk_3.js?v=1';

const audioUrl = new URL('./audio-core.js?v=2', import.meta.url).href;
const src = (c0 + c1 + c2 + c3).split('__AUDIO_CORE_URL__').join(audioUrl);
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* @vite-ignore */ url);
export const mountTonepad = mod.mountTonepad;
