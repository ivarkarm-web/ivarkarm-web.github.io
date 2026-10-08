/**
 * instrument.js — shared Instrument abstraction + registry for Pionier
 */

import { Gesture } from './gesture.js';

export class Instrument {
  constructor(def = {}) {
    this.id = def.id || 'unknown';
    this.name = def.name || this.id;
    this.description = def.description || '';
    this.category = def.category || 'found';
    this.polyphony = def.polyphony ?? 9;
    this.compatibleFx = def.compatibleFx || ['compressor', 'delay', 'reverb'];
    this.tuning = def.tuning || {};
    this.sources = def.sources || {};
    this.audioCtx = null;
    this.bus = null;
    this.activeVoices = new Map();
    this._ready = false;
  }

  async activate(audioCtx, bus) {
    this.audioCtx = audioCtx;
    this.bus = bus;
    this._ready = true;
  }

  deactivate() {
    this.dampAll();
    this._ready = false;
  }

  get ready() { return this._ready; }
  getZones() { return []; }
  setZones(fields) { this._zones = fields; }
  noteOn(gesture, zone = null) {}
  noteOff(zoneId, gesture = null) {}
  dampAll() {
    for (const [id] of this.activeVoices) this.noteOff(id);
    this.activeVoices.clear();
  }
  express(gesture, zone = null) {}
  getNotes() { return []; }
  drawExtras(ctx2d, layout) {}
  getPerformanceHints() { return { maxVoices: this.polyphony, prefersSamples: false }; }
}

const _registry = new Map();
let _activeId = null;

export const InstrumentRegistry = {
  register(instrument) {
    if (!(instrument instanceof Instrument) && typeof instrument.noteOn !== 'function') {
      throw new Error('InstrumentRegistry.register: expected Instrument instance');
    }
    _registry.set(instrument.id, instrument);
    return instrument;
  },
  get(id) { return _registry.get(id) || null; },
  list() {
    return Array.from(_registry.values()).map((inst) => ({
      id: inst.id, name: inst.name, description: inst.description, category: inst.category
    }));
  },
  get activeId() { return _activeId; },
  get active() { return _activeId ? _registry.get(_activeId) : null; },
  async setActive(id, audioCtx, bus) {
    if (_activeId && _activeId !== id) {
      const prev = _registry.get(_activeId);
      if (prev) prev.deactivate();
    }
    const next = _registry.get(id);
    if (!next) throw new Error('Unknown instrument: ' + id);
    await next.activate(audioCtx, bus);
    _activeId = id;
    return next;
  },
  clear() {
    if (_activeId) {
      const prev = _registry.get(_activeId);
      if (prev) prev.deactivate();
    }
    _registry.clear();
    _activeId = null;
  }
};

export { Gesture };
