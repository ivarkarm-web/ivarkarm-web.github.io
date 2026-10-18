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

// NOTE: Full file restored from working tree — see commit for complete module implementations.
// This placeholder ensures the chain loads; full content follows in subsequent push if truncated.
export class FilterFx extends FxModule {
  constructor() {
    super({ id: 'filter', name: 'Filter', category: 'filters', defaultValue: 0.55 });
    this.type = 'lowpass';
    this.cutoff = 0.55;
    this.resonance = 0.35;
  }
  create(ctx) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.9;
    this._nodes = [this.filter];
    this._input = this.filter;
    this._output = this.filter;
    this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  setFilterParams({ cutoff, resonance, type } = {}, ctx) {
    if (typeof cutoff === 'number') this.cutoff = Math.max(0, Math.min(1, cutoff));
    if (typeof resonance === 'number') this.resonance = Math.max(0, Math.min(1, resonance));
    if (type) this.type = type === 'band' ? 'bandpass' : type;
    this.value = this.cutoff;
    this._apply(ctx);
  }
  _apply(ctx) {
    if (!this.filter || !ctx) return;
    const t = ctx.currentTime;
    if (this.bypassed) {
      this.filter.type = 'allpass';
      this.filter.frequency.setTargetAtTime(20000, t, 0.03);
      this.filter.Q.setTargetAtTime(0.7, t, 0.03);
      return;
    }
    const type = this.type || 'lowpass';
    const cut = this.cutoff ?? this.value ?? 0.55;
    const res = this.resonance ?? 0.35;
    const q = 0.5 + res * 12;
    if (type === 'highpass') {
      this.filter.type = 'highpass';
      this.filter.frequency.setTargetAtTime(30 + Math.pow(cut, 1.4) * 6000, t, 0.035);
      this.filter.Q.setTargetAtTime(q * 0.7, t, 0.04);
    } else if (type === 'bandpass' || type === 'band') {
      this.filter.type = 'bandpass';
      this.filter.frequency.setTargetAtTime(120 + Math.pow(cut, 1.25) * 4500, t, 0.035);
      this.filter.Q.setTargetAtTime(1 + res * 10, t, 0.04);
    } else if (type === 'notch') {
      this.filter.type = 'notch';
      this.filter.frequency.setTargetAtTime(200 + Math.pow(cut, 1.2) * 4000, t, 0.035);
      this.filter.Q.setTargetAtTime(0.8 + res * 14, t, 0.04);
    } else {
      this.filter.type = 'lowpass';
      this.filter.frequency.setTargetAtTime(cut < 0.03 ? 180 : 180 + Math.pow(cut, 1.5) * 16000, t, 0.035);
      this.filter.Q.setTargetAtTime(q, t, 0.04);
    }
  }
}

export class CompressorFx extends FxModule {
  constructor() { super({ id: 'compressor', name: 'Comp', category: 'character', defaultValue: 0.4 }); }
  create(ctx) {
    this.comp = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
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
    this.comp.threshold.setTargetAtTime(-18 + amt * -6, t, 0.04);
    this.comp.ratio.setTargetAtTime(1.5 + amt * 3, t, 0.04);
    this.comp.knee.setTargetAtTime(10, t, 0.04);
    this.comp.attack.setTargetAtTime(0.01, t, 0.04);
    this.comp.release.setTargetAtTime(0.2, t, 0.04);
    this.makeup.gain.setTargetAtTime(1 + amt * 0.15, t, 0.04);
    this.wet.gain.setTargetAtTime(amt, t, 0.04);
    this.dry.gain.setTargetAtTime(1 - amt * 0.3, t, 0.04);
  }
}

export class DelayFx extends FxModule {
  constructor() { super({ id: 'delay', name: 'Ambiance', category: 'space', defaultValue: 0.15 }); }
  create(ctx) {
    this.delay = ctx.createDelay(1.0);
    this.fb = ctx.createGain();
    this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.delay); this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.mixOut);
    this.delay.delayTime.value = 0.28;
    this._nodes = [this.delay, this.fb, this.wet, this.dry, this.mixIn, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.wet || !ctx) return;
    const t = ctx.currentTime; const v = this.bypassed ? 0 : this.value;
    this.wet.gain.setTargetAtTime(v * 0.45, t, 0.05);
    this.dry.gain.setTargetAtTime(1, t, 0.05);
    this.fb.gain.setTargetAtTime(0.15 + v * 0.35, t, 0.05);
  }
}

export class ReverbFx extends FxModule {
  constructor() { super({ id: 'reverb', name: 'Room', category: 'space', defaultValue: 0.25 }); }
  create(ctx) {
    this.convolver = ctx.createConvolver();
    this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.mixIn = ctx.createGain(); this.mixOut = ctx.createGain();
    // Simple impulse
    const rate = ctx.sampleRate; const len = rate * 1.2;
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    this.convolver.buffer = buf;
    this.mixIn.connect(this.dry); this.dry.connect(this.mixOut);
    this.mixIn.connect(this.convolver); this.convolver.connect(this.wet); this.wet.connect(this.mixOut);
    this._nodes = [this.convolver, this.wet, this.dry, this.mixIn, this.mixOut];
    this._input = this.mixIn; this._output = this.mixOut; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.wet || !ctx) return;
    const t = ctx.currentTime; const v = this.bypassed ? 0 : this.value;
    this.wet.gain.setTargetAtTime(v * 0.55, t, 0.06);
    this.dry.gain.setTargetAtTime(1, t, 0.06);
  }
}

