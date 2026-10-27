/**
 * TonePad v11 — carousel + swipe-back from either edge when sequencer is open.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=11', base));
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

    // Dual-card track via CSS vars
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
    const root = document.documentElement;
    root.style.setProperty('--tp-tr', animate ? '.42s' : '0s');
    root.style.setProperty('--tp-x', x + 'px');
    root.style.setProperty('--tp-lx', (x + w) + 'px');
    const pan = document.getElementById('pan');
    if (pan) {
      pan.style.transform = 'translate3d(' + x + 'px,0,0)';
      pan.style.opacity = '1';
    }
    layer.style.transform = 'translate3d(' + (x + w) + 'px,0,0)';
    layer.style.opacity = '1';
    if (progress > 0.55) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  function resizeCanvas`
    );

    // Keep playing on handpan view
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    // Replace edge detection: open from right edge; close from left OR right edge
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(56, window.innerWidth * 0.12));
    const onRightEdge = e.clientX >= window.innerWidth - edge;
    const onLeftEdge = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page > 0 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.4));
    // page 0 → open (swipe left from right edge)
    // page 1 → close (swipe right from left edge, right edge, or left 40% of grid)
    const wantOpen = page < PAGES.length - 1 && onRightEdge;
    const wantClose = page > 0 && (onLeftEdge || onRightEdge || onLayerLeft);
    if (!wantOpen && !wantClose) return;
    swipe = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      dir: wantOpen ? 1 : -1,
      active: false
    };`
    );

    // Lower threshold to commit close/open so short edge swipes work
    src = src.replace(
      /if \(was && dir === 1 && dx < -Math\.min\(64, w \* 0\.18\)\) setPage\(page \+ 1, true\);\s*else if \(was && dir === -1 && dx > Math\.min\(64, w \* 0\.18\)\) setPage\(page - 1, true\);/,
      `const thresh = Math.min(48, w * 0.12);
    if (was && dir === 1 && dx < -thresh) setPage(page + 1, true);
    else if (was && dir === -1 && dx > thresh) setPage(page - 1, true);`
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
