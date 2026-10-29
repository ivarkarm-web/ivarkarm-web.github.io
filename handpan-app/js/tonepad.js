/**
 * TonePad v46 — gzip bootstrap (carousel + Clear + 9 sounds).
 */
const B64 = "H4sIAAAAAAACA9V97XbbOLLg/zwFkjnTIm2KJmXJsaXIuekkPZ07ScebpD/m5PpkIBKScE2RbBL6arfv2YfYd9n/+yj7JHuqAJIASclO4p6+m3O6TZH4KBTqC6hC4ejg4AE5IB+SmF3QkKz6A/J//+f/Ijye8piLLQlolixzFpFD8jxiNCOHJGVZN6JblpE8WcYhWSThMmI5sc4Ij";

function b64ToU8(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function gunzip(u8) {
  const ds = new DecompressionStream('gzip');
  const ab = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
  return new TextDecoder().decode(ab);
}

const audioUrl = new URL('./audio-core.js?v=2', import.meta.url).href;
const src = (await gunzip(b64ToU8(B64))).split('__AUDIO_CORE_URL__').join(audioUrl);
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* @vite-ignore */ url);
export const mountTonepad = mod.mountTonepad;