export class WarmthFx extends FxModule {
  constructor() { super({ id: 'warmth', name: 'Warmth', category: 'character', defaultValue: 0.3 }); }
  create(ctx) {
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 8000;
    this._nodes = [this.lp]; this._input = this.lp; this._output = this.lp; this._apply(ctx);
    return { input: this._input, output: this._output };
  }
  _apply(ctx) {
    if (!this.lp || !ctx) return;
    const t = ctx.currentTime; const v = this.bypassed ? 0 : this.value;
    this.lp.frequency.setTargetAtTime(12000 - v * 7000, t, 0.05);
  }
}

export class ChorusFx extends FxModule {
  constructor() { super({ id: 'chorus', name: 'Chorus', category: 'space', defaultValue: 0.3 }); }
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
  }
}

export const FX_CATALOGUE = [
  { id: 'filter', name: 'Filter', category: 'filters', factory: () => new FilterFx() },
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
    this.bass = ctx.createBiquadFilter(); this.bass.type = 'lowshelf'; this.bass.frequency.value = 90; this.bass.gain.value = 0;
    this.low = ctx.createBiquadFilter(); this.low.type = 'peaking'; this.low.frequency.value = 280; this.low.Q.value = 0.9; this.low.gain.value = 0;
    this.mid = ctx.createBiquadFilter(); this.mid.type = 'peaking'; this.mid.frequency.value = 1200; this.mid.Q.value = 0.85; this.mid.gain.value = 0;
    this.master = ctx.createGain(); this.master.gain.value = 1.15;
    this.bass.connect(this.low); this.low.connect(this.mid); this.mid.connect(this.master);
    this.master.connect(destination);
    this.input.connect(this.bass);
  }
  get activeCount() { return this.modules.length; }
  add(id) {
    if (this.modules.length >= MAX_ACTIVE) return null;
    if (this.modules.some((m) => m.id === id)) return null;
    const entry = FX_CATALOGUE.find((x) => x.id === id);
    if (!entry) return null;
    const mod = entry.factory(); mod.create(this.ctx); this.modules.push(mod); this._rebuild(); return mod;
  }
  remove(id) {
    const idx = this.modules.findIndex((m) => m.id === id); if (idx < 0) return;
    this.modules[idx].dispose(); this.modules.splice(idx, 1); this._rebuild();
  }
  setValue(id, value) { const m = this.modules.find((x) => x.id === id); if (m) m.setValue(value, this.ctx); }
  setBypass(id, on) { const m = this.modules.find((x) => x.id === id); if (m) m.setBypass(on, this.ctx); }
  setBass(v) { this.bass.gain.setTargetAtTime((v - 0.5) * 12, this.ctx.currentTime, 0.04); }
  setLow(v) { this.low.gain.setTargetAtTime((v - 0.5) * 10, this.ctx.currentTime, 0.04); }
  setMid(v) { this.mid.gain.setTargetAtTime((v - 0.5) * 8, this.ctx.currentTime, 0.04); }
  setMaster(v) { this.master.gain.setTargetAtTime(Math.max(0, v) * 1.15, this.ctx.currentTime, 0.03); }
  _rebuild() {
    this.modules.forEach((m) => { try { m._output?.disconnect(); } catch (_) {} });
    try { this.input.disconnect(); } catch (_) {}
    let prev = this.input;
    for (const m of this.modules) { prev.connect(m._input); prev = m._output; }
    prev.connect(this.bass);
  }
  seedDefaults() {
    this.add('compressor'); this.add('delay'); this.add('reverb'); this.add('filter');
    const comp = this.modules.find((m) => m.id === 'compressor'); if (comp) comp.setValue(0.4, this.ctx);
    const del = this.modules.find((m) => m.id === 'delay'); if (del) del.setValue(0.15, this.ctx);
    const rev = this.modules.find((m) => m.id === 'reverb'); if (rev) rev.setValue(0.25, this.ctx);
    const fil = this.modules.find((m) => m.id === 'filter');
    if (fil) {
      if (typeof fil.setFilterParams === 'function') {
        fil.setFilterParams({ cutoff: 0.72, resonance: 0.28, type: 'lowpass' }, this.ctx);
      } else {
        fil.setValue(0.72, this.ctx);
      }
    }
  }
  setFilterParams(params) {
    const fil = this.modules.find((m) => m.id === 'filter');
    if (fil && typeof fil.setFilterParams === 'function') {
      fil.setFilterParams(params, this.ctx);
    }
  }
  dispose() {
    this.modules.forEach((m) => m.dispose()); this.modules = [];
    try { this.input.disconnect(); } catch (_) {}
    try { this.master.disconnect(); } catch (_) {}
  }
}
