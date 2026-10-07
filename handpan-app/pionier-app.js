/**
 * pionier-app.js — canvas instrument surface
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
const ZIGZAG_SLOTS = [0, 1, 7, 2, 6, 3, 5, 4];
const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOTS = NOTE_NAMES.slice();

const DELAY_TYPES = {
  echo: { id: 'echo', label: 'Echo', desc: 'Classic repeating echo. Use Ambiance to set mix & length.', timeMin: 0.22, timeMax: 0.48, fbMin: 0.22, fbMax: 0.55, wetScale: 0.55 },
  slap: { id: 'slap', label: 'Slap', desc: 'Short slapback for rhythmic thickness.', timeMin: 0.055, timeMax: 0.12, fbMin: 0.05, fbMax: 0.18, wetScale: 0.45 },
  ping: { id: 'ping', label: 'Ping', desc: 'Bouncy longer repeats with more feedback.', timeMin: 0.28, timeMax: 0.55, fbMin: 0.35, fbMax: 0.68, wetScale: 0.5 },
  ambient: { id: 'ambient', label: 'Ambient', desc: 'Long washed repeats — spacious trails.', timeMin: 0.4, timeMax: 0.72, fbMin: 0.28, fbMax: 0.52, wetScale: 0.6 }
};

const REVERB_TYPES = {
  room: { id: 'room', label: 'Room', desc: 'Small intimate space. Use Room knob for wet amount.', taps: [0.022, 0.035, 0.048, 0.062], tapGains: [0.32, 0.26, 0.2, 0.14], fb: 0.28, filters: [5200, 4600, 4000, 3400], wetScale: 0.5 },
  hall: { id: 'hall', label: 'Hall', desc: 'Large concert hall with long decay.', taps: [0.038, 0.061, 0.089, 0.12], tapGains: [0.3, 0.25, 0.2, 0.16], fb: 0.42, filters: [4200, 3600, 3000, 2400], wetScale: 0.55 },
  plate: { id: 'plate', label: 'Plate', desc: 'Bright dense plate — studio sheen.', taps: [0.018, 0.029, 0.041, 0.055], tapGains: [0.34, 0.28, 0.22, 0.17], fb: 0.36, filters: [7000, 6200, 5400, 4600], wetScale: 0.52 },
  cave: { id: 'cave', label: 'Cave', desc: 'Dark cavernous space with long wash.', taps: [0.055, 0.088, 0.125, 0.17], tapGains: [0.28, 0.24, 0.2, 0.16], fb: 0.48, filters: [2800, 2200, 1700, 1300], wetScale: 0.58 }
};

const COMPRESSOR_TYPES = {
  soft: { id: 'soft', label: 'Soft', desc: 'Gentle leveling — smooth and musical. Use Comp knob for amount.', threshold: -18, knee: 24, ratio: 2.2, attack: 0.012, release: 0.28, makeup: 1.05 },
  punch: { id: 'punch', label: 'Punch', desc: 'Fast attack for transient snap and presence.', threshold: -14, knee: 8, ratio: 4, attack: 0.002, release: 0.12, makeup: 1.12 },
  glue: { id: 'glue', label: 'Glue', desc: 'Bus-style glue that tightens the whole pan.', threshold: -20, knee: 16, ratio: 3.2, attack: 0.02, release: 0.35, makeup: 1.08 },
  limit: { id: 'limit', label: 'Limit', desc: 'Hard limiter — loud and controlled, less dynamics.', threshold: -8, knee: 2, ratio: 12, attack: 0.001, release: 0.08, makeup: 1.15 }
};

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m) {
  const n = Math.round(m);
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
function rootToMidi(rootIndex, octaveOffset) {
  return 48 + rootIndex + octaveOffset * 12;
}

const state = {
  scaleIndex: 0, rootIndex: 2, octaveOffset: 0, voiceIndex: 0,
  notes: [], fields: [],
  glow: new Float32Array(9),
  zoneFlash: new Float32Array(9),
  pointers: new Map(),
  lastStrikeAt: new Map(),
  fx: { compress: 0.4, delay: 0.15, reverb: 0.25, master: 1.0, delayType: 'echo', reverbType: 'room', compressType: 'soft' }
};

function rebuildNotes() {
  const scale = SCALES[state.scaleIndex];
  const base = rootToMidi(state.rootIndex, state.octaveOffset);
  state.notes = scale.intervals.map((iv, i) => {
    const midi = base + iv;
    const isDing = i === 0;
    return {
      index: i, midi, name: midiName(midi), freq: mtof(midi),
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

const engine = {
  ctx: null, bus: null, voices: new Map(), noise: null, droneNodes: null, sampleBank: null,

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

    const nlen = Math.floor(this.ctx.sampleRate * 0.1);
    this.noise = this.ctx.createBuffer(1, nlen, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    this.sampleBank = new NoteSampleBank(this.ctx, './sounds/notes/');
    this.sampleBank.load().then(() => {
      console.info('[handpan] samples', this.sampleBank.byMidi.size);
    }).catch((e) => console.warn(e));

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1;
    this.bus.connect(this.dryGain);

    this.delay = this.ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.28;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.25;
    this.delayWet = this.ctx.createGain();
    this.delayWet.gain.value = 0;
    this.bus.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);

    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = 0;
    this.reverbInput = this.ctx.createGain();
    const delays = [0.031, 0.053, 0.073, 0.097];
    this._reverbTaps = [];
    delays.forEach((dt, i) => {
      const dd = this.ctx.createDelay(0.2);
      dd.delayTime.value = dt;
      const g = this.ctx.createGain();
      g.gain.value = 0.28 - i * 0.04;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 4200 - i * 400;
      this.reverbInput.connect(dd);
      dd.connect(f); f.connect(g); g.connect(this.reverbWet);
      const fb = this.ctx.createGain();
      fb.gain.value = 0.35;
      g.connect(fb); fb.connect(dd);
      this._reverbTaps.push({ d: dd, g, f, fb });
    });
    this.bus.connect(this.reverbInput);

    this.makeupGain = this.ctx.createGain();
    this.makeupGain.gain.value = 1;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.dryGain.connect(this.comp);
    this.delayWet.connect(this.comp);
    this.reverbWet.connect(this.comp);
    this.comp.connect(this.makeupGain);
    this.makeupGain.connect(this.masterGain);
    this.masterGain.connect(getAudioMaster());

    this.applyFx();
    resumeAudio();
    return true;
  },

  applyFx() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const del = state.fx.delay;
    const rev = state.fx.reverb;
    const amt = state.fx.compress;
    const dType = DELAY_TYPES[state.fx.delayType] || DELAY_TYPES.echo;
    const rType = REVERB_TYPES[state.fx.reverbType] || REVERB_TYPES.room;
    const cType = COMPRESSOR_TYPES[state.fx.compressType] || COMPRESSOR_TYPES.soft;

    if (this.comp) {
      // amt 0 = nearly bypass; amt 1 = full type settings (clearly audible)
      const thr = -2 + (cType.threshold + 2) * Math.pow(amt, 0.75);
      const ratio = 1.05 + (cType.ratio - 1.05) * amt;
      this.comp.threshold.setTargetAtTime(thr, t, 0.04);
      this.comp.ratio.setTargetAtTime(ratio, t, 0.04);
      this.comp.knee.setTargetAtTime(0.5 + cType.knee * amt, t, 0.04);
      this.comp.attack.setTargetAtTime(cType.attack, t, 0.04);
      this.comp.release.setTargetAtTime(cType.release, t, 0.04);
      if (this.makeupGain) {
        const mu = 1 + (cType.makeup - 1) * amt * 1.4;
        this.makeupGain.gain.setTargetAtTime(mu, t, 0.06);
      }
      if (this.dryGain) {
        this.dryGain.gain.setTargetAtTime(1, t, 0.06);
      }
    }

    if (this.masterGain) {
      const vol = Math.max(0, Math.min(1.5, state.fx.master ?? 1));
      this.masterGain.gain.setTargetAtTime(vol, t, 0.04);
    }

    if (this.delayWet && this.delay && this.delayFeedback) {
      const time = dType.timeMin + del * (dType.timeMax - dType.timeMin);
      const fb = dType.fbMin + del * (dType.fbMax - dType.fbMin);
      this.delayWet.gain.setTargetAtTime(del * dType.wetScale, t, 0.06);
      this.delayFeedback.gain.setTargetAtTime(fb, t, 0.06);
      this.delay.delayTime.setTargetAtTime(time, t, 0.08);
    }

    if (this.reverbWet && this.reverbInput) {
      this.reverbWet.gain.setTargetAtTime(rev * rType.wetScale, t, 0.08);
      this.reverbInput.gain.setTargetAtTime(0.35 + rev * 0.65, t, 0.08);
      if (this._reverbTaps && this._reverbTaps.length) {
        this._reverbTaps.forEach((tap, i) => {
          const dt = rType.taps[i] != null ? rType.taps[i] : rType.taps[rType.taps.length - 1];
          const g = rType.tapGains[i] != null ? rType.tapGains[i] : 0.15;
          const hz = rType.filters[i] != null ? rType.filters[i] : 3000;
          try {
            tap.d.delayTime.setTargetAtTime(dt, t, 0.1);
            tap.g.gain.setTargetAtTime(g, t, 0.08);
            tap.f.frequency.setTargetAtTime(hz, t, 0.1);
            if (tap.fb) tap.fb.gain.setTargetAtTime(rType.fb, t, 0.1);
          } catch (_) {}
        });
      }
    }
  },

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
    if (this.sampleBank && this.sampleBank.ready) {
      const played = this.sampleBank.play(note.midi, this.bus, t, { vel, radial, angleRad });
      if (played) {
        this.voices.set(idx, { idx, stop: played.stop, released: false });
        return;
      }
    }
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
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + T0 + 0.12);
      oscs.push(osc);
    });
    // No transient noise — clean tone only
    const voice = { idx, out, oscs, released: false, stop: (tt, tc) => this.releaseVoice(voice, tt, tc) };
    oscs[0].onended = () => { this.voices.delete(idx); try { out.disconnect(); } catch (_) {} };
    this.voices.set(idx, voice);
  },

  releaseVoice(voice, t, tc) {
    if (!voice || voice.released) return;
    voice.released = true;
    try { if (voice.out) { voice.out.gain.cancelScheduledValues(t); voice.out.gain.setTargetAtTime(0, t, tc); } } catch (_) {}
  },

  damp(idx) {
    const v = this.voices.get(idx);
    if (!v || !this.ctx) return;
    if (v.stop) v.stop(this.ctx.currentTime, 0.07);
    else this.releaseVoice(v, this.ctx.currentTime, 0.07);
  }
};

const canvas = document.getElementById('pan');
const ctx2 = canvas.getContext('2d');
let W = 800, H = 800, R = 0, CX = 0, CY = 0;

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(rect.width * dpr));
  H = Math.max(1, Math.round(rect.height * dpr));
  canvas.width = W; canvas.height = H;
  CX = W / 2; CY = H / 2;
  R = Math.min(W, H) * 0.48;
  layoutFields(); draw();
}

function layoutFields() {
  const midis = state.notes.map((n) => n.midi);
  const midiMin = Math.min.apply(null, midis);
  const midiMax = Math.max.apply(null, midis);
  const midiSpan = Math.max(1, midiMax - midiMin);
  state.fields = state.notes.map((n) => {
    const lowAmount = (midiMax - n.midi) / midiSpan;
    const size = 1 + lowAmount * 0.42;
    if (n.kind === 'ding') {
      const rr = R * 0.185 * size;
      return { i: n.index, x: CX, y: CY, rx: rr, ry: rr, rot: 0 };
    }
    const a = (n.angle * Math.PI) / 180;
    const d = R * 0.58;
    const radial = R * 0.155 * size;
    const tangential = R * 0.112 * size;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const rot = Math.atan2(uy, ux);
    return { i: n.index, x: CX + ux * d, y: CY + uy * d, rx: radial, ry: tangential, rot, ux, uy };
  });
}

function pathPad(f) {
  ctx2.beginPath();
  ctx2.ellipse(f.x, f.y, f.rx, f.ry, f.rot || 0, 0, Math.PI * 2);
}

function draw() {
  ctx2.clearRect(0, 0, W, H);
  const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
  g.addColorStop(0, '#2c2d32'); g.addColorStop(0.5, '#16171b'); g.addColorStop(1, '#0a0a0c');
  ctx2.fillStyle = g;
  ctx2.beginPath(); ctx2.arc(CX, CY, R, 0, Math.PI * 2); ctx2.fill();
  ctx2.strokeStyle = 'rgba(201,162,39,0.14)';
  ctx2.lineWidth = Math.max(1.5, R * 0.01);
  ctx2.beginPath(); ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2); ctx2.stroke();

  state.fields.forEach((f, i) => {
    const note = state.notes[i];
    const glow = state.glow[i] || 0;
    const radial = state.zoneFlash[i] || 0;
    const isDing = note.kind === 'ding';
    const hlx = f.ux != null ? f.ux : -0.35;
    const hly = f.uy != null ? f.uy : -0.45;
    const pad = ctx2.createRadialGradient(f.x + hlx * f.rx * 0.35, f.y + hly * f.ry * 0.35, 0, f.x, f.y, Math.max(f.rx, f.ry));
    pad.addColorStop(0, 'rgba(78,80,88,0.95)');
    pad.addColorStop(0.55, 'rgba(40,42,48,0.95)');
    pad.addColorStop(1, 'rgba(22,23,27,0.98)');
    ctx2.fillStyle = pad; pathPad(f); ctx2.fill();
    ctx2.strokeStyle = glow > 0.04 ? `rgba(201,162,39,${0.3 + glow * 0.55})` : 'rgba(255,255,255,0.12)';
    ctx2.lineWidth = isDing ? 2.2 : 1.5;
    pathPad(f); ctx2.stroke();
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
      ctx2.fill(); ctx2.restore();
    }
    drawSlit(f, isDing, glow);
  });
}

function drawSlit(f, isDing, glow) {
  const rot = f.rot || 0;
  const len = isDing ? f.rx * 0.42 : f.rx * 0.55;
  const halfW = isDing ? Math.max(1.2, f.rx * 0.06) : Math.max(1.0, f.ry * 0.11);
  const pulse = glow > 0.01 ? (0.82 + 0.18 * Math.sin(performance.now() * 0.014)) : 1;
  const a = Math.min(1, glow * 1.25) * pulse;
  ctx2.save();
  ctx2.translate(f.x, f.y);
  ctx2.rotate(rot);
  ctx2.globalCompositeOperation = 'lighter';
  const ambA = 0.06 + a * 0.55;
  const amb = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.8);
  amb.addColorStop(0, `rgba(255,220,120,${ambA * 0.5})`);
  amb.addColorStop(0.35, `rgba(201,162,39,${ambA * 0.28})`);
  amb.addColorStop(0.7, `rgba(201,162,39,${ambA * 0.08})`);
  amb.addColorStop(1, 'rgba(201,162,39,0)');
  ctx2.fillStyle = amb;
  ctx2.beginPath(); ctx2.ellipse(0, 0, len * 1.55, halfW * (4.5 + a * 3), 0, 0, Math.PI * 2); ctx2.fill();
  if (a > 0.02) {
    const mid = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.15);
    mid.addColorStop(0, `rgba(255,235,160,${a * 0.55})`);
    mid.addColorStop(0.4, `rgba(228,195,90,${a * 0.28})`);
    mid.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = mid;
    ctx2.beginPath(); ctx2.ellipse(0, 0, len * 1.15, halfW * (2.8 + a * 2), 0, 0, Math.PI * 2); ctx2.fill();
  }
  ctx2.globalCompositeOperation = 'source-over';
  ctx2.beginPath(); ctx2.ellipse(0, 0, len, halfW, 0, 0, Math.PI * 2);
  const recess = ctx2.createRadialGradient(0, 0, 0, 0, 0, len);
  recess.addColorStop(0, 'rgba(0,0,0,0.78)');
  recess.addColorStop(0.6, 'rgba(0,0,0,0.5)');
  recess.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx2.fillStyle = recess; ctx2.fill();
  ctx2.strokeStyle = a > 0.05 ? `rgba(255,230,140,${0.35 + a * 0.6})` : 'rgba(255,255,255,0.1)';
  ctx2.lineWidth = Math.max(0.9, halfW * 0.65);
  ctx2.stroke();
  if (a > 0.02) {
    ctx2.globalCompositeOperation = 'lighter';
    ctx2.beginPath(); ctx2.ellipse(0, 0, len * 0.94, halfW * 0.62, 0, 0, Math.PI * 2);
    const core = ctx2.createLinearGradient(-len, 0, len, 0);
    core.addColorStop(0, `rgba(201,162,39,${a * 0.2})`);
    core.addColorStop(0.35, `rgba(255,240,170,${a * 0.95})`);
    core.addColorStop(0.5, `rgba(255,250,220,${a})`);
    core.addColorStop(0.65, `rgba(255,240,170,${a * 0.95})`);
    core.addColorStop(1, `rgba(201,162,39,${a * 0.2})`);
    ctx2.fillStyle = core; ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(0, 0, len * 0.7, halfW * 0.28, 0, 0, Math.PI * 2);
    ctx2.fillStyle = `rgba(255,252,235,${a * 0.85})`; ctx2.fill();
    const bloom = ctx2.createRadialGradient(0, 0, 0, 0, 0, len * 1.6);
    bloom.addColorStop(0, `rgba(255,230,140,${a * 0.4})`);
    bloom.addColorStop(0.4, `rgba(228,195,90,${a * 0.18})`);
    bloom.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = bloom;
    ctx2.beginPath(); ctx2.ellipse(0, 0, len * 1.4, halfW * (3.8 + a * 2.5), 0, 0, Math.PI * 2); ctx2.fill();
  }
  ctx2.restore();
}

function tick() {
  let any = false;
  for (let i = 0; i < 9; i++) {
    if (state.glow[i] > 0.001) { state.glow[i] *= 0.9; any = true; }
    else state.glow[i] = 0;
  }
  if (any) draw();
  requestAnimationFrame(tick);
}

function hitVector(cx, cy) {
  let best = null, bestD = Infinity;
  for (const f of state.fields) {
    const dx = cx - f.x, dy = cy - f.y;
    const rot = f.rot || 0;
    const cos = Math.cos(-rot), sin = Math.sin(-rot);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const d = Math.hypot(lx / f.rx, ly / f.ry);
    if (d <= 1.28 && d < bestD) {
      bestD = d;
      best = { idx: f.i, radial: d, angleRad: Math.atan2(dy, dx) };
    }
  }
  return best;
}

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr = W / rect.width;
  return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
}

function estimateVelocity(e, idx) {
  let v = 0.65;
  if (typeof e.pressure === 'number' && e.pressure > 0) v = 0.25 + e.pressure * 0.75;
  if (typeof e.force === 'number' && e.force > 0) v = Math.max(v, Math.min(1, e.force));
  const now = performance.now();
  const last = state.lastStrikeAt.get(idx) || 0;
  const dt = now - last;
  state.lastStrikeAt.set(idx, now);
  if (dt > 0 && dt < 90) v = Math.min(1, v * (0.85 + (90 - dt) / 200));
  return v;
}

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
canvas.addEventListener('pointercancel', (e) => { state.pointers.delete(e.pointerId); });

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
  alert('Play the handpan: tap the tone fields or use Q W E R T Y U I O. Drag Comp / Ambiance / Room knobs. Open FX for delay, reverb, compressor types & master volume.');
});

function setupKnob(id, key, initial) {
  const el = document.getElementById(id);
  if (!el) return;
  const cnv = el.querySelector('.knob-canvas');
  const valEl = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
  let value = initial, dragging = false, lastY = 0;
  function paint() {
    if (!cnv) return;
    const c = cnv.getContext('2d');
    const s = cnv.width;
    c.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, r = s * 0.38;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 6; c.stroke();
    const start = Math.PI * 0.75;
    c.beginPath(); c.arc(cx, cy, r, start, start + Math.PI * 1.5 * value);
    c.strokeStyle = '#c9a227'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
  }
  function setVal(v) {
    value = Math.max(0, Math.min(1, v));
    state.fx[key] = value;
    if (valEl) valEl.textContent = Math.round(value * 100);
    el.setAttribute('aria-valuenow', Math.round(value * 100));
    paint();
    if (!engine.ctx) engine.ensure();
    else engine.applyFx();
  }
  setVal(initial);
  el.addEventListener('pointerdown', (e) => { dragging = true; lastY = e.clientY; el.setPointerCapture(e.pointerId); el.classList.add('is-active'); });
  el.addEventListener('pointermove', (e) => { if (!dragging) return; const dy = lastY - e.clientY; lastY = e.clientY; setVal(value + dy * 0.005); });
  el.addEventListener('pointerup', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('pointercancel', () => { dragging = false; el.classList.remove('is-active'); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setVal(value + 0.05); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setVal(value - 0.05); }
  });
}

setupKnob('knobCompress', 'compress', 0.4);
setupKnob('knobDelay', 'delay', 0.15);
setupKnob('knobReverb', 'reverb', 0.25);

function setFxPanelOpen(open) {
  const panel = document.getElementById('fxPanel');
  const backdrop = document.getElementById('fxBackdrop');
  const btn = document.getElementById('btnFxSettings');
  if (!panel || !backdrop || !btn) return;
  if (open) {
    panel.hidden = false; backdrop.hidden = false;
    void panel.offsetWidth;
    panel.classList.add('is-open'); backdrop.classList.add('is-open');
    btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
  } else {
    panel.classList.remove('is-open'); backdrop.classList.remove('is-open');
    btn.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
    const hide = () => { if (!panel.classList.contains('is-open')) { panel.hidden = true; backdrop.hidden = true; } };
    panel.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 360);
  }
}

function selectDelayType(id) {
  if (!DELAY_TYPES[id]) return;
  state.fx.delayType = id;
  document.querySelectorAll('#delayTypes .fx-type-btn').forEach((b) => {
    const on = b.getAttribute('data-delay') === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const desc = document.getElementById('delayDesc');
  if (desc) desc.textContent = DELAY_TYPES[id].desc;
  engine.applyFx();
}

function selectReverbType(id) {
  if (!REVERB_TYPES[id]) return;
  state.fx.reverbType = id;
  document.querySelectorAll('#reverbTypes .fx-type-btn').forEach((b) => {
    const on = b.getAttribute('data-reverb') === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const desc = document.getElementById('reverbDesc');
  if (desc) desc.textContent = REVERB_TYPES[id].desc;
  engine.applyFx();
}

function selectCompressType(id) {
  if (!COMPRESSOR_TYPES[id]) return;
  state.fx.compressType = id;
  document.querySelectorAll('#compTypes .fx-type-btn').forEach((b) => {
    const on = b.getAttribute('data-comp') === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const desc = document.getElementById('compDesc');
  if (desc) desc.textContent = COMPRESSOR_TYPES[id].desc;
  engine.applyFx();
}

const btnFx = document.getElementById('btnFxSettings');
if (btnFx) btnFx.addEventListener('click', () => setFxPanelOpen(!btnFx.classList.contains('is-open')));
const fxClose = document.getElementById('fxPanelClose');
if (fxClose) fxClose.addEventListener('click', () => setFxPanelOpen(false));
const fxBackdrop = document.getElementById('fxBackdrop');
if (fxBackdrop) fxBackdrop.addEventListener('click', () => setFxPanelOpen(false));
document.getElementById('delayTypes')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delay]');
  if (btn) selectDelayType(btn.getAttribute('data-delay'));
});
document.getElementById('reverbTypes')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-reverb]');
  if (btn) selectReverbType(btn.getAttribute('data-reverb'));
});
document.getElementById('compTypes')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-comp]');
  if (btn) selectCompressType(btn.getAttribute('data-comp'));
});

const masterEl = document.getElementById('masterVol');
const masterVal = document.getElementById('masterVolVal');
if (masterEl) {
  const setMaster = (v) => {
    const n = Math.max(0, Math.min(150, Number(v) || 0));
    state.fx.master = n / 100;
    masterEl.value = String(n);
    masterEl.setAttribute('aria-valuenow', String(n));
    if (masterVal) masterVal.textContent = n + '%';
    engine.applyFx();
  };
  masterEl.addEventListener('input', () => setMaster(masterEl.value));
  setMaster(masterEl.value || 100);
}

window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setFxPanelOpen(false); });
window.addEventListener('resize', resize);
rebuildNotes();
resize();
requestAnimationFrame(tick);

function unlock() {
  engine.ensure();
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('pointerdown', unlock);
