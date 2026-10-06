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
  // Handpan-style tone fields: ovals with long axis pointing toward the ding.
  // Size scales with pitch — highest note keeps the base size, lowest is largest.
  const midis = state.notes.map((n) => n.midi);
  const midiMin = Math.min.apply(null, midis);
  const midiMax = Math.max.apply(null, midis);
  const midiSpan = Math.max(1, midiMax - midiMin);

  state.fields = state.notes.map((n) => {
    // 0 = highest pitch, 1 = lowest pitch
    const lowAmount = (midiMax - n.midi) / midiSpan;
    // Highest keeps base size (1.0); lowest grows to ~1.42×
    const size = 1 + lowAmount * 0.42;

    if (n.kind === 'ding') {
      const rr = R * 0.185 * size;
      return { i: n.index, x: CX, y: CY, rx: rr, ry: rr, rot: 0 };
    }
    const a = (n.angle * Math.PI) / 180;
    // Slightly closer to the ding for a tighter classic handpan ring
    const d = R * 0.58;
    // Radial half-axis (toward ding) longer; tangential shorter
    const radial = R * 0.155 * size;
    const tangential = R * 0.112 * size;
    // Unit vector from ding toward this note (screen: sin/cos with y-up inverted)
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    // Ellipse rotation: major axis along radial direction
    const rot = Math.atan2(uy, ux);
    return {
      i: n.index,
      x: CX + ux * d,
      y: CY + uy * d,
      rx: radial,
      ry: tangential,
      rot,
      ux,
      uy
    };
  });
}

/** Ellipse path helper — rotated so long axis points toward the ding */
function pathPad(f) {
  ctx2.beginPath();
  ctx2.ellipse(f.x, f.y, f.rx, f.ry, f.rot || 0, 0, Math.PI * 2);
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

  ctx2.strokeStyle = 'rgba(201,162,39,0.14)';
  ctx2.lineWidth = Math.max(1.5, R * 0.01);
  ctx2.beginPath();
  ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
  ctx2.stroke();

  state.fields.forEach((f, i) => {
    const note = state.notes[i];
    const glow = state.glow[i] || 0;
    const radial = state.zoneFlash[i] || 0;
    const isDing = note.kind === 'ding';

    const hlx = f.ux != null ? f.ux : -0.35;
    const hly = f.uy != null ? f.uy : -0.45;
    const pad = ctx2.createRadialGradient(
      f.x + hlx * f.rx * 0.35, f.y + hly * f.ry * 0.35, 0,
      f.x, f.y, Math.max(f.rx, f.ry)
    );
    pad.addColorStop(0, 'rgba(78,80,88,0.95)');
    pad.addColorStop(0.55, 'rgba(40,42,48,0.95)');
    pad.addColorStop(1, 'rgba(22,23,27,0.98)');
    ctx2.fillStyle = pad;
    pathPad(f);
    ctx2.fill();

    // Outer rim of the tone field
    ctx2.strokeStyle = glow > 0.04
      ? `rgba(201,162,39,${0.3 + glow * 0.55})`
      : 'rgba(255,255,255,0.12)';
    ctx2.lineWidth = isDing ? 2.2 : 1.5;
    pathPad(f);
    ctx2.stroke();

    // Play glow bloom around the field
    if (glow > 0.02) {
      ctx2.save();
      ctx2.globalCompositeOperation = 'lighter';
      const gr = Math.max(f.rx, f.ry) * (0.95 + radial * 0.4);
      const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, gr);
      hg.addColorStop(0, `rgba(201,162,39,${glow * (0.25 + (1 - radial) * 0.2)})`);
      hg.addColorStop(0.55, `rgba(228,195,90,${glow * radial * 0.22})`);
      hg.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = hg;
      pathPad({ x: f.x, y: f.y, rx: f.rx * 1.12, ry: f.ry * 1.12, rot: f.rot });
      ctx2.fill();
      ctx2.restore();
    }

    // Center slit (handpan-style aperture) — lights up when played
    drawSlit(f, isDing, glow);
  });
}

