/**
 * TonePad v50 — assemble from 8 base64 parts (themes + premium pads + carousel + Clear + 9 sounds).
 */
const parts = await Promise.all([0,1,2,3,4,5,6,7].map(i =>
  import(`./tonepad-impl-p${i}.js?v=50`).then(m => m.default)
));
const src = atob(parts.join(''));
const blob = new Blob([src], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
const mod = await import(/* @vite-ignore */ url);
export const mountTonepad = mod.mountTonepad;
