/**
 * TonePad — chunk loader, shared looper BPM, wider edge swipes.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=22', base));
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

    // Tempo follows looper BPM control
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

    // Wider edge zones so sequencer is easier to open/close on phones
    src = src.replace(
      /const EDGE = 36;/, 
      `const EDGE = 56;`
    );
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(72, window.innerWidth * 0.18));
    const onRight = e.clientX >= window.innerWidth - edge;
    const onLeft = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page === 1 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.35));
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

    // Keep sequencer playing when returning to handpan
    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = mod.mountTonepad();
      try { window.PionierTonepad = api || window.PionierTonepad; } catch (_) {}
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
