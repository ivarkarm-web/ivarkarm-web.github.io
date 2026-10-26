/**
 * TonePad v6 — assemble tb0..tb7, rewrite imports, inject left-slide fix.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=6', base));
    const parts = await Promise.all(
      urls.map((u) =>
        fetch(u).then((r) => {
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

    // Absolute imports so blob: modules resolve
    const dir = new URL('./', base).href;
    src = src.replace(
      /from\s+(['"])(\.\/[^'"]+)\1/g,
      (m, q, rel) => `from ${q}${new URL(rel, dir).href}${q}`
    );

    // Inject handpan left-slide: % of own width (pixels often no-op under contain/layout)
    src = src.replace(
      /pan\.style\.transform\s*=\s*`translate3d\(\$\{x\}px,0,0\)`;\s*pan\.style\.opacity\s*=\s*String\(1\s*-\s*progress\s*\*\s*0\.85\);/,
      `const panPct = -progress * 110;
      pan.style.setProperty('transform', 'translate3d(' + panPct + '%,0,0)');
      pan.style.setProperty('opacity', String(Math.max(0, 1 - progress * 0.95)));
      pan.style.setProperty('contain', progress > 0.02 ? 'none' : '');`
    );

    // Extra chrome CSS for stage halo sliding with the pan
    src = src.replace(
      "'#pan{will-change:transform,opacity;transition:none}',",
      "'#pan{will-change:transform,opacity;transition:none;transform-origin:center center}'," +
        "'body.tonepad-open #pan{pointer-events:none}'," +
        "'body.tonepad-open .stage::before{transform:translate(calc(-50% - 55vw),50%)!important;opacity:.12;" +
        "transition:transform .42s cubic-bezier(.22,.82,.2,1),opacity .36s ease}',"
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
