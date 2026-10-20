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
    this.engineKind = def.engineKind || (this.category === 'handpan' ? 'sample' : 'procedural');
    this.polyphony = def.polyphony ?? 9;
    this.compatibleFx = def.compatibleFx || ['compressor', 'delay', 'reverb'];
    this.tuning = def.tuning || {};
    this.sources = def.sources || {};
    this.audioCtx = null;
    this.bus = null;
    this.activeVoices = new Map();
    this._ready = false;
  }
  async activate(audioCtx, bus) { this.audioCtx = audioCtx; this.bus = bus; this._ready = true; }
  deactivate() { this.dampAll(); this._ready = false; }
  get ready() { return this._ready; }
  getZones() { return []; }
  setZones(fields) { this._zones = fields; }
  noteOn(gesture, zone = null) {}
  noteOff(zoneId, gesture = null) {}
  dampAll() { for (const [id] of this.activeVoices) this.noteOff(id); this.activeVoices.clear(); }
  express(gesture, zone = null) {}
  getNotes() { return []; }
  drawExtras(ctx2d, layout) {}
  getPerformanceHints() { return { maxVoices: this.polyphony, prefersSamples: false }; }
}

const _registry = new Map();
let _activeId = null;
// Serialize async activations so rapid UI selections cannot finish out of order.
let _activationQueue = Promise.resolve();

export const InstrumentRegistry = {
  register(instrument) {
    if (!(instrument instanceof Instrument) && typeof instrument.noteOn !== 'function') {
      throw new Error('InstrumentRegistry.register: expected Instrument instance');
    }
    _registry.set(instrument.id, instrument);
    return instrument;
  },
  get(id) { return _registry.get(id) || null; }
  list() {
    return Array.from(_registry.values()).map((inst) => ({
      id: inst.id,
      name: inst.name,
      description: inst.description,
      category: inst.category,
      // sample = may use owner/recorded buffers; procedural = synthesis / library render
      engineKind: inst.engineKind || (inst.category === 'handpan' ? 'sample' : 'procedural')
    }));
  },
  get activeId() { return _activeId; },
  get active() { return _activeId ? _registry.get(_activeId) : null; },
  setActive(id, audioCtx, bus) {
    const activate = async () => {
      const next = _registry.get(id);
      if (!next) throw new Error('Unknown instrument: ' + id);
      const previousId = _activeId;
      const previous = previousId ? _registry.get(previousId) : null;

      // Initialize the candidate before taking the current instrument offline.
      // A failed activation must not leave the UI pointing at a deactivated voice.
      await next.activate(audioCtx, bus);

      if (previous && previousId !== id) previous.deactivate();
      _activeId = id;
      return next;
    };
    const result = _activationQueue.then(activate, activate);
    // Keep the queue usable after a rejected activation while returning the
    // original rejection to the caller.
    _activationQueue = result.catch(() => {});
    return result;
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
