/**
 * TonePad v46 loader — fetches full engine (9 sounds + Clear + carousel).
 */
const audioUrl = new URL('./audio-core.js?v=2', import.meta.url).href;
const implUrl = new URL('./tonepad-impl.js?v=46', import.meta.url).href;
const res = await fetch(implUrl);
if (!res.ok) throw new Error('tonepad-impl fetch failed ' + res.status);
let src = await res.text();
src = src.split('__AUDIO_CORE_URL__').join(audioUrl);
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* @vite-ignore */ url);
export const mountTonepad = mod.mountTonepad;
