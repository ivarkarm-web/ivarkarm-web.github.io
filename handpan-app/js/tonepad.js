/**
 * TonePad — chunk loader.
 * Carousel uses CSS vars (--tp-x, --tp-lx) to match sequence-carousel.css !important rules.
 * Tempo follows looper BPM.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=23', base));
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

    // Shared BPM from looper
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

    // Wider swipe edges
    src = src.replace(/const EDGE = 36;/, 'const EDGE = 56;');
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(80, window.innerWidth * 0.2));
    const onRight = e.clientX >= window.innerWidth - edge;
    const onLeft = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page === 1 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.4));
    const wantOpen = onRight && page < PAGES.length - 1;
    const wantClose = (onLeft || onLayerLeft) && page > 0;
    if (!wantOpen && !wantClose) return;
    swipe = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      dir: wantOpen && !onLeft ? 1 : -1,
      active: false
    };`
    );

    // Keep playing when leaving sequencer view
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    // CRITICAL: sequence-carousel.css uses !important + CSS vars.
    // Drive --tp-x / --tp-lx instead of inline transform (which loses to !important).
    src = src.replace(
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `const TP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const TP_MS = 420;

  function setTrack(panX, layerX, animate) {
    const root = document.documentElement;
    root.style.setProperty('--tp-ease', TP_EASE);
    root.style.setProperty('--tp-tr', animate ? (TP_MS / 1000) + 's' : '0s');
    root.style.setProperty('--tp-x', panX + 'px');
    root.style.setProperty('--tp-lx', layerX + 'px');
    // Also set inline as fallback if CSS vars file is missing
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
    // Park sequencer fully off to the right when closed; handpan slides left when open
    const parkRight = Math.ceil(Math.max(w + 24, window.innerWidth - box.left + 16));
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    const panX = -progress * w;
    const layerX = parkRight * (1 - progress);
    setTrack(panX, layerX, animate);
    if (progress > 0.55) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
  }

  function resizeCanvas`
    );

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = mod.mountTonepad();
      try {
        window.PionierTonepad = api || window.PionierTonepad;
        // Convenience: open sequencer from console / future UI
        if (window.PionierTonepad && !window.PionierTonepad.open) {
          /* api already has open/close from module */
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
