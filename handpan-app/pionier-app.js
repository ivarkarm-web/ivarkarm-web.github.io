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

// Fixed seats around the shell (0 = bottom, clockwise)
const RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];
// Handpan zigzag: scale degrees alternate left/right as they rise
// (not sequential clockwise). Slot index → angle seat.
const ZIGZAG_SLOTS = [0, 1, 7, 2, 6, 3, 5, 4];
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
  fx: { tone: 0.7, delay: 0.15, reverb: 0.25 }
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
      angle: isDing ? 0 : RING_ANGLES[ZIGZAG_SLOTS[i - 1]],
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
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 20;
    this.comp.ratio.value = 2.8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    // Graph completed after tone/delay/reverb nodes are created
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

    // Tone: low-pass on dry path (0 = dark, 1 = open/bright)
    this.toneFilter = this.ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.Q.value = 0.7;
    this.bus.connect(this.toneFilter);

    // Delay send
    this.delay = this.ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.28;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.25;
    this.delayWet = this.ctx.createGain();
    this.delayWet.gain.value = 0;
    this.toneFilter.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);

    // Simple algorithmic reverb (parallel comb-ish delays + wet)
    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = 0;
    this.reverbInput = this.ctx.createGain();
    const delays = [0.031, 0.053, 0.073, 0.097];
    this._reverbTaps = [];
    delays.forEach((dt, i) => {
      const d = this.ctx.createDelay(0.2);
      d.delayTime.value = dt;
      const g = this.ctx.createGain();
      g.gain.value = 0.28 - i * 0.04;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 4200 - i * 400;
      this.reverbInput.connect(d);
      d.connect(f);
      f.connect(g);
      g.connect(this.reverbWet);
      // light feedback
      const fb = this.ctx.createGain();
      fb.gain.value = 0.35;
      g.connect(fb);
      fb.connect(d);
      this._reverbTaps.push({ d, g, f, fb });
    });
    this.toneFilter.connect(this.reverbInput);

    // Master merge → compressor → destination
    this.toneFilter.connect(this.comp);
    this.delayWet.connect(this.comp);
    this.reverbWet.connect(this.comp);
    this.comp.connect(getAudioMaster());

    this.applyFx();
    resumeAudio();
    return true;
  },

  applyFx() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const tone = state.fx.tone;   // 0..1
    const del = state.fx.delay;
    const rev = state.fx.reverb;
    // Tone: 800 Hz (dark) → 12000 Hz (bright)
    if (this.toneFilter) {
      const hz = 800 * Math.pow(15, tone);
      this.toneFilter.frequency.cancelScheduledValues(t);
      this.toneFilter.frequency.setTargetAtTime(hz, t, 0.05);
    }
    if (this.delayWet) {
      this.delayWet.gain.setTargetAtTime(del * 0.55, t, 0.06);
      this.delayFeedback.gain.setTargetAtTime(0.15 + del * 0.45, t, 0.06);
      this.delay.delayTime.setTargetAtTime(0.18 + del * 0.35, t, 0.08);
    }
    if (this.reverbWet) {
      this.reverbWet.gain.setTargetAtTime(rev * 0.5, t, 0.08);
      this.reverbInput.gain.setTargetAtTime(0.4 + rev * 0.6, t, 0.08);
    }
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
  // Natural handpan proportions (golden ring radius, soft gaps ~0.1 R between tones)
  state.fields = state.notes.map((n) => {
    if (n.kind === 'ding') {
      return { i: n.index, x: CX, y: CY, rx: R * 0.205, ry: R * 0.205 };
    }
    const a = (n.angle * Math.PI) / 180;
    const d = R * 0.618; // φ⁻¹ — balanced distance from ding
    return {
      i: n.index,
      x: CX + Math.sin(a) * d,
      y: CY - Math.cos(a) * d,
      rx: R * 0.188,
      ry: R * 0.168
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
}
function shiftOct(d) {
  state.octaveOffset = Math.max(-1, Math.min(1, state.octaveOffset + d));
  rebuildNotes();
}
function setScale(i) {
  const n = SCALES.length;
  state.scaleIndex = ((i % n) + n) % n;
  rebuildNotes();
}

document.getElementById('scalePrev').onclick = () => setScale(state.scaleIndex - 1);
document.getElementById('scaleNext').onclick = () => setScale(state.scaleIndex + 1);
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

const FX_LABELS = { tone: 'Tone', delay: 'Ambiance', reverb: 'Room' };

function setFxParam(name, value01) {
  state.fx[name] = Math.max(0, Math.min(1, value01));
  const pct = Math.round(state.fx[name] * 100);
  const valEl = document.getElementById('val' + name[0].toUpperCase() + name.slice(1));
  if (valEl) valEl.textContent = String(pct);
  const knob = document.getElementById('knob' + name[0].toUpperCase() + name.slice(1));
  if (knob) {
    knob.setAttribute('aria-valuenow', String(pct));
    knob.setAttribute('aria-valuetext', (FX_LABELS[name] || name) + ' ' + pct + ' percent');
  }
  engine.applyFx();
  drawKnob(name);
}

function drawKnob(name) {
  const knob = document.getElementById('knob' + name[0].toUpperCase() + name.slice(1));
  if (!knob) return;
  const canvas = knob.querySelector('.knob-canvas');
  if (!canvas) return;
  const v = state.fx[name];
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 88;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = size / 2, cy = size / 2, r = 34;
  const start = Math.PI * 0.75;
  const span = Math.PI * 1.5;
  // track
  c.beginPath();
  c.arc(cx, cy, r, start, start + span);
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.stroke();
  // value arc
  c.beginPath();
  c.arc(cx, cy, r, start, start + span * v);
  c.strokeStyle = '#e85d04';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.stroke();
  // pointer
  const a = start + span * v;
  c.beginPath();
  c.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
  c.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
  c.strokeStyle = '#f0ece4';
  c.lineWidth = 2.5;
  c.lineCap = 'round';
  c.stroke();
  // outer ring
  c.beginPath();
  c.arc(cx, cy, r + 6, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  c.stroke();
}

function bindKnob(name) {
  const el = document.getElementById('knob' + name[0].toUpperCase() + name.slice(1));
  if (!el) return;
  let dragging = false;
  let lastY = 0;
  const onMove = (clientY) => {
    const dy = lastY - clientY;
    lastY = clientY;
    setFxParam(name, state.fx[name] + dy * 0.006);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    lastY = e.clientY;
    el.classList.add('is-active');
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    onMove(e.clientY);
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    el.classList.remove('is-active');
  });
  el.addEventListener('pointercancel', () => {
    dragging = false;
    el.classList.remove('is-active');
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      setFxParam(name, state.fx[name] + 0.03);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setFxParam(name, state.fx[name] - 0.03);
    }
  });
  // double-click reset
  el.addEventListener('dblclick', () => {
    const defaults = { tone: 0.7, delay: 0.15, reverb: 0.25 };
    setFxParam(name, defaults[name]);
  });
}

['tone', 'delay', 'reverb'].forEach((n) => {
  bindKnob(n);
  drawKnob(n);
});


const btnExit = document.getElementById('btnExit');
if (btnExit) {
  btnExit.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Always return to the main site home (not history.back — can fail / loop)
    const home = new URL('../index.html', window.location.href).href;
    window.location.assign(home);
  });
}
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
