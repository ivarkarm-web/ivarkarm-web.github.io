/**
 * TonePad v51 — infinity carousel + Clear + per-layer sound modules (9 instruments).
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const COLS = 16;
const ROWS = 8;
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v36';
const LAYER_COUNT = 5;
const DEFAULT_SOUND = 'bloom';

const LAYER_THEMES = [
  { name: 'Amber', h: 42, s: 70, l: 52 }, // L1 warm gold
  { name: 'Jade', h: 150, s: 55, l: 48 }, // L2 green
  { name: 'Sky', h: 200, s: 65, l: 52 }, // L3 cyan-blue
  { name: 'Violet', h: 275, s: 55, l: 58 }, // L4 purple
  { name: 'Rose', h: 340, s: 60, l: 55 }, // L5 pink-red
];
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
  if (window.__tonepadMounting) {
    return window.__tonepadMounting;
  }
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
    let layer = null;
    let audioCtx = null;
    let bus = null;
    let anchor = 0;
    let lastVisStep = -1;
    let timer = 0;
    let raf = 0;
    let rootMidi = 50;

    function idx(c, r) {
      return r * COLS + c;
    }
    function layerHasNotes(i) {
      const g = layers[i];
      for (let n = 0; n < g.length; n++) {
        if (g[n]) {
          return true;
        }
      }
      return false;
    }
    function nextNonEmptyLayer(from) {
      const base = ((from % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
      for (let n = 1; n <= LAYER_COUNT; n++) {
        const i = (base + n) % LAYER_COUNT;
        if (layerHasNotes(i)) {
          return i;
        }
      }
      return base;
    }
    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(STORE) || 'null');
        if (!s) {
          return;
        }
        if (Array.isArray(s.layers)) {
          s.layers.forEach((cells, li) => {
            if (li >= LAYER_COUNT || !Array.isArray(cells)) {
              return;
            }
            cells.forEach((v, i) => {
              if (i < layers[li].length) {
                layers[li][i] = v ? 1 : 0;
              }
            });
          });
        }
        if (Number.isFinite(s.velocity)) {
          velocity = Math.max(0, Math.min(1, +s.velocity));
        }
        if (Number.isFinite(s.probability)) {
          probability = Math.max(0, Math.min(1, +s.probability));
        }
        if (Number.isFinite(s.humanize)) {
          humanize = Math.max(0, Math.min(1, +s.humanize));
        }
        if (Number.isFinite(s.activeLayer)) {
          activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, s.activeLayer | 0));
        }
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
        localStorage.setItem(
          STORE,
          JSON.stringify({
            layers: layers.map((l) => Array.from(l)),
            layerSounds: layerSounds.slice(),
            velocity,
            probability,
            humanize,
            activeLayer,
            version: 45,
          })
        );
      } catch (_) {}
    }
    function getSharedBpm() {
      try {
        const t = window.PionierLooper?.getTimingState?.();
        if (t && Number(t.bpm) > 0) {
          return Number(t.bpm);
        }
      } catch (_) {}
      try {
        const el = document.querySelector('.looper-bpm-value');
        const n = el ? parseInt(el.textContent, 10) : 0;
        if (n > 0) {
          return n;
        }
      } catch (_) {}
      return 92;
    }
    function stepDur() {
      return 60 / getSharedBpm() / 4;
    }
    function freqForRow(row) {
      const deg = PENT[row % PENT.length];
      const oct = Math.floor(row / PENT.length);
      return 440 * Math.pow(2, (rootMidi - 69 + deg + oct * 12) / 12);
    }
    function ensureAudio() {
      if (audioCtx) {
        return true;
      }
      try {
        audioCtx = getAudioContext?.() || new (window.AudioContext || window.webkitAudioContext)();
        const master = getAudioMaster?.() || audioCtx.destination;
        bus = audioCtx.createGain();
        bus.gain.value = 0.85;
        bus.connect(master);
        return true;
      } catch (_) {
        return false;
      }
    }
    function envGain(g, t0, peak, attack, sustain, release) {
      const life = attack + sustain + release;
      const p = Math.max(0.0002, peak);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p, t0 + attack);
      if (sustain > 0.01) {
        g.gain.exponentialRampToValueAtTime(p * 0.7, t0 + attack + sustain);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + life);
      return life;
    }
    function makePartial(type, freq, level, cents, t0, peak, attack, sustain, release, dest) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (cents) {
        osc.detune.setValueAtTime(cents, t0);
      }
      const life = envGain(g, t0, peak * level, attack, sustain, release);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + life + 0.06);
      return life;
    }
    function trigger(row, when, vel, soundId) {
      if (!audioCtx || !bus) {
        return;
      }
      const f = freqForRow(row);
      const t0 = Math.max(audioCtx.currentTime + 0.003, when);
      const v = Math.max(0.05, Math.min(1, vel === null ? 0.6 : vel));
      const id =
        soundId && SOUND_IDS.has(soundId) ? soundId : layerSounds[playLayer] || DEFAULT_SOUND;
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
        fil.frequency.exponentialRampToValueAtTime(
          Math.min(1800, f * 2.2),
          t0 + (attack + sustain + release) * 0.85
        );
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
        fil.frequency.exponentialRampToValueAtTime(
          Math.min(1200, f * 2.0),
          t0 + (attack + sustain + release) * 0.75
        );
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.28, 4, t0, peak, attack, sustain, release * 0.8, mix);
        makePartial('triangle', f * 1.003, 0.18, -2, t0, peak, attack, sustain, release, mix);
        makePartial(
          'sine',
          f * 14.5,
          0.04 * v,
          0,
          t0,
          peak,
          attack * 0.5,
          0.02,
          release * 0.2,
          mix
        );
      } else if (id === 'warmpad') {
        const attack = 0.22 + (1 - v) * 0.25;
        const sustain = 1.1 + v * 1.2;
        const release = 2.8 + v * 1.5;
        const peak = 0.04 + v * 0.07;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.5, t0);
        fil.frequency.setValueAtTime(Math.min(2800, f * 3.8), t0);
        fil.frequency.exponentialRampToValueAtTime(
          Math.min(900, f * 1.6),
          t0 + (attack + sustain + release) * 0.9
        );
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
        fil.frequency.exponentialRampToValueAtTime(
          Math.min(180, ff * 2.2),
          t0 + (attack + sustain + release) * 0.7
        );
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
      if (!playing || !audioCtx) {
        return;
      }
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
        if (!gPlay) {
          continue;
        }
        const when = anchor + lastVisStep * sd;
        for (let row = 0; row < ROWS; row++) {
          if (!gPlay[idx(step, row)]) {
            continue;
          }
          if (Math.random() > probability) {
            continue;
          }
          const accent = step % 4 === 0 ? 1.15 : step % 2 === 0 ? 1.05 : 0.92;
          const baseVel = 0.35 + velocity * 0.55;
          const jitterV = (Math.random() - 0.5) * 2 * humanize * 0.2;
          const jitterT = (Math.random() - 0.5) * 2 * humanize * sd * 0.35;
          trigger(
            row,
            when + jitterT,
            Math.max(0.05, Math.min(1, baseVel * accent + jitterV)),
            layerSounds[playLayer]
          );
        }
      }
    }
    function tick() {
      if (!playing) {
        return;
      }
      scheduleAhead();
      timer = window.setTimeout(tick, 25);
    }
    function updatePlayButton() {
      const playBtn = layer ? layer.querySelector('[data-play]') : null;
      if (playBtn) {
        playBtn.textContent = playing ? 'Stop' : 'Play';
      }
    }
    function start() {
      if (playing) {
        return;
      }
      if (!ensureAudio()) {
        return;
      }
      try {
        resumeAudio?.();
      } catch (_) {}
      try {
        audioCtx.resume?.();
      } catch (_) {}
      playing = true;
      playLayer = layerHasNotes(activeLayer) ? activeLayer : nextNonEmptyLayer(activeLayer);
      playLayer = ((playLayer % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
      anchor = audioCtx.currentTime + 0.05;
      lastVisStep = -1;
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      timer = window.setTimeout(tick, 20);
      updateLayerButtons();
      updatePlayButton();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      draw();
    }
    function stop() {
      playing = false;
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      updatePlayButton();
      draw();
    }

    if (!document.getElementById('tonepad-css-v45')) {
      const style = document.createElement('style');
      style.id = 'tonepad-css-v45';
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
        '.tonepad-layer-btn{min-width:28px;height:28px;border-radius:6px;border:1px solid rgba(160,170,160,.35);background:rgba(20,24,20,.9);color:#9aab9e;font:600 11px system-ui;cursor:pointer;transition:border-color .15s,box-shadow .15s,color .15s,background .15s}',
        '.tonepad-layer-btn.is-active{border-color:var(--layer-accent,#e1cc8b);color:var(--layer-accent,#f0d99a);background:rgba(40,36,20,.95);box-shadow:0 0 10px color-mix(in srgb,var(--layer-accent,#e1cc8b) 35%,transparent)}',
        '.tonepad-layer-btn.is-empty{opacity:.4}',
        '.tonepad-play{min-width:52px;height:28px;border-radius:6px;border:1px solid rgba(120,200,140,.5);background:rgba(30,50,35,.9);color:#b8e0c0;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-clear{min-width:44px;height:28px;border-radius:6px;border:1px solid rgba(200,120,100,.45);background:rgba(50,24,20,.9);color:#e8b0a0;font:600 11px system-ui;cursor:pointer}',
        '.tonepad-canvas{flex:1;width:100%;min-height:100px;touch-action:none;border-radius:8px;background:#0a0c0a}',
        '.tonepad-sounds{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:2px 0 0;flex-shrink:0}',
        '@media (max-width:400px){.tonepad-sounds{grid-template-columns:repeat(3,minmax(0,1fr))}}',
        '.tonepad-sound-btn{min-height:28px;padding:4px 2px;border-radius:8px;border:1px solid rgba(160,170,160,.28);background:rgba(16,20,16,.92);color:#9aab9e;font:600 9px/1.15 system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;touch-action:manipulation;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.tonepad-sound-btn.is-active{border-color:rgba(240,217,154,.95);color:#fff3c4;background:rgba(48,42,16,.98);box-shadow:0 0 0 1px rgba(240,217,154,.45),0 0 12px rgba(240,217,154,.55),0 0 28px rgba(225,190,80,.35);text-shadow:0 0 8px rgba(240,217,154,.5);animation:tp-sound-pulse 2.4s ease-in-out infinite}',
        '@keyframes tp-sound-pulse{0%,100%{box-shadow:0 0 0 1px rgba(240,217,154,.4),0 0 10px rgba(240,217,154,.4),0 0 22px rgba(225,190,80,.25)}50%{box-shadow:0 0 0 1px rgba(240,217,154,.55),0 0 16px rgba(240,217,154,.7),0 0 36px rgba(225,190,80,.45)}}',
      ].join('');
      document.head.appendChild(style);
    }

    layer = document.getElementById('tonepadLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'tonepadLayer';
      layer.className = 'tonepad-layer';
      layer.setAttribute('role', 'region');
      layer.setAttribute('aria-label', 'Sequencer');
      // The carousel is parked off-screen while closed. `inert` keeps its
      // controls out of the tab order and accessibility tree without hiding
      // the element from layout (which would break the slide transition).
      layer.inert = true;
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    layer.innerHTML =
      '<div class="tonepad-chrome">' +
      '<button type="button" class="tonepad-play" data-play>Play</button>' +
      '<button type="button" class="tonepad-clear" data-clear title="Clear active layer">Clear</button>' +
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
        const th = LAYER_THEMES[i] || LAYER_THEMES[0];
        const accent = 'hsl(' + th.h + ',' + th.s + '%,' + Math.min(70, th.l + 8) + '%)';
        b.style.setProperty('--layer-accent', accent);
        b.style.borderColor =
          'hsla(' +
          th.h +
          ',' +
          th.s +
          '%,' +
          th.l +
          '%,' +
          (i === activeLayer ? '0.9' : '0.4') +
          ')';
        b.style.color = i === activeLayer ? accent : 'hsla(' + th.h + ',40%,70%,0.75)';
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
          try {
            resumeAudio?.();
            audioCtx?.resume?.();
          } catch (_) {}
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
    layer.querySelector('[data-clear]').addEventListener('click', (e) => {
      e.stopPropagation();
      layers[activeLayer].fill(0);
      draw();
      updateLayerButtons();
      save();
    });
    layer.querySelector('[data-play]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (playing) {
        stop();
      } else {
        start();
      }
    });

    const knobRepaint = [];
    function wireKnob(key, getV, setV) {
      const root = layer.querySelector('[data-k="' + key + '"]');
      const dial = root.querySelector('[data-dial]');
      const val = root.querySelector('[data-val]');
      const kc = dial.querySelector('canvas');
      const kg = kc ? kc.getContext('2d') : null;
      let drag = false,
        y0 = 0,
        v0 = 0;
      const paint = () => {
        const t = Math.max(0, Math.min(1, getV()));
        val.textContent = String(Math.round(t * 100));
        if (!kg) {
          return;
        }
        const s = kc.width,
          cx = s / 2,
          cy = s / 2,
          rad = s * 0.34;
        const a0 = Math.PI * 0.75,
          span = Math.PI * 1.5,
          a1 = a0 + span * t;
        kg.clearRect(0, 0, s, s);
        kg.lineWidth = s * 0.1;
        kg.lineCap = 'round';
        kg.strokeStyle = 'rgba(120,130,118,.35)';
        kg.beginPath();
        kg.arc(cx, cy, rad, a0, a0 + span);
        kg.stroke();
        if (t > 0) {
          kg.strokeStyle = '#e1cc8b';
          kg.beginPath();
          kg.arc(cx, cy, rad, a0, a1);
          kg.stroke();
        }
        kg.fillStyle = '#f0d99a';
        kg.beginPath();
        kg.arc(cx + Math.cos(a1) * rad, cy + Math.sin(a1) * rad, s * 0.07, 0, Math.PI * 2);
        kg.fill();
      };
      knobRepaint.push(paint);
      dial.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        drag = true;
        y0 = e.clientY;
        v0 = getV();
        dial.setPointerCapture?.(e.pointerId);
      });
      dial.addEventListener('pointermove', (e) => {
        if (!drag) {
          return;
        }
        setV(Math.max(0, Math.min(1, v0 + (y0 - e.clientY) / 120)));
        paint();
        save();
      });
      const end = () => {
        drag = false;
      };
      dial.addEventListener('pointerup', end);
      dial.addEventListener('pointercancel', end);
      paint();
    }
    wireKnob(
      'vel',
      () => velocity,
      (v) => {
        velocity = v;
      }
    );
    wireKnob(
      'prob',
      () => probability,
      (v) => {
        probability = v;
      }
    );
    wireKnob(
      'hum',
      () => humanize,
      (v) => {
        humanize = v;
      }
    );

    function homeBox() {
      const pan = document.getElementById('pan');
      const stage = document.getElementById('stage');
      if (!pan || !stage) {
        return null;
      }
      const sr = stage.getBoundingClientRect();
      return {
        left: sr.left + pan.offsetLeft,
        top: sr.top + pan.offsetTop,
        width: pan.offsetWidth || sr.width,
        height: pan.offsetHeight || sr.height,
      };
    }
    function place() {
      const box = homeBox();
      if (!box) {
        return;
      }
      layer.style.left = box.left + 'px';
      layer.style.top = box.top + 'px';
      layer.style.width = box.width + 'px';
      layer.style.height = box.height + 'px';
    }
    function setTrack(panX, layerX, animate) {
      const pan = document.getElementById('pan');
      const dur = animate ? '0.55s' : '0s';
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      // Scoped to the two cards (not <html>) so a drag doesn't restyle the whole page every frame.
      [pan, layer].forEach((el) => {
        if (!el) {
          return;
        }
        el.style.setProperty('--tp-tr', dur);
        el.style.setProperty('--tp-ease', ease);
      });
      // Safari/WebKit: make sure the new duration is in effect before the target value changes.
      if (animate) {
        void layer.offsetWidth;
      }
      if (pan) {
        pan.style.setProperty('--tp-x', panX + 'px');
        pan.style.transform = 'translate3d(' + panX + 'px,0,0)';
      }
      layer.style.setProperty('--tp-lx', layerX + 'px');
      layer.style.transform = 'translate3d(' + layerX + 'px,0,0)';
    }
    function parkDistances(box) {
      const w = Math.max(1, box.width);
      return {
        w,
        parkRight: Math.ceil(Math.max(w + 24, window.innerWidth - box.left + 16)),
        parkLeft: -Math.ceil(Math.max(w + 24, box.left + w + 16)),
      };
    }

    /*
     * Infinity ring: handpan (page 0) <-> sequencer (page 1), both directions.
     * dir = +1 -> swipe LEFT  (other page enters from the right, current exits left)
     * dir = -1 -> swipe RIGHT (other page enters from the left,  current exits right)
     * `parked` is the side (+1 right / -1 left) where the hidden page waits at rest,
     * so the next swipe never has to fly a page across the screen.
     */
    let parked = 1;
    let dragDir = 1;

    // Visible page = `page`; the other one is hidden.
    function applyTrack(visX, hidX, animate) {
      if (page === 0) {
        setTrack(visX, hidX, animate);
      } else {
        setTrack(hidX, visX, animate);
      }
    }
    function sideX(side, box) {
      const d = parkDistances(box);
      return side > 0 ? d.parkRight : d.parkLeft;
    }
    // Resting layout for the current page.
    function rest(animate) {
      const box = homeBox();
      if (!box) {
        return;
      }
      place();
      applyTrack(0, sideX(parked, box), animate);
    }
    // Live finger-follow while dragging.
    function shiftCarousel(animate) {
      const box = homeBox();
      if (!box) {
        return;
      }
      place();
      const dx = dragDx !== null ? dragDx : 0;
      const { w, parkRight, parkLeft } = parkDistances(box);
      const dir = dx < 0 ? 1 : dx > 0 ? -1 : dragDir;
      dragDir = dir;
      const p = Math.min(1, Math.abs(dx) / w);
      const exitX = dir > 0 ? parkLeft : parkRight;
      const enterX = dir > 0 ? parkRight : parkLeft;
      applyTrack(exitX * p, enterX * (1 - p), animate);
      // The layer takes pointer events once it is mostly on screen.
      const layerLead = page === 0 ? p > 0.3 : p < 0.7;
      document.body.classList.toggle('tonepad-open', layerLead);
    }
    function setPage(next, animate, dir) {
      const prev = page;
      const wasDragging = dragDx !== null;
      const d = dir === -1 ? -1 : dir === 1 ? 1 : dragDir;
      page = next ? 1 : 0;
      dragDx = null;
      open = page === 1;
      document.body.classList.toggle('tonepad-open', open);
      if (open) {
        layer.inert = false;
        layer.removeAttribute('aria-hidden');
      } else {
        // Move focus out before making the layer inert, otherwise focus is
        // dropped to <body> and keyboard users lose their place.
        try {
          if (layer.contains(document.activeElement)) {
            document.getElementById('tonepadToggle')?.focus({ preventScroll: true });
          }
        } catch (_) {}
        layer.inert = true;
        layer.setAttribute('aria-hidden', 'true');
      }
      const box = homeBox();
      if (!box) {
        return;
      }
      place();
      if (page !== prev) {
        // The old page leaves the way the finger moved; the new one arrives from the opposite side.
        const exitX = sideX(-d, box);
        const enterX = sideX(d, box);
        if (animate && !wasDragging) {
          // Programmatic switch (button / API): start the new page off-screen, then glide in.
          applyTrack(enterX, 0, false);
          void layer.offsetWidth;
        }
        applyTrack(0, exitX, animate);
        parked = -d;
      } else {
        // No page change (cancelled drag or initial layout).
        if (wasDragging) {
          parked = d;
        }
        rest(animate);
      }
      if (page === 1) {
        resizeCanvas();
        draw();
        updateLayerButtons();
        updateSoundButtons();
        updatePlayButton();
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
      if (!box) {
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Size the bitmap from the canvas's real laid-out box (unaffected by the carousel's translate).
      // A fixed "box - 56" guess ignored the header wrapping to two rows, so the flex-sized canvas
      // got stretched on screen and square pads rendered as rectangles.
      const cssW = canvas.clientWidth || box.width - 16;
      const cssH = canvas.clientHeight || box.height - 56;
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    // Square pads: cell size is set by the tighter axis and the grid is centred in the canvas.
    function gridMetrics(w, h) {
      const pad = Math.max(4, Math.min(w, h) * 0.02);
      const gap = Math.max(1, Math.min(w, h) * 0.01);
      const cell = Math.max(
        1,
        Math.min((w - pad * 2 - gap * (COLS - 1)) / COLS, (h - pad * 2 - gap * (ROWS - 1)) / ROWS)
      );
      const gw = cell * COLS + gap * (COLS - 1);
      const gh = cell * ROWS + gap * (ROWS - 1);
      return { gap, cell, x0: (w - gw) / 2, y0: (h - gh) / 2 };
    }
    function draw() {
      if (!g) {
        return;
      }
      const w = canvas.width,
        h = canvas.height;
      g.clearRect(0, 0, w, h);
      const m = gridMetrics(w, h);
      const gap = m.gap,
        cw = m.cell,
        ch = m.cell;
      const gridData = layers[activeLayer];
      let visStep = -1;
      if (playing && audioCtx) {
        const sd = stepDur();
        const total = (audioCtx.currentTime - anchor) / sd;
        visStep = ((Math.floor(total) % COLS) + COLS) % COLS;
      }
      const theme = LAYER_THEMES[activeLayer] || LAYER_THEMES[0];
      const rad = Math.max(2, Math.min(6, cw * 0.18));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = m.x0 + c * (cw + gap);
          const y = m.y0 + r * (ch + gap);
          const on = gridData[idx(c, r)];
          const rowShift = (r / Math.max(1, ROWS - 1)) * 18 - 6;
          if (on) {
            const grad = g.createLinearGradient(x, y, x, y + ch);
            grad.addColorStop(
              0,
              'hsla(' +
                (theme.h + rowShift) +
                ',' +
                theme.s +
                '%,' +
                Math.min(72, theme.l + 12) +
                '%,0.95)'
            );
            grad.addColorStop(
              1,
              'hsla(' +
                (theme.h + rowShift - 8) +
                ',' +
                (theme.s + 5) +
                '%,' +
                Math.max(28, theme.l - 10) +
                '%,0.9)'
            );
            g.fillStyle = grad;
          } else if (c === visStep) {
            g.fillStyle = 'hsla(' + theme.h + ',25%,28%,0.55)';
          } else {
            g.fillStyle = 'rgba(28,32,30,0.92)';
          }
          g.beginPath();
          if (g.roundRect) {
            g.roundRect(x, y, cw, ch, rad);
          } else {
            g.rect(x, y, cw, ch);
          }
          g.fill();
          if (on) {
            g.strokeStyle =
              'hsla(' + theme.h + ',' + theme.s + '%,' + Math.min(80, theme.l + 20) + '%,0.45)';
            g.lineWidth = 1;
            g.stroke();
          }
          if (c === visStep) {
            g.strokeStyle = 'hsla(' + theme.h + ',70%,75%,0.85)';
            g.lineWidth = 1.5;
            g.beginPath();
            if (g.roundRect) {
              g.roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, rad);
            } else {
              g.rect(x + 0.5, y + 0.5, cw - 1, ch - 1);
            }
            g.stroke();
          }
        }
      }
      if (playing) {
        raf = requestAnimationFrame(draw);
      }
    }

    let mode = null,
      pid = null;
    const seen = new Set();
    function cellAt(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      const x = (cx - rect.left) * (canvas.width / rect.width);
      const y = (cy - rect.top) * (canvas.height / rect.height);
      const m = gridMetrics(canvas.width, canvas.height);
      const c = Math.floor((x - m.x0) / (m.cell + m.gap));
      const r = Math.floor((y - m.y0) / (m.cell + m.gap));
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) {
        return null;
      }
      return { c, r };
    }
    function applyAt(cx, cy) {
      const hit = cellAt(cx, cy);
      if (!hit) {
        return;
      }
      const key = hit.c + ':' + hit.r;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const i = idx(hit.c, hit.r);
      if (mode === 'erase') {
        layers[activeLayer][i] = 0;
      } else if (mode === 'paint') {
        layers[activeLayer][i] = 1;
      } else {
        const on = !layers[activeLayer][i];
        mode = on ? 'paint' : 'erase';
        layers[activeLayer][i] = on ? 1 : 0;
      }
      draw();
      save();
      updateLayerButtons();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!open) {
        return;
      }
      // Edge touches belong to the carousel swipe, not to cell painting.
      if (e.clientX >= window.innerWidth - EDGE || e.clientX <= EDGE) {
        return;
      }
      e.preventDefault();
      pid = e.pointerId;
      mode = null;
      seen.clear();
      canvas.setPointerCapture?.(e.pointerId);
      applyAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!open || e.pointerId !== pid) {
        return;
      }
      applyAt(e.clientX, e.clientY);
    });
    const endPaint = () => {
      pid = null;
      mode = null;
      seen.clear();
    };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);

    const EDGE = 40;
    const BUILD = 'tp42';
    const SWIPE_IGNORE =
      '#looperRail,.topbar,#pionierBottomDock,#fxPanel,button,a,input,.tonepad-knob-dial';
    const HAS_TOUCH = 'ontouchstart' in window;
    let swipe = null;

    /* ---- opt-in on-screen readout: add ?tpdebug=1 to the URL, or tap the sequencer button 5x fast ---- */
    let debugOn = false,
      hud = null;
    const dbgLines = [];
    try {
      const q = new URLSearchParams(location.search).get('tpdebug');
      if (q === '1') {
        localStorage.setItem('tpdebug', '1');
      }
      if (q === '0') {
        localStorage.removeItem('tpdebug');
      }
      debugOn = localStorage.getItem('tpdebug') === '1';
    } catch (_) {}
    function dbg(msg) {
      if (!debugOn) {
        return;
      }
      if (!hud) {
        hud = document.createElement('div');
        hud.style.cssText =
          'position:fixed;left:4px;top:56px;z-index:99999;pointer-events:none;font:10px/1.35 ui-monospace,Menlo,monospace;color:#e1cc8b;background:rgba(0,0,0,.62);padding:4px 6px;border-radius:6px;max-width:92vw;white-space:pre-wrap';
        document.body.appendChild(hud);
      }
      dbgLines.push(msg);
      while (dbgLines.length > 8) {
        dbgLines.shift();
      }
      hud.textContent =
        BUILD +
        ' · ' +
        (HAS_TOUCH ? 'touch' : 'pointer') +
        ' · page ' +
        page +
        '\n' +
        dbgLines.join('\n');
    }
    (function wireDebugToggle() {
      const btn = document.getElementById('tonepadToggle');
      if (!btn) {
        return;
      }
      let taps = [];
      btn.addEventListener(
        'click',
        () => {
          const now = Date.now();
          taps = taps.filter((t) => now - t < 2500).concat(now);
          if (taps.length >= 5) {
            taps = [];
            debugOn = !debugOn;
            try {
              debugOn ? localStorage.setItem('tpdebug', '1') : localStorage.removeItem('tpdebug');
            } catch (_) {}
            if (hud) {
              hud.remove();
              hud = null;
            }
            dbgLines.length = 0;
            dbg('debug on');
          }
        },
        true
      );
    })();
    if (debugOn) {
      dbg('debug on');
    }

    function abortSwipe(why) {
      const was = swipe;
      swipe = null;
      if (was && was.active) {
        setPage(page, true, was.dir);
      }
      dbg('abort ' + why);
    }

    /*
     * One gesture engine, fed by touch events on touch screens (reliable on iOS) and by pointer
     * events for mouse / pen. Returns true when the touch began in a screen-edge zone.
     */
    function swipeBegin(id, x, y, target) {
      if (swipe) {
        // A previous release event can be lost (system gesture, app switch). Don't stay stuck.
        if (performance.now() - swipe.tLast < 1200) {
          return false;
        }
        abortSwipe('stale');
      }
      if (target && target.closest && target.closest(SWIPE_IGNORE)) {
        return false;
      }
      const onRight = x >= window.innerWidth - EDGE;
      const onLeft = x <= EDGE;
      const lr = open ? layer.getBoundingClientRect() : null;
      const onLayerLeft = !!(lr && x >= lr.left && x <= lr.left + Math.max(EDGE, lr.width * 0.35));
      if (!onRight && !onLeft && !onLayerLeft) {
        return false;
      }
      const now = performance.now();
      // Right edge always means "swipe left" (next page), on either page -> infinity loop.
      swipe = {
        x,
        y,
        id,
        dir: onRight ? 1 : -1,
        active: false,
        lastX: x,
        lastY: y,
        tLast: now,
        pts: [[x, now]],
      };
      dbg(
        'begin x=' +
          Math.round(x) +
          ' dir=' +
          swipe.dir +
          ' zone=' +
          (onRight ? 'R' : onLeft ? 'L' : 'layer')
      );
      return onRight || onLeft;
    }
    function swipeMove(id, x, y) {
      if (!swipe || swipe.id !== id) {
        return;
      }
      const now = performance.now();
      swipe.lastX = x;
      swipe.lastY = y;
      swipe.tLast = now;
      swipe.pts.push([x, now]);
      if (swipe.pts.length > 6) {
        swipe.pts.shift();
      }
      const dx = x - swipe.x;
      const dy = y - swipe.y;
      if (!swipe.active) {
        const adx = Math.abs(dx),
          ady = Math.abs(dy);
        if (adx < 8 && ady < 8) {
          return;
        }
        const toward = swipe.dir === 1 ? dx < 0 : dx > 0;
        // A thumb leaving the edge starts diagonal: be forgiving, only bail when clearly something else.
        if (toward && adx >= 8 && adx > ady * 0.7) {
          swipe.active = true;
          dragDir = swipe.dir;
          dbg('active dx=' + Math.round(dx) + ' dy=' + Math.round(dy));
        } else if ((ady > 32 && ady > adx * 1.5) || (!toward && adx > 32)) {
          swipe = null;
          dbg('dropped dx=' + Math.round(dx) + ' dy=' + Math.round(dy));
          return;
        } else {
          return;
        }
      }
      const box = homeBox();
      const w = box ? box.width : window.innerWidth;
      dragDx =
        swipe.dir === 1 ? Math.max(-w * 1.2, Math.min(0, dx)) : Math.min(w * 1.2, Math.max(0, dx));
      shiftCarousel(false);
    }
    function swipeEnd(id, x) {
      if (!swipe || swipe.id !== id) {
        return;
      }
      const endX = x === null ? swipe.lastX : x; // lost/cancelled touch: use the last real position
      const dx = endX - swipe.x;
      const dir = swipe.dir;
      const was = swipe.active;
      const pts = swipe.pts;
      swipe = null;
      const box = homeBox();
      const w = box ? box.width : 240;
      const dist = dir === 1 ? -dx : dx; // distance travelled in the swipe direction
      const thresh = Math.min(32, w * 0.1);
      let v = 0; // px/ms over the last ~100ms
      if (pts.length > 1) {
        const last = pts[pts.length - 1];
        let first = pts[0];
        for (let i = pts.length - 1; i >= 0; i--) {
          first = pts[i];
          if (last[1] - pts[i][1] > 100) {
            break;
          }
        }
        const dt = last[1] - first[1];
        if (dt > 0) {
          v = ((dir === 1 ? -1 : 1) * (last[0] - first[0])) / dt;
        }
      }
      const commit = was && (dist > thresh || (dist > 14 && v > 0.3));
      dbg(
        'end dist=' +
          Math.round(dist) +
          ' v=' +
          v.toFixed(2) +
          ' -> ' +
          (commit ? 'SWITCH' : was ? 'back' : 'ignored')
      );
      if (commit) {
        setPage(page === 0 ? 1 : 0, true, dir);
      } else {
        setPage(page, true, dir);
      }
    }

    const findTouch = (list, id) => {
      for (let i = 0; i < list.length; i++) {
        if ('t' + list[i].identifier === id) {
          return list[i];
        }
      }
      return null;
    };
    if (HAS_TOUCH) {
      window.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) {
            return;
          }
          const t = e.touches[0];
          const edge = swipeBegin('t' + t.identifier, t.clientX, t.clientY, e.target);
          // Claim edge touches so the browser never turns them into a page pan / back gesture.
          if (edge && e.cancelable) {
            e.preventDefault();
          }
        },
        { capture: true, passive: false }
      );
      window.addEventListener(
        'touchmove',
        (e) => {
          if (!swipe || typeof swipe.id !== 'string') {
            return;
          }
          const t = findTouch(e.touches, swipe.id);
          if (!t) {
            return;
          }
          swipeMove(swipe.id, t.clientX, t.clientY);
          if (swipe && swipe.active && e.cancelable) {
            e.preventDefault();
          }
        },
        { capture: true, passive: false }
      );
      const tEnd = (e) => {
        if (!swipe || typeof swipe.id !== 'string') {
          return;
        }
        const t = findTouch(e.changedTouches, swipe.id);
        if (!t) {
          return;
        }
        swipeEnd(swipe.id, e.type === 'touchcancel' ? null : t.clientX);
      };
      window.addEventListener('touchend', tEnd, { capture: true, passive: true });
      window.addEventListener('touchcancel', tEnd, { capture: true, passive: true });
    }
    // Mouse / pen (and touch on devices without touch events).
    const viaTouchEvents = (e) => HAS_TOUCH && e.pointerType === 'touch';
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!viaTouchEvents(e)) {
          swipeBegin(e.pointerId, e.clientX, e.clientY, e.target);
        }
      },
      { capture: true, passive: true }
    );
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!viaTouchEvents(e)) {
          swipeMove(e.pointerId, e.clientX, e.clientY);
        }
      },
      { capture: true, passive: true }
    );
    window.addEventListener(
      'pointerup',
      (e) => {
        if (!viaTouchEvents(e)) {
          swipeEnd(e.pointerId, e.clientX);
        }
      },
      { capture: true, passive: true }
    );
    window.addEventListener(
      'pointercancel',
      (e) => {
        if (!viaTouchEvents(e)) {
          swipeEnd(e.pointerId, null);
        }
      },
      { capture: true, passive: true }
    );
    window.addEventListener('resize', () => {
      dragDx = null;
      rest(false);
      resizeCanvas();
      draw();
    });

    load();
    knobRepaint.forEach((fn) => fn());
    updateLayerButtons();
    updateSoundButtons();
    updatePlayButton();
    setPage(0, false);
    resizeCanvas();
    draw();

    const api = {
      open: () => setPage(1, true),
      close: () => setPage(0, true),
      toggle: () => setPage(page === 1 ? 0 : 1, true),
      start,
      stop,
      isPlaying: () => playing,
    };
    window.PionierTonepad = api;

    try {
      const btn = document.getElementById('tonepadToggle');
      if (btn && !btn.dataset.tpWired) {
        btn.dataset.tpWired = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
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