/** Thin center slit / dimple on each tone field — with layered glow */
function drawSlit(f, isDing, glow) {
  const rot = f.rot || 0;
  // Slit length along the long axis; width is a thin opening
  const len = isDing ? f.rx * 0.42 : f.rx * 0.55;
  const halfW = isDing ? Math.max(1.2, f.rx * 0.06) : Math.max(1.0, f.ry * 0.11);
  const pulse = glow > 0.01 ? (0.82 + 0.18 * Math.sin(performance.now() * 0.014)) : 1;
  const a = Math.min(1, glow * 1.25) * pulse;

  ctx2.save();
  ctx2.translate(f.x, f.y);
  ctx2.rotate(rot);

  // Ambient outer glow (subtle when idle, strong when played)
  ctx2.globalCompositeOperation = 'lighter';
  const ambA = 0.06 + a * 0.55;
  const amb = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.8);
  amb.addColorStop(0, `rgba(255,220,120,${ambA * 0.5})`);
  amb.addColorStop(0.35, `rgba(201,162,39,${ambA * 0.28})`);
  amb.addColorStop(0.7, `rgba(201,162,39,${ambA * 0.08})`);
  amb.addColorStop(1, 'rgba(201,162,39,0)');
  ctx2.fillStyle = amb;
  ctx2.beginPath();
  ctx2.ellipse(0, 0, len * 1.55, halfW * (4.5 + a * 3), 0, 0, Math.PI * 2);
  ctx2.fill();

  // Mid glow layer along the slit axis
  if (a > 0.02) {
    const mid = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.15);
    mid.addColorStop(0, `rgba(255,235,160,${a * 0.55})`);
    mid.addColorStop(0.4, `rgba(228,195,90,${a * 0.28})`);
    mid.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = mid;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, len * 1.15, halfW * (2.8 + a * 2), 0, 0, Math.PI * 2);
    ctx2.fill();
  }

  ctx2.globalCompositeOperation = 'source-over';

  // Recessed dark slit body
  ctx2.beginPath();
  ctx2.ellipse(0, 0, len, halfW, 0, 0, Math.PI * 2);
  const recess = ctx2.createRadialGradient(0, 0, 0, 0, 0, len);
  recess.addColorStop(0, 'rgba(0,0,0,0.78)');
  recess.addColorStop(0.6, 'rgba(0,0,0,0.5)');
  recess.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx2.fillStyle = recess;
  ctx2.fill();

  // Soft rim around the slit
  ctx2.strokeStyle = a > 0.05
    ? `rgba(255,230,140,${0.35 + a * 0.6})`
    : 'rgba(255,255,255,0.1)';
  ctx2.lineWidth = Math.max(0.9, halfW * 0.65);
  ctx2.stroke();

  // Bright lit core when played
  if (a > 0.02) {
    ctx2.globalCompositeOperation = 'lighter';

    // Hot filament down the center of the slit
    ctx2.beginPath();
    ctx2.ellipse(0, 0, len * 0.94, halfW * 0.62, 0, 0, Math.PI * 2);
    const core = ctx2.createLinearGradient(-len, 0, len, 0);
    core.addColorStop(0, `rgba(201,162,39,${a * 0.2})`);
    core.addColorStop(0.35, `rgba(255,240,170,${a * 0.95})`);
    core.addColorStop(0.5, `rgba(255,250,220,${a})`);
    core.addColorStop(0.65, `rgba(255,240,170,${a * 0.95})`);
    core.addColorStop(1, `rgba(201,162,39,${a * 0.2})`);
    ctx2.fillStyle = core;
    ctx2.fill();

    // Inner spark line
    ctx2.beginPath();
    ctx2.ellipse(0, 0, len * 0.7, halfW * 0.28, 0, 0, Math.PI * 2);
    ctx2.fillStyle = `rgba(255,252,235,${a * 0.85})`;
    ctx2.fill();

    // Wide soft bloom around the slit
    const bloom = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.6);
    bloom.addColorStop(0, `rgba(255,230,140,${a * 0.4})`);
    bloom.addColorStop(0.4, `rgba(228,195,90,${a * 0.18})`);
    bloom.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = bloom;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, len * 1.4, halfW * (3.8 + a * 2.5), 0, 0, Math.PI * 2);
    ctx2.fill();
  }

  ctx2.restore();
}

