/**
 * pionier-app.js — canvas instrument surface (no Flutter / RN / generic UI kits)
 *
 * - Continuous X/Y multi-zone vector mapping per pad
 * - Non-linear velocity + layered sample interpolation
 * - Large elliptical tone fields
 * - Web Audio path; native CoreAudio/AAudio via optional bridge (native/audio-bridge.md)
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './js/audio-core.js';
import { VOICE_PRESETS } from './js/voice-presets.js';
import { NoteSampleBank } from './js/note-sample-bank.js';

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

const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOTS = NOTE_NAMES.slice();

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
function rootToMidi(rootIndex, octaveOffset) {
  return 48 + rootIndex + octaveOffset * 12;
}

const state = {
  scaleIndex: 0,
  rootIndex: 2,
  octaveOffset: 0,
  voiceIndex: 0,
  notes: [],
  fields: [],
  glow: new Float32Array(9),
  zoneFlash: new Float32Array(9), // last radial for draw
  pointers: new Map(),
  lastStrikeAt: new Map(), // idx -> time for velocity continuity
  fx: { tone: true, pulse: false, drone: false, space: false }
};

function rebuildNotes() {
  const scale = SCALES[state.scaleIndex];
  const base = rootToMidi(state.rootIndex, state.octaveOffset);
  state.notes = scale.intervals.map((iv, i) => {
    const midi = base + iv;
    const isDing = i === 0;
    return {
      index: i,
      midi,
      name: midiName(midi),
      freq: mtof(midi),
      kind: isDing ? 'ding' : 'ring',
      angle: isDing ? 0 : RING_ANGLES[i - 1],
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

// —— Engine ——
const engine = {
  ctx: null,
  bus: null,
  voices: new Map(),
  noise: null,
  droneNodes: null,
  sampleBank: null,

  ensure() {
    if (this.ctx) { resumeAudio(); return true; }
    this.ctx = getAudioContext();
    if (!this.ctx) return false;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.95;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 20;
    comp.ratio.value = 2.8;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.bus.connect(comp);
    comp.connect(getAudioMaster());
    const nlen = Math.floor(this.ctx.sampleRate * 0.1);
    this.noise = this.ctx.createBuffer(1, nlen, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    this.sampleBank = new NoteSampleBank(this.ctx, './sounds/notes/');
    this.sampleBank.load().then(() => {
      const n = this.sampleBank.byMidi.size;
      console.info('[handpan] samples', n);
      const hint = document.getElementById('hint');
      if (hint && n) hint.textContent = 'Vector pads · samples live · Q–O';
    }).catch((e) => console.warn(e));
    resumeAudio();
    return true;
  },

  /**
   * @param {number} idx
   * @param {{ vel: number, radial: number, angleRad: number }} touch
   */
  strike(idx, touch = {}) {
    if (!this.ensure()) return;
    const note = state.notes[idx];
    if (!note) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.001;
    const vel = Math.max(0.12, Math.min(1, touch.vel ?? 0.75));
    const radial = Math.max(0, Math.min(1.2, touch.radial ?? 0.4));
    const angleRad = touch.angleRad ?? 0;

    const prev = this.voices.get(idx);
    if (prev) {
      if (prev.stop) prev.stop(t, 0.04);
      else this.releaseVoice(prev, t, 0.04);
    }

    state.glow[idx] = Math.min(1, 0.55 + vel * 0.45);
    state.zoneFlash[idx] = radial;

    // Prefer multi-layer sample path
    if (this.sampleBank && this.sampleBank.ready) {
      const played = this.sampleBank.play(note.midi, this.bus, t, { vel, radial, angleRad });
      if (played) {
        this.voices.set(idx, {
          idx,
          stop: played.stop,
          released: false
        });
        return;
      }
    }

    // Synth fallback with zone-aware partial mix
    this._strikeSynth(note, idx, t, vel, radial);
  },

  _strikeSynth(note, idx, t, vel, radial) {
    const ctx = this.ctx;
    const preset = VOICE_PRESETS[state.voiceIndex] || VOICE_PRESETS[0];
    const f = note.freq;
    const z = NoteSampleBank.zoneWeights(radial);
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);

    const T0 = Math.max(1.5, 5.5 - Math.log(f / 165) / Math.LN2);
    const oscs = [];
    const gains = [0.55 * z.fundamental, 0.32 * z.partials, 0.18 * z.partials, 0.1 * z.brightness, 0.05 * z.brightness];
    preset.partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = preset.wave || 'sine';
      osc.frequency.value = f * ratio * (1 + ((i % 2) ? -1 : 1) * (preset.spread || 0.005));
      const g = ctx.createGain();
      const peak = (0.16 + 0.14 * vel) * (gains[i] || 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004 + (1 - vel) * 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + T0 * (preset.decay / 6.2) * (1 - i * 0.07));
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + T0 + 0.12);
      oscs.push(osc);
    });

    // edge noise
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * (2.5 + z.brightness * 3), 7000);
    bp.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(z.noise * vel * 0.4, t + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(t);
    src.stop(t + 0.07);

    const voice = {
      idx,
      out,
      oscs,
      released: false,
      stop: (tt, tc) => this.releaseVoice(voice, tt, tc)
    };
    oscs[0].onended = () => {
      this.voices.delete(idx);
      try { out.disconnect(); } catch (_) {}
    };
    this.voices.set(idx, voice);
  },

  releaseVoice(voice, t, tc) {
    if (!voice || voice.released) return;
    voice.released = true;
    try {
      if (voice.out) {
        voice.out.gain.cancelScheduledValues(t);
        voice.out.gain.setTargetAtTime(0, t, tc);
      }
    } catch (_) {}
  },

  damp(idx) {
    const v = this.voices.get(idx);
    if (!v || !this.ctx) return;
    if (v.stop) v.stop(this.ctx.currentTime, 0.07);
    else this.releaseVoice(v, this.ctx.currentTime, 0.07);
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
    g.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.3);
    osc.connect(g);
    g.connect(this.bus);
    osc.start();
    this.droneNodes = { osc, gain: g };
  }
};

