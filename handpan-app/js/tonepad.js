/**
 * TonePad v12 — infinite 2-card carousel (handpan ↔ sequencer ↔ handpan …).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=12', base));
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

    // Inject cycle helpers + replace shiftCarousel for infinite track
    src = src.replace(
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `let wrapBias = 0; // ±1 during forward/back wrap past ends

  function applyTrack(x, w, animate) {
    const root = document.documentElement;
    root.style.setProperty('--tp-tr', animate ? '.42s' : '0s');
    // Infinite 2-card: positions mod 2w so cards always loop
    // Handpan home slots at …, -2w, 0, 2w, …
    // Sequencer slots at …, -w, w, 3w, …
    const cycle = w * 2;
    let panX = x;
    let layerX = x + w;
    // Nudge into a nearby cycle so the visible card is on-screen when possible
    while (panX < -1.5 * w) { panX += cycle; layerX += cycle; }
    while (panX > 0.5 * w) { panX -= cycle; layerX -= cycle; }
    root.style.setProperty('--tp-x', panX + 'px');
    root.style.setProperty('--tp-lx', layerX + 'px');
    const pan = document.getElementById('pan');
    if (pan) {
      pan.style.transform = 'translate3d(' + panX + 'px,0,0)';
      pan.style.opacity = '1';
    }
    layer.style.transform = 'translate3d(' + layerX + 'px,0,0)';
    layer.style.opacity = '1';
  }

  function shiftCarousel(animate) {
    const box = homeBox();
    if (!box) return;
    place();
    const dx = dragDx != null ? dragDx : 0;
    const w = Math.max(1, box.width);
    // page 0 → 0, page 1 → -w, wrapBias shifts a full cycle during edge wrap
    const x = -(page + wrapBias) * w + dx;
    const progress = ((-x / w) % 2 + 2) % 2; // 0..2 continuous
    slideProgress = Math.min(1, progress > 1 ? progress - 1 : progress);
    applyTrack(x, w, animate);
    const showOpen = (progress > 0.5 && progress < 1.5) || (page === 1 && dragDx == null && wrapBias === 0);
    if (showOpen) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  function resizeCanvas`
    );

    // Keep playing when on handpan
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    // Infinite edge detection: always allow right-edge (forward) and left-edge (back)
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(56, window.innerWidth * 0.12));
    const onRightEdge = e.clientX >= window.innerWidth - edge;
    const onLeftEdge = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page === 1 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.4));
    // Forward = swipe left (dir 1); back = swipe right (dir -1). Always available (infinite).
    const wantForward = onRightEdge;
    const wantBack = onLeftEdge || onLayerLeft || (page === 1 && onRightEdge);
    if (!wantForward && !wantBack) return;
    // Prefer forward when starting on right edge; back when on left.
    const useForward = onRightEdge && !onLeftEdge;
    swipe = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      dir: useForward ? 1 : -1,
      active: false
    };`
    );

    // onUp: wrap pages infinitely
    src = src.replace(
      /if \(was && dir === 1 && dx < -Math\.min\(64, w \* 0\.18\)\) setPage\(page \+ 1, true\);\s*else if \(was && dir === -1 && dx > Math\.min\(64, w \* 0\.18\)\) setPage\(page - 1, true\);\s*else setPage\(page, true\);/,
      `const thresh = Math.min(48, w * 0.12);
    if (was && dir === 1 && dx < -thresh) {
      // forward (swipe left) — infinite
      if (page >= PAGES.length - 1) {
        wrapBias = 1; // animate one extra step past the end
        shiftCarousel(false);
        requestAnimationFrame(() => {
          page = 0;
          open = false;
          wrapBias = 0;
          dragDx = null;
          document.body.classList.remove('tonepad-open');
          layer.setAttribute('aria-hidden', 'true');
          shiftCarousel(true);
        });
      } else {
        setPage(page + 1, true);
      }
    } else if (was && dir === -1 && dx > thresh) {
      // back (swipe right) — infinite
      if (page <= 0) {
        wrapBias = -1;
        shiftCarousel(false);
        requestAnimationFrame(() => {
          page = PAGES.length - 1;
          open = true;
          wrapBias = 0;
          dragDx = null;
          document.body.classList.add('tonepad-open');
          layer.setAttribute('aria-hidden', 'false');
          start();
          resizeCanvas();
          shiftCarousel(true);
        });
      } else {
        setPage(page - 1, true);
      }
    } else {
      setPage(page, true);
    }`
    );

    // Allow overscroll drag past ends (infinite feel while dragging)
    src = src.replace(
      /const capped = swipe\.dir === 1 \? Math\.max\(-w, Math\.min\(0, dx\)\) : Math\.min\(w, Math\.max\(0, dx\)\);/,
      `// Free drag with soft clamp past one full page for infinite preview
    const capped = swipe.dir === 1
      ? Math.max(-w * 1.15, Math.min(0, dx))
      : Math.min(w * 1.15, Math.max(0, dx));`
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
