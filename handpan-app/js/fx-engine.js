/**
 * fx-engine.js — Unified modular effects architecture for Pionier
 * Instrument Bus → Ambience → Room → Comp → Effects → Tone → Master → Destination
 */
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const AMBIENCE_FX = [
  { id: 'clean-digital', name: 'Clean Digital Delay' },
  { id: 'warm-analog', name: 'Warm Analog-Style Delay' },
  { id: 'tape-echo', name: 'Tape Echo' },
  { id: 'ping-pong', name: 'Ping-Pong Delay' },
  { id: 'dotted', name: 'Dotted-Rhythm Delay' },
  { id: 'multi-tap', name: 'Multi-Tap Delay' },
  { id: 'reverse', name: 'Reverse-Texture Delay' },
  { id: 'granular', name: 'Granular Echo' },
  { id: 'resonator', name: 'Feedback Resonator' },
  { id: 'fractal', name: 'Fractal / Self-Similar Delay' }
];

export const ROOM_FX = [
  { id: 'small-room', name: 'Small Room' },
  { id: 'studio', name: 'Studio Room' },
  { id: 'hall', name: 'Concert Hall' },
  { id: 'cathedral', name: 'Large Cathedral' },
  { id: 'plate', name: 'Plate' },
  { id: 'spring', name: 'Spring' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'freeze', name: 'Freeze / Infinite Sustain' },
  { id: 'granular-cloud', name: 'Granular Cloud' },
  { id: 'infinite', name: 'Infinite Architectural Space' }
];

export const COMP_FX = [
  { id: 'transparent', name: 'Transparent Compressor' },
  { id: 'soft-knee', name: 'Soft-Knee Compressor' },
  { id: 'vintage', name: 'Vintage-Style Compression' },
  { id: 'fast-peak', name: 'Fast Peak Control' },
  { id: 'slow-bus', name: 'Slow Bus Compression' },
  { id: 'parallel', name: 'Parallel Compression' },
  { id: 'multiband', name: 'Multiband-Style Dynamics' },
  { id: 'transient', name: 'Transient Shaper' },
  { id: 'pumping', name: 'Rhythmic / Pumping Compression' },
  { id: 'envelope', name: 'Experimental Envelope Dynamics' }
];

export const EFFECTS_FX = [
  { id: 'lowpass', name: 'Low-Pass Filter' },
  { id: 'highpass', name: 'High-Pass Filter' },
  { id: 'bandpass', name: 'Band-Pass Filter' },
  { id: 'notch', name: 'Notch Filter' },
  { id: 'resonant', name: 'Resonant Filter' },
  { id: 'formant', name: 'Formant Filter' },
  { id: 'auto-wah', name: 'Auto-Wah' },
  { id: 'freq-shift', name: 'Frequency Shifter' },
  { id: 'spectral', name: 'Spectral / FFT Texture' },
  { id: 'mod-resonator', name: 'Experimental Modulated Resonator' }
];

class EffectModule {
  constructor(id, label, catalogue, defaultAlgo = 0) {
    this.id = id;
    this.label = label;
    this.catalogue = catalogue;
    this.algoIndex = defaultAlgo;
    this.value = 0.25;
    this.bypassed = false;
    this._ctx = null;
    this._input = null;
    this._output = null;
    this._nodes = [];
  }
  get algo() { return this.catalogue[this.algoIndex] || this.catalogue[0]; }
  create(ctx) {
    this._ctx = ctx;
    this._input = ctx.createGain();
    this._output = ctx.createGain();
    this._input.gain.value = 1;
    this._output.gain.value = 1;
    this._rebuild();
    return { input: this._input, output: this._output };
  }
  setValue(v) { this.value = clamp01(v); this._apply(); }
  setBypass(on) { this.bypassed = !!on; this._apply(); }
  selectAlgo(indexOrId) {
    let idx = typeof indexOrId === 'number' ? indexOrId : this.catalogue.findIndex((c) => c.id === indexOrId);
    if (idx < 0) idx = 0;
    if (idx === this.algoIndex) return;
    this.algoIndex = idx;
    this._rebuild();
  }
  _disposeNodes() {
    for (const n of this._nodes) {
      try { n.disconnect(); } catch (_) {}
      try { if (n.stop) n.stop(); } catch (_) {}
    }
    this._nodes = [];
  }
  _rebuild() {
    if (!this._ctx || !this._input || !this._output) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;
    try { this._output.gain.setTargetAtTime(0, t, 0.01); } catch (_) {}
    this._disposeNodes();
    try { this._input.disconnect(); } catch (_) {}
    this._buildGraph();
    this._apply();
    try { this._output.gain.setTargetAtTime(1, ctx.currentTime + 0.02, 0.03); } catch (_) {}
  }
  _buildGraph() {}
  _apply() {}
  dispose() {
    this._disposeNodes();
    try { this._input?.disconnect(); } catch (_) {}
    try { this._output?.disconnect(); } catch (_) {}
    this._input = this._output = this._ctx = null;
  }
}