// —— Canvas surface (continuous X/Y) ——
const canvas = document.getElementById('pan');
const ctx2 = canvas.getContext('2d');
let W = 800, H = 800, R = 0, CX = 0, CY = 0;

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(rect.width * dpr));
  H = Math.max(1, Math.round(rect.height * dpr));
  canvas.width = W;
  canvas.height = H;
  CX = W / 2;
  CY = H / 2;
  R = Math.min(W, H) * 0.48;
  layoutFields();
  draw();
}

function layoutFields() {
  // Spaced pads: clear gap between ding and ring, and between neighboring tones
  state.fields = state.notes.map((n) => {
    if (n.kind === 'ding') {
      return { i: n.index, x: CX, y: CY, rx: R * 0.21, ry: R * 0.21 };
    }
    const a = (n.angle * Math.PI) / 180;
    const d = R * 0.64; // farther from center → visible spacing
    return {
      i: n.index,
      x: CX + Math.sin(a) * d,
      y: CY - Math.cos(a) * d,
      rx: R * 0.195,
      ry: R * 0.17
    };
  });
}

function draw() {
  ctx2.clearRect(0, 0, W, H);
  const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
  g.addColorStop(0, '#2c2d32');
  g.addColorStop(0.5, '#16171b');
  g.addColorStop(1, '#0a0a0c');
  ctx2.fillStyle = g;
  ctx2.beginPath();
  ctx2.arc(CX, CY, R, 0, Math.PI * 2);
  ctx2.fill();

  ctx2.strokeStyle = 'rgba(232,93,4,0.14)';
  ctx2.lineWidth = Math.max(1.5, R * 0.01);
  ctx2.beginPath();
  ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
  ctx2.stroke();

  state.fields.forEach((f, i) => {
    const note = state.notes[i];
    const glow = state.glow[i] || 0;
    const radial = state.zoneFlash[i] || 0;
    const isDing = note.kind === 'ding';

    const pad = ctx2.createRadialGradient(f.x - f.rx * 0.25, f.y - f.ry * 0.3, 0, f.x, f.y, f.rx);
    pad.addColorStop(0, `rgba(78,80,88,${0.95})`);
    pad.addColorStop(0.55, `rgba(40,42,48,0.95)`);
    pad.addColorStop(1, `rgba(22,23,27,0.98)`);
    ctx2.fillStyle = pad;
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx2.fill();

    // Zone rings (center / mid / edge) — subtle guide
    ctx2.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx * 0.45, f.ry * 0.45, 0, 0, Math.PI * 2);
    ctx2.stroke();

    ctx2.strokeStyle = glow > 0.04
      ? `rgba(232,93,4,${0.3 + glow * 0.55})`
      : 'rgba(255,255,255,0.12)';
    ctx2.lineWidth = isDing ? 2 : 1.4;
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx2.stroke();

    if (glow > 0.02) {
      ctx2.save();
      ctx2.globalCompositeOperation = 'lighter';
      // Radial zone flash: edge strikes push glow outward
      const gr = f.rx * (0.9 + radial * 0.45);
      const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, gr);
      hg.addColorStop(0, `rgba(232,93,4,${glow * (0.25 + (1 - radial) * 0.2)})`);
      hg.addColorStop(0.55, `rgba(232,140,40,${glow * radial * 0.25})`);
      hg.addColorStop(1, 'rgba(232,93,4,0)');
      ctx2.fillStyle = hg;
      ctx2.beginPath();
      ctx2.ellipse(f.x, f.y, gr * 1.15, f.ry * (1.15 + radial * 0.2), 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }

    let display = note.name;
    const m = note.name.match(/^(.+?)(\d+)$/);
    if (m) {
      const subs = '₀₁₂₃₄₅₆₇₈₉';
      display = m[1] + [...m[2]].map((d) => subs[+d]).join('');
    }
    ctx2.fillStyle = glow > 0.15 ? '#f5f1ea' : 'rgba(210,205,196,0.82)';
    ctx2.font = `600 ${Math.max(13, R * (isDing ? 0.078 : 0.055))}px Inter, system-ui, sans-serif`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText(display, f.x, f.y);
  });
}

