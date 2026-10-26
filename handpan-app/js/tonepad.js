/**
 * TonePad-style sequencer.
 * 16 steps × 16 pentatonic pitches. Swipe right on the handpan to reveal it
 * in the space between the top bar and the looper. Everything else stays.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const COLS = 16;
const ROWS = 16;
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v1';

const grid = new Uint8Array(COLS * ROWS);
let bpm = 92;

function idx(col, row) { return row * COLS + col; }

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.cells) && saved.cells.length === grid.length) {
      saved.cells.forEach((v, i) => { grid[i] = v ? 1 : 0; });
    }
    if (saved && saved.bpm) bpm = Math.max(48, Math.min(160, Number(saved.bpm) || bpm));
  } catch (_) {}
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ cells: Array.from(grid), bpm, version: 1 }));
  } catch (_) {}
}

function rootMidi() {
  try {
    const notes = window.PionierCore?.handpan?.getNotes?.() || [];
    const ding = notes[0];
    if (ding && Number.isFinite(ding.midi)) return ding.midi - 12;
  } catch (_) {}
  return 48;
}

function freqForRow(row) {
  const semis = Math.floor(row / 5) * 12 + PENT[row % 5];
  return 440 * Math.pow(2, (rootMidi() + semis - 69) / 12);
}

export function mountTonepad() {
  if (document.getElementById('tonepadLayer')) return;
  load();

  if (!document.getElementById('tonepad-css')) {
    const style = document.createElement('style');
    style.id = 'tonepad-css';
    style.textContent = [
      '#stage{overflow:hidden}',
      '#pan{will-change:transform}',
      '.tonepad-layer{position:fixed;z-index:12;overflow:hidden;background:#070807;pointer-events:none;touch-action:none;will-change:transform}',
      'body.tonepad-open .tonepad-layer{pointer-events:auto}',
      '.tonepad-layer canvas{display:block;width:100%;height:100%;touch-action:none}'
    ].join('');
    document.head.appendChild(style);
  }

  const layer = document.createElement('div');
  layer.id = 'tonepadLayer';
  layer.className = 'tonepad-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';
  document.body.appendChild(layer);
  const canvas = layer.querySelector('canvas');
  const ctx2d = canvas.getContext('2d');

  const ripples = [];
  let open = false;
  let playing = false;
  let audioCtx = null;
  let bus = null;
  let rev = null;
  let timer = 0;
  let anchor = 0;
  let lastVisStep = -1;
  let raf = 0;
  // Horizontal instrument carousel. Page 0 is the handpan, page 1 is this grid.
  // Later instruments append to PAGES and the same edge-swipe moves between them.
  const PAGES = ['handpan', 'tonepad'];
  let page = 0;
  let dragDx = null;

  function homeBox() {
    const pan = document.getElementById('pan');
    const stage = document.getElementById('stage');
    if (!pan || !stage) return null;
    const sr = stage.getBoundingClientRect();
    return {
      left: sr.left + pan.offsetLeft,
      top: sr.top + pan.offsetTop,
      width: pan.offsetWidth || sr.width,
      height: pan.offsetHeight || sr.height
    };
  }

  function place() {
    const box = homeBox();
    if (!box) return;
    const stage = document.getElementById('stage');
    if (stage) stage.style.overflow = 'hidden';
    layer.style.left = box.left + 'px';
    layer.style.top = box.top + 'px';
    layer.style.width = box.width + 'px';
    layer.style.height = box.height + 'px';
    layer.style.right = 'auto';
  }

  function shiftCarousel(animate) {
    const box = homeBox();
    if (!box) return;
    place();
    const dx = dragDx || 0;
    const x = -page * box.width + dx;
    const tr = animate ? 'transform .36s cubic-bezier(.22,.85,.2,1)' : 'none';
    const pan = document.getElementById('pan');
    if (pan) {
      pan.style.transition = tr;
      pan.style.transform = `translate3d(${x}px,0,0)`;
    }
    layer.style.transition = tr;
    layer.style.transform = `translate3d(${x + box.width}px,0,0)`;
  }

  function resizeCanvas() {
    place();
    const box = homeBox();
    if (!box) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(box.width * dpr));
    const h = Math.max(1, Math.floor(box.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function metrics() {
    const w = canvas.width;
    const h = canvas.height;
    const pad = Math.round(Math.min(w, h) * 0.025);
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const gap = Math.max(2, Math.round(Math.min(innerW / COLS, innerH / ROWS) * 0.08));
    const cell = Math.min((innerW - gap * (COLS - 1)) / COLS, (innerH - gap * (ROWS - 1)) / ROWS);
    const gridW = cell * COLS + gap * (COLS - 1);
    const gridH = cell * ROWS + gap * (ROWS - 1);
    const ox = (w - gridW) / 2;
    const oy = (h - gridH) / 2;
    return { cell, gap, ox, oy, w, h };
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const m = metrics();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor((x - m.ox) / (m.cell + m.gap));
    const rowFromTop = Math.floor((y - m.oy) / (m.cell + m.gap));
    if (col < 0 || col >= COLS || rowFromTop < 0 || rowFromTop >= ROWS) return null;
    const localX = x - m.ox - col * (m.cell + m.gap);
    const localY = y - m.oy - rowFromTop * (m.cell + m.gap);
    if (localX > m.cell || localY > m.cell) return null;
    const row = ROWS - 1 - rowFromTop;
    return { col, row };
  }

  function setCell(col, row, on) {
    const i = idx(col, row);
    const next = on ? 1 : 0;
    if (grid[i] === next) return;
    grid[i] = next;
    save();
  }

  function ensureAudio() {
    resumeAudio();
    audioCtx = getAudioContext();
    if (!audioCtx) return false;
    if (!bus) {
      const master = getAudioMaster();
      bus = audioCtx.createGain();
      bus.gain.value = 0.9;
      const dry = audioCtx.createGain();
      dry.gain.value = 0.72;
      rev = audioCtx.createGain();
      rev.gain.value = 0.55;
      const d1 = audioCtx.createDelay(1.5);
      d1.delayTime.value = 0.21;
      const d2 = audioCtx.createDelay(1.5);
      d2.delayTime.value = 0.34;
      const fb1 = audioCtx.createGain();
      fb1.gain.value = 0.38;
      const fb2 = audioCtx.createGain();
      fb2.gain.value = 0.28;
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      d1.connect(lp); lp.connect(fb1); fb1.connect(d1); d1.connect(rev);
      d2.connect(fb2); fb2.connect(d2); d2.connect(rev);
      bus.connect(dry); dry.connect(master || audioCtx.destination);
      bus.connect(d1); bus.connect(d2);
      rev.connect(master || audioCtx.destination);
    }
    return true;
  }

  function chime(freq, when) {
    if (!audioCtx || !bus) return;
    const o = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator();
    o.type = 'sine';
    o2.type = 'sine';
    o.frequency.setValueAtTime(freq, when);
    o2.frequency.setValueAtTime(freq * 2.003, when);
    const g = audioCtx.createGain();
    const g2 = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.22, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.55);
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(0.05, when + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
    o.connect(g); o2.connect(g2);
    g.connect(bus); g2.connect(bus);
    o.start(when); o2.start(when);
    o.stop(when + 1.7); o2.stop(when + 1.1);
  }

  function scheduleColumn(col, when) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[idx(col, row)]) chime(freqForRow(row), when);
    }
  }

  function stepDur() { return 60 / bpm / 4; }

  function visStep() {
    if (!audioCtx || !playing) return { step: -1, frac: 0 };
    const sd = stepDur();
    const t = (audioCtx.currentTime - anchor) / sd;
    const wrapped = ((t % COLS) + COLS) % COLS;
    return { step: Math.floor(wrapped) % COLS, frac: wrapped % 1 };
  }

  let nextTime = 0;
  let nextCol = 0;
  function tick() {
    if (!playing || !audioCtx) return;
    if (audioCtx.state !== 'running') {
      timer = window.setTimeout(tick, 80);
      return;
    }
    const now = audioCtx.currentTime;
    const sd = stepDur();
    if (nextTime < now - 0.05) {
      const skip = Math.floor((now - nextTime) / sd);
      nextCol = (nextCol + skip) % COLS;
      nextTime += skip * sd;
      if (nextTime < now + 0.01) nextTime = now + 0.02;
    }
    while (nextTime < now + 0.14) {
      scheduleColumn(nextCol, nextTime);
      nextTime += sd;
      nextCol = (nextCol + 1) % COLS;
    }
    timer = window.setTimeout(tick, 25);
  }

  function start() {
    if (!ensureAudio()) return;
    if (playing) return;
    playing = true;
    const now = audioCtx.currentTime;
    anchor = now + 0.05;
    nextTime = anchor;
    nextCol = 0;
    lastVisStep = -1;
    timer = window.setTimeout(tick, 20);
  }

  function stop() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = 0;
    lastVisStep = -1;
  }

  function spawnRipples(col) {
    const m = metrics();
    for (let row = 0; row < ROWS; row++) {
      if (!grid[idx(col, row)]) continue;
      const rowFromTop = ROWS - 1 - row;
      ripples.push({
        x: m.ox + col * (m.cell + m.gap) + m.cell / 2,
        y: m.oy + rowFromTop * (m.cell + m.gap) + m.cell / 2,
        r: m.cell * 0.2,
        a: 0.55
      });
    }
  }

  function draw() {
    resizeCanvas();
    const m = metrics();
    const g = ctx2d;
    g.clearRect(0, 0, m.w, m.h);
    g.fillStyle = '#070807';
    g.fillRect(0, 0, m.w, m.h);

    const vis = visStep();
    if (vis.step !== lastVisStep && vis.step >= 0) {
      lastVisStep = vis.step;
      spawnRipples(vis.step);
    }

    for (let row = 0; row < ROWS; row++) {
      const rowFromTop = ROWS - 1 - row;
      for (let col = 0; col < COLS; col++) {
        const x = m.ox + col * (m.cell + m.gap);
        const y = m.oy + rowFromTop * (m.cell + m.gap);
        const on = grid[idx(col, row)];
        const beat = col % 4 === 0;
        g.lineWidth = Math.max(1, m.cell * 0.045);
        g.strokeStyle = on ? 'rgba(214, 244, 232, 0.95)' : (beat ? 'rgba(190, 206, 196, 0.28)' : 'rgba(170, 186, 176, 0.16)');
        g.fillStyle = on ? 'rgba(186, 245, 220, 0.92)' : 'rgba(255,255,255,0.015)';
        g.beginPath();
        g.rect(x, y, m.cell, m.cell);
        g.fill();
        g.stroke();
        if (on) {
          g.save();
          g.shadowColor = 'rgba(170, 255, 220, 0.85)';
          g.shadowBlur = m.cell * 0.45;
          g.fillStyle = 'rgba(230, 255, 245, 0.95)';
          g.fillRect(x, y, m.cell, m.cell);
          g.restore();
        }
      }
    }

    if (vis.step >= 0) {
      const x = m.ox + (vis.step + vis.frac) * (m.cell + m.gap) - m.gap / 2;
      g.strokeStyle = 'rgba(236, 255, 246, 0.85)';
      g.lineWidth = Math.max(1, m.cell * 0.06);
      g.beginPath();
      g.moveTo(x, m.oy - 2);
      g.lineTo(x, m.oy + ROWS * (m.cell + m.gap) - m.gap + 2);
      g.stroke();
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += m.cell * 0.09;
      rp.a *= 0.9;
      if (rp.a < 0.03) { ripples.splice(i, 1); continue; }
      g.strokeStyle = `rgba(200, 255, 230, ${rp.a})`;
      g.lineWidth = Math.max(1, m.cell * 0.05);
      g.beginPath();
      g.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      g.stroke();
    }

    raf = requestAnimationFrame(draw);
  }

  function setPage(next, animate) {
    page = Math.max(0, Math.min(PAGES.length - 1, next));
    dragDx = null;
    open = page === 1;
    document.body.classList.toggle('tonepad-open', open);
    layer.setAttribute('aria-hidden', open ? 'false' : 'true');
    shiftCarousel(animate);
    if (open) {
      start();
      resizeCanvas();
    } else {
      stop();
    }
  }

  // Draw on the grid. Navigation is only from the screen edges, so drawing stays free.
  let mode = null;
  let pid = null;
  const seen = new Set();

  function applyAt(x, y) {
    const hit = cellAt(x, y);
    if (!hit) return;
    const key = hit.col + ':' + hit.row;
    if (seen.has(key)) return;
    seen.add(key);
    if (mode === 'erase') setCell(hit.col, hit.row, false);
    else if (mode === 'paint') setCell(hit.col, hit.row, true);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!open) return;
    if (e.clientX < 28 || e.clientX > window.innerWidth - 28) return;
    canvas.setPointerCapture?.(e.pointerId);
    pid = e.pointerId;
    seen.clear();
    const hit = cellAt(e.clientX, e.clientY);
    mode = hit && grid[idx(hit.col, hit.row)] ? 'erase' : 'paint';
    applyAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pid !== e.pointerId || !mode) return;
    applyAt(e.clientX, e.clientY);
  });

  const endDraw = (e) => {
    if (pid !== e.pointerId) return;
    pid = null;
    mode = null;
    seen.clear();
  };
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);

  // Edge swipe: from the right edge, drag left to the next instrument.
  // From the left edge, drag right to the previous one.
  const EDGE = 32;
  let swipe = null;
  function onDown(e) {
    if (swipe) return;
    if (e.target.closest && e.target.closest('#looperRail, .topbar, #pionierBottomDock, #fxPanel, #pionierWelcome, button, a, input')) return;
    const fromRight = e.clientX >= window.innerWidth - EDGE && page < PAGES.length - 1;
    const fromLeft = e.clientX <= EDGE && page > 0;
    if (!fromRight && !fromLeft) return;
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: fromRight ? 1 : -1, active: false };
  }
  function onMove(e) {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const toward = swipe.dir === 1 ? dx < -8 : dx > 8;
    if (!swipe.active) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (toward && Math.abs(dx) > Math.abs(dy) * 1.2) swipe.active = true;
      else { swipe = null; return; }
    }
    const box = homeBox();
    const w = box ? box.width : window.innerWidth;
    const capped = swipe.dir === 1 ? Math.max(-w, Math.min(0, dx)) : Math.min(w, Math.max(0, dx));
    dragDx = capped;
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
    if (was && dir === 1 && dx < -Math.min(72, w * 0.22)) setPage(page + 1, true);
    else if (was && dir === -1 && dx > Math.min(72, w * 0.22)) setPage(page - 1, true);
    else setPage(page, true);
  }

  window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  window.addEventListener('pointermove', onMove, { capture: true, passive: true });
  window.addEventListener('pointerup', onUp, { capture: true, passive: true });
  window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
  window.addEventListener('resize', () => { dragDx = null; shiftCarousel(false); resizeCanvas(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { dragDx = null; shiftCarousel(false); resizeCanvas(); }, 200));

  setPage(0, false);
  raf = requestAnimationFrame(draw);

  window.PionierStageCarousel = {
    pages: PAGES,
    index: () => page,
    go(i) { setPage(i, true); }
  };
  window.PionierTonepad = {
    open: () => setPage(1, true),
    close: () => setPage(0, true),
    toggle: () => setPage(page === 1 ? 0 : 1, true)
  };
}