class AmbienceModule extends EffectModule {
  constructor() { super('ambience', 'AMBIENCE', AMBIENCE_FX, 0); this.value = 0.15; }
  _buildGraph() {
    const ctx = this._ctx;
    const algo = this.algo.id;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.mixOut = ctx.createGain();
    this._input.connect(this.dry);
    this.dry.connect(this.mixOut);
    this.wet.connect(this.mixOut);
    this.mixOut.connect(this._output);
    if (algo === 'ping-pong') {
      this.dL = ctx.createDelay(1.5);
      this.dR = ctx.createDelay(1.5);
      this.fbL = ctx.createGain();
      this.fbR = ctx.createGain();
      this._input.connect(this.dL);
      this.dL.connect(this.fbR);
      this.fbR.connect(this.dR);
      this.dR.connect(this.fbL);
      this.fbL.connect(this.dL);
      this.dL.connect(this.wet);
      this.dR.connect(this.wet);
      this._nodes.push(this.dL, this.dR, this.fbL, this.fbR);
    } else if (algo === 'multi-tap') {
      this.taps = [0.09, 0.17, 0.29, 0.41].map((t, i) => {
        const d = ctx.createDelay(1.0);
        d.delayTime.value = t;
        const g = ctx.createGain();
        g.gain.value = 0.4 - i * 0.08;
        this._input.connect(d);
        d.connect(g);
        g.connect(this.wet);
        this._nodes.push(d, g);
        return { d, g };
      });
    } else if (algo === 'granular') {
      this.d1 = ctx.createDelay(0.2);
      this.d2 = ctx.createDelay(0.2);
      this.lfo = ctx.createOscillator();
      this.lfoG = ctx.createGain();
      this.lfo.frequency.value = 7;
      this.lfoG.gain.value = 0.012;
      this.lfo.connect(this.lfoG);
      this.lfoG.connect(this.d1.delayTime);
      this.lfoG.connect(this.d2.delayTime);
      this.d1.delayTime.value = 0.04;
      this.d2.delayTime.value = 0.07;
      this.fb = ctx.createGain();
      this._input.connect(this.d1);
      this.d1.connect(this.d2);
      this.d2.connect(this.fb);
      this.fb.connect(this.d1);
      this.d1.connect(this.wet);
      this.d2.connect(this.wet);
      this.lfo.start();
      this._nodes.push(this.d1, this.d2, this.lfo, this.lfoG, this.fb);
    } else {
      this.delay = ctx.createDelay(1.8);
      this.fb = ctx.createGain();
      this.tone = ctx.createBiquadFilter();
      this.tone.type = 'lowpass';
      this.tone.frequency.value = 6000;
      this._input.connect(this.delay);
      this.delay.connect(this.tone);
      this.tone.connect(this.fb);
      this.fb.connect(this.delay);
      this.tone.connect(this.wet);
      this._nodes.push(this.delay, this.fb, this.tone);
    }
    this._nodes.push(this.dry, this.wet, this.mixOut);
  }
  _apply() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const amt = this.bypassed ? 0 : this.value;
    const algo = this.algo.id;
    this.dry.gain.setTargetAtTime(1, t, 0.04);
    const presets = {
      'clean-digital': { time: 0.32, fb: 0.38, wet: 0.55, tone: 12000 },
      'warm-analog': { time: 0.38, fb: 0.42, wet: 0.5, tone: 3800 },
      'tape-echo': { time: 0.45, fb: 0.48, wet: 0.52, tone: 2800 },
      'ping-pong': { time: 0.28, fb: 0.45, wet: 0.48, tone: 7000 },
      'dotted': { time: 0.375, fb: 0.4, wet: 0.5, tone: 8000 },
      'multi-tap': { time: 0.2, fb: 0.25, wet: 0.55, tone: 9000 },
      'reverse': { time: 0.55, fb: 0.32, wet: 0.45, tone: 5000 },
      'granular': { time: 0.06, fb: 0.55, wet: 0.5, tone: 6500 },
      'resonator': { time: 0.08, fb: 0.72, wet: 0.4, tone: 4200 },
      'fractal': { time: 0.22, fb: 0.62, wet: 0.48, tone: 5500 }
    };
    const p = presets[algo] || presets['clean-digital'];
    if (this.delay) {
      this.delay.delayTime.setTargetAtTime(p.time * (0.6 + amt * 0.8), t, 0.08);
      this.fb.gain.setTargetAtTime(p.fb * amt, t, 0.06);
      if (this.tone) this.tone.frequency.setTargetAtTime(p.tone, t, 0.1);
    }
    if (this.dL) {
      this.dL.delayTime.setTargetAtTime(p.time * (0.7 + amt * 0.5), t, 0.08);
      this.dR.delayTime.setTargetAtTime(p.time * 1.15 * (0.7 + amt * 0.5), t, 0.08);
      this.fbL.gain.setTargetAtTime(p.fb * amt * 0.9, t, 0.06);
      this.fbR.gain.setTargetAtTime(p.fb * amt * 0.9, t, 0.06);
    }
    if (this.taps) this.taps.forEach((tap, i) => tap.g.gain.setTargetAtTime((0.4 - i * 0.08) * amt, t, 0.06));
    if (this.d1) this.fb.gain.setTargetAtTime(p.fb * amt, t, 0.06);
    this.wet.gain.setTargetAtTime(amt * p.wet, t, 0.06);
  }
}

