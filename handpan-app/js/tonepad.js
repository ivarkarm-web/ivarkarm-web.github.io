/**
 * TonePad v16 — no title/hint, BPM in its own bar, light mode.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=16', base));
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

    // --- Chrome: BPM only, no TonePad title / hint ---
    src = src.replace(
      /layer\.innerHTML\s*=\s*[\s\S]*?document\.body\.appendChild\(layer\);/,
      `layer.innerHTML =
    '<div class="tonepad-chrome">' +
      '<div class="tonepad-bpm">' +
        '<span class="tonepad-bpm-label">BPM</span>' +
        '<div class="tonepad-bpm-dial" tabindex="0" role="slider" aria-label="Tempo" aria-valuemin="48" aria-valuemax="160">' +
          '<canvas width="96" height="96"></canvas>' +
        '</div>' +
        '<span class="tonepad-bpm-val" data-bpm-val>92</span>' +
      '</div>' +
    '</div>' +
    '<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';
  document.body.appendChild(layer);`
    );

    // --- Injected CSS: flex column (BPM bar above grid) + light mode ---
    src = src.replace(
      /style\.textContent\s*=\s*\[[\s\S]*?\]\.join\(''\);/,
      `style.textContent = [
      '#stage{overflow:hidden}',
      '#pan{will-change:transform;transition:none}',
      '.tonepad-layer{position:fixed;z-index:14;overflow:hidden;background:#0a0d0b;pointer-events:none;touch-action:none;will-change:transform;border-radius:10px;display:flex;flex-direction:column}',
      'body.tonepad-open .tonepad-layer{pointer-events:auto}',
      '.tonepad-layer canvas#tonepadCanvas{display:block;flex:1 1 auto;min-height:0;width:100%;touch-action:none;border-radius:0 0 10px 10px}',
      '.tonepad-chrome{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 10px 4px;pointer-events:none;background:rgba(10,13,11,.96);border-bottom:1px solid rgba(200,210,200,.08)}',
      '.tonepad-chrome *{pointer-events:auto}',
      '.tonepad-bpm{display:flex;flex-direction:row;align-items:center;gap:8px}',
      '.tonepad-bpm-label{font:600 9px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#c9b06a}',
      '.tonepad-bpm-dial{width:36px;height:36px;border-radius:8px;border:1px solid rgba(232,212,138,.4);background:linear-gradient(160deg,#1a2018,#0e120f);cursor:ns-resize;touch-action:none}',
      '.tonepad-bpm-dial canvas{width:100%;height:100%;display:block;pointer-events:none}',
      '.tonepad-bpm-val{font:600 12px/1 Inter,system-ui,sans-serif;color:#f0d99a;min-width:2ch}',
      'body.tonepad-open #pan{pointer-events:none}',
      /* Light mode */
      'html.theme-light .tonepad-layer,body.theme-light .tonepad-layer{background:#f2f0ea}',
      'html.theme-light .tonepad-chrome,body.theme-light .tonepad-chrome{background:rgba(242,240,234,.98);border-bottom-color:rgba(40,36,28,.1)}',
      'html.theme-light .tonepad-bpm-label,body.theme-light .tonepad-bpm-label{color:#8a7020}',
      'html.theme-light .tonepad-bpm-dial,body.theme-light .tonepad-bpm-dial{border-color:rgba(140,110,30,.35);background:linear-gradient(160deg,#f7f4ec,#e8e4da)}',
      'html.theme-light .tonepad-bpm-val,body.theme-light .tonepad-bpm-val{color:#5c4a12}'
    ].join('');`
    );

    // Canvas draw: theme-aware background + empty cells
    src = src.replace(
      /g\.clearRect\(0, 0, w, h\);\s*\/\/ card background\s*g\.fillStyle = '#0a0d0b';\s*g\.fillRect\(0, 0, w, h\);\s*g\.strokeStyle = 'rgba\(200, 210, 200, 0\.12\)';/,
      `g.clearRect(0, 0, w, h);
    const light = document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light');
    g.fillStyle = light ? '#f2f0ea' : '#0a0d0b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = light ? 'rgba(40, 36, 28, 0.12)' : 'rgba(200, 210, 200, 0.12)';`
    );

    src = src.replace(
      /g\.fillStyle = beat \? 'rgba\(255,255,255,0\.04\)' : 'rgba\(255,255,255,0\.018\)';/,
      `g.fillStyle = light
          ? (beat ? 'rgba(40,36,28,0.07)' : 'rgba(40,36,28,0.035)')
          : (beat ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.018)');`
    );

    // BPM knob ring colors in light mode
    src = src.replace(
      /c\.strokeStyle = 'rgba\(120,130,118,\.35\)';\s*c\.beginPath\(\);\s*c\.arc\(cx, cy, r, start, start \+ span\);\s*c\.stroke\(\);\s*c\.strokeStyle = '#e1cc8b';/,
      `const lightKnob = document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light');
    c.strokeStyle = lightKnob ? 'rgba(80,70,40,.25)' : 'rgba(120,130,118,.35)';
    c.beginPath();
    c.arc(cx, cy, r, start, start + span);
    c.stroke();
    c.strokeStyle = lightKnob ? '#a08020' : '#e1cc8b';`
    );

    // metrics: smaller top chrome now that bar is outside canvas flow — still pad a little
    src = src.replace(
      /const topChrome = Math\.round\(Math\.min\(w, h\) \* 0\.11\);/,
      `const topChrome = Math.round(Math.min(w, h) * 0.02);`
    );

    // --- Carousel track (v15 park + smooth) ---
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

  function parkDistances(box) {
    const w = Math.max(1, box.width);
    const parkRight = Math.ceil(Math.max(w + 24, window.innerWidth - box.left + 16));
    const parkLeft = -Math.ceil(Math.max(w + 24, box.left + w + 16));
    return { w, parkRight, parkLeft };
  }

  function shiftCarousel(animate) {
    const box = homeBox();
    if (!box) return;
    place();
    const dx = dragDx != null ? dragDx : 0;
    const { w, parkRight, parkLeft } = parkDistances(box);
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    setTrack(parkLeft * progress, parkRight * (1 - progress), animate);
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
    const { parkRight } = parkDistances(box);
    const dx = dragDx != null ? dragDx : 0;
    dragDx = null;
    setTrack(parkRight + dx, dx, false);
    void layer.offsetWidth;
    requestAnimationFrame(() => {
      setTrack(0, -parkRight, true);
      page = 0;
      open = false;
      document.body.classList.remove('tonepad-open');
      layer.setAttribute('aria-hidden', 'true');
      afterTransition(layer, TP_MS, () => setTrack(0, parkRight, false));
    });
  }

  function wrapBackwardToSequencer() {
    const box = homeBox();
    if (!box) return;
    const { parkLeft } = parkDistances(box);
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
      afterTransition(layer, TP_MS, () => setTrack(parkLeft, 0, false));
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
