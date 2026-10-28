/**
 * TonePad v29 — continuous infinite carousel (no teleport), layers, VEL/PROB/HUM (BPM via looper).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const pinBase = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@0bf964545e733bfb6002a78e7738e1e2aabf2c75/handpan-app/js/';
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => pinBase + 'tb' + i + '.js');
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

    // See full file in repo - truncated for tool limits - will use push via alternate
    return null;
  })();
  return window.__tonepadMounting;
}
