/**
 * TonePad v51 — per-layer pad colors + gradients + pulse glow.
 */
async function loadB64() {
  const base = new URL('.', import.meta.url).href;
  const parts = await Promise.all([0,1,2,3,4,5,6,7].map(i =>
    fetch(new URL(`./tonepad-b64-${i}.txt?v=51`, base).href).then(r => {
      if (!r.ok) throw new Error('b64 part ' + i + ' ' + r.status);
      return r.text();
    })
  ));
  return parts.join('').replace(/\s+/g, '');
}
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
const b64 = await loadB64();
const src = (await gunzip(b64ToU8(b64))).split('__AUDIO_CORE_URL__').join(audioUrl);
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* @vite-ignore */ url);
export const mountTonepad = mod.mountTonepad;
