/**
 * fx.js — modular expressive FX chain for Pionier
 * Limit ~5 active modules. One primary expressive parameter per module.
 */
const MAX_ACTIVE = 5;

export class FxModule {
  constructor(def) {
    this.id = def.id; this.name = def.name; this.category = def.category;
    this.value = def.defaultValue ?? 0.35; this.bypassed = false;
    this._nodes = []; this._input = null; this._output = null;
  }
  create(ctx) { throw new Error('FxModule.create must be implemented'); }
  setValue(v, ctx) { this.value = Math.max(0, Math.min(1, v)); this._apply(ctx); }
  setBypass(on, ctx) { this.bypassed = !!on; this._apply(ctx); }
  _apply(ctx) {}
  dispose() {
    for (const n of this._nodes) { try { n.disconnect(); } catch (_) {} }
    this._nodes = []; this._input = null; this._output = null;
  }
}

export class CompressorFx extends FxModule {
  constructor() { super({ id: 'compressor', name: 'Comp', category: 'character', defaultValue: 0.4 }); this.type = 'soft'; }
  create(ctx) {
    this.comp = ctx.createDynamicsCompressor(); this.makeup = ctx.createGain();
    this.dry = ctx.createGain(); this.wet = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.comp); this.comp.connect(this.makeup);
    this.makeup.connect(this.wet); this.wet.connect(this.mixOut);
    this._nodes = [this.comp, this.makeup, this.dry, this.wet, this.mixIn, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.comp || !ctx) return;
    const t = ctx.currentTime; const amt = this.bypassed ? 0 : this.value;
    const presets = {
      soft: { threshold: -18, knee: 24, ratio: 2.2, attack: 0.012, release: 0.28, makeup: 1.05 },
      punch: { threshold: -14, knee: 8, ratio: 4, attack: 0.002, release: 0.12, makeup: 1.12 },
      glue: { threshold: -20, knee: 16, ratio: 3.2, attack: 0.02, release: 0.35, makeup: 1.08 },
      limit: { threshold: -8, knee: 2, ratio: 12, attack: 0.001, release: 0.08, makeup: 1.15 }
    };
    const p = presets[this.type] || presets.soft;
    this.comp.threshold.setTargetAtTime(-2 + (p.threshold + 2) * Math.pow(amt, 0.75), t, 0.04);
    this.comp.ratio.setTargetAtTime(1.05 + (p.ratio - 1.05) * amt, t, 0.04);
    this.comp.knee.setTargetAtTime(0.5 + p.knee * amt, t, 0.04);
    this.comp.attack.setTargetAtTime(p.attack, t, 0.04);
    this.comp.release.setTargetAtTime(p.release, t, 0.04);
    this.makeup.gain.setTargetAtTime(1 + (p.makeup - 1) * amt * 1.4, t, 0.06);
    this.wet.gain.setTargetAtTime(amt > 0.01 ? 1 : 0, t, 0.04);
    this.dry.gain.setTargetAtTime(1, t, 0.04);
  }
}

export class DelayFx extends FxModule {
  constructor() { super({ id: 'delay', name: 'Ambiance', category: 'space', defaultValue: 0.15 }); this.type = 'echo'; }
  create(ctx) {
    this.delay = ctx.createDelay(1.5); this.fb = ctx.createGain();
    this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.delay); this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.mixOut);
    this._nodes = [this.delay, this.fb, this.wet, this.dry, this.mixIn, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.delay || !ctx) return;
    const t = ctx.currentTime; const del = this.bypassed ? 0 : this.value;
    const types = {
      echo: { timeMin: 0.22, timeMax: 0.48, fbMin: 0.22, fbMax: 0.55, wetScale: 0.55 },
      slap: { timeMin: 0.055, timeMax: 0.12, fbMin: 0.05, fbMax: 0.18, wetScale: 0.45 },
      ping: { timeMin: 0.28, timeMax: 0.55, fbMin: 0.35, fbMax: 0.68, wetScale: 0.5 },
      ambient: { timeMin: 0.4, timeMax: 0.72, fbMin: 0.28, fbMax: 0.52, wetScale: 0.6 }
    };
    const d = types[this.type] || types.echo;
    this.delay.delayTime.setTargetAtTime(d.timeMin + del * (d.timeMax - d.timeMin), t, 0.08);
    this.fb.gain.setTargetAtTime(d.fbMin + del * (d.fbMax - d.fbMin), t, 0.06);
    this.wet.gain.setTargetAtTime(del * d.wetScale, t, 0.06);
    this.dry.gain.setTargetAtTime(1, t, 0.06);
  }
}

