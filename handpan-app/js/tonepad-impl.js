/**
 * TonePad v51 — infinity carousel + Clear + per-layer sound modules (9 instruments).
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const COLS = 16;
const ROWS = 8;
const MELO_ROWS = ROWS;
const DRUM_ROWS = 8; // 10 requested; at 390px-wide (16 cols) cell width is ~20px (<32px), so 8 curated rows for readability
const DRUM_VOICES = ['kick', 'snare', 'clap', 'ch', 'oh', 'lowtom', 'hightom', 'rim'];
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v36';
const LAYER_COUNT = 5;
const DEFAULT_SOUND = 'bloom';
const DEFAULT_MODE = 'melodic';

const LAYER_THEMES = [
  { name: 'Amber',  h: 42,  s: 70, l: 52 },  // L1 warm gold
  { name: 'Jade',   h: 150, s: 55, l: 48 },  // L2 green
  { name: 'Sky',    h: 200, s: 65, l: 52 },  // L3 cyan-blue
  { name: 'Violet', h: 275, s: 55, l: 58 },  // L4 purple
  { name: 'Rose',   h: 340, s: 60, l: 55 },  // L5 pink-red
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
const _iconSvg = (body) => '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' + body + '</svg>';
const TP_ICONS = {
  play: _iconSvg('<polygon points="6.5,4.5 15.5,10 6.5,15.5" fill="currentColor"/>'),
  stop: _iconSvg('<rect x="5.5" y="5.5" width="9" height="9" rx="1.5" fill="currentColor"/>'),
  clear: _iconSvg('<path d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>'),
  melody: _iconSvg('<circle cx="5" cy="14" r="2.1" fill="currentColor"/><circle cx="10" cy="10" r="2.1" fill="currentColor"/><circle cx="15" cy="6" r="2.1" fill="currentColor"/>'),
  drum: _iconSvg('<circle cx="10" cy="10" r="6.2" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/>'),
};
const MELO_FX_KNOBS = [
  { k: 'reverb', label: 'REV' },
  { k: 'delay', label: 'DLY' },
  { k: 'tone', label: 'TONE' },
  { k: 'decay', label: 'DEC' },
  { k: 'shimmer', label: 'SHIM' },
];
const DRUM_FX_KNOBS = [
  { k: 'tune', label: 'TUNE' },
  { k: 'decay', label: 'DEC' },
  { k: 'drive', label: 'DRV' },
  { k: 'space', label: 'SPC' },
  { k: 'swing', label: 'SWNG' },
];

export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * MELO_ROWS));
    const drumLayers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * DRUM_ROWS));
    const layerSounds = Array.from({ length: LAYER_COUNT }, () => DEFAULT_SOUND);
    const layerModes = Array.from({ length: LAYER_COUNT }, () => DEFAULT_MODE);
    let activeLayer = 0;
    let playLayer = 0;
    let velocity = 0.7;
    let probability = 1;
    let humanize = 0.12;
    const MELO_FX_DEFAULT = () => ({ reverb: 0, delay: 0, tone: 0.5, decay: 0.5, shimmer: 0 });
    const DRUM_FX_DEFAULT = () => ({ tune: 0.5, decay: 0.5, drive: 0, space: 0, swing: 0 });
    const fxToneMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 2.2);   // 0.5->1.0, ~0.47..2.14
    const fxDecayMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 2.64); // 0.5->1.0, ~0.4..2.5
    const fxTuneMul = (v) => Math.pow(2, (clamp01(v, 0.5) - 0.5) * 1.0);   // 0.5->1.0, ~0.707..1.414 (±6st)
    let tpSends = null; // lazy shared reverb+delay, created on first non-zero send; defaults add no nodes
    function makeImpulse(ctx, dur, decay) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }
    function ensureTpSends() {
      if (tpSends || !audioCtx) return tpSends;
      const ctx = audioCtx;
      const master = getAudioMaster?.() || ctx.destination;
      const revIn = ctx.createGain(); revIn.gain.value = 1;
      const convolver = ctx.createConvolver(); convolver.buffer = makeImpulse(ctx, 1.15, 2.6);
      const revOut = ctx.createGain(); revOut.gain.value = 0; // faded in when used
      revIn.connect(convolver); convolver.connect(revOut); revOut.connect(master);
      const dlyIn = ctx.createGain(); dlyIn.gain.value = 1;
      const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.22;
      const fb = ctx.createGain(); fb.gain.value = 0.28; // capped feedback
      const dlyOut = ctx.createGain(); dlyOut.gain.value = 0;
      dlyIn.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(dlyOut); dlyOut.connect(master);
      tpSends = { ctx, revIn, revOut, convolver, dlyIn, delay, fb, dlyOut, revOn: false, dlyOn: false };
      return tpSends;
    }
    function fadeSendGain(g, target, t0) {
      try { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value || 0.0001), t0); g.gain.linearRampToValueAtTime(target, t0 + 0.03); }
      catch (_) { try { g.gain.value = target; } catch (_) {} }
    }
    function tapSend(source, kind, level, nodes, tEnd) {
      if (!(level > 0.001) || !audioCtx || !source) return;
      const s = ensureTpSends(); if (!s) return;
      const t0 = audioCtx.currentTime;
      if (kind === 'rev') { if (!s.revOn) { s.revOn = true; fadeSendGain(s.revOut, 0.42, t0); } }
      else { if (!s.dlyOn) { s.dlyOn = true; fadeSendGain(s.dlyOut, 0.32, t0); } }
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(Math.max(0, Math.min(1, level)) * 0.55, t0);
      source.connect(g); g.connect(kind === 'rev' ? s.revIn : s.dlyIn);
      if (nodes) nodes.push(g);
      // disconnect tap after voice ends; shared bus stays (cheap, 2 fx) until page lifecycle
      if (tEnd && isFinite(tEnd)) {
        const ms = Math.max(40, Math.ceil((tEnd - t0 + 0.15) * 1000));
        try { setTimeout(() => { try { source.disconnect(g); } catch(_){} try { g.disconnect(); } catch(_){} }, ms); } catch(_) {}
      }
    }
    const melodicFx = Array.from({ length: LAYER_COUNT }, MELO_FX_DEFAULT);
    const drumFx = Array.from({ length: LAYER_COUNT }, DRUM_FX_DEFAULT);
    function clamp01(v, fb) { return Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : fb; }
    function loadFxArr(src, defs, out) {
      if (!Array.isArray(src)) return;
      src.forEach((o, li) => {
        if (li >= LAYER_COUNT || !o || typeof o !== 'object') return;
        const d = defs(); Object.keys(d).forEach((k) => { out[li][k] = clamp01(o[k], d[k]); });
      });
    }
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

    function idx(c, r) { return r * COLS + c; }
    function modeOf(i) { return layerModes[i] === 'drum' ? 'drum' : 'melodic'; }
    function rowsForMode(mode) { return mode === 'drum' ? DRUM_ROWS : MELO_ROWS; }
    function rowsForLayer(i) { return rowsForMode(modeOf(i)); }
    function gridForLayer(i) { return modeOf(i) === 'drum' ? drumLayers[i] : layers[i]; }
    function activeRows() { return rowsForLayer(activeLayer); }
    function activeGrid() { return gridForLayer(activeLayer); }
    function layerHasNotes(i) {
      const g = gridForLayer(i);
      if (!g) return false;
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
        loadFxArr(s.fxMelodic, MELO_FX_DEFAULT, melodicFx);
        loadFxArr(s.fxDrum, DRUM_FX_DEFAULT, drumFx);
        if (Number.isFinite(s.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, s.activeLayer | 0));
        if (Array.isArray(s.layerSounds)) {
          s.layerSounds.forEach((id, li) => {
            if (li < LAYER_COUNT && typeof id === 'string' && SOUND_IDS.has(id)) layerSounds[li] = id;
          });
        }
        if (Array.isArray(s.layerModes)) {
          s.layerModes.forEach((m, li) => {
            if (li < LAYER_COUNT && (m === 'melodic' || m === 'drum')) layerModes[li] = m;
          });
        }
        if (Array.isArray(s.drumLayers)) {
          s.drumLayers.forEach((cells, li) => {
            if (li >= LAYER_COUNT || !Array.isArray(cells)) return;
            cells.forEach((v, i) => { if (i < drumLayers[li].length) drumLayers[li][i] = v ? 1 : 0; });
          });
        }
        if (Array.isArray(s.drumKits)) {
          s.drumKits.forEach((k, li) => {
            if (li < LAYER_COUNT && typeof k === 'string' && DRUM_KIT_IDS.has(k)) drumKits[li] = k;
          });
        }
      } catch (_) {}
    }
    function save() {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          layers: layers.map((l) => Array.from(l)),
          layerSounds: layerSounds.slice(),
          velocity, probability, humanize, activeLayer,
          layerModes: layerModes.slice(),
          drumLayers: drumLayers.map((l) => Array.from(l)),
          drumKits: drumKits.slice(),
          fxMelodic: melodicFx.map((o) => ({ ...o })),
          fxDrum: drumFx.map((o) => ({ ...o })),
          version: 48
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
    let _curShimmer = 0;
    function makePartial(type, freq, level, cents, t0, peak, attack, sustain, release, dest) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (cents) osc.detune.setValueAtTime(cents, t0);
      const life = envGain(g, t0, peak * level, attack, sustain, release);
      if (_curShimmer > 0.001) {
        try {
          const depth = _curShimmer * 7; // cents, gentle
          const dur = Math.max(0.05, life);
          const n = 64;
          const curve = new Float32Array(n);
          for (let i = 0; i < n; i++) curve[i] = (cents || 0) + Math.sin((i / (n - 1)) * Math.PI * 2 * dur * 4.5) * depth;
          osc.detune.setValueCurveAtTime(curve, t0, dur);
        } catch (_) {}
      }
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + life + 0.06);
      return life;
    }
    let drumNoiseBuf = null;
    let drumNoiseCtx = null;
    let activeDrumVoices = 0;
    const DRUM_VOICE_CAP = 24;
    let openHatChokes = [];
    function getDrumNoise(ctx) {
      if (drumNoiseBuf && drumNoiseCtx === ctx) return drumNoiseBuf;
      const len = Math.max(1, Math.floor(ctx.sampleRate * 1.0));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      drumNoiseBuf = buf; drumNoiseCtx = ctx;
      return buf;
    }
    function drumTrack(nodes, src, life, onDone) {
      activeDrumVoices += 1;
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        activeDrumVoices = Math.max(0, activeDrumVoices - 1);
        try { nodes.forEach((n) => { try { n.disconnect(); } catch (_) {} }); } catch (_) {}
        if (typeof onDone === 'function') try { onDone(); } catch (_) {}
      };
      try { src.onended = finish; } catch (_) {}
      try { setTimeout(finish, Math.max(50, Math.ceil((life + 0.12) * 1000))); } catch (_) {}
    }
    function chokeOpenHats(t0) {
      const list = openHatChokes.slice();
      openHatChokes = [];
      list.forEach((ch) => {
        try {
          const g = ch.g;
          g.gain.cancelScheduledValues(t0);
          g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.02);
          try { ch.src.stop(t0 + 0.03); } catch (_) {}
        } catch (_) {}
      });
    }
    const DRUM_KIT_LIST = [
      { id: 'classic', name: 'Classic' },
      { id: 'deep', name: 'Deep' },
      { id: 'punchy', name: 'Punchy' },
      { id: 'lofi', name: 'Lo-fi' },
      { id: 'industrial', name: 'Industrial' },
      { id: 'tribal', name: 'Tribal' },
    ];
    const DRUM_KIT_IDS = new Set(DRUM_KIT_LIST.map((k) => k.id));
    const DEFAULT_DRUM_KIT = 'classic';
    const drumKits = Array.from({ length: LAYER_COUNT }, () => DEFAULT_DRUM_KIT);
    function kitOf(i) { const k = drumKits[i]; return DRUM_KIT_IDS.has(k) ? k : DEFAULT_DRUM_KIT; }
    const _driveCurves = {};
    function driveCurve(amount) {
      const k = Math.max(0, Math.min(40, Math.round(amount * 10) / 10));
      if (_driveCurves[k]) return _driveCurves[k];
      const n = 1024, c = new Float32Array(n);
      const a = 1 + k * 4;
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a || 1); }
      _driveCurves[k] = c; return c;
    }
    function maybeDrive(ctx, dest, nodes, amount) {
      if (!(amount > 0)) return dest;
      const ws = ctx.createWaveShaper(); ws.curve = driveCurve(amount); ws.oversample = '2x';
      ws.connect(dest); nodes.push(ws); return ws;
    }
    // Kit params: each returns per-voice overrides merged over classic behavior.
    // Classic values mirror the original triggerDrum exactly.
    const KITS = {
      classic: { kick:{base:52,sweep:3.2,sweepEnd:52,sweepT:0.06,peak:0.95,dur:0.42,sub:{f0:90,f1:42,sweepT:0.07,peak:0.35,dur:0.22}}, snare:{dur:0.22,peak:0.55,bp:1800,bpQ:0.7,hp:700,body:220,bodyEnd:160,bodyDur:0.11,bodyPeak:0.45}, clap:{dur:0.24,peak:0.38,bp:1400}, ch:{dur:0.055,peak:0.22,hp:6500,bp:9500}, oh:{dur:0.42,peak:0.18,hp:5200,bp:9500}, lowtom:{base:110,sweep:2.1,sweepEnd:110,sweepT:0.09,peak:0.55,dur:0.32}, hightom:{base:165,sweep:2.1,sweepEnd:165,sweepT:0.09,peak:0.55,dur:0.32}, rim:{dur:0.045,peak:0.28,bp:1800,bpQ:5}, perc:{dur:0.09,peak:0.2,bp:3200,bpQ:2.2} },
      deep:    { kick:{base:42,sweep:2.6,sweepEnd:38,sweepT:0.09,peak:1.0,dur:0.62,sub:{f0:70,f1:34,sweepT:0.11,peak:0.42,dur:0.34},lp:220}, snare:{dur:0.26,peak:0.45,bp:1500,bpQ:0.6,hp:500,body:180,bodyEnd:130,bodyDur:0.14,bodyPeak:0.4}, clap:{dur:0.22,peak:0.3,bp:1200}, ch:{dur:0.075,peak:0.16,hp:5200,bp:8000}, oh:{dur:0.55,peak:0.14,hp:4200,bp:7800}, lowtom:{base:92,sweep:1.9,sweepEnd:88,sweepT:0.11,peak:0.6,dur:0.42}, hightom:{base:140,sweep:1.9,sweepEnd:132,sweepT:0.1,peak:0.55,dur:0.38}, rim:{dur:0.055,peak:0.22,bp:1500,bpQ:3.5}, perc:{dur:0.11,peak:0.17,bp:2600,bpQ:1.8} },
      punchy:  { kick:{base:58,sweep:4.2,sweepEnd:55,sweepT:0.035,peak:1.05,dur:0.24,sub:{f0:110,f1:50,sweepT:0.04,peak:0.28,dur:0.12}}, snare:{dur:0.16,peak:0.62,bp:2100,bpQ:0.9,hp:900,body:240,bodyEnd:190,bodyDur:0.07,bodyPeak:0.55}, clap:{dur:0.18,peak:0.42,bp:1700}, ch:{dur:0.038,peak:0.24,hp:7000,bp:10500}, oh:{dur:0.28,peak:0.17,hp:5800,bp:10000}, lowtom:{base:120,sweep:2.4,sweepEnd:115,sweepT:0.06,peak:0.58,dur:0.22}, hightom:{base:180,sweep:2.4,sweepEnd:172,sweepT:0.055,peak:0.58,dur:0.2}, rim:{dur:0.035,peak:0.32,bp:2200,bpQ:6}, perc:{dur:0.06,peak:0.22,bp:3800,bpQ:2.6} },
      lofi:    { drive:0.9, kick:{base:50,sweep:2.8,sweepEnd:48,sweepT:0.07,peak:0.85,dur:0.3,sub:{f0:80,f1:40,sweepT:0.08,peak:0.3,dur:0.16},lp:180}, snare:{dur:0.15,peak:0.46,bp:1400,bpQ:0.5,hp:600,body:190,bodyEnd:140,bodyDur:0.08,bodyPeak:0.35,lp:3200}, clap:{dur:0.16,peak:0.3,bp:1100,lp:2800}, ch:{dur:0.04,peak:0.17,hp:5500,bp:7500,lp:7000}, oh:{dur:0.26,peak:0.13,hp:4500,bp:7000,lp:6500}, lowtom:{base:105,sweep:1.8,sweepEnd:100,sweepT:0.08,peak:0.48,dur:0.24,lp:900}, hightom:{base:155,sweep:1.8,sweepEnd:148,sweepT:0.075,peak:0.48,dur:0.22,lp:1100}, rim:{dur:0.04,peak:0.22,bp:1400,bpQ:3,lp:2600}, perc:{dur:0.07,peak:0.16,bp:2400,bpQ:1.5,lp:3200} },
      industrial:{ drive:1.6, kick:{base:55,sweep:3.8,sweepEnd:48,sweepT:0.05,peak:1.1,dur:0.34,sub:{f0:95,f1:44,sweepT:0.06,peak:0.38,dur:0.18},type:'triangle'}, snare:{dur:0.2,peak:0.58,bp:2300,bpQ:1.1,hp:1000,body:260,bodyEnd:170,bodyDur:0.09,bodyPeak:0.5}, clap:{dur:0.2,peak:0.4,bp:1900,bpQ:1.0}, ch:{dur:0.045,peak:0.26,hp:7500,bp:11000,bpQ:1.8}, oh:{dur:0.34,peak:0.2,hp:6200,bp:10500,bpQ:1.6}, lowtom:{base:115,sweep:2.3,sweepEnd:105,sweepT:0.07,peak:0.6,dur:0.28,type:'triangle'}, hightom:{base:175,sweep:2.3,sweepEnd:160,sweepT:0.065,peak:0.6,dur:0.26,type:'triangle'}, rim:{dur:0.04,peak:0.34,bp:2400,bpQ:7}, perc:{dur:0.08,peak:0.24,bp:4200,bpQ:3.2} },
      tribal:  { kick:{base:48,sweep:2.4,sweepEnd:44,sweepT:0.1,peak:0.88,dur:0.5,sub:{f0:75,f1:38,sweepT:0.12,peak:0.4,dur:0.28}}, snare:{dur:0.18,peak:0.4,bp:1300,bpQ:0.5,hp:450,body:170,bodyEnd:125,bodyDur:0.12,bodyPeak:0.38}, clap:{dur:0.2,peak:0.28,bp:1000}, ch:{dur:0.065,peak:0.15,hp:5000,bp:7200}, oh:{dur:0.36,peak:0.13,hp:4000,bp:6800}, lowtom:{base:95,sweep:1.7,sweepEnd:82,sweepT:0.13,peak:0.72,dur:0.46}, hightom:{base:145,sweep:1.7,sweepEnd:128,sweepT:0.12,peak:0.68,dur:0.4}, rim:{dur:0.07,peak:0.3,bp:1200,bpQ:2.5}, perc:{dur:0.12,peak:0.18,bp:2200,bpQ:1.2} },
    };
    function getKit(id) { return KITS[DRUM_KIT_IDS.has(id) ? id : DEFAULT_DRUM_KIT] || KITS.classic; }
    function triggerDrum(row, when, vel, kitId, fxLayer) {
      if (!audioCtx || !bus) return;
      if (activeDrumVoices >= DRUM_VOICE_CAP) return;
      const t0 = Math.max(audioCtx.currentTime + 0.003, when);
      const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
      const voice = DRUM_VOICES[Math.max(0, Math.min(DRUM_VOICES.length - 1, row))] || 'kick';
      const kit = getKit(kitId);
      const dfx = (fxLayer != null && drumFx[fxLayer]) ? drumFx[fxLayer] : DRUM_FX_DEFAULT();
      const tm = fxTuneMul(dfx.tune), dm = fxDecayMul(dfx.decay);
      const effDrive = (kit.drive || 0) + clamp01(dfx.drive, 0) * 2.0; // knob 0 = exact kit drive (0.5 neutral mapped so 0 is default)
      const out = audioCtx.createGain();
      const dest = maybeDrive(audioCtx, bus, [out], effDrive);
      out.connect(dest);
      const nodes = [out];
      if (dest !== bus) nodes.push(dest);

      const addLP = (chainIn, freq) => {
        if (!(freq > 0)) return chainIn;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(freq, t0); lp.Q.setValueAtTime(0.5, t0);
        chainIn.connect(lp); nodes.push(lp); return lp;
      };
      let voiceDur = 0.2;

      if (voice === 'kick' || voice === 'lowtom' || voice === 'hightom') {
        const isTom = voice !== 'kick';
        const p = kit[voice] || KITS.classic[voice];
        const base = p.base * tm, peak = p.peak * (0.5 + v * 0.7), dur = p.dur * dm;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = p.type || 'sine';
        osc.frequency.setValueAtTime(base * p.sweep, t0);
        osc.frequency.exponentialRampToValueAtTime(p.sweepEnd * tm, t0 + p.sweepT * dm);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        const tail = addLP(g, p.lp);
        osc.connect(g); tail.connect(out); nodes.push(osc, g);
        if (p.sub) {
          const s = p.sub;
          const sd = s.dur * dm;
          const o2 = audioCtx.createOscillator(); const g2 = audioCtx.createGain();
          o2.type = 'triangle'; o2.frequency.setValueAtTime(s.f0 * tm, t0);
          o2.frequency.exponentialRampToValueAtTime(s.f1 * tm, t0 + s.sweepT * dm);
          g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(peak * s.peak, t0 + 0.005);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + sd);
          const t2 = addLP(g2, p.lp);
          o2.connect(g2); t2.connect(out); nodes.push(o2, g2);
          o2.start(t0); o2.stop(t0 + sd + 0.06);
        }
        osc.start(t0); osc.stop(t0 + dur + 0.04);
        drumTrack(nodes, osc, dur);
      } else if (voice === 'snare') {
        const p = kit.snare || KITS.classic.snare;
        const dur = voiceDur = p.dur * dm, bodyDur = p.bodyDur * dm, peak = p.peak * (0.45 + v * 0.7);
        const nsrc = audioCtx.createBufferSource(); nsrc.buffer = getDrumNoise(audioCtx);
        const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ, t0);
        const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(p.hp * tm, t0);
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(peak, t0 + 0.003);
        ng.gain.exponentialRampToValueAtTime(peak * 0.25, t0 + 0.04); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        nsrc.connect(hp); hp.connect(bp); bp.connect(ng); addLP(ng, p.lp).connect(out);
        const osc = audioCtx.createOscillator(); const og = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(p.body * tm, t0); osc.frequency.exponentialRampToValueAtTime(p.bodyEnd * tm, t0 + 0.06 * dm);
        og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(peak * p.bodyPeak, t0 + 0.003);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + bodyDur);
        osc.connect(og); og.connect(out);
        nodes.push(nsrc, bp, hp, ng, osc, og);
        nsrc.start(t0); nsrc.stop(t0 + dur + 0.04); osc.start(t0); osc.stop(t0 + bodyDur + 0.04);
        drumTrack(nodes, nsrc, dur);
      } else if (voice === 'ch' || voice === 'oh') {
        if (voice === 'ch') chokeOpenHats(t0);
        const p = kit[voice] || KITS.classic[voice];
        const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
        const nsrc = audioCtx.createBufferSource(); nsrc.buffer = getDrumNoise(audioCtx);
        const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(p.hp * tm, t0);
        const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ || 0.9, t0);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        nsrc.connect(hp); hp.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out);
        nodes.push(nsrc, hp, bp, g);
        nsrc.start(t0); nsrc.stop(t0 + dur + 0.04);
        if (voice === 'oh') {
          const entry = { g, src: nsrc };
          openHatChokes.push(entry);
          drumTrack(nodes, nsrc, dur, () => { openHatChokes = openHatChokes.filter((x) => x !== entry); });
        } else {
          drumTrack(nodes, nsrc, dur);
        }
      } else if (voice === 'clap') {
        const p = kit.clap || KITS.classic.clap;
        const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
        let lastSrc = null;
        [0, 0.011, 0.023].forEach((off, k) => {
          const nsrc = audioCtx.createBufferSource(); nsrc.buffer = getDrumNoise(audioCtx);
          const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(p.bp * tm + k * 120, t0 + off); bp.Q.setValueAtTime(p.bpQ || 0.8, t0 + off);
          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.0001, t0 + off); g.gain.exponentialRampToValueAtTime(peak * (k === 2 ? 1 : 0.65), t0 + off + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + (k === 2 ? dur : 0.03));
          nsrc.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out); nodes.push(nsrc, bp, g);
          nsrc.start(t0 + off); nsrc.stop(t0 + off + dur + 0.04); lastSrc = nsrc;
        });
        drumTrack(nodes, lastSrc, dur);
      } else if (voice === 'rim' || voice === 'perc') {
        const p = kit[voice] || KITS.classic[voice] || KITS.classic.rim;
        const dur = voiceDur = p.dur * dm, peak = p.peak * (0.45 + v * 0.7);
        const nsrc = audioCtx.createBufferSource(); nsrc.buffer = getDrumNoise(audioCtx);
        const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.setValueAtTime(p.bp * tm, t0); bp.Q.setValueAtTime(p.bpQ, t0);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        nsrc.connect(bp); bp.connect(g); addLP(g, p.lp).connect(out); nodes.push(nsrc, bp, g);
        nsrc.start(t0); nsrc.stop(t0 + dur + 0.04);
        drumTrack(nodes, nsrc, dur);
      } else {
        const dur = voiceDur = 0.08;
        const nsrc = audioCtx.createBufferSource(); nsrc.buffer = getDrumNoise(audioCtx);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2 * v, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        nsrc.connect(g); g.connect(out); nodes.push(nsrc, g);
        nsrc.start(t0); nsrc.stop(t0 + dur + 0.04);
        drumTrack(nodes, nsrc, dur);
      }
      tapSend(out, 'rev', clamp01(dfx.space, 0) * 0.7, nodes, t0 + voiceDur + 0.25);
    }
    function trigger(row, when, vel, soundId, mode, fxLayer) {
      if (!audioCtx || !bus) return;
      const fli = (fxLayer != null) ? fxLayer : (playing ? playLayer : activeLayer);
      if (mode === 'drum') { triggerDrum(row, when, vel, kitOf(fli), fli); return; }
      const mfx = melodicFx[fli] || MELO_FX_DEFAULT();
      const tmf = fxToneMul(mfx.tone), dmf = fxDecayMul(mfx.decay);
      _curShimmer = clamp01(mfx.shimmer, 0);
      const clampFreq = (hz) => Math.min(18500, Math.max(30, hz));
      const f = freqForRow(row);
      const t0 = Math.max(audioCtx.currentTime + 0.003, when);
      const v = Math.max(0.05, Math.min(1, vel == null ? 0.6 : vel));
      const id = (soundId && SOUND_IDS.has(soundId)) ? soundId : layerSounds[fli] || DEFAULT_SOUND;
      const fil = audioCtx.createBiquadFilter();
      const mix = audioCtx.createGain();
      mix.gain.setValueAtTime(1, t0);
      mix.connect(fil);
      fil.connect(bus);

      if (id === 'bloom') {
        const attack = 0.09 + (1 - v) * 0.14;
        const sustain = 0.55 + v * 0.9;
        let release = 2.4 + (MELO_ROWS - row) * 0.08 + v * 1.2; release *= dmf;
        const peak = 0.05 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.7, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(4200, f * 5.5)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(1800, f * 2.2)) * tmf), t0 + (attack + sustain + release) * 0.85);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.42, 5.5, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.002, 0.22, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.997, 0.1, -3, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 0.5, 0.08, 0, t0, peak, attack, sustain, release, mix);
      } else if (id === 'handpan') {
        const attack = 0.012 + (1 - v) * 0.02;
        const sustain = 0.08;
        let release = 1.6 + v * 0.9; release *= dmf;
        const peak = 0.07 + v * 0.11;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(1.1, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(5200, f * 6.5)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(1400, f * 2.4)) * tmf), t0 + release * 0.7);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.38, 3, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', f * 2.76, 0.22, -4, t0, peak, attack, sustain, release * 0.7, mix);
        makePartial('sine', f * 4.05, 0.09, 0, t0, peak, attack, sustain, release * 0.5, mix);
        makePartial('triangle', f * 1.01, 0.12, 0, t0, peak, attack, sustain, release * 0.9, mix);
      } else if (id === 'kalimba') {
        const attack = 0.004;
        const sustain = 0.02;
        let release = 0.55 + v * 0.45; release *= dmf;
        const peak = 0.09 + v * 0.12;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.9, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(6500, f * 8)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(2200, f * 3)) * tmf), t0 + release * 0.6);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 6.27, 0.32 * v, 0, t0, peak, attack, sustain, release * 0.35, mix);
        makePartial('triangle', f * 2.01, 0.15, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else if (id === 'marimba') {
        const attack = 0.006;
        const sustain = 0.03;
        let release = 0.7 + v * 0.5; release *= dmf;
        const peak = 0.08 + v * 0.11;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(1.4, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(4800, f * 5.8)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(1600, f * 2.1)) * tmf), t0 + release * 0.55);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 3.92, 0.28, 8, t0, peak, attack, sustain, release * 0.4, mix);
        makePartial('triangle', f * 1.005, 0.22, 0, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', f * 9.1, 0.06 * v, 0, t0, peak, attack, sustain, release * 0.25, mix);
      } else if (id === 'bell') {
        const attack = 0.008;
        const sustain = 0.05;
        let release = 2.8 + v * 1.4; release *= dmf;
        const peak = 0.055 + v * 0.08;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.6, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(7000, f * 9)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(2500, f * 3.5)) * tmf), t0 + release * 0.8);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.71, 0.45, 4, t0, peak, attack, sustain, release * 0.9, mix);
        makePartial('sine', f * 5.15, 0.22, -6, t0, peak, attack, sustain, release * 0.7, mix);
        makePartial('sine', f * 8.46, 0.1, 2, t0, peak, attack, sustain, release * 0.45, mix);
        makePartial('sine', f * 1.004, 0.3, 7, t0, peak, attack, sustain, release, mix);
      } else if (id === 'pluck') {
        const attack = 0.003;
        const sustain = 0.01;
        let release = 0.45 + v * 0.35; release *= dmf;
        const peak = 0.1 + v * 0.12;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(2.2, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(7800, f * 10 + 800)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(900, f * 1.6)) * tmf), t0 + release * 0.85);
        makePartial('sawtooth', f, 0.55, 0, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 1.002, 0.4, 3, t0, peak, attack, sustain, release * 0.9, mix);
        makePartial('sine', f * 2.01, 0.18, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else if (id === 'epiano') {
        const attack = 0.015 + (1 - v) * 0.03;
        const sustain = 0.25 + v * 0.35;
        let release = 1.4 + v * 0.8; release *= dmf;
        const peak = 0.06 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.85, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(3800, f * 4.8)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(1200, f * 2.0)) * tmf), t0 + (attack + sustain + release) * 0.75);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.28, 4, t0, peak, attack, sustain, release * 0.8, mix);
        makePartial('triangle', f * 1.003, 0.18, -2, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 14.5, 0.04 * v, 0, t0, peak, attack * 0.5, 0.02, release * 0.2, mix);
      } else if (id === 'warmpad') {
        const attack = 0.22 + (1 - v) * 0.25;
        const sustain = 1.1 + v * 1.2;
        let release = 2.8 + v * 1.5; release *= dmf;
        const peak = 0.04 + v * 0.07;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.5, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(2800, f * 3.8)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(900, f * 1.6)) * tmf), t0 + (attack + sustain + release) * 0.9);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.55, 8, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f, 0.4, -7, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', f * 0.5, 0.18, 0, t0, peak, attack * 1.2, sustain, release, mix);
        makePartial('sine', f * 1.5, 0.12, 3, t0, peak, attack, sustain, release * 0.9, mix);
      } else if (id === 'sub') {
        const attack = 0.04 + (1 - v) * 0.06;
        const sustain = 0.35 + v * 0.5;
        let release = 1.1 + v * 0.7; release *= dmf;
        const peak = 0.12 + v * 0.14;
        const ff = Math.max(35, f * 0.5);
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.9, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(420, ff * 4.5)) * tmf), t0);
        fil.frequency.exponentialRampToValueAtTime(clampFreq((Math.min(180, ff * 2.2)) * tmf), t0 + (attack + sustain + release) * 0.7);
        makePartial('sine', ff, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('triangle', ff * 1.01, 0.22, 0, t0, peak, attack, sustain, release * 0.85, mix);
        makePartial('sine', ff * 2.0, 0.08, 0, t0, peak, attack, sustain, release * 0.5, mix);
      } else {
        const attack = 0.09 + (1 - v) * 0.14;
        const sustain = 0.55 + v * 0.9;
        let release = 2.4 + v * 1.2; release *= dmf;
        const peak = 0.05 + v * 0.09;
        fil.type = 'lowpass';
        fil.Q.setValueAtTime(0.7, t0);
        fil.frequency.setValueAtTime(clampFreq((Math.min(4200, f * 5.5)) * tmf), t0);
        makePartial('sine', f, 1.0, 0, t0, peak, attack, sustain, release, mix);
        makePartial('sine', f * 2.0, 0.25, 0, t0, peak, attack, sustain, release, mix);
      }
    
      tapSend(fil, 'rev', clamp01(mfx.reverb, 0), null, t0 + 8);
      tapSend(fil, 'dly', clamp01(mfx.delay, 0), null, t0 + 8);
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
        const mode = modeOf(playLayer);
        const gPlay = gridForLayer(playLayer);
        const rows = rowsForLayer(playLayer);
        if (!gPlay) continue;
        const when = anchor + lastVisStep * sd;
        for (let row = 0; row < rows; row++) {
          if (!gPlay[idx(step, row)]) continue;
          if (Math.random() > probability) continue;
          const accent = (step % 4 === 0) ? 1.15 : (step % 2 === 0 ? 1.05 : 0.92);
          const baseVel = 0.35 + velocity * 0.55;
          const jitterV = (Math.random() - 0.5) * 2 * humanize * 0.2;
          const jitterT = (Math.random() - 0.5) * 2 * humanize * sd * 0.35;
          let swingT = 0;
          if (mode === 'drum' && (step % 2) === 1) {
            const sw = clamp01((drumFx[playLayer] && drumFx[playLayer].swing) || 0, 0);
            if (sw > 0) swingT = Math.min(sw * sd * 0.45, sd * 0.45, 0.12);
          }
          const tOff = Math.max(0, jitterT + swingT); // never earlier than step; swing default 0 => jitterT preserved when >=0
          trigger(row, when + (swingT > 0 ? tOff : jitterT), Math.max(0.05, Math.min(1, baseVel * accent + jitterV)), layerSounds[playLayer], mode, playLayer);
        }
      }
    }
    function tick() {
      if (!playing) return;
      scheduleAhead();
      timer = window.setTimeout(tick, 25);
    }
    function updatePlayButton() {
      const playBtn = layer ? layer.querySelector('[data-play]') : null;
      if (!playBtn) return;
      playBtn.classList.toggle('is-running', !!playing);
      playBtn.innerHTML = playing ? TP_ICONS.stop : TP_ICONS.play;
      playBtn.setAttribute('aria-label', playing ? 'Stop' : 'Play');
      playBtn.title = playing ? 'Stop' : 'Play';
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
      if (timer) { clearTimeout(timer); timer = 0; }
      timer = window.setTimeout(tick, 20);
      updateLayerButtons();
      updatePlayButton();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      draw();
    }
    function stop() {
      playing = false;
      if (timer) { clearTimeout(timer); timer = 0; }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      updatePlayButton();
      draw();
    }

    const tpStyleId = 'tonepad-css-v50-colors';
    ['tonepad-css-v45', 'tonepad-css-v46-theme', 'tonepad-css-v47-drum', 'tonepad-css-v48-layout', 'tonepad-css-v49-icons'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
    if (!document.getElementById(tpStyleId)) {
      const style = document.createElement('style');
      style.id = tpStyleId;
      style.textContent = [
        '.tonepad-layer{touch-action:none;position:fixed;z-index:40;box-sizing:border-box;background:var(--tp-layer-bg,rgba(8,10,9,.94));border-radius:12px;overflow:hidden;transform:translate3d(100vw,0,0);transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform;display:flex;flex-direction:column;padding:8px;gap:6px}',
        'body.tonepad-open .tonepad-layer{pointer-events:auto}',
        '#pan{transition:transform var(--tp-tr,0s) var(--tp-ease,cubic-bezier(0.22,1,0.36,1));will-change:transform}',
        'body.tonepad-open #pan{pointer-events:none}',
        '.tonepad-top{flex:0 0 auto;display:flex;align-items:center;gap:6px}',
        '.tonepad-select{width:100%;min-height:44px;height:44px;padding:0 34px 0 12px;border-radius:10px;border:1px solid var(--tp-layer-btn-border,rgba(160,170,160,.35));background:var(--tp-layer-btn-bg,rgba(20,24,20,.9));color:var(--tp-layer-btn-fg,#9aab9e);font:600 13px system-ui;cursor:pointer;appearance:none;-webkit-appearance:none;touch-action:manipulation;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 16px) 18px,calc(100% - 11px) 18px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}',
        '.tonepad-select:focus-visible{outline:2px solid var(--tp-knob-accent,#e1cc8b);outline-offset:1px}',
        '.tonepad-bottom{flex:0 0 auto;display:flex;flex-direction:row;align-items:center;gap:6px;flex-wrap:wrap}',
        '.tonepad-transport{display:flex;flex-direction:row;align-items:center;gap:6px;flex-wrap:wrap;flex:1 1 auto;min-width:0}',
        '.tonepad-knobs{display:flex;gap:6px;align-items:center;flex:0 0 auto;flex-wrap:wrap}',
        '.tonepad-knob{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:34px}',
        '.tonepad-knob-label{font:600 8px/1 system-ui,sans-serif;letter-spacing:.05em;color:var(--tp-knob-label,#c9b06a)}',
        '.tonepad-knob-dial{width:32px;height:32px;border-radius:8px;border:1px solid var(--tp-knob-dial-border,rgba(232,212,138,.4));background:var(--tp-knob-dial-bg,#141a14);cursor:ns-resize;touch-action:none}',
        '.tonepad-knob-dial canvas{width:100%;height:100%;display:block;pointer-events:none}',
        '.tonepad-knob-val{font:600 9px/1 system-ui,sans-serif;color:var(--tp-knob-val,#f0d99a)}',
        '.tonepad-knob-divider{width:1px;align-self:stretch;min-height:28px;margin:2px 1px;border-radius:1px;background:var(--tp-divider,rgba(160,170,160,.28));flex:0 0 1px}',
        '@media (max-width:370px){.tonepad-knob-divider{display:none}}',
        '.tonepad-knobs[data-fx-mode="melodic"] .tonepad-knob[data-k^="fx"] .tonepad-knob-val{color:var(--tp-melody-fill,var(--tp-melody-accent,#7fe0e8))}',
        '.tonepad-knobs[data-fx-mode="drum"] .tonepad-knob[data-k^="fx"] .tonepad-knob-val{color:var(--tp-drum-fill,var(--tp-drum-accent,#f2c94c))}',
        '.tonepad-layers{display:flex;gap:4px}',
        '.tonepad-layer-btn{min-width:28px;min-height:28px;height:28px;border-radius:6px;border:1px solid var(--tp-layer-btn-border,rgba(160,170,160,.35));background:var(--tp-layer-btn-bg,rgba(20,24,20,.9));color:var(--tp-layer-btn-fg,#9aab9e);font:600 11px system-ui;cursor:pointer;transition:border-color .15s,box-shadow .15s,color .15s,background .15s;touch-action:manipulation}',
        '.tonepad-layer-btn.is-active{border-color:var(--layer-accent,#e1cc8b);color:var(--layer-accent,#f0d99a);background:var(--tp-layer-btn-active-bg,rgba(40,36,20,.95));box-shadow:0 0 10px color-mix(in srgb,var(--layer-accent,#e1cc8b) 35%,transparent)}',
        '.tonepad-layer-btn.is-empty{opacity:.4}',
        '.tonepad-icon-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;width:44px;min-height:44px;height:44px;padding:0;border-radius:8px;cursor:pointer;touch-action:manipulation;transition:border-color .15s,box-shadow .15s,color .15s,background .15s}',
        '.tonepad-icon-btn svg{width:20px;height:20px;display:block;pointer-events:none}',
        '.tonepad-icon-btn:focus-visible{outline:2px solid var(--tp-knob-accent,#e1cc8b);outline-offset:1px}',
        '.tonepad-play{border:1px solid var(--tp-icon-play-border,rgba(120,200,140,.5));background:var(--tp-icon-play-bg,rgba(30,50,35,.9));color:var(--tp-icon-play-fg,#5fd97a);box-shadow:0 0 0 1px var(--tp-icon-play-glow,transparent)}',
        '.tonepad-play.is-running{border-color:var(--tp-icon-stop-border,rgba(255,107,102,.52));background:var(--tp-icon-stop-bg,rgba(62,26,24,.92));color:var(--tp-icon-stop-fg,#ff6b66);box-shadow:0 0 0 1px var(--tp-icon-stop-glow,transparent)}',
        '.tonepad-clear{border:1px solid var(--tp-clear-border,rgba(200,120,100,.45));background:var(--tp-clear-bg,rgba(50,24,20,.9));color:var(--tp-icon-clear-fg,#e8b0a0)}',
        '.tonepad-mode-btn{border:1px solid var(--tp-melody-border,rgba(127,224,232,.5));background:var(--tp-melody-bg,rgba(18,52,56,.92));color:var(--tp-melody-accent,#7fe0e8);box-shadow:0 0 10px var(--tp-melody-glow,rgba(127,224,232,.24))}',
        '.tonepad-mode-btn[aria-pressed="true"]{border-color:var(--tp-drum-border,rgba(242,201,76,.52));color:var(--tp-drum-accent,#f2c94c);background:var(--tp-drum-bg,rgba(58,46,14,.92));box-shadow:0 0 10px var(--tp-drum-glow,rgba(242,201,76,.24))}',
        '.tonepad-canvas{flex:1 1 auto;width:100%;min-height:0;touch-action:none;border-radius:8px;background:var(--tp-canvas-bg,#0a0c0a)}',
        '.tonepad-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}'
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
      '<div class="tonepad-top" data-top>' +
        '<label class="tonepad-sr-only" for="tpSoundSelect">Instrument</label>' +
        '<select id="tpSoundSelect" class="tonepad-select" data-sound-select aria-label="Instrument for active layer"></select>' +
        '<label class="tonepad-sr-only" for="tpKitSelect">Drum kit</label>' +
        '<select id="tpKitSelect" class="tonepad-select" data-kit-select aria-label="Drum kit for active layer" hidden><option value="classic">Classic</option></select>' +
      '</div>' +
      '<canvas class="tonepad-canvas" aria-label="TonePad sequencer grid" aria-describedby="tonepad-drum-row-names"></canvas>' +
      '<div id="tonepad-drum-row-names" class="tonepad-sr-only">Drum rows, top to bottom: kick, snare, clap, closed hat, open hat, low tom, high tom, rim.</div>' +
      '<div class="tonepad-bottom" data-bottom>' +
        '<div class="tonepad-transport">' +
          '<button type="button" class="tonepad-play tonepad-icon-btn" data-play aria-label="Play" title="Play">' + TP_ICONS.play + '</button>' +
          '<button type="button" class="tonepad-clear tonepad-icon-btn" data-clear aria-label="Clear active layer" title="Clear active layer">' + TP_ICONS.clear + '</button>' +
          '<div class="tonepad-layers" data-layers></div>' +
          '<button type="button" class="tonepad-mode-btn tonepad-icon-btn" data-mode aria-pressed="false" aria-label="Switch active layer to drum" title="Switch to drum mode">' + TP_ICONS.melody + '</button>' +
        '</div>' +
        '<div class="tonepad-knobs" data-fx-mode="melodic">' +
          '<div class="tonepad-knob" data-k="vel"><span class="tonepad-knob-label">VEL</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>70</span></div>' +
          '<div class="tonepad-knob" data-k="prob"><span class="tonepad-knob-label">PROB</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>100</span></div>' +
          '<div class="tonepad-knob" data-k="hum"><span class="tonepad-knob-label">HUM</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>12</span></div>' +
          '<span class="tonepad-knob-divider" aria-hidden="true"></span>' +
          '<div class="tonepad-knob" data-k="fx0"><span class="tonepad-knob-label" data-klabel>FX</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>0</span></div>' +
          '<div class="tonepad-knob" data-k="fx1"><span class="tonepad-knob-label" data-klabel>FX</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>0</span></div>' +
          '<div class="tonepad-knob" data-k="fx2"><span class="tonepad-knob-label" data-klabel>FX</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>0</span></div>' +
          '<div class="tonepad-knob" data-k="fx3"><span class="tonepad-knob-label" data-klabel>FX</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>0</span></div>' +
          '<div class="tonepad-knob" data-k="fx4"><span class="tonepad-knob-label" data-klabel>FX</span><div class="tonepad-knob-dial" data-dial><canvas width="72" height="72"></canvas></div><span class="tonepad-knob-val" data-val>0</span></div>' +
        '</div>' +
      '</div>';

    const canvas = layer.querySelector('canvas.tonepad-canvas');
    const g = canvas.getContext('2d');
    const tpTheme = { knobTrack: 'rgba(120,130,118,.35)', knobAccent: '#e1cc8b', knobFill: '#f0d99a', melodyAccent: '#7fe0e8', melodyFill: '#9ff0f5', drumAccent: '#f2c94c', drumFill: '#f7d978', gridOff: 'rgba(28,32,30,0.92)', gridPlayheadA: 0.55, isLight: false, icon: 'rgba(154,171,158,0.82)' };
    function resolveTpTheme() {
      try {
        tpTheme.isLight = !!(document.documentElement.classList.contains('theme-light') || document.body.classList.contains('theme-light'));
        const cs = getComputedStyle(document.documentElement);
        const v = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
        tpTheme.knobTrack = v('--tp-knob-track', tpTheme.knobTrack);
        tpTheme.knobAccent = v('--tp-knob-accent', tpTheme.knobAccent);
        tpTheme.knobFill = v('--tp-knob-val', tpTheme.knobFill);
        tpTheme.melodyAccent = v('--tp-melody-accent', tpTheme.melodyAccent);
        tpTheme.melodyFill = v('--tp-melody-fill', tpTheme.melodyFill);
        tpTheme.drumAccent = v('--tp-drum-accent', tpTheme.drumAccent);
        tpTheme.drumFill = v('--tp-drum-fill', tpTheme.drumFill);
        tpTheme.gridOff = v('--tp-grid-off', tpTheme.gridOff);
        tpTheme.icon = v('--tp-layer-btn-fg', tpTheme.icon);
        const a = parseFloat(v('--tp-grid-playhead-a', ''));
        if (!Number.isNaN(a)) tpTheme.gridPlayheadA = a;
      } catch (_) {}
    }
    resolveTpTheme();
    const tpThemeObserver = (typeof MutationObserver !== 'undefined')
      ? new MutationObserver(() => { resolveTpTheme(); try { if (Array.isArray(knobRepaint)) knobRepaint.forEach((fn) => { try { fn(); } catch (_) {} }); } catch (_) {} try { draw(); } catch (_) {} })
      : null;
    if (tpThemeObserver) tpThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const layersEl = layer.querySelector('[data-layers]');
    const soundSelect = layer.querySelector('[data-sound-select]');
    const kitSelect = layer.querySelector('[data-kit-select]');
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
        b.style.borderColor = 'hsla(' + th.h + ',' + th.s + '%,' + th.l + '%,' + (i === activeLayer ? '0.9' : '0.4') + ')';
        b.style.color = i === activeLayer ? accent : 'hsla(' + th.h + ',40%,70%,0.75)';
        b.classList.toggle('is-active', i === activeLayer);
        b.classList.toggle('is-empty', !layerHasNotes(i));
      });
    }
    if (soundSelect) {
      soundSelect.innerHTML = '';
      SOUNDS.forEach((s) => {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.name;
        soundSelect.appendChild(o);
      });
      soundSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        layerSounds[activeLayer] = soundSelect.value;
        save();
        if (ensureAudio()) {
          try { resumeAudio?.(); audioCtx?.resume?.(); } catch (_) {}
          trigger(3, audioCtx.currentTime + 0.02, 0.72, soundSelect.value, 'melodic', activeLayer);
        }
      });
    }
    if (kitSelect) {
      kitSelect.innerHTML = '';
      DRUM_KIT_LIST.forEach((k) => {
        const o = document.createElement('option');
        o.value = k.id; o.textContent = k.name;
        kitSelect.appendChild(o);
      });
      kitSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        drumKits[activeLayer] = kitSelect.value;
        save();
        if (ensureAudio()) {
          try { resumeAudio?.(); audioCtx?.resume?.(); } catch (_) {}
          const t = audioCtx.currentTime + 0.02;
          triggerDrum(0, t, 0.82, kitSelect.value);
          triggerDrum(1, t + 0.18, 0.72, kitSelect.value);
        }
      });
    }
    function updateModeUI() {
      const drum = modeOf(activeLayer) === 'drum';
      const modeBtn = layer ? layer.querySelector('[data-mode]') : null;
      if (modeBtn) {
        modeBtn.setAttribute('aria-pressed', drum ? 'true' : 'false');
        modeBtn.innerHTML = drum ? TP_ICONS.drum : TP_ICONS.melody;
        modeBtn.setAttribute('aria-label', drum ? 'Switch active layer to melody' : 'Switch active layer to drum');
        modeBtn.title = drum ? 'Switch to melody mode' : 'Switch to drum mode';
      }
      if (soundSelect) soundSelect.hidden = drum;
      if (kitSelect) {
        kitSelect.hidden = !drum;
        const k = kitOf(activeLayer);
        if (kitSelect.value !== k) kitSelect.value = k;
      }
      try { refreshFxKnobs(); } catch (_) {}
    }
    function updateSoundButtons() {
      updateModeUI();
      const cur = layerSounds[activeLayer] || DEFAULT_SOUND;
      if (soundSelect && soundSelect.value !== cur) soundSelect.value = cur;
      if (kitSelect) { const k = kitOf(activeLayer); if (kitSelect.value !== k) kitSelect.value = k; }
    }
    layer.querySelector('[data-clear]').addEventListener('click', (e) => {
      e.stopPropagation();
      const g = activeGrid();
      if (g) g.fill(0);
      draw();
      updateLayerButtons();
      save();
    });
    layer.querySelector('[data-play]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (playing) stop();
      else start();
    });
    layer.querySelector('[data-mode]').addEventListener('click', (e) => {
      e.stopPropagation();
      layerModes[activeLayer] = modeOf(activeLayer) === 'drum' ? 'melodic' : 'drum';
      updateModeUI();
      draw();
      save();
    });

    const knobRepaint = [];
    function wireKnob(key, getV, setV) {
      const root = layer.querySelector('[data-k="' + key + '"]');
      if (!root) return null;
      const dial = root.querySelector('[data-dial]');
      const val = root.querySelector('[data-val]');
      const labelEl = root.querySelector('[data-klabel]');
      const kc = dial.querySelector('canvas');
      const kg = kc ? kc.getContext('2d') : null;
      let drag = false, y0 = 0, v0 = 0;
      const paint = () => {
        const t = Math.max(0, Math.min(1, getV()));
        if (val) val.textContent = String(Math.round(t * 100));
        if (!kg) return;
        const isFx = /^fx\d+$/.test(key);
        const drum = isFx && modeOf(activeLayer) === 'drum';
        const accent = isFx ? (drum ? tpTheme.drumAccent : tpTheme.melodyAccent) : tpTheme.knobAccent;
        const fill = isFx ? (drum ? tpTheme.drumFill : tpTheme.melodyFill) : tpTheme.knobFill;
        const s = kc.width, cx = s / 2, cy = s / 2, rad = s * 0.34;
        const a0 = Math.PI * 0.75, span = Math.PI * 1.5, a1 = a0 + span * t;
        kg.clearRect(0, 0, s, s);
        kg.lineWidth = s * 0.1;
        kg.lineCap = 'round';
        kg.strokeStyle = tpTheme.knobTrack;
        kg.beginPath(); kg.arc(cx, cy, rad, a0, a0 + span); kg.stroke();
        if (t > 0) {
          kg.strokeStyle = accent;
          kg.beginPath(); kg.arc(cx, cy, rad, a0, a1); kg.stroke();
        }
        kg.fillStyle = fill;
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
      return { paint, setLabel: (t) => { if (labelEl) labelEl.textContent = t; } };
    }
    wireKnob('vel', () => velocity, (v) => { velocity = v; });
    wireKnob('prob', () => probability, (v) => { probability = v; });
    wireKnob('hum', () => humanize, (v) => { humanize = v; });
    const fxKnobHandles = [];
    function currentFxDefs() { return modeOf(activeLayer) === 'drum' ? DRUM_FX_KNOBS : MELO_FX_KNOBS; }
    function currentFxObj() { return modeOf(activeLayer) === 'drum' ? drumFx[activeLayer] : melodicFx[activeLayer]; }
    for (let i = 0; i < 5; i++) {
      fxKnobHandles.push(wireKnob('fx' + i,
        () => { const d = currentFxDefs()[i]; const o = currentFxObj(); return d && o ? (o[d.k] ?? 0) : 0; },
        (v) => { const d = currentFxDefs()[i]; const o = currentFxObj(); if (d && o) o[d.k] = Math.max(0, Math.min(1, v)); }
      ));
    }
    function refreshFxKnobs() {
      const defs = currentFxDefs();
      const mode = modeOf(activeLayer);
      const knobsEl = layer ? layer.querySelector('.tonepad-knobs') : null;
      if (knobsEl) knobsEl.setAttribute('data-fx-mode', mode);
      for (let i = 0; i < 5; i++) {
        const h = fxKnobHandles[i]; const d = defs[i];
        if (h && d) { h.setLabel(d.label); h.paint(); }
      }
    }
    refreshFxKnobs();

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
      // Scoped to the two cards (not <html>) so a drag doesn't restyle the whole page every frame.
      [pan, layer].forEach((el) => {
        if (!el) return;
        el.style.setProperty('--tp-tr', dur);
        el.style.setProperty('--tp-ease', ease);
      });
      // Safari/WebKit: make sure the new duration is in effect before the target value changes.
      if (animate) void layer.offsetWidth;
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
        parkLeft: -Math.ceil(Math.max(w + 24, box.left + w + 16))
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
      if (page === 0) setTrack(visX, hidX, animate);
      else setTrack(hidX, visX, animate);
    }
    function sideX(side, box) {
      const d = parkDistances(box);
      return side > 0 ? d.parkRight : d.parkLeft;
    }
    // Resting layout for the current page.
    function rest(animate) {
      const box = homeBox();
      if (!box) return;
      place();
      applyTrack(0, sideX(parked, box), animate);
    }
    // Live finger-follow while dragging.
    function shiftCarousel(animate) {
      const box = homeBox();
      if (!box) return;
      place();
      const dx = dragDx != null ? dragDx : 0;
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
      const wasDragging = dragDx != null;
      const d = dir === -1 ? -1 : (dir === 1 ? 1 : dragDir);
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
      if (!box) return;
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
        if (wasDragging) parked = d;
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
      if (!box) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Size the bitmap from the canvas's real laid-out box (unaffected by the carousel's translate).
      // A fixed "box - 56" guess ignored the header wrapping to two rows, so the flex-sized canvas
      // got stretched on screen and square pads rendered as rectangles.
      const cssW = canvas.clientWidth || (box.width - 16);
      const cssH = canvas.clientHeight || (box.height - 56);
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
    }
    // Square pads: cell size is set by the tighter axis and the grid is centred in the canvas.
    function gridMetrics(w, h, rows) {
      const rcount = rows == null ? activeRows() : rows;
      const isDrum = (modeOf(activeLayer) === 'drum' && rcount === DRUM_ROWS);
      const pad = Math.max(4, Math.min(w, h) * 0.02);
      const gap = Math.max(1, Math.min(w, h) * 0.01);
      const labelW = isDrum ? Math.max(12, Math.min(w, h) * 0.04) : 0;
      const cell = Math.max(1, Math.min(
        (w - pad * 2 - labelW - gap * (COLS - 1)) / COLS,
        (h - pad * 2 - gap * (rcount - 1)) / rcount
      ));
      const gw = cell * COLS + gap * (COLS - 1);
      const gh = cell * rcount + gap * (rcount - 1);
      return { gap, cell, x0: pad + labelW + (w - pad * 2 - labelW - gw) / 2, y0: (h - gh) / 2, rows: rcount, labelW: labelW, isDrum: isDrum };
    }
    function draw() {
      if (!g) return;
      const w = canvas.width, h = canvas.height;
      g.clearRect(0, 0, w, h);
      const aRows = activeRows();
      const m = gridMetrics(w, h, aRows);
      const gap = m.gap, cw = m.cell, ch = m.cell;
      const gridData = activeGrid();
      let visStep = -1;
      if (playing && audioCtx) {
        const sd = stepDur();
        const total = (audioCtx.currentTime - anchor) / sd;
        visStep = ((Math.floor(total) % COLS) + COLS) % COLS;
      }
      const theme = LAYER_THEMES[activeLayer] || LAYER_THEMES[0];
      const rad = Math.max(2, Math.min(6, cw * 0.18));
      if (m.isDrum && m.labelW > 0) {
        const icons = ['kick','snare','clap','ch','oh','lowtom','hightom','rim'];
        const gx = (m.x0 - gap) - m.labelW / 2;
        g.save();
        g.strokeStyle = tpTheme.icon;
        g.fillStyle = tpTheme.icon;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (let r = 0; r < aRows; r++) {
          const cx = gx;
          const cy = m.y0 + r * (ch + gap) + ch / 2;
          const sz = Math.min(m.labelW, ch) * 0.78;
          const lw = Math.max(1, sz * 0.11);
          g.lineWidth = lw;
          const v = icons[r];
          g.beginPath();
          if (v === 'kick') {
            g.arc(cx, cy, sz * 0.44, 0, Math.PI * 2); g.fill();
          } else if (v === 'snare') {
            g.arc(cx, cy, sz * 0.36, 0, Math.PI * 2); g.stroke();
          } else if (v === 'clap') {
            const ds = sz * 0.16, ox = sz * 0.2;
            const diamond = (dx) => { g.moveTo(cx+dx, cy-ds); g.lineTo(cx+dx+ds, cy); g.lineTo(cx+dx, cy+ds); g.lineTo(cx+dx-ds, cy); g.closePath(); };
            diamond(-ox); diamond(ox); g.fill();
          } else if (v === 'ch') {
            const bw = sz * 0.42, bh = Math.max(1.5, sz * 0.08);
            if (g.roundRect) { g.roundRect(cx - bw/2, cy - bh/2, bw, bh, bh/2); } else { g.rect(cx - bw/2, cy - bh/2, bw, bh); }
            g.fill();
          } else if (v === 'oh') {
            g.arc(cx, cy, sz * 0.34, 0, Math.PI * 2); g.stroke();
            g.beginPath();
            const bw = sz * 0.36, bh = Math.max(1.5, sz * 0.07);
            if (g.roundRect) { g.roundRect(cx - bw/2, cy - bh/2, bw, bh, bh/2); } else { g.rect(cx - bw/2, cy - bh/2, bw, bh); }
            g.fill();
          } else if (v === 'lowtom') {
            const rad = sz * 0.4;
            for (let i = 0; i < 6; i++) { const a = -Math.PI/2 + i * Math.PI/3; const px = cx + Math.cos(a)*rad, py = cy + Math.sin(a)*rad; if(i) g.lineTo(px,py); else g.moveTo(px,py); }
            g.closePath(); g.fill();
          } else if (v === 'hightom') {
            const rad = sz * 0.28;
            for (let i = 0; i < 6; i++) { const a = -Math.PI/2 + i * Math.PI/3; const px = cx + Math.cos(a)*rad, py = cy + Math.sin(a)*rad; if(i) g.lineTo(px,py); else g.moveTo(px,py); }
            g.closePath(); g.fill();
          } else if (v === 'rim') {
            const rs = sz * 0.2;
            g.save(); g.translate(cx, cy); g.rotate(Math.PI/4);
            g.rect(-rs, -rs, rs*2, rs*2); g.restore();
            g.fill();
          }
        }
        g.restore();
      }
      for (let r = 0; r < aRows; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = m.x0 + c * (cw + gap);
          const y = m.y0 + r * (ch + gap);
          const on = gridData ? gridData[idx(c, r)] : 0;
          const rowShift = (r / Math.max(1, aRows - 1)) * 18 - 6;
          if (on) {
            const grad = g.createLinearGradient(x, y, x, y + ch);
            grad.addColorStop(0, 'hsla(' + (theme.h + rowShift) + ',' + theme.s + '%,' + Math.min(72, theme.l + 12) + '%,0.95)');
            grad.addColorStop(1, 'hsla(' + (theme.h + rowShift - 8) + ',' + (theme.s + 5) + '%,' + Math.max(28, theme.l - 10) + '%,0.9)');
            g.fillStyle = grad;
          } else if (c === visStep) {
            g.fillStyle = tpTheme.isLight
              ? 'hsla(' + theme.h + ',22%,84%,' + tpTheme.gridPlayheadA + ')'
              : 'hsla(' + theme.h + ',25%,28%,' + tpTheme.gridPlayheadA + ')';
          } else {
            g.fillStyle = tpTheme.gridOff;
          }
          g.beginPath();
          if (g.roundRect) g.roundRect(x, y, cw, ch, rad);
          else g.rect(x, y, cw, ch);
          g.fill();
          if (on) {
            g.strokeStyle = tpTheme.isLight
              ? 'hsla(' + theme.h + ',' + theme.s + '%,' + Math.max(28, theme.l - 8) + '%,0.4)'
              : 'hsla(' + theme.h + ',' + theme.s + '%,' + Math.min(80, theme.l + 20) + '%,0.45)';
            g.lineWidth = 1;
            g.stroke();
          }
          if (c === visStep) {
            g.strokeStyle = tpTheme.isLight
              ? 'hsla(' + theme.h + ',55%,42%,0.75)'
              : 'hsla(' + theme.h + ',70%,75%,0.85)';
            g.lineWidth = 1.5;
            g.beginPath();
            if (g.roundRect) g.roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, rad);
            else g.rect(x + 0.5, y + 0.5, cw - 1, ch - 1);
            g.stroke();
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
      const aRows = activeRows();
      const m = gridMetrics(canvas.width, canvas.height, aRows);
      const c = Math.floor((x - m.x0) / (m.cell + m.gap));
      const r = Math.floor((y - m.y0) / (m.cell + m.gap));
      if (c < 0 || r < 0 || c >= COLS || r >= aRows) return null;
      return { c, r };
    }
    function applyAt(cx, cy) {
      const hit = cellAt(cx, cy);
      if (!hit) return;
      const key = hit.c + ':' + hit.r;
      if (seen.has(key)) return;
      seen.add(key);
      const i = idx(hit.c, hit.r);
      const gridData = activeGrid();
      if (!gridData) return;
      if (mode === 'erase') gridData[i] = 0;
      else if (mode === 'paint') gridData[i] = 1;
      else {
        const on = !gridData[i];
        mode = on ? 'paint' : 'erase';
        gridData[i] = on ? 1 : 0;
      }
      draw(); save(); updateLayerButtons();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!open) return;
      // Edge touches belong to the carousel swipe, not to cell painting.
      if (e.clientX >= window.innerWidth - EDGE || e.clientX <= EDGE) return;
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
    const BUILD = 'tp42';
    const SWIPE_IGNORE = '#looperRail,.topbar,#pionierBottomDock,#fxPanel,button,a,input,select,.tonepad-knob-dial';
    const HAS_TOUCH = 'ontouchstart' in window;
    let swipe = null;

    /* ---- opt-in on-screen readout: add ?tpdebug=1 to the URL, or tap the sequencer button 5x fast ---- */
    let debugOn = false, hud = null;
    const dbgLines = [];
    try {
      const q = new URLSearchParams(location.search).get('tpdebug');
      if (q === '1') localStorage.setItem('tpdebug', '1');
      if (q === '0') localStorage.removeItem('tpdebug');
      debugOn = localStorage.getItem('tpdebug') === '1';
    } catch (_) {}
    function dbg(msg) {
      if (!debugOn) return;
      if (!hud) {
        hud = document.createElement('div');
        hud.style.cssText = 'position:fixed;left:4px;top:56px;z-index:99999;pointer-events:none;font:10px/1.35 ui-monospace,Menlo,monospace;color:#e1cc8b;background:rgba(0,0,0,.62);padding:4px 6px;border-radius:6px;max-width:92vw;white-space:pre-wrap';
        document.body.appendChild(hud);
      }
      dbgLines.push(msg);
      while (dbgLines.length > 8) dbgLines.shift();
      hud.textContent = BUILD + ' · ' + (HAS_TOUCH ? 'touch' : 'pointer') + ' · page ' + page + '\n' + dbgLines.join('\n');
    }
    (function wireDebugToggle() {
      const btn = document.getElementById('tonepadToggle');
      if (!btn) return;
      let taps = [];
      btn.addEventListener('click', () => {
        const now = Date.now();
        taps = taps.filter((t) => now - t < 2500).concat(now);
        if (taps.length >= 5) {
          taps = [];
          debugOn = !debugOn;
          try { debugOn ? localStorage.setItem('tpdebug', '1') : localStorage.removeItem('tpdebug'); } catch (_) {}
          if (hud) { hud.remove(); hud = null; }
          dbgLines.length = 0;
          dbg('debug on');
        }
      }, true);
    })();
    if (debugOn) dbg('debug on');

    function abortSwipe(why) {
      const was = swipe;
      swipe = null;
      if (was && was.active) setPage(page, true, was.dir);
      dbg('abort ' + why);
    }

    /*
     * One gesture engine, fed by touch events on touch screens (reliable on iOS) and by pointer
     * events for mouse / pen. Returns true when the touch began in a screen-edge zone.
     */
    function swipeBegin(id, x, y, target) {
      if (swipe) {
        // A previous release event can be lost (system gesture, app switch). Don't stay stuck.
        if (performance.now() - swipe.tLast < 1200) return false;
        abortSwipe('stale');
      }
      if (target && target.closest && target.closest(SWIPE_IGNORE)) return false;
      const onRight = x >= window.innerWidth - EDGE;
      const onLeft = x <= EDGE;
      const lr = open ? layer.getBoundingClientRect() : null;
      const onLayerLeft = !!(lr && x >= lr.left && x <= lr.left + Math.max(EDGE, lr.width * 0.35));
      if (!onRight && !onLeft && !onLayerLeft) return false;
      const now = performance.now();
      // Right edge always means "swipe left" (next page), on either page -> infinity loop.
      swipe = { x, y, id, dir: onRight ? 1 : -1, active: false, lastX: x, lastY: y, tLast: now, pts: [[x, now]] };
      dbg('begin x=' + Math.round(x) + ' dir=' + swipe.dir + ' zone=' + (onRight ? 'R' : onLeft ? 'L' : 'layer'));
      return onRight || onLeft;
    }
    function swipeMove(id, x, y) {
      if (!swipe || swipe.id !== id) return;
      const now = performance.now();
      swipe.lastX = x; swipe.lastY = y; swipe.tLast = now;
      swipe.pts.push([x, now]);
      if (swipe.pts.length > 6) swipe.pts.shift();
      const dx = x - swipe.x;
      const dy = y - swipe.y;
      if (!swipe.active) {
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx < 8 && ady < 8) return;
        const toward = swipe.dir === 1 ? dx < 0 : dx > 0;
        // A thumb leaving the edge starts diagonal: be forgiving, only bail when clearly something else.
        if (toward && adx >= 8 && adx > ady * 0.7) { swipe.active = true; dragDir = swipe.dir; dbg('active dx=' + Math.round(dx) + ' dy=' + Math.round(dy)); }
        else if ((ady > 32 && ady > adx * 1.5) || (!toward && adx > 32)) { swipe = null; dbg('dropped dx=' + Math.round(dx) + ' dy=' + Math.round(dy)); return; }
        else return;
      }
      const box = homeBox();
      const w = box ? box.width : window.innerWidth;
      dragDx = swipe.dir === 1 ? Math.max(-w * 1.2, Math.min(0, dx)) : Math.min(w * 1.2, Math.max(0, dx));
      shiftCarousel(false);
    }
    function swipeEnd(id, x) {
      if (!swipe || swipe.id !== id) return;
      const endX = x == null ? swipe.lastX : x;       // lost/cancelled touch: use the last real position
      const dx = endX - swipe.x;
      const dir = swipe.dir;
      const was = swipe.active;
      const pts = swipe.pts;
      swipe = null;
      const box = homeBox();
      const w = box ? box.width : 240;
      const dist = dir === 1 ? -dx : dx;               // distance travelled in the swipe direction
      const thresh = Math.min(32, w * 0.1);
      let v = 0;                                       // px/ms over the last ~100ms
      if (pts.length > 1) {
        const last = pts[pts.length - 1];
        let first = pts[0];
        for (let i = pts.length - 1; i >= 0; i--) { first = pts[i]; if (last[1] - pts[i][1] > 100) break; }
        const dt = last[1] - first[1];
        if (dt > 0) v = ((dir === 1 ? -1 : 1) * (last[0] - first[0])) / dt;
      }
      const commit = was && (dist > thresh || (dist > 14 && v > 0.3));
      dbg('end dist=' + Math.round(dist) + ' v=' + v.toFixed(2) + ' -> ' + (commit ? 'SWITCH' : was ? 'back' : 'ignored'));
      if (commit) setPage(page === 0 ? 1 : 0, true, dir);
      else setPage(page, true, dir);
    }

    const findTouch = (list, id) => {
      for (let i = 0; i < list.length; i++) if ('t' + list[i].identifier === id) return list[i];
      return null;
    };
    if (HAS_TOUCH) {
      window.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const edge = swipeBegin('t' + t.identifier, t.clientX, t.clientY, e.target);
        // Claim edge touches so the browser never turns them into a page pan / back gesture.
        if (edge && e.cancelable) e.preventDefault();
      }, { capture: true, passive: false });
      window.addEventListener('touchmove', (e) => {
        if (!swipe || typeof swipe.id !== 'string') return;
        const t = findTouch(e.touches, swipe.id);
        if (!t) return;
        swipeMove(swipe.id, t.clientX, t.clientY);
        if (swipe && swipe.active && e.cancelable) e.preventDefault();
      }, { capture: true, passive: false });
      const tEnd = (e) => {
        if (!swipe || typeof swipe.id !== 'string') return;
        const t = findTouch(e.changedTouches, swipe.id);
        if (!t) return;
        swipeEnd(swipe.id, e.type === 'touchcancel' ? null : t.clientX);
      };
      window.addEventListener('touchend', tEnd, { capture: true, passive: true });
      window.addEventListener('touchcancel', tEnd, { capture: true, passive: true });
    }
    // Mouse / pen (and touch on devices without touch events).
    const viaTouchEvents = (e) => HAS_TOUCH && e.pointerType === 'touch';
    window.addEventListener('pointerdown', (e) => { if (!viaTouchEvents(e)) swipeBegin(e.pointerId, e.clientX, e.clientY, e.target); }, { capture: true, passive: true });
    window.addEventListener('pointermove', (e) => { if (!viaTouchEvents(e)) swipeMove(e.pointerId, e.clientX, e.clientY); }, { capture: true, passive: true });
    window.addEventListener('pointerup', (e) => { if (!viaTouchEvents(e)) swipeEnd(e.pointerId, e.clientX); }, { capture: true, passive: true });
    window.addEventListener('pointercancel', (e) => { if (!viaTouchEvents(e)) swipeEnd(e.pointerId, null); }, { capture: true, passive: true });
    window.addEventListener('resize', () => { dragDx = null; rest(false); resizeCanvas(); draw(); });

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
      isPlaying: () => playing
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