class RoomModule extends EffectModule {
  constructor() { super('room', 'ROOM', ROOM_FX, 0); this.value = 0.25; }
  _buildGraph() {
    const ctx = this._ctx;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.mixOut = ctx.createGain();
    this.preDelay = ctx.createDelay(0.1);
    this.inputGain = ctx.createGain();
    this._input.connect(this.dry);
    this.dry.connect(this.mixOut);
    this._input.connect(this.inputGain);
    this.inputGain.connect(this.preDelay);
    const baseTimes = [0.029, 0.037, 0.053, 0.067, 0.079, 0.097];
    this.taps = baseTimes.map((bt, i) => {
      const d = ctx.createDelay(0.5);
      d.delayTime.value = bt;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000 - i * 400;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      this.preDelay.connect(d);
      d.connect(lp);
      lp.connect(g);
      g.connect(this.wet);
      g.connect(fb);
      fb.connect(d);
      this._nodes.push(d, fb, lp, g);
      return { d, fb, lp, g };
    });
    this.ap = ctx.createDelay(0.05);
    this.ap.delayTime.value = 0.012;
    this.apG = ctx.createGain();
    this.apG.gain.value = 0.5;
    this.wet.connect(this.ap);
    this.ap.connect(this.apG);
    this.apG.connect(this.wet);
    this.wet.connect(this.mixOut);
    this.mixOut.connect(this._output);
    this._nodes.push(this.dry, this.wet, this.mixOut, this.preDelay, this.inputGain, this.ap, this.apG);
  }
  _apply() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const amt = this.bypassed ? 0 : this.value;
    const algo = this.algo.id;
    const presets = {
      'small-room': { decay: 0.28, size: 0.7, tone: 6200, wet: 0.45, pre: 0.008 },
      'studio': { decay: 0.35, size: 0.9, tone: 5500, wet: 0.48, pre: 0.012 },
      'hall': { decay: 0.52, size: 1.4, tone: 4200, wet: 0.52, pre: 0.022 },
      'cathedral': { decay: 0.72, size: 2.0, tone: 3200, wet: 0.55, pre: 0.035 },
      'plate': { decay: 0.42, size: 0.85, tone: 7800, wet: 0.5, pre: 0.006 },
      'spring': { decay: 0.38, size: 0.75, tone: 4500, wet: 0.48, pre: 0.004 },
      'shimmer': { decay: 0.65, size: 1.6, tone: 9000, wet: 0.5, pre: 0.018 },
      'freeze': { decay: 0.72, size: 1.2, tone: 5000, wet: 0.55, pre: 0.01 },
      'granular-cloud': { decay: 0.7, size: 1.8, tone: 3800, wet: 0.52, pre: 0.025 },
      'infinite': { decay: 0.8, size: 2.2, tone: 2800, wet: 0.55, pre: 0.04 }
    };
    const p = presets[algo] || presets['small-room'];
    this.dry.gain.setTargetAtTime(1, t, 0.05);
    this.preDelay.delayTime.setTargetAtTime(p.pre, t, 0.08);
    this.inputGain.gain.setTargetAtTime(0.4 + amt * 0.6, t, 0.06);
    this.taps.forEach((tap, i) => {
      const sizeMul = p.size * (0.7 + amt * 0.6);
      tap.d.delayTime.setTargetAtTime((0.025 + i * 0.014) * sizeMul, t, 0.12);
      const fbTarget = (algo === 'freeze' && amt > 0.55) ? 0.88 : p.decay * (0.55 + amt * 0.4);
      tap.fb.gain.setTargetAtTime(clamp(fbTarget, 0, 0.9), t, 0.1);
      tap.lp.frequency.setTargetAtTime(p.tone * (1 - i * 0.06), t, 0.12);
      tap.g.gain.setTargetAtTime(0.18 + amt * 0.12, t, 0.08);
    });
    this.wet.gain.setTargetAtTime(amt * p.wet, t, 0.08);
  }
}

