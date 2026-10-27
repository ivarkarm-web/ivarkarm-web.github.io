/**
 * TonePad v15 — park inactive card fully off-screen (no edge sliver).
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=15', base));
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
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `const TP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const TP_MS = 520;

  function setTrack(panX, layerX, animate) {
    const root = document.documentElement;
    root.style.setProperty('--tp-ease', TP_EASE);
    root.style.setProperty('--tp-tr', animate ? (TP_MS / 1000) + 's' : '0s');
    root.style.setProperty('--tp-x', panX + 'px');
    root.style.setProperty('--tp-lx', layerX + 'px');
    const pan = document.getElementById('pan');
    if (pan) {
      pan.style.transform = 'translate3d(' + panX + 'px,0,0) translateZ(0)';
      pan.style.opacity = '1';
    }
    layer.style.transform = 'translate3d(' + layerX + 'px,0,0) translateZ(0)';
    layer.style.opacity = '1';
  }

  /** Distances that push each card fully past the viewport edge. */
  function parkDistances(box) {
    const w = Math.max(1, box.width);
    // layer is position:fixed at box.left — need box.left + layerX >= innerWidth
    const parkRight = Math.ceil(Math.max(w + 24, window.innerWidth - box.left + 16));
    // pan layout left is box.left — need box.left + panX + w <= 0
    const parkLeft = -Math.ceil(Math.max(w + 24, box.left + w + 16));
    return { w, parkRight, parkLeft };
  }

  function shiftCarousel(animate) {
    const box = homeBox();
    if (!box) return;
    place();
    const dx = dragDx != null ? dragDx : 0;
    const { w, parkRight, parkLeft } = parkDistances(box);
    // progress 0 = handpan, 1 = sequencer
    const t = Math.max(0, Math.min(1, page + (-dx) / w * (page === 0 ? 1 : 1)));
    // cleaner: base offset in "page units"
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    // Interpolate between fully-parked positions so nothing peeks at rest
    const panX = parkLeft * progress;
    const layerX = parkRight * (1 - progress);
    setTrack(panX, layerX, animate);
    if (progress > 0.55) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  function afterTransition(el, ms, fn) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      fn();
    };
    const onEnd = (e) => {
      if (e.propertyName && e.propertyName.indexOf('transform') === -1) return;
      finish();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, ms + 80);
  }

  function wrapForwardToHandpan() {
    const box = homeBox();
    if (!box) return;
    const { w, parkRight, parkLeft } = parkDistances(box);
    const dx = dragDx != null ? dragDx : 0;
    dragDx = null;
    const progress = Math.max(0, Math.min(1, (w - dx) / w));
    // Continue from current interpolated positions
    const curPan = parkLeft * Math.max(0, Math.min(1, 1 + dx / w));
    const curLayer = parkRight * (1 - Math.max(0, Math.min(1, 1 + dx / w)));
    // From sequencer (progress~1): pan near parkLeft, layer near 0
    // Wrap forward: pan enters from right (parkRight → 0), layer exits left (0 → parkLeft-ish)
    setTrack(parkRight + dx, dx, false);
    void layer.offsetWidth;
    requestAnimationFrame(() => {
      setTrack(0, -parkRight, true);
      page = 0;
      open = false;
      document.body.classList.remove('tonepad-open');
      layer.setAttribute('aria-hidden', 'true');
      afterTransition(layer, TP_MS, () => {
        setTrack(0, parkRight, false);
      });
    });
  }

  function wrapBackwardToSequencer() {
    const box = homeBox();
    if (!box) return;
    const { w, parkRight, parkLeft } = parkDistances(box);
    const dx = dragDx != null ? dragDx : 0;
    dragDx = null;
    setTrack(dx, parkLeft + dx, false);
    void layer.offsetWidth;
    requestAnimationFrame(() => {
      setTrack(-parkLeft, 0, true);
      page = 1;
      open = true;
      document.body.classList.add('tonepad-open');
      layer.setAttribute('aria-hidden', 'false');
      start();
      resizeCanvas();
      afterTransition(layer, TP_MS, () => {
        setTrack(parkLeft, 0, false);
      });
    });
  }

  function resizeCanvas`
    );

    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

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

    src = src.replace(
      /if \(was && dir === 1 && dx < -Math\.min\(64, w \* 0\.18\)\) setPage\(page \+ 1, true\);\s*else if \(was && dir === -1 && dx > Math\.min\(64, w \* 0\.18\)\) setPage\(page - 1, true\);\s*else setPage\(page, true\);/,
      `const thresh = Math.min(40, w * 0.1);
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

    src = src.replace(
      /const capped = swipe\.dir === 1 \? Math\.max\(-w, Math\.min\(0, dx\)\) : Math\.min\(w, Math\.max\(0, dx\)\);/,
      `const capped = swipe.dir === 1
      ? Math.max(-w * 1.05, Math.min(0, dx))
      : Math.min(w * 1.05, Math.max(0, dx));`
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