function tick() {
  let any = false;
  for (let i = 0; i < 9; i++) {
    if (state.glow[i] > 0.001) {
      state.glow[i] *= 0.9;
      any = true;
    } else state.glow[i] = 0;
  }
  if (any) draw();
  requestAnimationFrame(tick);
}

/**
 * Continuous surface hit test: nearest pad in elliptical distance.
 * Returns { idx, radial, angleRad } where radial is 0..~1+ from pad center.
 */
function hitVector(cx, cy) {
  let best = null;
  let bestD = Infinity;
  for (const f of state.fields) {
    const dx = (cx - f.x) / f.rx;
    const dy = (cy - f.y) / f.ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Generous hit radius so fields are hard to miss
    if (d <= 1.35 && d < bestD) {
      bestD = d;
      best = {
        idx: f.i,
        radial: d, // 0 center → 1 edge of ellipse → >1 outside but still claimed
        angleRad: Math.atan2(cy - f.y, cx - f.x)
      };
    }
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

/** Velocity from pointer pressure, height, or movement history */
function estimateVelocity(e, idx) {
  let v = 0.65;
  if (typeof e.pressure === 'number' && e.pressure > 0) {
    v = 0.25 + e.pressure * 0.75;
  }
  if (typeof e.force === 'number' && e.force > 0) {
    v = Math.max(v, Math.min(1, e.force));
  }
  // Rapid re-strikes: slight velocity continuity (rolling fingers)
  const now = performance.now();
  const last = state.lastStrikeAt.get(idx) || 0;
  const dt = now - last;
  state.lastStrikeAt.set(idx, now);
  if (dt > 0 && dt < 90) {
    v = Math.min(1, v * (0.85 + (90 - dt) / 200));
  }
  return v;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = canvasCoords(e);
  const hit = hitVector(x, y);
  if (!hit) return;
  const vel = estimateVelocity(e, hit.idx);
  state.pointers.set(e.pointerId, hit.idx);
  engine.strike(hit.idx, { vel, radial: hit.radial, angleRad: hit.angleRad });
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

const keyMap = Object.fromEntries(KEYS.map((k, i) => [k, i]));
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const idx = keyMap[e.key.toLowerCase()];
  if (idx == null) return;
  e.preventDefault();
  engine.strike(idx, { vel: 0.8, radial: 0.35, angleRad: 0 });
  draw();
});

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
  scaleBtn.closest('.control-block').style.position = 'relative';
}
function closeScaleMenu() { scaleMenu.hidden = true; }
scaleBtn.onclick = () => { if (scaleMenu.hidden) openScaleMenu(); else closeScaleMenu(); };
document.addEventListener('click', (e) => {
  if (!scaleMenu.hidden && !scaleBtn.contains(e.target) && !scaleMenu.contains(e.target)) closeScaleMenu();
});

document.querySelectorAll('.rail-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fx = btn.dataset.fx;
    if (fx === 'tone') return;
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
  alert(
    'Handpan — vector pads\\n\\n' +
    '• Strike near pad center → deeper body tone\\n' +
    '• Strike near pad edge → brighter partials + attack\\n' +
    '• Velocity uses a non-linear curve + layered samples\\n' +
    '• Scale / Base Note / Octave transpose live\\n' +
    '• Keys Q–O'
  );
};

window.addEventListener('resize', resize);
rebuildNotes();
resize();
requestAnimationFrame(tick);
window.addEventListener('pointerdown', function unlock() {
  engine.ensure();
  window.removeEventListener('pointerdown', unlock);
});
