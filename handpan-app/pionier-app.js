/**
 * pionier-app.js — from-scratch handpan UI
 * 9-note radial · interval scales · base note + octave transposition
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './js/audio-core.js';
import { VOICE_PRESETS, resolveVoiceIndex } from './js/voice-presets.js';

const SCALES = [
  { id: 'celtic-minor', label: 'Celtic Minor', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'kurdan-integral', label: 'Kurdan / Integral', intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19] },
  { id: 'hijaz', label: 'Hijaz', intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19] },
  { id: 'pygmy', label: 'Pygmy', intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24] },
  { id: 'amara', label: 'Amara', intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22] },
  { id: 'akebono', label: 'AkeBono', intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24] },
  { id: 'equinox', label: 'Equinox', intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24] },
  { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22] },
  { id: 'aeolian', label: 'Aeolian', intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19] },
  { id: 'major-sabye', label: 'Major / Sabye', intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23] }
];

const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135]; // degrees, bottom-first clockwise
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOTS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
/** Base MIDI for root letter at octave 3 (C3=48 … B3=59), then + octaveOffset*12 */
function rootToMidi(rootIndex, octaveOffset) {
  // C3 = 48
  return 48 + rootIndex + octaveOffset * 12;
}

// —— State ——
const state = {
  scaleIndex: 0,
  rootIndex: 2, // D
  octaveOffset: 0,
  voiceIndex: 0,
  notes: [],
  fields: [],
  glow: new Float32Array(9),
  pointers: new Map(), // pointerId -> note index
  fx: { tone: true, pulse: false, drone: false, space: false }
};

function rebuildNotes() {
  const scale = SCALES[state.scaleIndex];
  const base = rootToMidi(state.rootIndex, state.octaveOffset);
  state.notes = scale.intervals.map((iv, i) => {
    const midi = base + iv;
    const isDing = i === 0;
    const angle = isDing ? 0 : RING_ANGLES[i - 1];
    return {
      index: i,
      midi,
      name: midiName(midi),
      freq: mtof(midi),
      kind: isDing ? 'ding' : 'ring',
      angle,
      key: KEYS[i]
    };
  });
  updateLabels();
  layoutFields();
  draw();
}

function updateLabels() {
  document.getElementById('scaleLabel').textContent = SCALES[state.scaleIndex].label;
  document.getElementById('rootLabel').textContent = ROOTS[state.rootIndex];
  const o = state.octaveOffset;
  document.getElementById('octLabel').textContent = o === 0 ? '0' : (o > 0 ? '+' + o : String(o));
  document.getElementById('voiceName').textContent = VOICE_PRESETS[state.voiceIndex]?.name || 'Steel';
}

// —— Audio engine ——
const engine = {
  ctx: null,
  bus: null,
  voices: new Map(),
  noise: null,
  droneNodes: null,

  ensure() {
    if (this.ctx) { resumeAudio(); return true; }
    this.ctx = getAudioContext();
    if (!this.ctx) return false;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    this.bus.connect(comp);
    comp.connect(getAudioMaster());
    const nlen = Math.floor(this.ctx.sampleRate * 0.1);
    this.noise = this.ctx.createBuffer(1, nlen, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    resumeAudio();
    return true;
  },

  strike(idx, vel = 0.75) {
    if (!this.ensure()) return;
    const note = state.notes[idx];
    if (!note) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.002;
    vel = Math.max(0.2, Math.min(1, vel));

    const prev = this.voices.get(idx);
    if (prev) this.releaseVoice(prev, t, 0.03);

    const preset = VOICE_PRESETS[state.voiceIndex] || VOICE_PRESETS[0];
    const f = note.freq;
    const out = ctx.createGain();
    out.gain.value = 1;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = note.kind === 'ding' ? 0 : Math.sin((note.angle * Math.PI) / 180) * 0.45;
      out.connect(pan); pan.connect(this.bus);
    } else out.connect(this.bus);

    const T0 = Math.max(1.6, 5.8 - 1.0 * Math.log(f / 164.81) / Math.LN2);
    const baseG = 0.18 + 0.14 * vel;
    const oscs = [];
    const gains = [0.5, 0.3, 0.16, 0.09, 0.04];
    preset.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = preset.wave || 'sine';
      const det = (i % 2 ? -1 : 1) * (preset.spread || 0.006) * (i > 1 ? 0.6 : 1);
      osc.frequency.value = f * ratio * (1 + det);
      const g = ctx.createGain();
      const peak = baseG * (gains[i] || 0.03) * (state.fx.tone ? 1 : 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + T0 * (preset.decay / 6.2) * (1 - i * 0.08));
      osc.connect(g); g.connect(out);
      osc.start(t);
      osc.stop(t + T0 + 0.15);
      oscs.push(osc);
    });

    // strike noise
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * (preset.noiseRatio || 3.5), 6000);
    bp.Q.value = preset.noiseQ || 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime((preset.noiseLevel || 0.15) * vel, t + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + (preset.noiseDecay || 0.05));
    src.connect(bp); bp.connect(ng); ng.connect(out);
    src.start(t); src.stop(t + 0.08);

    const voice = { idx, out, oscs, released: false };
    oscs[0].onended = () => { this.voices.delete(idx); try { out.disconnect(); } catch (_) {} };
    this.voices.set(idx, voice);
    state.glow[idx] = 1;
  },

  releaseVoice(voice, t, tc) {
    if (!voice || voice.released) return;
    voice.released = true;
    try {
      voice.out.gain.cancelScheduledValues(t);
      voice.out.gain.setTargetAtTime(0, t, tc);
    } catch (_) {}
  },

  damp(idx) {
    const v = this.voices.get(idx);
    if (!v || !this.ctx) return;
    this.releaseVoice(v, this.ctx.currentTime, 0.05);
  },

  setDrone(on) {
    if (!this.ensure()) return;
    if (!on) {
      if (this.droneNodes) {
        const t = this.ctx.currentTime;
        try { this.droneNodes.gain.gain.setTargetAtTime(0, t, 0.15); } catch (_) {}
        setTimeout(() => {
          try { this.droneNodes.osc.stop(); this.droneNodes.gain.disconnect(); } catch (_) {}
          this.droneNodes = null;
        }, 600);
      }
      return;
    }
    if (this.droneNodes) return;
    const note = state.notes[0];
    if (!note) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note.freq * 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.3);
    osc.connect(g); g.connect(this.bus);
    osc.start();
    this.droneNodes = { osc, gain: g };
  }
};

