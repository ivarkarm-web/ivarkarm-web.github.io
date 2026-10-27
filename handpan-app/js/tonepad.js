/**
 * TonePad v13 — infinite carousel with smooth wrap (no jumps).
 *
 * Normal: page 0 handpan (x=0), page 1 sequencer (x=-w).
 * Wrap forward (sequencer → handpan via swipe left):
 *   pan teleports off-right (hidden), then both animate — sequencer exits left, handpan enters right.
 * Wrap back (handpan → sequencer via swipe right):
 *   layer teleports off-left, then sequencer enters left, handpan exits right.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=13', base));
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

    // Clean dual-card track + wrap helpers
    src = src.replace(
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `function setTrack(panX, layerX, animate) {
    const root = document.documentElement;
    const tr = animate ? '.42s' : '0s';
    root.style.setProperty('--tp-tr', tr);
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
    // Strict 2-page positions — no modulo during drag (avoids teleports)
    const x = -page * w + dx;
    slideProgress = Math.max(0, Math.min(1, -x / w));
    setTrack(x, x + w, animate);
    if (slideProgress > 0.55) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  /** Sequencer → handpan continuing left (infinite). */
  function wrapForwardToHandpan() {
    const box = homeBox();
    if (!box) return;
    const w = Math.max(1, box.width);
    dragDx = null;
    // 1) Park handpan just off the right (invisible), sequencer stays centered
    setTrack(w, 0, false);
    // 2) Animate: handpan slides in from right, sequencer exits left
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTrack(0, -w, true);
        page = 0;
        open = false;
        document.body.classList.remove('tonepad-open');
        layer.setAttribute('aria-hidden', 'true');
        // 3) After anim, snap sequencer to off-right home (same off-screen, no flash)
        setTimeout(() => {
          setTrack(0, w, false);
          shiftCarousel(false);
        }, 450);
      });
    });
  }

  /** Handpan → sequencer continuing right (infinite the other way). */
  function wrapBackwardToSequencer() {
    const box = homeBox();
    if (!box) return;
    const w = Math.max(1, box.width);
    dragDx = null;
    // 1) Park sequencer just off the left
    setTrack(0, -w, false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTrack(w, 0, true); // pan exits right, sequencer enters from left
        page = 1;
        open = true;
        document.body.classList.add('tonepad-open');
        layer.setAttribute('aria-hidden', 'false');
        start();
        resizeCanvas();
        setTimeout(() => {
          // Snap to normal page-1 layout: pan off left, layer centered
          setTrack(-w, 0, false);
          shiftCarousel(false);
        }, 450);
      });
    });
  }

  function resizeCanvas`
    );

    // Keep playing on handpan
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    // Edges: forward always from right; back from left (or left portion of layer)
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(56, window.innerWidth * 0.12));
    const onRightEdge = e.clientX >= window.innerWidth - edge;
    const onLeftEdge = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page === 1 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.4));
    const wantForward = onRightEdge;
    const wantBack = onLeftEdge || onLayerLeft;
    if (!wantForward && !wantBack) return;
    swipe = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      dir: wantForward && !onLeftEdge ? 1 : -1,
      active: false
    };`
    );

    // Commit: normal step or smooth infinite wrap
    src = src.replace(
      /if \(was && dir === 1 && dx < -Math\.min\(64, w \* 0\.18\)\) setPage\(page \+ 1, true\);\s*else if \(was && dir === -1 && dx > Math\.min\(64, w \* 0\.18\)\) setPage\(page - 1, true\);\s*else setPage\(page, true\);/,
      `const thresh = Math.min(48, w * 0.12);
    if (was && dir === 1 && dx < -thresh) {
      if (page >= PAGES.length - 1) wrapForwardToHandpan();
      else setPage(page + 1, true);
    } else if (was && dir === -1 && dx > thresh) {
      if (page <= 0) wrapBackwardToSequencer();
      else setPage(page - 1, true);
    } else {
      setPage(page, true);
    }`
    );

    // Slight overscroll rubber-band only (no second page teleport while dragging)
    src = src.replace(
      /const capped = swipe\.dir === 1 \? Math\.max\(-w, Math\.min\(0, dx\)\) : Math\.min\(w, Math\.max\(0, dx\)\);/,
      `const capped = swipe.dir === 1
      ? Math.max(-w * 1.08, Math.min(0, dx))
      : Math.min(w * 1.08, Math.max(0, dx));`
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