function tick() {
  let any = false;
  for (let i = 0; i < 9; i++) {
    if (state.glow[i] > 0.001) {
      state.glow[i] *= 0.9;
      any = true;
    } else state.glow[i] = 0;
  }
  // Redraw while any field is glowing so the slit pulse animates
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
    // Point relative to field center, then into the ellipse's local (rotated) frame
    const dx = cx - f.x;
    const dy = cy - f.y;
    const rot = f.rot || 0;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    // Elliptical distance in local space (0 = center, 1 = edge)
    const d = Math.hypot(lx / f.rx, ly / f.ry);
    // Generous thumb-friendly hit area
    if (d <= 1.28 && d < bestD) {
      bestD = d;
      best = {
        idx: f.i,
        radial: d,
        angleRad: Math.atan2(dy, dx)
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


// Hard-block browser zoom gestures on the instrument surface
;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});

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
window.addEventListener('keyup', (e) => {
  const idx = keyMap[e.key.toLowerCase()];
  if (idx != null) engine.damp(idx);
});

// UI wiring
function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}
wire('scalePrev', () => { state.scaleIndex = (state.scaleIndex - 1 + SCALES.length) % SCALES.length; rebuildNotes(); });
wire('scaleNext', () => { state.scaleIndex = (state.scaleIndex + 1) % SCALES.length; rebuildNotes(); });
wire('rootDown', () => { state.rootIndex = (state.rootIndex - 1 + 12) % 12; rebuildNotes(); });
wire('rootUp', () => { state.rootIndex = (state.rootIndex + 1) % 12; rebuildNotes(); });
wire('octDown', () => { state.octaveOffset = Math.max(-1, state.octaveOffset - 1); rebuildNotes(); });
wire('octUp', () => { state.octaveOffset = Math.min(1, state.octaveOffset + 1); rebuildNotes(); });
wire('voicePrev', () => { state.voiceIndex = (state.voiceIndex - 1 + VOICE_PRESETS.length) % VOICE_PRESETS.length; updateLabels(); });
wire('voiceNext', () => { state.voiceIndex = (state.voiceIndex + 1) % VOICE_PRESETS.length; updateLabels(); });
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  alert('Play the handpan: tap the tone fields or use Q W E R T Y U I O. Drag Tone / Ambiance / Room knobs. Switch scale, root, and octave on the left.');
});

// Knobs
function setupKnob(id, key, initial) {
  const el = document.getElementById(id);
  if (!el) return;
  const canvas = el.querySelector('.knob-canvas');
  const valEl = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
  let value = initial;
  let dragging = false;
  let lastY = 0;

  function paint() {
    if (!canvas) return;
    const c = canvas.getContext('2d');
    const s = canvas.width;
    c.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, r = s * 0.38;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 6;
    c.stroke();
    const start = Math.PI * 0.75;
    const end = start + Math.PI * 1.5 * value;
    c.beginPath();
    c.arc(cx, cy, r, start, end);
    c.strokeStyle = '#c9a227';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.stroke();
  }

  function setVal(v) {
    value = Math.max(0, Math.min(1, v));
    state.fx[key] = value;
    if (valEl) valEl.textContent = Math.round(value * 100);
    el.setAttribute('aria-valuenow', Math.round(value * 100));
    el.setAttribute('aria-valuetext', key + ' ' + Math.round(value * 100) + ' percent');
    paint();
    engine.applyFx();
  }

  setVal(initial);

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-active');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = lastY - e.clientY;
    lastY = e.clientY;
    setVal(value + dy * 0.005);
  });
  el.addEventListener('pointerup', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('pointercancel', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setVal(value + 0.05); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setVal(value - 0.05); }
  });
}

setupKnob('knobTone', 'tone', 0.7);
setupKnob('knobDelay', 'delay', 0.15);
setupKnob('knobReverb', 'reverb', 0.25);

// Boot
window.addEventListener('resize', resize);
rebuildNotes();
resize();
requestAnimationFrame(tick);

// Unlock audio on first gesture
function unlock() {
  engine.ensure();
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('pointerdown', unlock);