class CompModule extends EffectModule {
  constructor() { super('comp', 'COMP', COMP_FX, 0); this.value = 0.35; }
  _buildGraph() {
    const ctx = this._ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.mixOut = ctx.createGain();
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 200;
    this._input.connect(this.dry);
    this.dry.connect(this.mixOut);
    this._input.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeup.connect(this.wet);
    this.wet.connect(this.mixOut);
    this.mixOut.connect(this._output);
    this._nodes.push(this.comp, this.makeup, this.dry, this.wet, this.mixOut, this.hp);
  }
  _apply() {
    if (!this._ctx || !this.comp) return;
    const t = this._ctx.currentTime;
    const amt = this.bypassed ? 0 : this.value;
    const algo = this.algo.id;
    const presets = {
      'transparent': { thr: -22, knee: 20, ratio: 2.0, atk: 0.015, rel: 0.25, makeup: 1.05 },
      'soft-knee': { thr: -18, knee: 28, ratio: 2.8, atk: 0.02, rel: 0.32, makeup: 1.08 },
      'vintage': { thr: -16, knee: 12, ratio: 3.5, atk: 0.008, rel: 0.18, makeup: 1.12 },
      'fast-peak': { thr: -12, knee: 4, ratio: 6.0, atk: 0.001, rel: 0.08, makeup: 1.1 },
      'slow-bus': { thr: -20, knee: 18, ratio: 2.4, atk: 0.04, rel: 0.45, makeup: 1.08 },
      'parallel': { thr: -24, knee: 16, ratio: 4.0, atk: 0.01, rel: 0.22, makeup: 1.15 },
      'multiband': { thr: -18, knee: 14, ratio: 3.2, atk: 0.012, rel: 0.28, makeup: 1.1 },
      'transient': { thr: -10, knee: 6, ratio: 5.0, atk: 0.0008, rel: 0.05, makeup: 1.08 },
      'pumping': { thr: -14, knee: 8, ratio: 8.0, atk: 0.002, rel: 0.35, makeup: 1.12 },
      'envelope': { thr: -20, knee: 22, ratio: 3.0, atk: 0.025, rel: 0.5, makeup: 1.1 }
    };
    const p = presets[algo] || presets.transparent;
    this.comp.threshold.setTargetAtTime(-2 + (p.thr + 2) * Math.pow(amt, 0.7), t, 0.04);
    this.comp.knee.setTargetAtTime(0.5 + p.knee * amt, t, 0.04);
    this.comp.ratio.setTargetAtTime(1.05 + (p.ratio - 1.05) * amt, t, 0.04);
    this.comp.attack.setTargetAtTime(p.atk, t, 0.04);
    this.comp.release.setTargetAtTime(p.rel, t, 0.04);
    const makeup = 1 + (p.makeup - 1) * amt * 1.2;
    this.makeup.gain.setTargetAtTime(clamp(makeup, 1, 1.4), t, 0.06);
    const wetAmt = algo === 'parallel' ? Math.min(1, amt * 1.2) : (amt > 0.02 ? 1 : 0);
    this.wet.gain.setTargetAtTime(wetAmt, t, 0.04);
    this.dry.gain.setTargetAtTime(1, t, 0.04);
  }
}

