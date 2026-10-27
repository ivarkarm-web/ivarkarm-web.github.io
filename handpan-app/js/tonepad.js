/** TonePad loader — assembles tn0..tn3 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const parts = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        fetch(new URL('./tn' + i + '.js?v=19', base), { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('missing tn' + i);
          return r.text();
        })
      )
    );
    const src = parts.join('');
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
