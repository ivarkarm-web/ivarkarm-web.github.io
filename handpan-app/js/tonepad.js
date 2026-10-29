/**
 * TonePad v43 — selectable per-layer sound modules under the step grid.
 * Preserves square pads, VEL/PROB/HUM knobs, and infinity carousel from v42.
 * Handpan <-> sequencer is an infinity ring: swiping from the right edge on the
 * sequencer brings the handpan back in from the right.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const COLS = 16;
const ROWS = 8;
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v36';
const LAYER_COUNT = 5;
const DEFAULT_SOUND = 'bloom';
const SOUNDS = [
  { id: 'bloom', name: 'Bloom' },
  { id: 'handpan', name: 'Handpan' },
  { id: 'kalimba', name: 'Kalimba' },
  { id: 'marimba', name: 'Marimba' },
  { id: 'bell', name: 'Bell' },
  { id: 'pluck', name: 'Pluck' },
  { id: 'epiano', name: 'E-Piano' },
  { id: 'warmpad', name: 'Warm Pad' },
  { id: 'sub', name: 'Sub' },
];
const SOUND_IDS = new Set(SOUNDS.map((s) => s.id));

export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));
    const layerSounds = Array.from({ length: LAYER_COUNT }, () => DEFAULT_SOUND);
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
        if (Array.isArray(s.layerSounds)) {
          s.layerSounds.forEach((id, li) => {
            if (li < LAYER_COUNT && typeof id === 'string' && SOUND_IDS.has(id)) {
              layerSounds[li] = id;
            }
          });
        }
      } catch (_) {}
    }
    function save() {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          layers: layers.map((l) => Array.from(l)),
          layerSounds: layerSounds.slice(),
          velocity, probability, humanize, activeLayer, version: 43
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
    function envGain(g, t0, peak, attack, sustain, release) {
      const life = attack + sustain + release;
      const p = Math.max(0.0002, peak);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p, t0 + attack);
      if (sustain > 0.01) g.gain.exponentialRampToValueAtTime(p * 0.7, t0 + attack + sustain);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);
      return life;
    }
    function makePartial(type, freq, level, cents, t0, peak, attack, sustain, release, dest) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (cents) osc.detune.setValueAtTime(cents, t0);
      const life = envGain(g, t0, peak * level, attack, sustain, release);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + life + 0.06);
      return life;
    }
    function trigger(row, when, vel, soundId) {
      if (!audioCtx || !bus) return;
      const f = freqForRow(row);
      const t0 = Math.max(audioCtx.currentTime + 0.003, when);
      const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
      const id = (soundId && SOUND_IDS.has(soundId)) ? soundId : layerSounds[playLayer] || DEFAULT_SOUND;
      const fil = audioCtx.createBiquadFilter();
      const mix = audioCtx.createGain();
      mix.gain.setValueAtTime(1, t0);
      mix.connect(fil);
      fil.connect(bus);

      if (id === 'bloom') {
        const attack = 0.09 + (1 - v) * 0.14;
        const sustain = 0.55 + v * 0.9;
        const release = 2.4 + (ROWS - row) * 0.08 + v * 1.2;
        const peak = 0.05 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.7, t0);
        fil.frequency.setValueAtTime(Math.min(4200, f * 5.5), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(1800, f * 2.2), t0 + (attack + sustain + release) * 0.85);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.42, 5.5, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.002, 0.22, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.997, 0.1, -3, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 0.5, 0.08, 0, t0, peak, attack, sustain, release, mix);
      } else if (id === 'handpan') {
        const attack = 0.012 + (1 - v) * 0.02;
        const sustain = 0.08;
        const release = 1.6 + v * 0.9;
        const peak = 0.07 + v * 0.11;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(1.1, t0);
        fil.frequency.setValueAtTime(Math.min(5200, f * 6.5), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(1400, f * 2.4), t0 + release * 0.7);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.38, 3, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', f * 2.76, 0.22, -4, t0, peak, attack, sustain, release * 0.7, mix);
        makePartial('sine', f * 4.05, 0.09, 0, t0, peak, attack, sustain, release * 0.5, mix);
        makePartial('triangle', f * 1.01, 0.12, 0, t0, peak, attack, sustain, release * 0.9, mix);
      } else if (id === 'kalimba') {
        const attack = 0.004;
        const sustain = 0.02;
        const release = 0.55 + v * 0.45;
        const peak = 0.09 + v * 0.12;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.9, t0);
        fil.frequency.setValueAtTime(Math.min(6500, f * 8), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(2200, f * 3), t0 + release * 0.6);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 6.27, 0.32 * v, 0, t0, peak, attack, sustain, release * 0.35, mix);
        makePartial('triangle', f * 2.01, 0.15, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else if (id === 'marimba') {
        const attack = 0.006;
        const sustain = 0.03;
        const release = 0.7 + v * 0.5;
        const peak = 0.08 + v * 0.11;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(1.4, t0);
        fil.frequency.setValueAtTime(Math.min(4800, f * 5.8), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(1600, f * 2.1), t0 + release * 0.55);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 3.92, 0.28, 8, t0, peak, attack, sustain, release * 0.4, mix);
        makePartial('triangle', f * 1.005, 0.22, 0, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', f * 9.1, 0.06 * v, 0, t0, peak, attack, sustain, release * 0.25, mix);
      } else if (id === 'bell') {
        const attack = 0.008;
        const sustain = 0.05;
        const release = 2.8 + v * 1.4;
        const peak = 0.055 + v * 0.08;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.6, t0);
        fil.frequency.setValueAtTime(Math.min(7000, f * 9), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(2500, f * 3.5), t0 + release * 0.8);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.71, 0.45, 4, t0, peak, attack, sustain, release * 0.9, mix);
        makePartial('sine', f * 5.15, 0.22, -6, t0, peak, attack, sustain, release * 0.7, mix);
        makePartial('sine', f * 8.46, 0.1, 2, t0, peak, attack, sustain, release * 0.45, mix);
        makePartial('sine', f * 1.004, 0.3, 7, t0, peak, attack, sustain, release, mix);
      } else if (id === 'pluck') {
        const attack = 0.003;
        const sustain = 0.01;
        const release = 0.45 + v * 0.35;
        const peak = 0.1 + v * 0.12;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(2.2, t0);
        fil.frequency.setValueAtTime(Math.min(7800, f * 10 + 800), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(900, f * 1.6), t0 + release * 0.85);
        makePartial('sawtooth', f, 0.55, 0, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 1.002, 0.4, 3, t0, peak, attack, sustain, release * 0.9, mix);
        makePartial('sine', f * 2.01, 0.18, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else if (id === 'epiano') {
        const attack = 0.015 + (1 - v) * 0.03;
        const sustain = 0.25 + v * 0.35;
        const release = 1.4 + v * 0.8;
        const peak = 0.06 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.85, t0);
        fil.frequency.setValueAtTime(Math.min(3800, f * 4.8), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(1200, f * 2.0), t0 + (attack + sustain + release) * 0.75);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.28, 4, t0, peak, attack, sustain, release * 0.8, mix);
        makePartial('triangle', f * 1.003, 0.18, -2, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 14.5, 0.04 * v, 0, t0, peak, attack * 0.5, 0.02, release * 0.2, mix);
      } else if (id === 'warmpad') {
        const attack = 0.22 + (1 - v) * 0.25;
        const sustain = 1.1 + v * 1.2;
        const release = 2.8 + v * 1.5;
        const peak = 0.04 + v * 0.07;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.5, t0);
        fil.frequency.setValueAtTime(Math.min(2800, f * 3.8), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(900, f * 1.6), t0 + (attack + sustain + release) * 0.9);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.55, 8, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.4, -7, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 0.5, 0.18, 0, t0, peak, attack * 1.2, sustain, release, mix);
        makePartial('sine', f * 1.5, 0.12, 3, t0, peak, attack, sustain, release * 0.9, mix);
      } else if (id === 'sub') {
        const attack = 0.04 + (1 - v) * 0.06;
        const sustain = 0.35 + v * 0.5;
        const release = 1.1 + v * 0.7;
        const peak = 0.12 + v * 0.14;
        const ff = Math.max(35, f * 0.5);
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.9, t0);
        fil.frequency.setValueAtTime(Math.min(420, ff * 4.5), t0);
        fil.frequency.exponentialRampToValueAtTime(Math.min(180, ff * 2.2), t0 + (attack + sustain + release) * 0.7);
        makePartial('sine', ff, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', ff * 1.01, 0.22, 0, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', ff * 2.0, 0.08, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else {
        const attack = 0.09 + (1 - v) * 0.14;
        const sustain = 0.55 + v * 0.9;
        const release = 2.4 + v * 1.2;
        const peak = 0.05 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.7, t0);
        fil.frequency.setValueAtTime(Math.min(4200, f * 5.5), t0);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.25, 0, t0, peak, attack, sustain, release, mix);
      }
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
          trigger(row, when + jitterT, Math.max(0.05, Math.min(1, baseVel * accent + jitterV)), layerSounds[playLayer]);
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

    if (!document.getElementById('tonepad-css-v43')) {
      const style = document.createElement('style');
      style.id = 'tonepad-css-v43';
      style.textContent = [
        '.tonepad-layer{touch-action:none;position:fixed;z-index:40;box-sizing:border-box;background:rgba(8,10,9,.94);border-radius:12px;overflow:hidden;transform:translate3d(100vw,0,0);transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform;display:flex;flex-direction:column;padding:8px;gap:6px}',
        'body.tonepad-open .tonepad-layer{pointer-events:auto}',
        '#pan{transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform}',
        'body.tonepad-open #pan{pointer-events:none}',
        '.tonepad-chrome{display:flex;flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap}',
        '.tonepad-knobs{display:flex;gap:8px;align-items:center}',
        '.tonepad-knob{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px}',
        '.tonepad-knob-label{font:600 9px/1 system-ui,sans-serif;letter-spacing:.06em;color:#c9b06a}',
        '.tonepad-knob-dial{width:36px;height:36px;border-radius:8px;border:1px solid rgba(232,212,138,.4);background:#141a14;cursor:ns-resize;touch-action:none}',
        '.tonepad-knob-dial canvas{width:100%;height:100%;display:block;pointer-events:none}',
        '.tonepad-knob-val{font:600 10px/1 system-ui,sans-serif;color:#f0d99a}',
        '.tonepad-layers{display:flex;gap:4px}',
        '.tonepad-layer-btn{min-width:28px;height:28px;border-radius:6px;border:1px solid rgba(160,170,160,.35);background:rgba(20,24,20,.9);color:#9aab9e;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-layer-btn.is-active{border-color:#e1cc8b;color:#f0d99a}',
        '.tonepad-layer-btn.is-empty{opacity:.4}',
        '.tonepad-play{min-width:52px;height:28px;border-radius:6px;border:1px solid rgba(120,200,140,.5);background:rgba(30,50,35,.9);color:#b8e0c0;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-canvas{flex:1;width:100%;min-height:100px;touch-action:none;border-radius:8px;background:#0a0c0a}',
        '.tonepad-sounds{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:2px 0 0;flex-shrink:0}',
        '@media (max-width:400px){.tonepad-sounds{grid-template-columns:repeat(3,minmax(0,1fr))}}',
        '.tonepad-sound-btn{min-height:28px;padding:4px 2px;border-radius:8px;border:1px solid rgba(160,170,160,.28);background:rgba(16,20,16,.92);color:#9aab9e;font:600 9px/1.15 system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;touch-action:manipulation;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.tonepad-sound-btn.is-active{border-color:rgba(225,204,139,.85);color:#f0d99a;background:rgba(40,36,18,.95);box-shadow:0 0 0 1px rgba(225,204,139,.25),0 0 10px rgba(225,204,139,.12)}'
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
          '<div class="tonepad-knob" data-k="vel"><span class="tonepad-knob-label">VEL</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>70</span></div>' +
          '<div class="tonepad-knob" data-k="prob"><span class="tonepad-knob-label">PROB</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>100</span></div>' +
          '<div class="tonepad-knob" data-k="hum"><span class="tonepad-knob-label">HUM</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>12</span></div>' +
        '</div>' +
      '</div>' +
      '<canvas class="tonepad-canvas"></canvas>' +
      '<div class="tonepad-sounds" data-sounds></div>';

    const canvas = layer.querySelector('canvas.tonepad-canvas');
    const g = canvas.getContext('2d');
    const layersEl = layer.querySelector('[data-layers]');
    const soundsEl = layer.querySelector('[data-sounds]');
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
        updateSoundButtons();
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
    SOUNDS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tonepad-sound-btn';
      b.textContent = s.name;
      b.dataset.sound = s.id;
      b.title = s.name;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        layerSounds[activeLayer] = s.id;
        updateSoundButtons();
        save();
        if (ensureAudio()) {
          try { resumeAudio?.(); audioCtx?.resume?.(); } catch (_) {}
          trigger(3, audioCtx.currentTime + 0.02, 0.72, s.id);
        }
      });
      soundsEl.appendChild(b);
    });
    function updateSoundButtons() {
      const cur = layerSounds[activeLayer] || DEFAULT_SOUND;
      soundsEl.querySelectorAll('.tonepad-sound-btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.sound === cur);
      });
    }
    layer.querySelector('[data-play]').addEventListener('click', (e) => {
      e.stopPropagation();
      ensureAudio();
      try { resumeAudio?.(); audioCtx?.resume?.(); } catch (_) {}
      if (playing) { stop(); e.target.textContent = 'Play'; }
      else { start(); e.target.textContent = 'Stop'; }
    });

    const knobRepaint = [];
    function wireKnob(key, getV, setV) {
      const root = layer.querySelector('[data-k="' + key + '"]');
      const dial = root.querySelector('[data-dial]');
      const val = root.querySelector('[data-val]');
      const kc = dial.querySelector('canvas');
      const kg = kc ? kc.getContext('2d') : null;
      let drag = false, y0 = 0, v0 = 0;
      const paint = () => {
        const t = Math.max(0, Math.min(1, getV()));
        val.textContent = String(Math.round(t * 100));
        if (!kg) return;
        const s = kc.width, cx = s / 2, cy = s / 2, rad = s * 0.34;
        const a0 = Math.PI * 0.75, span = Math.PI * 1.5, a1 = a0 + span * t;
        kg.clearRect(0, 0, s, s);
        kg.lineWidth = s * 0.1;
        kg.lineCap = 'round';
        kg.strokeStyle = 'rgba(120,130,118,.35)';
        kg.beginPath(); kg.arc(cx, cy, rad, a0, a0 + span); kg.stroke();
        if (t > 0) {
          kg.strokeStyle = '#e1cc8b';
          kg.beginPath(); kg.arc(cx, cy, rad, a0, a1); kg.stroke();
        }
        kg.fillStyle = '#f0d99a';
        kg.beginPath(); kg.arc(cx + Math.cos(a1) * rad, cy + Math.sin(a1) * rad, s * 0.07, 0, Math.PI * 2); kg.fill();
      };
      knobRepaint.push(paint);
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
      const pan = document.getElementById('pan');
      const dur = animate ? '0.55s' : '0s';
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      [pan, layer].forEach((el) => {
        if (!el) return;
        el.style.setProperty('--tp-tr', dur);
        el.style.setProperty('--tp-ease', ease);
      });
      if (animate) void layer.offsetWidth;
      if (pan) {
        pan.style.setProperty('--tp-x', panX + 'px');
        pan.style.transform = 'translate3d(' + panX + 'px,0,0)';
      }
      layer.style.setProperty('--tp-lx', layerX + 'px');
      layer.style.transform = 'translate3d(' + layerX + 'px,0,0)';
    }
    function parkDistances(box) {
      const w = box ? box.width : (window.innerWidth || 360);
      return { pan: 0, layer: w + 8 };
    }
    function rest(animate) {
      const box = homeBox();
      place();
      const d = parkDistances(box);
      if (page === 0) setTrack(0, d.layer, animate);
      else setTrack(-d.layer, 0, animate);
    }
    function setPage(p, animate) {
      page = p ? 1 : 0;
      open = page === 1;
      document.body.classList.toggle('tonepad-open', open);
      layer.setAttribute('aria-hidden', open ? 'false' : 'true');
      const toggle = document.getElementById('tonepadToggle');
      if (toggle) {
        toggle.classList.toggle('is-active', open);
        toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
      }
      rest(!!animate);
      if (open) {
        resizeCanvas();
        draw();
        updateLayerButtons();
        updateSoundButtons();
      }
    }
    function resizeCanvas() {
      const box = homeBox();
      if (!box) return;
      const cssW = canvas.clientWidth || (box.width - 16);
      const cssH = canvas.clientHeight || (box.height - 56);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
    }
    function draw() {
      const w = canvas.width, h = canvas.height;
      if (!w || !h) return;
      g.clearRect(0, 0, w, h);
      const pad = Math.min(w / COLS, h / ROWS) * 0.92;
      const ox = (w - pad * COLS) / 2;
      const oy = (h - pad * ROWS) / 2;
      const gap = pad * 0.08;
      const cell = pad - gap;
      const grid = layers[activeLayer];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = ox + c * pad + gap / 2;
          const y = oy + r * pad + gap / 2;
          const on = grid[idx(c, r)];
          g.fillStyle = on ? 'rgba(225,204,139,0.85)' : 'rgba(30,36,30,0.9)';
          g.strokeStyle = on ? 'rgba(240,217,154,0.7)' : 'rgba(80,90,80,0.4)';
          g.lineWidth = Math.max(1, pad * 0.03);
          const rr = Math.max(2, cell * 0.12);
          g.beginPath();
          g.moveTo(x + rr, y);
          g.arcTo(x + cell, y, x + cell, y + cell, rr);
          g.arcTo(x + cell, y + cell, x, y + cell, rr);
          g.arcTo(x, y + cell, x, y, rr);
          g.arcTo(x, y, x + cell, y, rr);
          g.closePath();
          g.fill();
          g.stroke();
        }
      }
      if (playing && lastVisStep >= 0) {
        const step = ((lastVisStep % COLS) + COLS) % COLS;
        const x = ox + step * pad;
        g.fillStyle = 'rgba(225,204,139,0.12)';
        g.fillRect(x, oy, pad, pad * ROWS);
      }
    }
    function cellAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      const x = (clientX - rect.left) * dpr;
      const y = (clientY - rect.top) * dpr;
      const pad = Math.min(canvas.width / COLS, canvas.height / ROWS) * 0.92;
      const ox = (canvas.width - pad * COLS) / 2;
      const oy = (canvas.height - pad * ROWS) / 2;
      const c = Math.floor((x - ox) / pad);
      const r = Math.floor((y - oy) / pad);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
      return { c, r };
    }
    let paintMode = null;
    function paintCell(c, r, force) {
      const i = idx(c, r);
      const grid = layers[activeLayer];
      if (force === 1 || force === 0) grid[i] = force;
      else grid[i] = grid[i] ? 0 : 1;
      draw(); save(); updateLayerButtons();
    }
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) return;
      const i = idx(cell.c, cell.r);
      paintMode = layers[activeLayer][i] ? 0 : 1;
      paintCell(cell.c, cell.r, paintMode);
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (paintMode == null) return;
      const cell = cellAt(e.clientX, e.clientY);
      if (cell) paintCell(cell.c, cell.r, paintMode);
    });
    const endPaint = () => { paintMode = null; };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);

    // Carousel / swipe handling preserved from v42 — edge zones only; do not alter thresholds.
    let swipeId = null, swipeX0 = 0, swipeY0 = 0, swipeT0 = 0, swipeMoved = false;
    function viaTouchEvents(e) { return e.pointerType === 'touch' && ('ontouchstart' in window); }
    function swipeStart(id, x, y) {
      swipeId = id; swipeX0 = x; swipeY0 = y; swipeT0 = performance.now(); swipeMoved = false; dragDx = 0;
    }
    function swipeMove(id, x, y) {
      if (id !== swipeId) return;
      const dx = x - swipeX0, dy = y - swipeY0;
      if (!swipeMoved && Math.hypot(dx, dy) > 8) swipeMoved = true;
      if (!swipeMoved) return;
      const box = homeBox();
      const w = box ? box.width : window.innerWidth;
      if (page === 0) {
        if (dx < 0) { dragDx = dx; setTrack(dx, w + 8 + dx, false); }
      } else {
        if (dx > 0) { dragDx = dx; setTrack(-w + dx, dx, false); }
      }
    }
    function swipeEnd(id, x) {
      if (id !== swipeId) return;
      const dx = (x == null ? 0 : x - swipeX0);
      const dt = Math.max(1, performance.now() - swipeT0);
      const vel = dx / dt;
      const box = homeBox();
      const w = box ? box.width : window.innerWidth;
      const thresh = Math.min(80, w * 0.22);
      let go = page;
      if (page === 0 && (dx < -thresh || vel < -0.4)) go = 1;
      if (page === 1 && (dx > thresh || vel > 0.4)) go = 0;
      swipeId = null; dragDx = null;
      setPage(go, true);
    }
    function edgeZone(x) {
      const m = 28;
      return x < m || x > (window.innerWidth - m);
    }
    window.addEventListener('touchstart', (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const t = e.changedTouches[0];
      if (!edgeZone(t.clientX) && !open) return;
      if (open || edgeZone(t.clientX)) swipeStart('t' + t.identifier, t.clientX, t.clientY);
    }, { capture: true, passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!e.changedTouches) return;
      for (const t of e.changedTouches) swipeMove('t' + t.identifier, t.clientX, t.clientY);
    }, { capture: true, passive: true });
    window.addEventListener('touchend', (e) => {
      if (!e.changedTouches) return;
      for (const t of e.changedTouches) swipeEnd('t' + t.identifier, t.clientX);
    }, { capture: true, passive: true });
    window.addEventListener('touchcancel', (e) => {
      if (!e.changedTouches) return;
      for (const t of e.changedTouches) swipeEnd('t' + t.identifier, null);
    }, { capture: true, passive: true });
    window.addEventListener('pointerdown', (e) => {
      if (viaTouchEvents(e)) return;
      if (!edgeZone(e.clientX) && !open) return;
      if (open || edgeZone(e.clientX)) swipeStart(e.pointerId, e.clientX, e.clientY);
    }, { capture: true, passive: true });
    window.addEventListener('pointermove', (e) => { if (!viaTouchEvents(e)) swipeMove(e.pointerId, e.clientX, e.clientY); }, { capture: true, passive: true });
    window.addEventListener('pointerup', (e) => { if (!viaTouchEvents(e)) swipeEnd(e.pointerId, e.clientX); }, { capture: true, passive: true });
    window.addEventListener('pointercancel', (e) => { if (!viaTouchEvents(e)) swipeEnd(e.pointerId, null); }, { capture: true, passive: true });
    window.addEventListener('resize', () => { dragDx = null; rest(false); resizeCanvas(); draw(); });

    load();
    knobRepaint.forEach((fn) => fn());
    updateLayerButtons();
    updateSoundButtons();
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
      const toggle = document.getElementById('tonepadToggle');
      if (toggle && !toggle.dataset.tpBound) {
        toggle.dataset.tpBound = '1';
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
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
