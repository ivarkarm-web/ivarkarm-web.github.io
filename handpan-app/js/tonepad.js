/**
 * TonePad v29 entry — loads v27 pin, then patches carousel for continuous infinite slide.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const pinBase =
      'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@0bf964545e733bfb6002a78e7738e1e2aabf2c75/handpan-app/js/';
    const loaderUrl = pinBase + 'tonepad.js';
    const res = await fetch(loaderUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error('tonepad pin ' + res.status);
    let loaderSrc = await res.text();

    loaderSrc = loaderSrc.replace(
      /const urls = \[0, 1, 2, 3, 4, 5, 6, 7\]\.map\(\(i\) => new URL\('\.\/tb' \+ i \+ '\.js\?v=27', base\)\);/,
      "const pinBase = '" + pinBase + "';\n    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => pinBase + 'tb' + i + '.js');"
    );

    const smoothInject = `
    // --- v29 continuous carousel ---
    src = src.replace(
      /const TP_EASE = '[^']*';\\s*const TP_MS = \\d+;/,
      "const TP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';\\n  const TP_MS = 600;"
    );
    src = src.replace(
      /const capped = swipe\\.dir === 1 \\? Math\\.max\\(-w(?: \\* [0-9.]+)?, Math\\.min\\(0, dx\\)\\) : Math\\.min\\(w(?: \\* [0-9.]+)?, Math\\.max\\(0, dx\\)\\);/,
      "const capped = swipe.dir === 1 ? Math.max(-w * 1.3, Math.min(0, dx)) : Math.min(w * 1.3, Math.max(0, dx));"
    );
    src = src.replace(
      /function setTrack\\(panX, layerX, animate\\) \\{[\\s\\S]*?layer\\.style\\.opacity = '1';\\s*\\}/,
      \`function setTrack(panX, layerX, animate) {
    const root = document.documentElement;
    root.style.setProperty('--tp-ease', TP_EASE);
    root.style.setProperty('--tp-tr', animate ? (TP_MS / 1000) + 's' : '0s');
    root.style.setProperty('--tp-x', panX + 'px');
    root.style.setProperty('--tp-lx', layerX + 'px');
    const pan = document.getElementById('pan');
    const tr = animate ? ('transform ' + (TP_MS / 1000) + 's ' + TP_EASE) : 'none';
    if (pan) {
      pan.style.transition = tr;
      pan.style.transform = 'translate3d(' + panX + 'px,0,0) translateZ(0)';
      pan.style.opacity = '1';
    }
    layer.style.transition = tr;
    layer.style.transform = 'translate3d(' + layerX + 'px,0,0) translateZ(0)';
    layer.style.opacity = '1';
  }\`
    );
    src = src.replace(
      /function shiftCarousel\\(animate\\) \\{[\\s\\S]*?catch \\(_\\) \\{\\}\\s*\\}/,
      \`function shiftCarousel(animate) {
    const { box, w, parkRight, parkLeft } = parkDistances();
    if (!box) return;
    place();
    const dx = dragDx != null ? dragDx : 0;
    let progress = page - (dx / w);
    slideProgress = Math.max(0, Math.min(1, progress));
    let panX, layerX;
    if (progress >= 0 && progress <= 1) {
      panX = parkLeft * progress;
      layerX = parkRight * (1 - progress);
    } else if (progress > 1) {
      const u = progress - 1;
      panX = parkRight * (1 - u);
      layerX = -parkRight * u;
    } else {
      const u = -progress;
      panX = parkRight * u;
      layerX = parkLeft + parkRight * u;
    }
    setTrack(panX, layerX, animate);
    if (slideProgress > 0.5) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn) {
        btn.setAttribute('aria-pressed', page === 1 ? 'true' : 'false');
        btn.classList.toggle('is-active', page === 1);
      }
    } catch (_) {}
  }\`
    );
    src = src.replace(
      /function wrapForwardToHandpan\\(\\) \\{[\\s\\S]*?\\n  \\}/,
      \`function wrapForwardToHandpan() {
    const { parkRight, w } = parkDistances();
    place();
    const dx = dragDx != null ? dragDx : -w * 0.2;
    const progress = 1 - (dx / w);
    const u = Math.max(0, progress - 1);
    setTrack(parkRight * (1 - u), -parkRight * u, false);
    page = 0; open = false; dragDx = null;
    document.body.classList.remove('tonepad-open');
    layer.setAttribute('aria-hidden', 'true');
    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('is-active'); }
    } catch (_) {}
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTrack(0, -parkRight, true);
        setTimeout(() => setTrack(0, parkRight, false), TP_MS + 40);
      });
    });
  }\`
    );
    src = src.replace(
      /function wrapBackwardToSequencer\\(\\) \\{[\\s\\S]*?\\n  \\}/,
      \`function wrapBackwardToSequencer() {
    const { parkLeft, parkRight, w } = parkDistances();
    place();
    const dx = dragDx != null ? dragDx : w * 0.2;
    const progress = 0 - (dx / w);
    const u = Math.max(0, -progress);
    setTrack(parkRight * u, parkLeft + parkRight * u, false);
    page = 1; open = true; dragDx = null;
    document.body.classList.add('tonepad-open');
    layer.setAttribute('aria-hidden', 'false');
    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn) { btn.setAttribute('aria-pressed', 'true'); btn.classList.add('is-active'); }
    } catch (_) {}
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTrack(parkLeft, 0, true);
        start(); resizeCanvas();
      });
    });
  }\`
    );
    // --- end v29 ---
`;

    if (loaderSrc.includes('const blob = new Blob([src]')) {
      loaderSrc = loaderSrc.replace(
        'const blob = new Blob([src]',
        smoothInject + '\n    const blob = new Blob([src]'
      );
    } else {
      console.warn('[tonepad] inject point missing');
    }

    const blob = new Blob([loaderSrc], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = await mod.mountTonepad();
      try {
        if (!document.getElementById('tonepad-smooth-v29')) {
          const style = document.createElement('style');
          style.id = 'tonepad-smooth-v29';
          style.textContent =
            '#pan, .tonepad-layer{transition-timing-function:cubic-bezier(0.22,1,0.36,1)!important;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;}';
          document.head.appendChild(style);
        }
        document.documentElement.style.setProperty('--tp-ease', 'cubic-bezier(0.22, 1, 0.36, 1)');
      } catch (_) {}
      try {
        const btn = document.getElementById('tonepadToggle');
        if (btn && !btn.dataset.tpWired) {
          btn.dataset.tpWired = '1';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tp = window.PionierTonepad;
            if (!tp) return;
            if (typeof tp.toggle === 'function') tp.toggle();
            else if (document.body.classList.contains('tonepad-open') && tp.close) tp.close();
            else if (tp.open) tp.open();
          });
        }
      } catch (_) {}
      try { window.PionierTonepad = api || window.PionierTonepad; } catch (_) {}
      return api;
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  })().catch((err) => {
    console.error('[tonepad] mount failed', err);
    window.__tonepadMounting = null;
    throw err;
  });
  return window.__tonepadMounting;
}