// —— Canvas layout & draw ——
const canvas = document.getElementById('pan');
const ctx2 = canvas.getContext('2d');
let W = 800, H = 800, R = 0, CX = 0, CY = 0;

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.round(rect.width * dpr);
  H = Math.round(rect.height * dpr);
  canvas.width = W; canvas.height = H;
  CX = W / 2; CY = H / 2;
  R = Math.min(W, H) * 0.46;
  layoutFields();
  draw();
}

function layoutFields() {
  state.fields = state.notes.map((n) => {
    if (n.kind === 'ding') {
      return { i: n.index, x: CX, y: CY, rx: R * 0.2, ry: R * 0.2 };
    }
    const a = (n.angle * Math.PI) / 180;
    const d = R * 0.58;
    return {
      i: n.index,
      x: CX + Math.sin(a) * d,
      y: CY - Math.cos(a) * d,
      rx: R * 0.175,
      ry: R * 0.155
    };
  });
}

function draw() {
  ctx2.clearRect(0, 0, W, H);
  // shell
  const g = ctx2.createRadialGradient(CX - R * 0.25, CY - R * 0.3, R * 0.05, CX, CY, R);
  g.addColorStop(0, '#2a2b30');
  g.addColorStop(0.55, '#15161a');
  g.addColorStop(1, '#0b0b0d');
  ctx2.fillStyle = g;
  ctx2.beginPath();
  ctx2.arc(CX, CY, R, 0, Math.PI * 2);
  ctx2.fill();

  // subtle rim ring
  ctx2.strokeStyle = 'rgba(232,93,4,0.12)';
  ctx2.lineWidth = Math.max(1, R * 0.008);
  ctx2.beginPath();
  ctx2.arc(CX, CY, R * 0.92, 0, Math.PI * 2);
  ctx2.stroke();

  state.fields.forEach((f, i) => {
    const note = state.notes[i];
    const glow = state.glow[i] || 0;
    const isDing = note.kind === 'ding';

    // pad body
    const pad = ctx2.createRadialGradient(f.x - f.rx * 0.3, f.y - f.ry * 0.35, 0, f.x, f.y, f.rx);
    pad.addColorStop(0, `rgba(70,72,78,${0.9 + glow * 0.1})`);
    pad.addColorStop(1, `rgba(28,29,33,${0.95})`);
    ctx2.fillStyle = pad;
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx2.fill();

    // outline
    ctx2.strokeStyle = glow > 0.05
      ? `rgba(232,93,4,${0.35 + glow * 0.5})`
      : 'rgba(255,255,255,0.1)';
    ctx2.lineWidth = isDing ? 1.6 : 1.1;
    ctx2.stroke();

    if (glow > 0.01) {
      ctx2.save();
      ctx2.globalCompositeOperation = 'lighter';
      const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rx * 1.4);
      hg.addColorStop(0, `rgba(232,93,4,${glow * 0.35})`);
      hg.addColorStop(1, 'rgba(232,93,4,0)');
      ctx2.fillStyle = hg;
      ctx2.beginPath();
      ctx2.ellipse(f.x, f.y, f.rx * 1.3, f.ry * 1.3, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }

    let display = note.name;
    const m = note.name.match(/^(.+?)(\d+)$/);
    if (m) {
      const subs = '₀₁₂₃₄₅₆₇₈₉';
      display = m[1] + [...m[2]].map((d) => subs[+d]).join('');
    }
    ctx2.fillStyle = glow > 0.2 ? '#f0ece4' : 'rgba(200,196,188,0.75)';
    ctx2.font = `500 ${Math.max(11, R * (isDing ? 0.07 : 0.05))}px Inter, system-ui, sans-serif`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText(display, f.x, f.y);
  });
}

