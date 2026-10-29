/**
 * TonePad v35 — fix empty-layer playLayer crash + scheduleAhead null-safety.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const COLS = 16;
const ROWS = 8;
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v35';
const LAYER_COUNT = 5;

export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));
    let activeLayer = 0;
    let playLayer = 0;
    let velocity = 0.7;
    let probability = 1;
    let humanize = 0.12;
    let playing = false;
    let open = false;
    let page = 0;
    let dragDx = null;
    let audioCtx = null;
    let bus = null;
    let anchor = 0;
    let lastVisStep = -1;
    let timer = 0;
    let raf = 0;
    let rootMidi = 50;

    function idx(c, r) { return r * COLS + c; }
    function layerHasNotes(i) {
      const g = layers[i];
      for (let n = 0; n < g.length; n++) if (g[n]) return true;
      return false;
    }
    function nextNonEmptyLayer(from) {
      const base = ((from % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
      for (let n = 1; n <= LAYER_COUNT; n++) {
        const i = (base + n) % LAYER_COUNT;
        if (layerHasNotes(i)) return i;
      }
      return base;
    }
    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(STORE) || 'null');
        if (!s) return;
        if (Array.isArray(s.layers)) {
          s.layers.forEach((cells, li) => {
            if (li >= LAYER_COUNT || !Array.isArray(cells)) return;
            cells.forEach((v, i) => { if (i < layers[li].length) layers[li][i] = v ? 1 : 0; });
          });
        }
        if (Number.isFinite(s.velocity)) velocity = Math.max(0, Math.min(1, +s.velocity));
        if (Number.isFinite(s.probability)) probability = Math.max(0, Math.min(1, +s.probability));
        if (Number.isFinite(s.humanize)) humanize = Math.max(0, Math.min(1, +s.humanize));
        if (Number.isFinite(s.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, s.activeLayer | 0));
      } catch (_) {}
    }
    function save() {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          layers: layers.map((l) => Array.from(l)),
          velocity, probability, humanize, activeLayer, version: 35
        }));
      } catch (_) {}
    }
    function getSharedBpm() {
      try {
        const t = window.PionierLooper?.getTimingState?.();
        if (t && Number(t.bpm) > 0) return Number(t.bpm);
      } catch (_) {}
      try {
        const el = document.querySelector('.looper-bpm-value');
        const n = el ? parseInt(el.textContent, 10) : 0;
        if (n > 0) return n;
      } catch (_) {}
      return 92;
    }
    function stepDur() { return 60 / getSharedBpm() / 4; }
    function freqForRow(row) {
      const deg = PENT[row % PENT.length];
      const oct = Math.floor(row / PENT.length);
      return 440 * Math.pow(2, (rootMidi - 69 + deg + oct * 12) / 12);
    }
    function ensureAudio() {
      if (audioCtx) return true;
      try {
        audioCtx = getAudioContext?.() || new (window.AudioContext || window.webkitAudioContext)();
        const master = getAudioMaster?.() || audioCtx.destination;
        bus = audioCtx.createGain();
        bus.gain.value = 0.85;
        bus.connect(master);
        return true;
      } catch (_) { return false; }
    }
    function trigger(row, when, vel) {
      if (!audioCtx || !bus) return;
      const f = freqForRow(row);
      const t0 = Math.max(audioCtx.currentTime + 0.003, when);
      const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
      const attack = 0.09 + (1 - v) * 0.14;
      const sustain = 0.55 + v * 0.9;
      const release = 2.4 + (ROWS - row) * 0.08 + v * 1.2;
      const life = attack + sustain + release + 0.08;
      const masterPeak = 0.05 + v * 0.09;
      const fil = audioCtx.createBiquadFilter();
      fil.type = 'lowpass';
      fil.Q.setValueAtTime(0.7, t0);
      fil.frequency.setValueAtTime(Math.min(4200, f * 5.5), t0);
      fil.frequency.exponentialRampToValueAtTime(Math.min(1800, f * 2.2), t0 + life * 0.85);
      const mix = audioCtx.createGain();
      mix.gain.setValueAtTime(1, t0);
      mix.connect(fil);
      fil.connect(bus);
      function partial(type, freq, level, cents) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (cents) osc.detune.setValueAtTime(cents, t0);
        const peak = Math.max(0.0002, masterPeak * level);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
        g.gain.exponentialRampToValueAtTime(peak * 0.72, t0 + attack + sustain);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);
        osc.connect(g);
        g.connect(mix);
        osc.start(t0);
        osc.stop(t0 + life + 0.05);
      }
      partial('sine', f, 1.0, 0);
      partial('sine', f, 0.42, 5.5);
      partial('sine', f * 2.002, 0.22, 0);
      partial('sine', f * 2.997, 0.1, -3);
      partial('triangle', f * 0.5, 0.08, 0);
    }
    function scheduleAhead() {
      if (!playing || !audioCtx) return;
      const sd = stepDur();
      const now = audioCtx.currentTime;
      while (anchor + lastVisStep * sd < now + 0.18) {
        lastVisStep += 1;
        const step = ((lastVisStep % COLS) + COLS) % COLS;
        if (step === 0 && lastVisStep > 0) {
          playLayer = nextNonEmptyLayer(playLayer);
        }
        playLayer = ((playLayer % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
        const gPlay = layers[playLayer];
        if (!gPlay) continue;
        const when = anchor + lastVisStep * sd;
        for (let row = 0; row < ROWS; row++) {
          if (!gPlay[idx(step, row)]) continue;
          if (Math.random() > probability) continue;
          const accent = (step % 4 === 0) ? 1.15 : (step % 2 === 0 ? 1.05 : 0.92);
          const baseVel = 0.35 + velocity * 0.55;
          const jitterV = (Math.random() - 0.5) * 2 * humanize * 0.2;
          const jitterT = (Math.random() - 0.5) * 2 * humanize * sd * 0.35;
          trigger(row, when + jitterT, Math.max(0.05, Math.min(1, baseVel * accent + jitterV)));
        }
      }
    }
    function tick() {
      if (!playing) return;
      scheduleAhead();
      timer = window.setTimeout(tick, 25);
    }
    function start() {
      if (playing) return;
      if (!ensureAudio()) return;
      try { resumeAudio?.(); } catch (_) {}
      try { audioCtx.resume?.(); } catch (_) {}
      playing = true;
      playLayer = layerHasNotes(activeLayer) ? activeLayer : nextNonEmptyLayer(activeLayer);
      playLayer = ((playLayer % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
      anchor = audioCtx.currentTime + 0.05;
      lastVisStep = -1;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(tick, 20);
      updateLayerButtons();
    }
    function stop() {
      playing = false;
      if (timer) { clearTimeout(timer); timer = 0; }
    }

    if (!document.getElementById('tonepad-css-v35')) {
      const style = document.createElement('style');
      style.id = 'tonepad-css-v35';
      style.textContent = [
        '.tonepad-layer{position:fixed;z-index:40;box-sizing:border-box;background:rgba(8,10,9,.94);border-radius:12px;overflow:hidden;transform:translate3d(100vw,0,0);transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform;display:flex;flex-direction:column;padding:8px;gap:6px}',
        'body.tonepad-open .tonepad-layer{pointer-events:auto}',
        '#pan{transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform}',
        'body.tonepad-open #pan{pointer-events:none}',
        '.tonepad-chrome{display:flex;flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap}',
        '.tonepad-knobs{display:flex;gap:8px;align-items:center}',
        '.tonepad-knob{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px}',
        '.tonepad-knob-label{font:600 9px/1 system-ui,sans-serif;letter-spacing:.06em;color:#c9b06a}',
        '.tonepad-knob-dial{width:36px;height:36px;border-radius:8px;border:1px solid rgba(232,212,138,.4);background:#141a14;cursor:ns-resize;touch-action:none}',
        '.tonepad-knob-val{font:600 10px/1 system-ui,sans-serif;color:#f0d99a}',
        '.tonepad-layers{display:flex;gap:4px}',
        '.tonepad-layer-btn{min-width:28px;height:28px;border-radius:6px;border:1px solid rgba(160,170,160,.35);background:rgba(20,24,20,.9);color:#9aab9e;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-layer-btn.is-active{border-color:#e1cc8b;color:#f0d99a}',
        '.tonepad-layer-btn.is-empty{opacity:.4}',
        '.tonepad-play{min-width:52px;height:28px;border-radius:6px;border:1px solid rgba(120,200,140,.5);background:rgba(30,50,35,.9);color:#b8e0c0;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-canvas{flex:1;width:100%;min-height:120px;touch-action:none;border-radius:8px;background:#0a0c0a}'
      ].join('');
      document.head.appendChild(style);
    }

    let layer = document.getElementById('tonepadLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'tonepadLayer';
      layer.className = 'tonepad-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    layer.innerHTML =
      '<div class="tonepad-chrome">' +
        '<button type="button" class="tonepad-play" data-play>Play</button>' +
        '<div class="tonepad-layers" data-layers></div>' +
        '<div class="tonepad-knobs">' +
          '<div class="tonepad-knob" data-k="vel"><span class="tonepad-knob-label">VEL</span><div class="tonepad-knob-dial" data-dial></div><span class="tonepad-knob-val" data-val>70</span></div>' +
          '<div class="tonepad-knob" data-k="prob"><span class="tonepad-knob-label">PROB</span><div class="tonepad-knob-dial" data-dial></div><span class="tonepad-knob-val" data-val>100</span></div>' +
          '<div class="tonepad-knob" data-k="hum"><span class="tonepad-knob-label">HUM</span><div class="tonepad-knob-dial" data-dial></div><span class="tonepad-knob-val" data-val>12</span></div>' +
        '</div>' +
      '</div>' +
      '<canvas class="tonepad-canvas"></canvas>';

    const canvas = layer.querySelector('canvas');
    const g = canvas.getContext('2d');
    const layersEl = layer.querySelector('[data-layers]');
    for (let i = 0; i < LAYER_COUNT; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tonepad-layer-btn';
      b.textContent = String(i + 1);
      b.dataset.layer = String(i);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        activeLayer = i;
        updateLayerButtons();
        draw();
        save();
      });
      layersEl.appendChild(b);
    }
    function updateLayerButtons() {
      layersEl.querySelectorAll('.tonepad-layer-btn').forEach((b) => {
        const i = +b.dataset.layer;
        b.classList.toggle('is-active', i === activeLayer);
        b.classList.toggle('is-empty', !layerHasNotes(i));
      });
    }
    layer.querySelector('[data-play]').addEventListener('click', (e) => {
      e.stopPropagation();
      ensureAudio();
      try { resumeAudio?.(); audioCtx?.resume?.(); } catch (_) {}
      if (playing) { stop(); e.target.textContent = 'Play'; }
      else { start(); e.target.textContent = 'Stop'; }
    });

    function wireKnob(key, getV, setV) {
      const root = layer.querySelector('[data-k="' + key + '"]');
      const dial = root.querySelector('[data-dial]');
      const val = root.querySelector('[data-val]');
      let drag = false, y0 = 0, v0 = 0;
      const paint = () => { val.textContent = String(Math.round(getV() * 100)); };
      dial.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        drag = true; y0 = e.clientY; v0 = getV();
        dial.setPointerCapture?.(e.pointerId);
      });
      dial.addEventListener('pointermove', (e) => {
        if (!drag) return;
        setV(Math.max(0, Math.min(1, v0 + (y0 - e.clientY) / 120)));
        paint(); save();
      });
      const end = () => { drag = false; };
      dial.addEventListener('pointerup', end);
      dial.addEventListener('pointercancel', end);
      paint();
    }
    wireKnob('vel', () => velocity, (v) => { velocity = v; });
    wireKnob('prob', () => probability, (v) => { probability = v; });
    wireKnob('hum', () => humanize, (v) => { humanize = v; });

    function homeBox() {
      const pan = document.getElementById('pan');
      const stage = document.getElementById('stage');
      if (!pan || !stage) return null;
      const sr = stage.getBoundingClientRect();
      return { left: sr.left + pan.offsetLeft, top: sr.top + pan.offsetTop, width: pan.offsetWidth || sr.width, height: pan.offsetHeight || sr.height };
    }
    function place() {
      const box = homeBox();
      if (!box) return;
      layer.style.left = box.left + 'px';
      layer.style.top = box.top + 'px';
      layer.style.width = box.width + 'px';
      layer.style.height = box.height + 'px';
    }
    function setTrack(panX, layerX, animate) {
      const root = document.documentElement;
      root.style.setProperty('--tp-tr', animate ? '0.55s' : '0s');
      root.style.setProperty('--tp-ease', 'cubic-bezier(0.22, 1, 0.36, 1)');
      const pan = document.getElementById('pan');
      if (pan) pan.style.transform = 'translate3d(' + panX + 'px,0,0)';
      layer.style.transform = 'translate3d(' + layerX + 'px,0,0)';
    }
    function parkDistances(box) {
      const w = Math.max(1, box.width);
      return {
        w,
        parkRight: Math.ceil(Math.max(w + 24, window.innerWidth - box.left + 16)),
        parkLeft: -Math.ceil(Math.max(w + 24, box.left + w + 16))
      };
    }
    function shiftCarousel(animate) {
      const box = homeBox();
      if (!box) return;
      place();
      const dx = dragDx != null ? dragDx : 0;
      const { w, parkRight, parkLeft } = parkDistances(box);
      let panX, layerX;
      if (page === 0) {
        if (dx < 0) {
          const p = Math.min(1, -dx / w);
          panX = parkLeft * p;
          layerX = parkRight * (1 - p);
        } else {
          panX = dx;
          layerX = parkLeft + dx;
        }
      } else {
        if (dx > 0) {
          const p = Math.min(1, dx / w);
          panX = parkLeft * (1 - p);
          layerX = parkRight * p;
        } else {
          panX = parkRight + dx;
          layerX = dx;
        }
      }
      setTrack(panX, layerX, animate);
      document.body.classList.toggle('tonepad-open', page === 1 || (page === 0 && dx < -w * 0.3));
    }
    function setPage(next, animate) {
      page = next ? 1 : 0;
      dragDx = null;
      open = page === 1;
      document.body.classList.toggle('tonepad-open', open);
      layer.setAttribute('aria-hidden', open ? 'false' : 'true');
      const box = homeBox();
      if (!box) return;
      place();
      const { parkRight, parkLeft } = parkDistances(box);
      if (page === 0) setTrack(0, parkRight, animate);
      else {
        setTrack(parkLeft, 0, animate);
        start();
        resizeCanvas();
        draw();
      }
      try {
        const btn = document.getElementById('tonepadToggle');
        if (btn) {
          btn.setAttribute('aria-pressed', open ? 'true' : 'false');
          btn.classList.toggle('is-active', open);
        }
      } catch (_) {}
    }
    function resizeCanvas() {
      place();
      const box = homeBox();
      if (!box) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor((box.width - 16) * dpr));
      const h = Math.max(1, Math.floor((box.height - 56) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
    }
    function draw() {
      if (!g) return;
      const w = canvas.width, h = canvas.height;
      g.clearRect(0, 0, w, h);
      const pad = Math.max(4, Math.min(w, h) * 0.02);
      const gap = Math.max(1, Math.min(w, h) * 0.01);
      const cw = (w - pad * 2 - gap * (COLS - 1)) / COLS;
      const ch = (h - pad * 2 - gap * (ROWS - 1)) / ROWS;
      const gridData = layers[activeLayer];
      let visStep = -1;
      if (playing && audioCtx) {
        const sd = stepDur();
        const total = (audioCtx.currentTime - anchor) / sd;
        visStep = ((Math.floor(total) % COLS) + COLS) % COLS;
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = pad + c * (cw + gap);
          const y = pad + r * (ch + gap);
          const on = gridData[idx(c, r)];
          if (on) {
            const hue = 40 + (r / ROWS) * 80;
            g.fillStyle = 'hsla(' + hue + ',55%,55%,0.85)';
          } else {
            g.fillStyle = c === visStep ? 'rgba(80,90,70,0.55)' : 'rgba(30,36,30,0.9)';
          }
          g.fillRect(x, y, cw, ch);
          if (c === visStep) {
            g.strokeStyle = 'rgba(200,255,180,0.7)';
            g.lineWidth = 1;
            g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
          }
        }
      }
      if (playing) raf = requestAnimationFrame(draw);
    }

    let mode = null, pid = null;
    const seen = new Set();
    function cellAt(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      const x = (cx - rect.left) * (canvas.width / rect.width);
      const y = (cy - rect.top) * (canvas.height / rect.height);
      const pad = Math.max(4, Math.min(canvas.width, canvas.height) * 0.02);
      const gap = Math.max(1, Math.min(canvas.width, canvas.height) * 0.01);
      const cw = (canvas.width - pad * 2 - gap * (COLS - 1)) / COLS;
      const ch = (canvas.height - pad * 2 - gap * (ROWS - 1)) / ROWS;
      const c = Math.floor((x - pad) / (cw + gap));
      const r = Math.floor((y - pad) / (ch + gap));
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
      return { c, r };
    }
    function applyAt(cx, cy) {
      const hit = cellAt(cx, cy);
      if (!hit) return;
      const key = hit.c + ':' + hit.r;
      if (seen.has(key)) return;
      seen.add(key);
      const i = idx(hit.c, hit.r);
      if (mode === 'erase') layers[activeLayer][i] = 0;
      else if (mode === 'paint') layers[activeLayer][i] = 1;
      else {
        const on = !layers[activeLayer][i];
        mode = on ? 'paint' : 'erase';
        layers[activeLayer][i] = on ? 1 : 0;
      }
      draw(); save(); updateLayerButtons();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!open) return;
      e.preventDefault();
      pid = e.pointerId; mode = null; seen.clear();
      canvas.setPointerCapture?.(e.pointerId);
      applyAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!open || e.pointerId !== pid) return;
      applyAt(e.clientX, e.clientY);
    });
    const endPaint = () => { pid = null; mode = null; seen.clear(); };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);

    const EDGE = 40;
    let swipe = null;
    function onDown(e) {
      if (swipe) return;
      if (e.target.closest?.('#looperRail,.topbar,#pionierBottomDock,#fxPanel,button,a,input,.tonepad-knob-dial')) return;
      const onRight = e.clientX >= window.innerWidth - EDGE;
      const onLeft = e.clientX <= EDGE;
      const lr = open ? layer.getBoundingClientRect() : null;
      const onLayerLeft = !!(lr && e.clientX >= lr.left && e.clientX <= lr.left + Math.max(EDGE, lr.width * 0.35));
      if (!onRight && !onLeft && !onLayerLeft) return;
      swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: onRight ? 1 : -1, active: false };
    }
    function onMove(e) {
      if (!swipe || swipe.id !== e.pointerId) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (!swipe.active) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        const toward = swipe.dir === 1 ? dx < -8 : dx > 8;
        if (toward && Math.abs(dx) > Math.abs(dy) * 1.1) swipe.active = true;
        else { swipe = null; return; }
      }
      const box = homeBox();
      const w = box ? box.width : window.innerWidth;
      dragDx = swipe.dir === 1 ? Math.max(-w * 1.2, Math.min(0, dx)) : Math.min(w * 1.2, Math.max(0, dx));
      shiftCarousel(false);
    }
    function onUp(e) {
      if (!swipe || swipe.id !== e.pointerId) return;
      const dx = e.clientX - swipe.x;
      const dir = swipe.dir;
      const was = swipe.active;
      swipe = null;
      const box = homeBox();
      const w = box ? box.width : 240;
      const thresh = Math.min(40, w * 0.12);
      if (was && dir === 1 && dx < -thresh) setPage(1, true);
      else if (was && dir === -1 && dx > thresh) setPage(0, true);
      else setPage(page, true);
    }
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    window.addEventListener('pointerup', onUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
    window.addEventListener('resize', () => { dragDx = null; shiftCarousel(false); resizeCanvas(); draw(); });

    load();
    updateLayerButtons();
    setPage(0, false);
    resizeCanvas();
    draw();

    const api = {
      open: () => setPage(1, true),
      close: () => setPage(0, true),
      toggle: () => setPage(page === 1 ? 0 : 1, true)
    };
    window.PionierTonepad = api;

    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn && !btn.dataset.tpWired) {
        btn.dataset.tpWired = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          api.toggle();
        });
      }
    } catch (_) {}

    return api;
  })().catch((err) => {
    console.error('[tonepad] mount failed', err);
    window.__tonepadMounting = null;
    return null;
  });
  return window.__tonepadMounting;
}
