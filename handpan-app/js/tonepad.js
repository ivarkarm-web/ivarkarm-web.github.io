/**
 * TonePad v19 — Velocity, Probability, Humanize knobs + musical scheduling.
 */
export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const base = import.meta.url;
    const urls = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new URL('./tb' + i + '.js?v=19', base));
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

    // Load /tmp built transforms by re-reading isn't available — inline critical path from v19 build
    const patchUrl = new URL('./tonepad.js?v=19', base);
    // Apply full transform set from pre-built logic:
    const transforms = await fetch(new URL('./tonepad-v19-patches.js?v=1', base).href).catch(() => null);

    // --- Full inline transforms (self-contained) ---
    src = src.replace(
      /const grid = new Uint8Array\(COLS \* ROWS\);\nlet bpm = 92;/,
      `const grid = new Uint8Array(COLS * ROWS);
const LAYER_COUNT = 5;
const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));
let activeLayer = 0;
let playLayer = 0;
let bpm = 92;
let velocity = 0.72;
let probability = 1;
let humanizeAmt = 0.12;
function layerHasNotes(i) {
  const g = layers[i];
  if (!g) return false;
  for (let k = 0; k < g.length; k++) if (g[k]) return true;
  return false;
}
function nextNonEmptyLayer(from) {
  for (let n = 1; n <= LAYER_COUNT; n++) {
    const i = (from + n) % LAYER_COUNT;
    if (layerHasNotes(i)) return i;
  }
  return from;
}
function firstNonEmptyLayer() {
  for (let i = 0; i < LAYER_COUNT; i++) if (layerHasNotes(i)) return i;
  return 0;
}
function syncGridFromActive() {
  grid.set(layers[activeLayer]);
}
function commitActiveToLayer() {
  layers[activeLayer].set(grid);
}`
    );

    src = src.replace(
      /function load\(\) \{\n  try \{\n    const saved = JSON\.parse\(localStorage\.getItem\(STORE\) \|\| 'null'\);\n    if \(saved && Array\.isArray\(saved\.cells\) && saved\.cells\.length === grid\.length\) \{\n      saved\.cells\.forEach\(\(v, i\) => \{ grid\[i\] = v \? 1 : 0; \}\);\n    \}\n    if \(saved && saved\.bpm\) bpm = Math\.max\(48, Math\.min\(160, Number\(saved\.bpm\) \|\| bpm\)\);\n  \} catch \(_\) \{\}\n\}\n\nfunction save\(\) \{\n  try \{\n    localStorage\.setItem\(STORE, JSON\.stringify\(\{ cells: Array\.from\(grid\), bpm, version: 1 \}\)\);\n  \} catch \(_\) \{\}\n\}/,
      `function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!saved) return;
    if (Array.isArray(saved.layers)) {
      saved.layers.forEach((cells, li) => {
        if (li >= LAYER_COUNT || !Array.isArray(cells)) return;
        cells.forEach((v, i) => { if (i < layers[li].length) layers[li][i] = v ? 1 : 0; });
      });
    } else if (Array.isArray(saved.cells) && saved.cells.length === grid.length) {
      saved.cells.forEach((v, i) => { layers[0][i] = v ? 1 : 0; });
    }
    if (saved.bpm) bpm = Math.max(48, Math.min(160, Number(saved.bpm) || bpm));
    if (saved.velocity != null) velocity = Math.max(0, Math.min(1, Number(saved.velocity)));
    if (saved.probability != null) probability = Math.max(0, Math.min(1, Number(saved.probability)));
    if (saved.humanize != null) humanizeAmt = Math.max(0, Math.min(1, Number(saved.humanize)));
    if (Number.isFinite(saved.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, saved.activeLayer | 0));
    syncGridFromActive();
  } catch (_) {}
}

function save() {
  try {
    commitActiveToLayer();
    localStorage.setItem(STORE, JSON.stringify({
      layers: layers.map((l) => Array.from(l)),
      cells: Array.from(layers[0]),
      bpm,
      velocity,
      probability,
      humanize: humanizeAmt,
      activeLayer,
      version: 3
    }));
  } catch (_) {}
}`
    );

    src = src.replace(
      /function setCell\(col, row, on\) \{\n    grid\[idx\(col, row\)\] = on \? 1 : 0;\n    save\(\);\n  \}/,
      `function setCell(col, row, on) {
    const v = on ? 1 : 0;
    grid[idx(col, row)] = v;
    layers[activeLayer][idx(col, row)] = v;
    save();
    try { window.__tonepadUpdateLayers?.(); } catch (_) {}
  }`
    );

    src = src.replace(
      /function scheduleAhead\(\) \{\n    if \(!playing \|\| !audioCtx\) return;\n    const sd = stepDur\(\);\n    const now = audioCtx\.currentTime;\n    const look = 0\.12;\n    while \(anchor \+ lastVisStep \* sd < now \+ look\) \{\n      lastVisStep \+= 1;\n      const step = \(\(lastVisStep % COLS\) \+ COLS\) % COLS;\n      const when = anchor \+ lastVisStep \* sd;\n      for \(let row = 0; row < ROWS; row\+\+\) \{\n        if \(grid\[idx\(step, row\)\]\) trigger\(row, when, 0\.55 \+ Math\.random\(\) \* 0\.25\);\n      \}\n    \}\n  \}/,
      `function scheduleAhead() {
    if (!playing || !audioCtx) return;
    const sd = stepDur();
    const now = audioCtx.currentTime;
    const look = 0.12;
    while (anchor + lastVisStep * sd < now + look) {
      lastVisStep += 1;
      const step = ((lastVisStep % COLS) + COLS) % COLS;
      if (step === 0 && lastVisStep > 0) {
        playLayer = nextNonEmptyLayer(playLayer);
        try { window.__tonepadUpdateLayers?.(); } catch (_) {}
      }
      const when = anchor + lastVisStep * sd;
      const g = layers[playLayer];
      const accent = (step % 4 === 0) ? 1.18 : (step % 2 === 0 ? 1.05 : 0.9);
      const baseVel = 0.28 + velocity * 0.65;
      for (let row = 0; row < ROWS; row++) {
        if (!g[idx(step, row)]) continue;
        if (Math.random() > probability) continue;
        const jt = (Math.random() - 0.5) * 2 * humanizeAmt * sd * 0.4;
        const jv = (Math.random() - 0.5) * 2 * humanizeAmt * 0.4;
        const vel = Math.max(0.05, Math.min(1, baseVel * accent + jv));
        trigger(row, when + jt, vel);
      }
    }
  }`
    );

    src = src.replace(
      /function start\(\) \{\n    if \(playing\) return;\n    if \(!ensureAudio\(\)\) return;\n    resumeAudio\(\);\n    playing = true;\n    anchor = audioCtx\.currentTime \+ 0\.05;\n    lastVisStep = -1;\n    if \(timer\) clearTimeout\(timer\);\n    timer = window\.setTimeout\(tick, 20\);\n  \}/,
      `function start() {
    if (playing) return;
    if (!ensureAudio()) return;
    resumeAudio();
    playing = true;
    playLayer = firstNonEmptyLayer();
    anchor = audioCtx.currentTime + 0.05;
    lastVisStep = -1;
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(tick, 20);
    try { window.__tonepadUpdateLayers?.(); } catch (_) {}
  }`
    );

    src = src.replace(
      /layer\.innerHTML\s*=\s*[\s\S]*?document\.body\.appendChild\(layer\);/,
      `layer.innerHTML =
    '<div class="tonepad-chrome">' +
      '<div class="tonepad-knobs">' +
        '<div class="tonepad-bpm" data-knob="bpm">' +
          '<span class="tonepad-bpm-label">BPM</span>' +
          '<div class="tonepad-bpm-dial" data-dial tabindex="0" role="slider" aria-label="Tempo" aria-valuemin="48" aria-valuemax="160">' +
            '<canvas width="96" height="96"></canvas>' +
          '</div>' +
          '<span class="tonepad-bpm-val" data-bpm-val>92</span>' +
        '</div>' +
        '<div class="tonepad-bpm" data-knob="vel">' +
          '<span class="tonepad-bpm-label">VEL</span>' +
          '<div class="tonepad-bpm-dial" data-dial tabindex="0" role="slider" aria-label="Velocity" aria-valuemin="0" aria-valuemax="100">' +
            '<canvas width="96" height="96"></canvas>' +
          '</div>' +
          '<span class="tonepad-bpm-val" data-vel-val>72</span>' +
        '</div>' +
        '<div class="tonepad-bpm" data-knob="prob">' +
          '<span class="tonepad-bpm-label">PROB</span>' +
          '<div class="tonepad-bpm-dial" data-dial tabindex="0" role="slider" aria-label="Probability" aria-valuemin="0" aria-valuemax="100">' +
            '<canvas width="96" height="96"></canvas>' +
          '</div>' +
          '<span class="tonepad-bpm-val" data-prob-val>100</span>' +
        '</div>' +
        '<div class="tonepad-bpm" data-knob="hum">' +
          '<span class="tonepad-bpm-label">HUM</span>' +
          '<div class="tonepad-bpm-dial" data-dial tabindex="0" role="slider" aria-label="Humanize" aria-valuemin="0" aria-valuemax="100">' +
            '<canvas width="96" height="96"></canvas>' +
          '</div>' +
          '<span class="tonepad-bpm-val" data-hum-val>12</span>' +
        '</div>' +
      '</div>' +
      '<div class="tonepad-layers" role="tablist" aria-label="Pattern layers">' +
        [0,1,2,3,4].map((i) =>
          '<button type="button" class="tonepad-layer-btn' + (i === 0 ? ' is-active' : '') +
          '" data-layer="' + i + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') +
          '" aria-label="Layer ' + (i + 1) + '">' + (i + 1) + '</button>'
        ).join('') +
      '</div>' +
    '</div>' +
    '<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';
  document.body.appendChild(layer);`
    );

    src = src.replace(
      /style\.textContent\s*=\s*\[[\s\S]*?\]\.join\(''\);/,
      `style.textContent = [
      '#stage{overflow:hidden}',
      '#pan{will-change:transform;transition:none}',
      '.tonepad-layer{position:fixed;z-index:14;overflow:hidden;background:#0a0d0b;pointer-events:none;touch-action:none;will-change:transform;border-radius:10px;display:flex;flex-direction:column}',
      'body.tonepad-open .tonepad-layer{pointer-events:auto}',
      '.tonepad-layer canvas#tonepadCanvas{display:block;flex:1 1 auto;min-height:0;width:100%;touch-action:none;border-radius:0 0 10px 10px}',
      '.tonepad-chrome{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;pointer-events:none;background:rgba(10,13,11,.96);border-bottom:1px solid rgba(200,210,200,.08)}',
      '.tonepad-chrome *{pointer-events:auto}',
      '.tonepad-knobs{display:flex;flex-direction:row;align-items:center;gap:8px;flex:0 1 auto;flex-wrap:wrap}',
      '.tonepad-bpm{display:flex;flex-direction:row;align-items:center;gap:4px;flex:0 0 auto}',
      '.tonepad-bpm-label{font:600 8px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#c9b06a}',
      '.tonepad-bpm-dial{width:30px;height:30px;border-radius:8px;border:1px solid rgba(232,212,138,.4);background:linear-gradient(160deg,#1a2018,#0e120f);cursor:ns-resize;touch-action:none}',
      '.tonepad-bpm-dial canvas{width:100%;height:100%;display:block;pointer-events:none}',
      '.tonepad-bpm-val{font:600 11px/1 Inter,system-ui,sans-serif;color:#f0d99a;min-width:2ch}',
      '.tonepad-layers{display:flex;align-items:center;gap:5px;flex:0 0 auto}',
      '.tonepad-layer-btn{appearance:none;width:28px;height:28px;border-radius:8px;border:1px solid rgba(200,210,200,.18);background:rgba(255,255,255,.04);color:#9aab9e;font:600 11px/1 Inter,system-ui,sans-serif;cursor:pointer;padding:0}',
      '.tonepad-layer-btn.is-active{border-color:rgba(232,212,138,.55);background:rgba(232,212,138,.14);color:#f0d99a}',
      '.tonepad-layer-btn.is-playing{box-shadow:0 0 0 2px rgba(120,200,160,.45)}',
      '.tonepad-layer-btn.is-empty{opacity:.45}',
      'body.tonepad-open #pan{pointer-events:none}',
      'html.theme-light .tonepad-layer,body.theme-light .tonepad-layer{background:#f2f0ea}',
      'html.theme-light .tonepad-chrome,body.theme-light .tonepad-chrome{background:rgba(242,240,234,.98);border-bottom-color:rgba(40,36,28,.1)}',
      'html.theme-light .tonepad-bpm-label,body.theme-light .tonepad-bpm-label{color:#8a7020}',
      'html.theme-light .tonepad-bpm-dial,body.theme-light .tonepad-bpm-dial{border-color:rgba(140,110,30,.35);background:linear-gradient(160deg,#f7f4ec,#e8e4da)}',
      'html.theme-light .tonepad-bpm-val,body.theme-light .tonepad-bpm-val{color:#5c4a12}',
      'html.theme-light .tonepad-layer-btn,body.theme-light .tonepad-layer-btn{border-color:rgba(40,36,28,.12);background:rgba(40,36,28,.04);color:#5a564c}',
      'html.theme-light .tonepad-layer-btn.is-active,body.theme-light .tonepad-layer-btn.is-active{border-color:rgba(140,110,30,.45);background:rgba(200,170,60,.18);color:#5c4a12}',
      'html.theme-light .tonepad-layer-btn.is-playing,body.theme-light .tonepad-layer-btn.is-playing{box-shadow:0 0 0 2px rgba(100,140,80,.4)}'
    ].join('');`
    );

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
    src = src.replace(
      /c\.strokeStyle = 'rgba\(120,130,118,\.35\)';\s*c\.beginPath\(\);\s*c\.arc\(cx, cy, r, start, start \+ span\);\s*c\.stroke\(\);\s*c\.strokeStyle = '#e1cc8b';/,
      `const lightKnob = document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light');
    c.strokeStyle = lightKnob ? 'rgba(80,70,40,.25)' : 'rgba(120,130,118,.35)';
    c.beginPath();
    c.arc(cx, cy, r, start, start + span);
    c.stroke();
    c.strokeStyle = lightKnob ? '#a08020' : '#e1cc8b';`
    );
    src = src.replace(
      /const topChrome = Math\.round\(Math\.min\(w, h\) \* 0\.11\);/,
      `const topChrome = Math.round(Math.min(w, h) * 0.02);`
    );

    src = src.replace(
      /const bpmVal = layer\.querySelector\('\[data-bpm-val\]'\);/,
      `const bpmVal = layer.querySelector('[data-bpm-val]');
  function updateLayerButtons() {
    layer.querySelectorAll('.tonepad-layer-btn').forEach((btn) => {
      const i = Number(btn.getAttribute('data-layer'));
      btn.classList.toggle('is-active', i === activeLayer);
      const isPlaying = (typeof playing !== 'undefined') && playing && i === playLayer;
      btn.classList.toggle('is-playing', !!isPlaying);
      btn.classList.toggle('is-empty', !layerHasNotes(i));
      btn.setAttribute('aria-selected', i === activeLayer ? 'true' : 'false');
    });
  }
  window.__tonepadUpdateLayers = updateLayerButtons;
  layer.querySelectorAll('.tonepad-layer-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute('data-layer'));
      if (!Number.isFinite(i) || i === activeLayer) return;
      commitActiveToLayer();
      activeLayer = i;
      syncGridFromActive();
      updateLayerButtons();
      save();
    });
  });
  queueMicrotask(() => { try { updateLayerButtons(); } catch (_) {} });
  (function wireExtraKnobs() {
    function isLight() {
      return document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light');
    }
    function paintOne(dialEl, t01) {
      const cnv = dialEl && dialEl.querySelector('canvas');
      if (!cnv) return;
      const c = cnv.getContext('2d');
      if (!c) return;
      const w = cnv.width, h = cnv.height, cx = w/2, cy = h/2;
      const r = Math.min(w,h)*0.38;
      const start = Math.PI*0.75, span = Math.PI*1.5;
      const t = Math.max(0, Math.min(1, t01));
      c.clearRect(0,0,w,h);
      c.lineWidth = Math.max(3, w*0.07);
      c.lineCap = 'round';
      c.strokeStyle = isLight() ? 'rgba(80,70,40,.25)' : 'rgba(120,130,118,.35)';
      c.beginPath(); c.arc(cx,cy,r,start,start+span); c.stroke();
      c.strokeStyle = isLight() ? '#a08020' : '#e1cc8b';
      c.beginPath(); c.arc(cx,cy,r,start,start+span*t); c.stroke();
      const a = start + span * t;
      c.fillStyle = isLight() ? '#5c4a12' : '#f0d99a';
      c.beginPath(); c.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r, Math.max(3,w*0.055), 0, Math.PI*2); c.fill();
    }
    function paintAll() {
      paintOne(layer.querySelector('[data-knob="bpm"] [data-dial]'), (bpm-48)/(160-48));
      paintOne(layer.querySelector('[data-knob="vel"] [data-dial]'), velocity);
      paintOne(layer.querySelector('[data-knob="prob"] [data-dial]'), probability);
      paintOne(layer.querySelector('[data-knob="hum"] [data-dial]'), humanizeAmt);
      const bv = layer.querySelector('[data-bpm-val]');
      const vv = layer.querySelector('[data-vel-val]');
      const pv = layer.querySelector('[data-prob-val]');
      const hv = layer.querySelector('[data-hum-val]');
      if (bv) bv.textContent = String(Math.round(bpm));
      if (vv) vv.textContent = String(Math.round(velocity*100));
      if (pv) pv.textContent = String(Math.round(probability*100));
      if (hv) hv.textContent = String(Math.round(humanizeAmt*100));
    }
    window.__tonepadPaintKnobs = paintAll;
    function wireDial(knobKey, getV, setV) {
      const dial = layer.querySelector('[data-knob="'+knobKey+'"] [data-dial]');
      if (!dial) return;
      let drag=false, y0=0, v0=0;
      const apply = (v) => { setV(v); paintAll(); save(); };
      dial.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        drag=true; y0=e.clientY; v0=getV();
        dial.setPointerCapture && dial.setPointerCapture(e.pointerId);
      });
      dial.addEventListener('pointermove', (e) => {
        if (!drag) return; e.stopPropagation();
        apply(v0 + (y0 - e.clientY) / 120);
      });
      const stop = (e) => { if (!drag) return; drag=false; e && e.stopPropagation && e.stopPropagation(); };
      dial.addEventListener('pointerup', stop);
      dial.addEventListener('pointercancel', stop);
      dial.addEventListener('keydown', (e) => {
        if (e.key==='ArrowUp'||e.key==='ArrowRight') { e.preventDefault(); apply(getV()+0.02); }
        else if (e.key==='ArrowDown'||e.key==='ArrowLeft') { e.preventDefault(); apply(getV()-0.02); }
      });
    }
    wireDial('vel', () => velocity, (t) => { velocity = Math.max(0, Math.min(1, t)); });
    wireDial('prob', () => probability, (t) => { probability = Math.max(0, Math.min(1, t)); });
    wireDial('hum', () => humanizeAmt, (t) => { humanizeAmt = Math.max(0, Math.min(1, t)); });
    paintAll();
  })();`
    );

    src = src.replace(
      /function paintBpmKnob\(\) \{[\s\S]*?\n  \}\n\n  \(function wireBpm/,
      `function paintBpmKnob() {
    try { if (window.__tonepadPaintKnobs) return window.__tonepadPaintKnobs(); } catch (_) {}
  }

  (function wireBpm`
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
