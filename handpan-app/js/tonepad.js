/**
 * TonePad v28 - smoother infinite carousel, layers, VEL/PROB/HUM (BPM via looper).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=28', base));
    const parts = await Promise.all(
      urls.map((u) =>
        fetch(u, { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('missing ' + u);
          return r.text();
        })
      )
    );
    const b64 = parts.join('').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let src = new TextDecoder().decode(bytes);

    const dirUrl = new URL('./', base).href;
    src = src.replace(
      /from\s+(['"])(\.\/[^'"]+)\1/g,
      (m, q, rel) => `from ${q}${new URL(rel, dirUrl).href}${q}`
    );

    // Load the rest of the patches from a companion module to keep this file small
    const patchUrl = new URL('./tonepad-patches.js?v=28', base);
    const { applyTonepadPatches } = await import(/* @vite-ignore */ patchUrl.href);
    src = applyTonepadPatches(src);

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = mod.mountTonepad();
      try { window.PionierTonepad = api || window.PionierTonepad; } catch (_) {}
      try {
        const btn = document.getElementById('tonepadToggle');
        if (btn && !btn.dataset.tpWired) {
          btn.dataset.tpWired = '1';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tp = window.PionierTonepad;
            if (!tp) return;
            if (typeof tp.toggle === 'function') tp.toggle();
            else if (document.body.classList.contains('tonepad-open') && tp.close) tp.close();
            else if (tp.open) tp.open();
          });
        }
      } catch (_) {}
      try {
        const pl = document.getElementById('portraitLock');
        if (pl) {
          pl.style.pointerEvents = 'none';
          if (pl.hidden) pl.style.display = 'none';
        }
      } catch (_) {}
      return api;
    } finally {
      URL.revokeObjectURL(url);
    }
  })().catch((err) => {
    console.error('[tonepad] mount failed', err);
    window.__tonepadMounting = null;
    throw err;
  });
  return window.__tonepadMounting;
}
