/**
 * TonePad v24 — CSS-var carousel, shared looper BPM, sequencer toggle button.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=24', base));
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

    src = src.replace(/const EDGE = 36;/, 'const EDGE = 64;');
    src = src.replace(
      /if \(e\.target\.closest && e\.target\.closest\('#looperRail, \.topbar, #pionierBottomDock, #fxPanel, #pionierWelcome, \.tonepad-bpm, button, a, input'\)\) return;/, 
      `if (e.target.closest && e.target.closest('#looperRail, .topbar, #pionierBottomDock, #fxPanel, #fxEditor, #pionierWelcome, .tonepad-bpm, .tonepad-chrome, button, a, input')) return;`
    );
    src = src.replace(
      /const fromRight = e\.clientX >= window\.innerWidth - EDGE && page < PAGES\.length - 1;\s*const fromLeft = e\.clientX <= EDGE && page > 0;\s*if \(!fromRight && !fromLeft\) return;\s*swipe = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId, dir: fromRight \? 1 : -1, active: false \};/,
      `const edge = Math.max(EDGE, Math.min(96, window.innerWidth * 0.22));
    const onRight = e.clientX >= window.innerWidth - edge;
    const onLeft = e.clientX <= edge;
    const layerEl = document.getElementById('tonepadLayer');
    const lr = layerEl && page === 1 ? layerEl.getBoundingClientRect() : null;
    const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(edge, lr.width * 0.45));
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

    src = src.replace(
      /if \(open\) \{\s*start\(\);\s*resizeCanvas\(\);\s*\} else \{\s*stop\(\);\s*\}/,
      `if (open) {
      start();
      resizeCanvas();
    }`
    );

    src = src.replace(
      /function shiftCarousel\(animate\) \{[\s\S]*?\n  \}\n\n  function resizeCanvas/,
      `const TP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const TP_MS = 480;

  function setTrack(panX, layerX, animate) {
    const root = document.documentElement;
    root.style.setProperty('--tp-ease', TP_EASE);
    root.style.setProperty('--tp-tr', animate ? (TP_MS / 1000) + 's' : '0s');
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
    // Park distances large enough that each card fully leaves the viewport
    const parkRight = Math.ceil(Math.max(w + 48, window.innerWidth - box.left + 24));
    const parkLeft = -Math.ceil(Math.max(w + 48, box.left + w + 24));
    // progress 0 = handpan, 1 = sequencer
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    // Handpan slides fully off left; sequencer arrives from right into the pan box
    const panX = parkLeft * progress;
    const layerX = parkRight * (1 - progress);
    setTrack(panX, layerX, animate);
    if (progress > 0.5) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
    // Keep toggle button state in sync
    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn) {
        btn.setAttribute('aria-pressed', page === 1 ? 'true' : 'false');
        btn.classList.toggle('is-active', page === 1);
      }
    } catch (_) {}
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
      } catch (_) {}

      // Visible toggle so users are not stuck with edge-swipe only
      try {
        let btn = document.getElementById('tonepadToggle');
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'tonepadToggle';
          btn.className = 'icon-btn tonepad-toggle-btn';
          btn.title = 'Sequencer';
          btn.setAttribute('aria-label', 'Open sequencer');
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = '▦';
          const nav = document.getElementById('instrumentNav');
          const fx = document.getElementById('fxPanelOpen');
          if (nav && fx) nav.insertBefore(btn, fx);
          else if (nav) nav.appendChild(btn);
          else document.body.appendChild(btn);
        }
        if (!btn.dataset.tpWired) {
          btn.dataset.tpWired = '1';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const tp = window.PionierTonepad;
              if (!tp) return;
              if (typeof tp.toggle === 'function') tp.toggle();
              else if (document.body.classList.contains('tonepad-open') && tp.close) tp.close();
              else if (tp.open) tp.open();
            } catch (err) {
              console.warn('[tonepad] toggle', err);
            }
          });
        }
      } catch (err) {
        console.warn('[tonepad] toggle button', err);
      }

      // Don't let portrait-lock overlay steal edge swipes when "hidden"
      try {
        const pl = document.getElementById('portraitLock');
        if (pl) {
          pl.style.pointerEvents = 'none';
          if (pl.hidden) pl.style.display = 'none';
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