class EffectsModule extends EffectModule {
  constructor() { super('effects', 'EFFECTS', EFFECTS_FX, 0); this.value = 0.5; }
  _buildGraph() {
    const ctx = this._ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter2 = ctx.createBiquadFilter();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.mixOut = ctx.createGain();
    this.lfo = ctx.createOscillator();
    this.lfoG = ctx.createGain();
    this.lfo.frequency.value = 2.5;
    this.lfoG.gain.value = 0;
    this.lfo.connect(this.lfoG);
    try { this.lfo.start(); } catch (_) {}
    this._input.connect(this.dry);
    this.dry.connect(this.mixOut);
    this._input.connect(this.filter);
    this.filter.connect(this.filter2);
    this.filter2.connect(this.wet);
    this.wet.connect(this.mixOut);
    this.mixOut.connect(this._output);
    this._nodes.push(this.filter, this.filter2, this.dry, this.wet, this.mixOut, this.lfo, this.lfoG);
  }
  _apply() {
    if (!this._ctx || !this.filter) return;
    const t = this._ctx.currentTime;
    const amt = this.bypassed ? 0 : this.value;
    const algo = this.algo.id;
    try { this.lfoG.disconnect(); } catch (_) {}
    this.dry.gain.setTargetAtTime(algo === 'spectral' || algo === 'mod-resonator' ? 0.35 : 0.15, t, 0.04);
    this.wet.gain.setTargetAtTime(0.85 + amt * 0.15, t, 0.04);
    const freqFromAmt = (min, max) => min + Math.pow(amt, 1.3) * (max - min);
    switch (algo) {
      case 'lowpass':
        this.filter.type = 'lowpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(200, 16000), t, 0.05);
        this.filter.Q.setTargetAtTime(0.7, t, 0.05);
        this.filter2.type = 'allpass';
        break;
      case 'highpass':
        this.filter.type = 'highpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(30, 4000), t, 0.05);
        this.filter.Q.setTargetAtTime(0.7, t, 0.05);
        this.filter2.type = 'allpass';
        break;
      case 'bandpass':
        this.filter.type = 'bandpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(200, 4000), t, 0.05);
        this.filter.Q.setTargetAtTime(1 + amt * 4, t, 0.05);
        this.filter2.type = 'allpass';
        break;
      case 'notch':
        this.filter.type = 'notch';
        this.filter.frequency.setTargetAtTime(freqFromAmt(400, 3000), t, 0.05);
        this.filter.Q.setTargetAtTime(2 + amt * 8, t, 0.05);
        this.filter2.type = 'allpass';
        break;
      case 'resonant':
        this.filter.type = 'lowpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(300, 5000), t, 0.05);
        this.filter.Q.setTargetAtTime(4 + amt * 14, t, 0.05);
        this.filter2.type = 'allpass';
        break;
      case 'formant':
        this.filter.type = 'peaking';
        this.filter.frequency.setTargetAtTime(500 + amt * 400, t, 0.05);
        this.filter.Q.setTargetAtTime(4, t, 0.05);
        this.filter.gain.setTargetAtTime(6 + amt * 6, t, 0.05);
        this.filter2.type = 'peaking';
        this.filter2.frequency.setTargetAtTime(1400 + amt * 800, t, 0.05);
        this.filter2.Q.setTargetAtTime(3, t, 0.05);
        this.filter2.gain.setTargetAtTime(4 + amt * 5, t, 0.05);
        break;
      case 'auto-wah':
        this.filter.type = 'bandpass';
        this.filter.Q.setTargetAtTime(6 + amt * 6, t, 0.05);
        this.lfo.frequency.setTargetAtTime(0.6 + amt * 3, t, 0.08);
        this.lfoG.gain.setTargetAtTime(300 + amt * 1200, t, 0.08);
        this.filter.frequency.value = 600;
        this.lfoG.connect(this.filter.frequency);
        this.filter2.type = 'allpass';
        break;
      case 'freq-shift':
        this.filter.type = 'bandpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(150, 3500), t, 0.04);
        this.filter.Q.setTargetAtTime(8 + amt * 10, t, 0.04);
        this.filter2.type = 'highpass';
        this.filter2.frequency.setTargetAtTime(80, t, 0.04);
        break;
      case 'spectral':
        this.filter.type = 'bandpass';
        this.filter.frequency.setTargetAtTime(freqFromAmt(300, 2200), t, 0.06);
        this.filter.Q.setTargetAtTime(10 + amt * 20, t, 0.06);
        this.filter2.type = 'bandpass';
        this.filter2.frequency.setTargetAtTime(freqFromAmt(800, 4500), t, 0.06);
        this.filter2.Q.setTargetAtTime(8 + amt * 12, t, 0.06);
        break;
      case 'mod-resonator':
        this.filter.type = 'peaking';
        this.filter.frequency.setTargetAtTime(freqFromAmt(200, 1800), t, 0.05);
        this.filter.Q.setTargetAtTime(12 + amt * 18, t, 0.05);
        this.filter.gain.setTargetAtTime(8 + amt * 10, t, 0.05);
        this.lfo.frequency.setTargetAtTime(0.15 + amt * 1.5, t, 0.1);
        this.lfoG.gain.setTargetAtTime(80 + amt * 400, t, 0.1);
        this.lfoG.connect(this.filter.frequency);
        this.filter2.type = 'lowpass';
        this.filter2.frequency.setTargetAtTime(6000, t, 0.05);
        break;
      default:
        this.filter.type = 'lowpass';
        this.filter.frequency.setTargetAtTime(18000, t, 0.05);
    }
    if (this.bypassed) {
      this.wet.gain.setTargetAtTime(0, t, 0.04);
      this.dry.gain.setTargetAtTime(1, t, 0.04);
    }
  }
}

class ToneStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.low = ctx.createBiquadFilter();
    this.mid = ctx.createBiquadFilter();
    this.bass = ctx.createBiquadFilter();
    this.master = ctx.createGain();
    this.low.type = 'lowshelf';
    this.low.frequency.value = 220;
    this.low.gain.value = 0;
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.8;
    this.mid.gain.value = 0;
    this.bass.type = 'lowshelf';
    this.bass.frequency.value = 90;
    this.bass.gain.value = 0;
    this.master.gain.value = 1.0;
    this.input.connect(this.low);
    this.low.connect(this.mid);
    this.mid.connect(this.bass);
    this.bass.connect(this.master);
  }
  set(id, v) {
    const t = this.ctx.currentTime;
    v = clamp01(v);
    if (id === 'master') {
      this.master.gain.setTargetAtTime(v * 1.1, t, 0.04);
      return;
    }
    const db = (v - 0.5) * 18;
    if (id === 'low') this.low.gain.setTargetAtTime(db, t, 0.05);
    else if (id === 'mid') this.mid.gain.setTargetAtTime(db, t, 0.05);
    else if (id === 'bass') this.bass.gain.setTargetAtTime(db * 0.85, t, 0.05);
  }
  connect(dest) { this.master.connect(dest); }
  disconnect() { try { this.master.disconnect(); } catch (_) {} }
}

export class FxEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.destination = destination;
    this.ambience = new AmbienceModule();
    this.room = new RoomModule();
    this.comp = new CompModule();
    this.effects = new EffectsModule();
    this.modules = [this.ambience, this.room, this.comp, this.effects];
    this.input = ctx.createGain();
    this.input.gain.value = 1;
    const a = this.ambience.create(ctx);
    const r = this.room.create(ctx);
    const c = this.comp.create(ctx);
    const e = this.effects.create(ctx);
    this.tone = new ToneStage(ctx);
    this.input.connect(a.input);
    a.output.connect(r.input);
    r.output.connect(c.input);
    c.output.connect(e.input);
    e.output.connect(this.tone.input);
    this.tone.connect(destination);
    this.tone.set('low', 0.5);
    this.tone.set('mid', 0.5);
    this.tone.set('bass', 0.5);
    this.tone.set('master', 0.75);
  }
  getModule(id) { return this.modules.find((m) => m.id === id) || null; }
  setModuleValue(id, value) { const m = this.getModule(id); if (m) m.setValue(value); }
  setModuleBypass(id, on) { const m = this.getModule(id); if (m) m.setBypass(on); }
  selectAlgo(moduleId, algoIndexOrId) { const m = this.getModule(moduleId); if (m) m.selectAlgo(algoIndexOrId); }
  setTone(id, value) { this.tone.set(id, value); }
  setMaster(v) { this.tone.set('master', v); }
  dispose() {
    this.modules.forEach((m) => m.dispose());
    this.tone.disconnect();
    try { this.input.disconnect(); } catch (_) {}
  }
}

export default FxEngine;
