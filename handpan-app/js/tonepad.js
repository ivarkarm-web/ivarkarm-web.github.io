/**
 * TonePad loader — assemble full module from string parts
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const mods = await Promise.all(
      [0,1,2,3].map((i) => import(new URL("./tp-part-" + i + ".js?v=4", base).href))
    );
    const src = mods.map((m) => m.default).join("");
    const blob = new Blob([src], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      return mod.mountTonepad();
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  return window.__tonepadMounting;
}
