/**
 * TonePad v4 — assemble from base64 parts tb0..tb7
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0,1,2,3,4,5,6,7].map((i) => new URL('./tb' + i + '.js?v=4', base));
    const parts = await Promise.all(urls.map((u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error('missing ' + u);
      return r.text();
    })));
    const b64 = parts.join('').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'text/javascript' });
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
