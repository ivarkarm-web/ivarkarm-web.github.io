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
  if (document.getElementById('tonepadLayer')) return window.PionierTonepad || null;
  load();

  if (!document.getElementById('tonepad-css')) {
    const style = document.createElement('style');
    style.id = 'tonepad-css';
    style.textContent = [
      '#stage{overflow:hidden}',
      '#pan{will-change:transform,opacity}',
      '.tonepad-layer{position:fixed;z-index:14;overflow:hidden;background:transparent;pointer-events:none;touch-action:none;will-change:transform,opacity;border-radius:4px}',
      'body.tonepad-open .tonepad-layer{pointer-events:auto}',
      'body.tonepad-open #pan{pointer-events:none}',
      '.tonepad-layer canvas{display:block;width:100%;height:100%;touch-action:none;border-radius:4px}',
      '.tonepad-chrome{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;pointer-events:none;background:linear-gradient(180deg,rgba(7,8,7,.92),rgba(7,8,7,0))}',
      '.tonepad-chrome *{pointer-events:auto}',
      '.tonepad-title{font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#a8b8ac}',
      '.tonepad-hint{font:500 10px/1.2 Inter,system-ui,sans-serif;color:#6a7a6e}',
      '.tonepad-bpm{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:48px}',
      '.tonepad-bpm-label{font:600 8px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#c9b06a}',
      '.tonepad-bpm-dial{width:44px;height:44px;border-radius:4px;border:1px solid rgba(232,212,138,.45);background:linear-gradient(160deg,#1a2018,#0e120f);cursor:ns-resize;touch-action:none}',
      '.tonepad-bpm-dial canvas{width:100%;height:100%;display:block;pointer-events:none}',
      '.tonepad-bpm-val{font:600 11px/1 Inter,system-ui,sans-serif;color:#f0d99a}'
    ].join('');
    document.head.appendChild(style);
  }

  const layer = document.createElement('div');
  layer.id = 'tonepadLayer';
  layer.className = 'tonepad-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="tonepad-chrome"><div><div class="tonepad-title">TonePad</div><div class="tonepad-hint">swipe edge · paint steps</div></div><div class="tonepad-bpm"><span class="tonepad-bpm-label">BPM</span><div class="tonepad-bpm-dial" tabindex="0" role="slider" aria-label="Tempo" aria-valuemin="48" aria-valuemax="160"><canvas width="96" height="96"></canvas></div><span class="tonepad-bpm-val" data-bpm-val>92</span></div></div><canvas id="tonepadCanvas" aria-label="Pentatonic step sequencer"></canvas>';
  document.body.appendChild(layer);
  const canvas = layer.querySelector('#tonepadCanvas');
  const ctx2d = canvas.getContext('2d');
  const bpmDial = layer.querySelector('.tonepad-bpm-dial');
  const bpmCanvas = bpmDial.querySelector('canvas');
  const bpmValEl = layer.querySelector('[data-bpm-val]');
  function paintBpmKnob() {
    const c = bpmCanvas.getContext('2d'); if (!c) return;
    const w = bpmCanvas.width, h = bpmCanvas.height, cx = w/2, cy = h/2, r = Math.min(w,h)*0.38;
    const start = Math.PI*0.75, span = Math.PI*1.5, t = (bpm-48)/(160-48);
    c.clearRect(0,0,w,h); c.lineWidth = Math.max(3,w*0.07); c.lineCap = 'round';
    c.strokeStyle = 'rgba(120,130,118,.35)'; c.beginPath(); c.arc(cx,cy,r,start,start+span); c.stroke();
    c.strokeStyle = '#e1cc8b'; c.beginPath(); c.arc(cx,cy,r,start,start+span*t); c.stroke();
    const a = start+span*t; c.fillStyle = '#f0d99a'; c.beginPath(); c.arc(cx+Math.cos(a)*r, cy+Math.sin(a)*r, Math.max(3,w*0.055), 0, Math.PI*2); c.fill();
    if (bpmValEl) bpmValEl.textContent = String(Math.round(bpm));
    bpmDial.setAttribute('aria-valuenow', String(Math.round(bpm)));
  }
  (function wireBpm() {
    let drag=false, startY=0, startBpm=bpm;
    const apply = (v) => { bpm = Math.max(48, Math.min(160, Math.round(v))); paintBpmKnob(); save(); };
    bpmDial.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); drag=true; startY=e.clientY; startBpm=bpm; bpmDial.setPointerCapture?.(e.pointerId); });
    bpmDial.addEventListener('pointermove', (e) => { if (!drag) return; e.stopPropagation(); apply(startBpm + (startY - e.clientY)/1.2); });
    const stop = () => { drag=false; };
    bpmDial.addEventListener('pointerup', stop); bpmDial.addEventListener('pointercancel', stop);
    paintBpmKnob();
  })();

  // REST of file continues in next commit if needed - MARKER_NEED_REST
  console.warn('[tonepad] incomplete push');
}
