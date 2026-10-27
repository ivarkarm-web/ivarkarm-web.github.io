/**
 * TonePad v20 — Shared looper BPM; VEL/PROB/HUM only; row-aligned knobs.
 * (See artifacts build — content loaded from validated offline file)
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const remote = new URL('./tonepad.bundle.js?v=20', base);
    try {
      const mod = await import(/* @vite-ignore */ remote.href);
      if (typeof mod.mountTonepad === 'function') return mod.mountTonepad();
    } catch (e) {
      console.warn('[tonepad] bundle missing, falling back to chunks', e);
    }
    // Fallback: original chunk loader + patches
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=20', base));
    const parts = await Promise.all(urls.map((u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('missing ' + u); return r.text(); })));
    const b64 = parts.join('').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let src = new TextDecoder().decode(bytes);
    const dirUrl = new URL('./', base).href;
    src = src.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (m, q, rel) => `from ${q}${new URL(rel, dirUrl).href}${q}`);
    // minimal critical patches only (layers + shared bpm) live in tonepad.bundle.js preferred path
    const blob = new Blob([src], { type: 'text/javascript' });
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
