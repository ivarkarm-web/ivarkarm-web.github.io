/**
 * TonePad v25 — CSS-var carousel, BPM left, 5 layers, no title chrome.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=25', base));
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

    // Multi-layer store + active/play pointers
    src = src.replace(
      /const grid = new Uint8Array\(COLS \* ROWS\);\s*let bpm = 92;/,
      `const LAYER_COUNT = 5;
const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));
const grid = layers[0];
let activeLayer = 0;
let playLayer = 0;
let bpm = 92;

function layerHasNotes(i) {
  const g = layers[i];
  for (let n = 0; n < g.length; n++) if (g[n]) return true;
  return false;
}
function nextNonEmptyLayer(from) {
  for (let n = 1; n <= LAYER_COUNT; n++) {
    const i = (from + n) % LAYER_COUNT;
    if (layerHasNotes(i)) return i;
  }
  return from;
}
function selectLayer(i) {
  i = Math.max(0, Math.min(LAYER_COUNT - 1, i | 0));
  activeLayer = i;
  // grid is always layers[activeLayer] via rebinding isn't possible (const),
  // so we copy views: paint/draw use layers[activeLayer] via sync helpers.
  try { updateLayerButtons(); } catch (_) {}
}
function activeGrid() { return layers[activeLayer]; }
function playGrid() { return layers[playLayer]; }`
    );

    // Route all grid reads/writes through active layer except playback
    // After layers patch, `grid` still points to layers[0]. Redirect setCell/draw/paint to activeGrid.
    src = src.replace(
      /function save\(\) \{\s*try \{\s*localStorage\.setItem\(STORE, JSON\.stringify\(\{ cells: Array\.from\(grid\), bpm, version: 1 \}\)\);\s*\} catch \(_\) \{\}\s*\}/,
      `function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      cells: Array.from(layers[activeLayer]),
      layers: layers.map((g) => Array.from(g)),
      activeLayer,
      bpm,
      version: 2
    }));
  } catch (_) {}
}`
    );
    src = src.replace(
      /function load\(\) \{\s*try \{\s*const saved = JSON\.parse\(localStorage\.getItem\(STORE\) \|\| 'null'\);\s*if \(saved && Array\.isArray\(saved\.cells\) && saved\.cells\.length === grid\.length\) \{\s*saved\.cells\.forEach\(\(v, i\) => \{ grid\[i\] = v \? 1 : 0; \}\);\s*\}\s*if \(saved && saved\.bpm\) bpm = Math\.max\(48, Math\.min\(160, Number\(saved\.bpm\) \|\| bpm\)\);\s*\} catch \(_\) \{\}\s*\}/,
      `function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!saved) return;
    if (Array.isArray(saved.layers) && saved.layers.length) {
      saved.layers.forEach((cells, li) => {
        if (li >= LAYER_COUNT || !Array.isArray(cells)) return;
        for (let i = 0; i < Math.min(cells.length, layers[li].length); i++) {
          layers[li][i] = cells[i] ? 1 : 0;
        }
      });
    } else if (Array.isArray(saved.cells) && saved.cells.length === COLS * ROWS) {
      saved.cells.forEach((v, i) => { layers[0][i] = v ? 1 : 0; });
    }
    if (Number.isFinite(saved.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, saved.activeLayer | 0));
    if (saved.bpm) bpm = Math.max(48, Math.min(160, Number(saved.bpm) || bpm));
    playLayer = layerHasNotes(activeLayer) ? activeLayer : nextNonEmptyLayer(activeLayer);
  } catch (_) {}
}`
    );

    // Chrome: BPM left + layer buttons, no title/hint
    src = src.replace(
      /layer\.innerHTML =\s*'<div class="tonepad-chrome">' \+[\s\S]*?'<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"><\/canvas>';/,
      `layer.innerHTML =
    '<div class="tonepad-chrome">' +
      '<div class="tonepad-bpm">' +
        '<span class="tonepad-bpm-label">BPM</span>' +
        '<div class="tonepad-bpm-dial" tabindex="0" role="slider" aria-label="Tempo" aria-valuemin="48" aria-valuemax="160">' +
          '<canvas width="96" height="96"></canvas>' +
        '</div>' +
        '<span class="tonepad-bpm-val" data-bpm-val>92</span>' +
      '</div>' +
      '<div class="tonepad-layers" role="tablist" aria-label="Sequencer layers">' +
        '<button type="button" class="tonepad-layer-btn is-active" data-layer="0" aria-pressed="true">L1</button>' +
        '<button type="button" class="tonepad-layer-btn" data-layer="1" aria-pressed="false">L2</button>' +
        '<button type="button" class="tonepad-layer-btn" data-layer="2" aria-pressed="false">L3</button>' +
        '<button type="button" class="tonepad-layer-btn" data-layer="3" aria-pressed="false">L4</button>' +
        '<button type="button" class="tonepad-layer-btn" data-layer="4" aria-pressed="false">L5</button>' +
      '</div>' +
    '</div>' +
    '<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';`
    );

    // Inject layer button helpers + wire after bpmVal
    src = src.replace(
      /const bpmVal = layer\.querySelector\('\[data-bpm-val\]'\);/,
      `const bpmVal = layer.querySelector('[data-bpm-val]');
  const layerBtns = Array.from(layer.querySelectorAll('.tonepad-layer-btn'));

  function updateLayerButtons() {
    layerBtns.forEach((btn) => {
      const i = Number(btn.dataset.layer) || 0;
      const empty = !layerHasNotes(i);
      btn.classList.toggle('is-active', i === activeLayer);
      btn.classList.toggle('is-playing', i === playLayer && playing);
      btn.classList.toggle('is-empty', empty);
      btn.setAttribute('aria-pressed', i === activeLayer ? 'true' : 'false');
    });
  }

  layerBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i = Number(btn.dataset.layer) || 0;
      activeLayer = i;
      updateLayerButtons();
      save();
    });
  });`
    );

    // Draw + paint use active layer
    src = src.replace(
      /const on = grid\[idx\(col, row\)\];/,
      'const on = layers[activeLayer][idx(col, row)];'
    );
    src = src.replace(
      /const on = !grid\[idx\(hit\.col, hit\.row\)\];/,
      'const on = !layers[activeLayer][idx(hit.col, hit.row)];'
    );

    // setCell if exists
    src = src.replace(
      /function setCell\(col, row, on\) \{\s*grid\[idx\(col, row\)\] = on \? 1 : 0;/,
      `function setCell(col, row, on) {
    layers[activeLayer][idx(col, row)] = on ? 1 : 0;`
    );

    // Playback: use playLayer, advance on cycle when step wraps
    src = src.replace(
      /for \(let row = 0; row < ROWS; row\+\+\) \{\s*if \(grid\[idx\(step, row\)\]\) trigger\(row, when, 0\.55 \+ Math\.random\(\) \* 0\.25\);\s*\}/,
      `// Advance layer at the start of a new cycle (skip empty layers)
      if (step === 0 && lastVisStep > 0) {
        playLayer = nextNonEmptyLayer(playLayer);
        try { updateLayerButtons(); } catch (_) {}
      }
      const gPlay = layers[playLayer];
      for (let row = 0; row < ROWS; row++) {
        if (gPlay[idx(step, row)]) trigger(row, when, 0.55 + Math.random() * 0.25);
      }`
    );

    // Shared BPM for step duration
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

    // Replace injected chrome CSS (title/hint styles → layer bar)
    src = src.replace(
      /'\.tonepad-chrome\{[^']*\}',/,
      `'.tonepad-chrome{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;pointer-events:none;background:linear-gradient(180deg,rgba(7,8,7,.94),rgba(7,8,7,0));box-sizing:border-box}',`
    );
    src = src.replace(
      /'\.tonepad-title\{[^']*\}',/,
      `'.tonepad-layers{display:flex;align-items:center;gap:4px;pointer-events:auto}',`
    );
    src = src.replace(
      /'\.tonepad-bpm\{[^']*\}',/,
      `'.tonepad-bpm{display:flex;flex-direction:row;align-items:center;gap:6px;min-width:0;pointer-events:auto}',`
    );
    src = src.replace(
      /'\.tonepad-bpm-dial\{[^']*\}',/,
      `'.tonepad-bpm-dial{width:36px;height:36px;border-radius:6px;border:1px solid rgba(232,212,138,.45);background:linear-gradient(160deg,#1a2018,#0e120f);cursor:ns-resize;touch-action:none;position:relative;flex:0 0 auto}',`
    );
    src = src.replace(
      /'\.tonepad-hint\{[^']*\}',/,
      `'.tonepad-layer-btn{min-width:28px;height:28px;padding:0 6px;border-radius:6px;border:1px solid rgba(160,170,160,.35);background:rgba(20,24,20,.85);color:#9aab9e;font:600 10px/1 Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}',
      '.tonepad-layer-btn.is-active{border-color:rgba(225,204,139,.7);color:#f0d99a;background:rgba(40,36,20,.9)}',
      '.tonepad-layer-btn.is-playing{box-shadow:0 0 0 1px rgba(120,200,140,.55)}',
      '.tonepad-layer-btn.is-empty{opacity:.45}',`
    );

    // After paintBpmKnob first call / load - update layer buttons
    src = src.replace(
      /load\(\);\s*\n\s*if \(!document\.getElementById\('tonepad-css'\)\)/,
      `load();
  try { updateLayerButtons(); } catch (_) {}

  if (!document.getElementById('tonepad-css'))`
    );

    // Carousel / edge swipe (same as v24)
    src = src.replace(/const EDGE = 36;/, 'const EDGE = 64;');
    src = src.replace(
      /if \(e\.target\.closest && e\.target\.closest\('#looperRail, \.topbar, #pionierBottomDock, #fxPanel, #pionierWelcome, \.tonepad-bpm, button, a, input'\)\) return;/,
      `if (e.target.closest && e.target.closest('#looperRail, .topbar, #pionierBottomDock, #fxPanel, #fxEditor, #pionierWelcome, .tonepad-bpm, .tonepad-chrome, .tonepad-layers, button, a, input')) return;`
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
    const parkRight = Math.ceil(Math.max(w + 48, window.innerWidth - box.left + 24));
    const parkLeft = -Math.ceil(Math.max(w + 48, box.left + w + 24));
    const x = -page * w + dx;
    const progress = Math.max(0, Math.min(1, -x / w));
    slideProgress = progress;
    setTrack(parkLeft * progress, parkRight * (1 - progress), animate);
    if (progress > 0.5) document.body.classList.add('tonepad-open');
    else if (!animate) document.body.classList.toggle('tonepad-open', page === 1);
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

    // start() should set playLayer to first non-empty from active
    src = src.replace(
      /function start\(\) \{\s*if \(playing\) return;\s*if \(!ensureAudio\(\)\) return;\s*resumeAudio\(\);\s*playing = true;/,
      `function start() {
    if (playing) return;
    if (!ensureAudio()) return;
    resumeAudio();
    playLayer = layerHasNotes(activeLayer) ? activeLayer : nextNonEmptyLayer(activeLayer);
    try { updateLayerButtons(); } catch (_) {}
    playing = true;`
    );

    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ url);
      const api = mod.mountTonepad();
      try { window.PionierTonepad = api || window.PionierTonepad; } catch (_) {}

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
