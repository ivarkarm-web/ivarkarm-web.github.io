/**
 * TonePad loader — implementation in tonepad-impl.js
 */
export async function mountTonepad() {
  const mod = await import(new URL('./tonepad-impl.js?v=3', import.meta.url).href);
  return mod.mountTonepad();
}