export class ReverbFx extends FxModule {
  constructor() { super({ id: 'reverb', name: 'Room', category: 'space', defaultValue: 0.25 }); this.type = 'room'; }
  create(ctx) {
    this.input = ctx.createGain(); this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.input); this.wet.connect(this.mixOut);
    const delays = [0.031, 0.053, 0.073, 0.097]; this.taps = [];
    delays.forEach((dt, i) => {
      const dd = ctx.createDelay(0.3); dd.delayTime.value = dt;
      const g = ctx.createGain(); g.gain.value = 0.28 - i * 0.04;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 4200 - i * 400;
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      this.input.connect(dd); dd.connect(f); f.connect(g); g.connect(this.wet); g.connect(fb); fb.connect(dd);
      this.taps.push({ d: dd, g, f, fb });
    });
    this._nodes = [this.input, this.wet, this.dry, this.mixIn, this.mixOut, ...this.taps.flatMap((t) => [t.d, t.g, t.f, t.fb])];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.wet || !ctx) return;
    const t = ctx.currentTime; const rev = this.bypassed ? 0 : this.value;
    const types = {
      room: { taps: [0.022, 0.035, 0.048, 0.062], tapGains: [0.32, 0.26, 0.2, 0.14], fb: 0.28, filters: [5200, 4600, 4000, 3400], wetScale: 0.5 },
      hall: { taps: [0.038, 0.061, 0.089, 0.12], tapGains: [0.3, 0.25, 0.2, 0.16], fb: 0.42, filters: [4200, 3600, 3000, 2400], wetScale: 0.55 },
      plate: { taps: [0.018, 0.029, 0.041, 0.055], tapGains: [0.34, 0.28, 0.22, 0.17], fb: 0.36, filters: [7000, 6200, 5400, 4600], wetScale: 0.52 },
      cave: { taps: [0.055, 0.088, 0.125, 0.17], tapGains: [0.28, 0.24, 0.2, 0.16], fb: 0.48, filters: [2800, 2200, 1700, 1300], wetScale: 0.58 }
    };
    const r = types[this.type] || types.room;
    this.wet.gain.setTargetAtTime(rev * r.wetScale, t, 0.08);
    this.input.gain.setTargetAtTime(0.35 + rev * 0.65, t, 0.08);
    this.dry.gain.setTargetAtTime(1, t, 0.06);
    this.taps.forEach((tap, i) => {
      try {
        tap.d.delayTime.setTargetAtTime(r.taps[i] ?? r.taps[r.taps.length - 1], t, 0.1);
        tap.g.gain.setTargetAtTime(r.tapGains[i] ?? 0.15, t, 0.08);
        tap.f.frequency.setTargetAtTime(r.filters[i] ?? 3000, t, 0.1);
        tap.fb.gain.setTargetAtTime(r.fb, t, 0.1);
      } catch (_) {}
    });
  }
}

export class LowpassFx extends FxModule {
  constructor() { super({ id: 'lowpass', name: 'Low Pass', category: 'filters', defaultValue: 0.7 }); }
  create(ctx) {
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 0.7;
    this._nodes = [this.filter]; this._input = this.filter; this._output = this.filter; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.filter || !ctx) return;
    const hz = this.bypassed ? 20000 : 200 + Math.pow(this.value, 1.6) * 19800;
    this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.04);
  }
}

export class WarmthFx extends FxModule {
  constructor() { super({ id: 'warmth', name: 'Warmth', category: 'character', defaultValue: 0.3 }); }
  create(ctx) {
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.5;
    this.sat = ctx.createWaveShaper(); this.drive = ctx.createGain();
    this.mixIn = ctx.createGain(); this.dry = ctx.createGain(); this.wet = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.drive); this.drive.connect(this.sat); this.sat.connect(this.lp);
    this.lp.connect(this.wet); this.wet.connect(this.mixOut);
    this._makeCurve(0.3);
    this._nodes = [this.lp, this.sat, this.drive, this.mixIn, this.dry, this.wet, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _makeCurve(amount) {
    const n = 2048; const curve = new Float32Array(n); const k = amount * 12;
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    this.sat.curve = curve;
  }
  _apply(ctx) {
    if (!this.lp || !ctx) return;
    const t = ctx.currentTime; const v = this.bypassed ? 0 : this.value;
    this.lp.frequency.setTargetAtTime(18000 - v * 10000, t, 0.05);
    this.drive.gain.setTargetAtTime(1 + v * 0.8, t, 0.05);
    this.wet.gain.setTargetAtTime(v * 0.7, t, 0.05);
    this.dry.gain.setTargetAtTime(1 - v * 0.25, t, 0.05);
    this._makeCurve(0.15 + v * 0.55);
  }
}

export class ChorusFx extends FxModule {
  constructor() { super({ id: 'chorus', name: 'Chorus', category: 'space', defaultValue: 0.35 }); }
  create(ctx) {
    this.delay = ctx.createDelay(0.05);
    this.lfo = ctx.createOscillator(); this.lfoGain = ctx.createGain();
    this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.delay); this.delay.connect(this.wet); this.wet.connect(this.mixOut);
    this.lfo.type = 'sine'; this.lfo.frequency.value = 0.8; this.lfoGain.gain.value = 0.004;
    this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.delay.delayTime);
    this.delay.delayTime.value = 0.018; this.lfo.start();
    this._nodes = [this.delay, this.lfo, this.lfoGain, this.wet, this.dry, this.mixIn, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.wet || !ctx) return;
    const t = ctx.currentTime; const v = this.bypassed ? 0 : this.value;
    this.wet.gain.setTargetAtTime(v * 0.55, t, 0.05); this.dry.gain.setTargetAtTime(1, t, 0.05);
    this.lfoGain.gain.setTargetAtTime(0.002 + v * 0.006, t, 0.05);
    this.lfo.frequency.setTargetAtTime(0.4 + v * 1.2, t, 0.08);
  }
}

