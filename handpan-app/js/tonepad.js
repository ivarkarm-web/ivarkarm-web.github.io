/**
 * TonePad v9 — assemble tb0..tb7 + carousel + keep playing on handpan view.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=9', base));
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

    const dir = new URL('./', base).href;
    src = src.replace(
      /from\s+(['"])(\.\/[^'"]+)\1/g,
      (m, q, rel) => `from ${q}${new URL(rel, dir).href}${q}`
    );

    // True dual-card carousel
    src = src.replace(
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `function shiftCarousel(animate) {
    const box = homeBox();
    if (!box) return;
    place();
    const dx = dragDx != null ? dragDx : 0;
    const w = Math.max(1, box.width);
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    const tr = animate
      ? 'transform .42s cubic-bezier(.22,.82,.2,1)'
      : 'none';

    const pan = document.getElementById('pan');
    if (pan) {
      pan.style.setProperty('transition', tr);
      pan.style.setProperty('transform', 'translate3d(' + x + 'px,0,0)');
      pan.style.setProperty('opacity', '1');
      pan.style.setProperty('contain', progress > 0.01 ? 'none' : '');
    }

    layer.style.transition = tr;
    layer.style.transform = 'translate3d(' + (x + w) + 'px,0,0)';
    layer.style.opacity = '1';

    if (progress > 0.55) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  function resizeCanvas`
    );

    // Keep playing when returning to handpan — only start when opening, never stop on close
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }
    // stay playing in background when viewing handpan`
    );

    // Easier swipe-back from left side of sequencer
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;/,
      `const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && open ? layerEl.getBoundingClientRect() : null;
    const fromRight = e.clientX >= window.innerWidth - EDGE && page < PAGES.length - 1;
    const fromLeft = page > 0 && (
      e.clientX <= EDGE ||
      (lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(EDGE, lr.width * 0.28))
    );`
    );

    src = src.replace(
      "'#pan{will-change:transform,opacity;transition:none}',",
      "'#pan{will-change:transform;transition:none;opacity:1}',"
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
