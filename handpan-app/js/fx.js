/**
 * fx.js — modular expressive FX chain for Pionier
 * Limit ~5 active modules. One primary expressive parameter per module.
 */
const MAX_ACTIVE = 5;

export class FxModule {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.category = def.category || 'fx';
    this.param = def.param || 'amount';
    this.value = def.defaultValue ?? 0.35;
    this.enabled = !!def.enabled;
    this._nodes = [];
    this._input = null;
    this._output = null;
    this._ctx = null;
  }
  create(ctx) {
    this._ctx = ctx;
    this._input = ctx.createGain();
    this._output = ctx.createGain();
    this._input.gain.value = 1;
    this._output.gain.value = 1;
    this._build();
    return { input: this._input, output: this._output };
  }
  setValue(v) {
    this.value = Math.max(0, Math.min(1, v));
    this._apply();
  }
  setEnabled(on) {
    this.enabled = !!on;
    this._apply();
  }
  _build() {}
  _apply() {}
  dispose() {
    for (const n of this._nodes) {
      try { n.disconnect(); } catch (_) {}
      try { if (n.stop) n.stop(); } catch (_) {}
    }
    this._nodes = [];
    try { this._input?.disconnect(); } catch (_) {}
    try { this._output?.disconnect(); } catch (_) {}
  }
}

export class DelayModule extends FxModule {
  constructor() {
    super({ id: 'delay', name: 'Delay', category: 'time', param: 'mix', defaultValue: 0.25 });
  }
  _build() {
    const ctx = this._ctx;
    this.delay = ctx.createDelay(1.5);
    this.fb = ctx.createGain();
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.delay.delayTime.value = 0.32;
    this.fb.gain.value = 0.35;
    this._input.connect(this.dry);
    this.dry.connect(this._output);
    this._input.connect(this.delay);
    this.delay.connect(this.fb);
    this.fb.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this._output);
    this._nodes.push(this.delay, this.fb, this.wet, this.dry);
    this._apply();
  }
  _apply() {
    if (!this.wet) return;
    const t = this._ctx.currentTime;
    const amt = this.enabled ? this.value : 0;
    this.wet.gain.setTargetAtTime(amt * 0.55, t, 0.05);
    this.dry.gain.setTargetAtTime(1, t, 0.05);
    this.fb.gain.setTargetAtTime(0.25 + amt * 0.35, t, 0.05);
  }
}

export class ReverbModule extends FxModule {
  constructor() {
    super({ id: 'reverb', name: 'Reverb', category: 'space', param: 'mix', defaultValue: 0.3 });
  }
  _build() {
    const ctx = this._ctx;
    this.wet = ctx.createGain();
    this.dry = ctx.createGain();
    this.taps = [0.03, 0.05, 0.08, 0.12, 0.17, 0.23].map((dt, i) => {
      const d = ctx.createDelay(0.5);
      d.delayTime.value = dt;
      const g = ctx.createGain();
      g.gain.value = 0.25 - i * 0.03;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      this._input.connect(d);
      d.connect(g);
      g.connect(this.wet);
      g.connect(fb);
      fb.connect(d);
      this._nodes.push(d, g, fb);
      return { d, g, fb };
    });
    this._input.connect(this.dry);
    this.dry.connect(this._output);
    this.wet.connect(this._output);
    this._nodes.push(this.wet, this.dry);
    this._apply();
  }
  _apply() {
    if (!this.wet) return;
    const t = this._ctx.currentTime;
    const amt = this.enabled ? this.value : 0;
    this.wet.gain.setTargetAtTime(amt * 0.5, t, 0.06);
    this.dry.gain.setTargetAtTime(1, t, 0.06);
    this.taps.forEach((tap, i) => {
      tap.fb.gain.setTargetAtTime((0.3 + amt * 0.4) * (1 - i * 0.05), t, 0.08);
    });
  }
}

export class FilterModule extends FxModule {
  constructor() {
    super({ id: 'filter', name: 'Filter', category: 'tone', param: 'cutoff', defaultValue: 0.7 });
  }
  _build() {
    const ctx = this._ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 8000;
    this.filter.Q.value = 0.8;
    this._input.connect(this.filter);
    this.filter.connect(this._output);
    this._nodes.push(this.filter);
    this._apply();
  }
  _apply() {
    if (!this.filter) return;
    const t = this._ctx.currentTime;
    const amt = this.enabled ? this.value : 1;
    const freq = 200 + Math.pow(amt, 1.5) * 14000;
    this.filter.frequency.setTargetAtTime(freq, t, 0.05);
  }
}

export class CompressorModule extends FxModule {
  constructor() {
    super({ id: 'comp', name: 'Compressor', category: 'dynamics', param: 'amount', defaultValue: 0.4, enabled: true });
  }
  _build() {
    const ctx = this._ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.makeup = ctx.createGain();
    this._input.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeup.connect(this._output);
    this._nodes.push(this.comp, this.makeup);
    this._apply();
  }
  _apply() {
    if (!this.comp) return;
    const t = this._ctx.currentTime;
    const amt = this.enabled ? this.value : 0;
    this.comp.threshold.setTargetAtTime(-6 - amt * 18, t, 0.05);
    this.comp.ratio.setTargetAtTime(1.5 + amt * 4, t, 0.05);
    this.comp.knee.setTargetAtTime(10 + amt * 20, t, 0.05);
    this.comp.attack.setTargetAtTime(0.005, t, 0.05);
    this.comp.release.setTargetAtTime(0.15, t, 0.05);
    this.makeup.gain.setTargetAtTime(1 + amt * 0.25, t, 0.05);
  }
}

export class FxChain {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.destination = destination;
    this.modules = [];
    this.input = ctx.createGain();
    this.master = ctx.createGain();
    this.input.gain.value = 1;
    this.master.gain.value = 1;
    this.delay = new DelayModule();
    this.reverb = new ReverbModule();
    this.filter = new FilterModule();
    this.comp = new CompressorModule();
    this.modules = [this.delay, this.reverb, this.filter, this.comp];
    let prev = this.input;
    for (const mod of this.modules) {
      const { input, output } = mod.create(ctx);
      prev.connect(input);
      prev = output;
    }
    prev.connect(this.master);
    this.master.connect(destination);
  }
  setModuleValue(id, value) {
    const mod = this.modules.find((m) => m.id === id);
    if (mod) mod.setValue(value);
  }
  setModuleEnabled(id, on) {
    const mod = this.modules.find((m) => m.id === id);
    if (mod) mod.setEnabled(on);
  }
  dispose() {
    for (const mod of this.modules) mod.dispose();
    try { this.input.disconnect(); } catch (_) {}
    try { this.master.disconnect(); } catch (_) {}
  }
}