export const FX_CATALOGUE = [
  { id: 'lowpass', name: 'Low Pass', category: 'filters', factory: () => new LowpassFx() },
  { id: 'warmth', name: 'Warmth', category: 'character', factory: () => new WarmthFx() },
  { id: 'compressor', name: 'Comp', category: 'character', factory: () => new CompressorFx() },
  { id: 'chorus', name: 'Chorus', category: 'space', factory: () => new ChorusFx() },
  { id: 'delay', name: 'Ambiance', category: 'space', factory: () => new DelayFx() },
  { id: 'reverb', name: 'Room', category: 'space', factory: () => new ReverbFx() }
];

export class FxChain {
  constructor(ctx, destination) {
    this.ctx = ctx; this.destination = destination; this.modules = [];
    this.input = ctx.createGain(); this.input.gain.value = 1;
    this.bass = ctx.createBiquadFilter();
    this.bass.type = 'lowshelf';
    this.bass.frequency.value = 90;
    this.bass.gain.value = 0;
    this.low = ctx.createBiquadFilter();
    this.low.type = 'peaking';
    this.low.frequency.value = 280;
    this.low.Q.value = 0.9;
    this.low.gain.value = 0;
    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1200;
    this.mid.Q.value = 0.85;
    this.mid.gain.value = 0;
    this.master = ctx.createGain(); this.master.gain.value = 1.15;
    this.bass.connect(this.low);
    this.low.connect(this.mid);
    this.mid.connect(this.master);
    this.master.connect(destination);
    this._rebuild();
  }
  /** v in 0..1, 0.5 = neutral */
  setBass(v) {
    const g = (Math.max(0, Math.min(1, v)) - 0.5) * 24;
    this.bass.gain.setTargetAtTime(g, this.ctx.currentTime, 0.04);
  }
  setLow(v) {
    const g = (Math.max(0, Math.min(1, v)) - 0.5) * 24;
    this.low.gain.setTargetAtTime(g, this.ctx.currentTime, 0.04);
  }
  setMid(v) {
    const g = (Math.max(0, Math.min(1, v)) - 0.5) * 24;
    this.mid.gain.setTargetAtTime(g, this.ctx.currentTime, 0.04);
  }
  setMaster(v) {
    const g = Math.max(0, Math.min(1.4, Math.max(0, Math.min(1, v)) * 1.4));
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.04);
  }
  get activeCount() { return this.modules.length; }
  add(id) {
    if (this.modules.length >= MAX_ACTIVE) return null;
    if (this.modules.some((m) => m.id === id)) return null;
    const entry = FX_CATALOGUE.find((e) => e.id === id); if (!entry) return null;
    const mod = entry.factory(); mod.create(this.ctx); this.modules.push(mod); this._rebuild(); return mod;
  }
  remove(id) {
    const idx = this.modules.findIndex((m) => m.id === id); if (idx < 0) return;
    this.modules[idx].dispose(); this.modules.splice(idx, 1); this._rebuild();
  }
  setValue(id, value) { const m = this.modules.find((x) => x.id === id); if (m) m.setValue(value, this.ctx); }
  setBypass(id, on) { const m = this.modules.find((x) => x.id === id); if (m) m.setBypass(on, this.ctx); }
  _rebuild() {
    try { this.input.disconnect(); } catch (_) {}
    this.modules.forEach((m) => { try { m._output?.disconnect(); } catch (_) {} });
    let prev = this.input;
    for (const m of this.modules) { prev.connect(m._input); prev = m._output; }
    prev.connect(this.bass);
  }
  seedDefaults() {
    this.add('compressor'); this.add('delay'); this.add('reverb');
    const comp = this.modules.find((m) => m.id === 'compressor'); if (comp) comp.setValue(0.4, this.ctx);
    const del = this.modules.find((m) => m.id === 'delay'); if (del) del.setValue(0.15, this.ctx);
    const rev = this.modules.find((m) => m.id === 'reverb'); if (rev) rev.setValue(0.25, this.ctx);
  }
  dispose() {
    this.modules.forEach((m) => m.dispose()); this.modules = [];
    try { this.input.disconnect(); } catch (_) {}
    try { this.master.disconnect(); } catch (_) {}
  }
}