function tick() {
  let any = false;
  for (let i = 0; i < 9; i++) {
    if (state.glow[i] > 0.001) {
      state.glow[i] *= 0.92;
      any = true;
    } else state.glow[i] = 0;
  }
  if (any) draw();
  requestAnimationFrame(tick);
}

// —— Hit test ——
function hitTest(cx, cy) {
  let best = -1, bestD = Infinity;
  for (const f of state.fields) {
    const dx = (cx - f.x) / f.rx;
    const dy = (cy - f.y) / f.ry;
    const d = dx * dx + dy * dy;
    if (d <= 1.15 && d < bestD) { bestD = d; best = f.i; }
  }
  return best;
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr = W / rect.width;
  return {
    x: (e.clientX - rect.left) * dpr,
    y: (e.clientY - rect.top) * dpr
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = canvasCoords(e);
  const idx = hitTest(x, y);
  if (idx < 0) return;
  state.pointers.set(e.pointerId, idx);
  engine.strike(idx, 0.7 + Math.random() * 0.25);
  draw();
});
canvas.addEventListener('pointerup', (e) => {
  const idx = state.pointers.get(e.pointerId);
  state.pointers.delete(e.pointerId);
  if (idx != null) engine.damp(idx);
});
canvas.addEventListener('pointercancel', (e) => {
  state.pointers.delete(e.pointerId);
});

// Keyboard
const keyMap = Object.fromEntries(KEYS.map((k, i) => [k, i]));
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const idx = keyMap[e.key.toLowerCase()];
  if (idx == null) return;
  e.preventDefault();
  engine.strike(idx, 0.8);
  draw();
});

// —— UI controls ——
function shiftRoot(d) {
  state.rootIndex = (state.rootIndex + d + 12) % 12;
  rebuildNotes();
  if (state.fx.drone) { engine.setDrone(false); engine.setDrone(true); }
}
function shiftOct(d) {
  state.octaveOffset = Math.max(-1, Math.min(1, state.octaveOffset + d));
  rebuildNotes();
  if (state.fx.drone) { engine.setDrone(false); engine.setDrone(true); }
}
function setScale(i) {
  state.scaleIndex = i;
  rebuildNotes();
  closeScaleMenu();
}

document.getElementById('rootDown').onclick = () => shiftRoot(-1);
document.getElementById('rootUp').onclick = () => shiftRoot(1);
document.getElementById('octDown').onclick = () => shiftOct(-1);
document.getElementById('octUp').onclick = () => shiftOct(1);

document.getElementById('voicePrev').onclick = () => {
  state.voiceIndex = (state.voiceIndex - 1 + VOICE_PRESETS.length) % VOICE_PRESETS.length;
  updateLabels();
};
document.getElementById('voiceNext').onclick = () => {
  state.voiceIndex = (state.voiceIndex + 1) % VOICE_PRESETS.length;
  updateLabels();
};

const scaleMenu = document.getElementById('scaleMenu');
const scaleBtn = document.getElementById('scaleBtn');
function openScaleMenu() {
  scaleMenu.hidden = false;
  scaleMenu.innerHTML = '';
  SCALES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.label;
    if (i === state.scaleIndex) b.classList.add('is-active');
    b.onclick = () => setScale(i);
    scaleMenu.appendChild(b);
  });
  // position under button
  const block = scaleBtn.closest('.control-block');
  block.style.position = 'relative';
}
function closeScaleMenu() { scaleMenu.hidden = true; }
scaleBtn.onclick = () => {
  if (scaleMenu.hidden) openScaleMenu(); else closeScaleMenu();
};
document.addEventListener('click', (e) => {
  if (!scaleMenu.hidden && !scaleBtn.contains(e.target) && !scaleMenu.contains(e.target)) {
    closeScaleMenu();
  }
});

document.querySelectorAll('.rail-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fx = btn.dataset.fx;
    if (fx === 'tone') return; // always on visual
    state.fx[fx] = !state.fx[fx];
    btn.classList.toggle('is-on', state.fx[fx]);
    btn.setAttribute('aria-pressed', String(state.fx[fx]));
    if (fx === 'drone') engine.setDrone(state.fx.drone);
  });
});

document.getElementById('btnExit').onclick = () => {
  try {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      history.back();
      return;
    }
  } catch (_) {}
  location.href = '../index.html';
};

document.getElementById('btnHelp').onclick = () => {
  alert('Handpan — 9 notes\n\n• Scale: interval pattern\n• Base Note: transpose chromatically\n• Octave: shift ±1 octave\n• Keys Q–O or touch pads\n• Voices: ‹ Steel ›');
};

// boot
window.addEventListener('resize', resize);
rebuildNotes();
resize();
requestAnimationFrame(tick);

// unlock audio on first gesture
const unlock = () => { engine.ensure(); window.removeEventListener('pointerdown', unlock); };
window.addEventListener('pointerdown', unlock);
