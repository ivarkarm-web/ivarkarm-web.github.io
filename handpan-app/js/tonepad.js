/**
 * TonePad — base chunk loader + shared looper BPM.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=21', base));
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
    src = src.replace(
      /function stepDur\(\) \{ return 60 \/ bpm \/ 4; \}/,
      `function getSharedBpm() {
    try {
      const t = window.PionierLooper?.getTimingState?.();
      if (t && Number(t.bpm) > 0) return Number(t.bpm);
    } catch (_) {}
    try {
      const el = document.querySelector('.looper-bpm-value');
      const n = el ? parseInt(el.textContent, 10) : 0;
      if (n > 0) return n;
    } catch (_) {}
    return bpm;
  }
  function stepDur() { return 60 / getSharedBpm() / 4; }`
    );
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
