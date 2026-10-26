/**
 * TonePad — loads implementation parts then mounts.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [
      new URL('./tonepad-p1.js?v=3', base),
      new URL('./tonepad-p2.js?v=3', base),
      new URL('./tonepad-p3.js?v=3', base),
      new URL('./tonepad-p4.js?v=3', base)
    ];
    const parts = await Promise.all(urls.map((u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error('tonepad part ' + u);
      return r.text();
    })));
    const blob = new Blob([parts.join('')], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const mod = await import(/* @vite-ignore */ url);
    return mod.mountTonepad();
  })();
  return window.__tonepadMounting;
}
