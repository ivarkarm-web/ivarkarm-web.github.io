/**
 * note-sample-bank.js
 *
 * Optional one-shot audio bank for properly licensed recordings; empty manifests use the procedural fallback.
 * Exposes multi-zone harmonic blend + non-linear velocity layering
 * without Flutter / React Native — pure Web Audio graph only.
 */
export class NoteSampleBank {
  constructor(ctx, baseUrl = './sounds/notes/') {
    this.ctx = ctx;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    /** Active scale MIDI → AudioBuffer */
    this.byMidi = new Map();
    /** scaleId → Map(midi → AudioBuffer) */
    this.byScale = new Map();
    /** Union of all samples (fallback when a scale pack is missing) */
    this.allMidi = new Map();
    this.activeScaleId = null;
    this.manifest = null;
    this.ready = false;
    this.loadPromise = null;
    this._rr = new Map();
  }

  async load() {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  async _load() {
    const res = await fetch(this.baseUrl + 'manifest.json');
    if (!res.ok) throw new Error('Sample manifest missing: ' + res.status);
    this.manifest = await res.json();

    // Support both flat samples[] and nested scales[].samples
    const flat = [];
    for (const s of this.manifest.samples || []) {
      flat.push({ ...s, scaleId: s.scaleId || 'default' });
    }
    for (const scale of this.manifest.scales || []) {
      for (const s of scale.samples || []) {
        flat.push({ ...s, scaleId: s.scaleId || scale.id || 'default' });
      }
    }
    const seen = new Set();
    const samples = [];
    for (const s of flat) {
      const key = (s.scaleId || 'default') + '|' + s.file;
      if (seen.has(key)) continue;
      seen.add(key);
      samples.push(s);
    }

    await Promise.all(
      samples.map(async (s) => {
        try {
          const r = await fetch(this.baseUrl + s.file);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(ab.slice(0));
          const scaleId = s.scaleId || 'default';
          if (!this.byScale.has(scaleId)) this.byScale.set(scaleId, new Map());
          this.byScale.get(scaleId).set(s.midi, buf);
          this.allMidi.set(s.midi, buf);
        } catch (e) {
          console.warn('Sample failed', s.file, e);
        }
      })
    );

    const preferred =
      this.manifest.scales?.[0]?.id ||
      (this.byScale.has('default') ? 'default' : null) ||
      (this.byScale.size ? this.byScale.keys().next().value : null);

    if (preferred) this.setActiveScale(preferred);
    else if (this.allMidi.size) {
      this.byMidi = new Map(this.allMidi);
      this.activeScaleId = 'all';
      this.ready = true;
    } else {
      this.ready = false;
    }
    console.info('[samples] loaded scales', [...this.byScale.keys()], 'active', this.activeScaleId, 'notes', this.byMidi.size);
    return this;
  }

  /**
   * Switch which scale pack is used. If the pack is missing, fall back to
   * default / any loaded samples so we never drop to synth when audio exists.
   */
  setActiveScale(scaleId) {
    let map = scaleId ? this.byScale.get(scaleId) : null;

    if (!map || !map.size) {
      if (scaleId) {
        for (const k of this.byScale.keys()) {
          if (k === scaleId || k.startsWith(scaleId) || scaleId.startsWith(k)) {
            map = this.byScale.get(k);
            scaleId = k;
            break;
          }
        }
      }
    }

    if (!map || !map.size) {
      if (this.byScale.has('default') && this.byScale.get('default').size) {
        map = this.byScale.get('default');
        scaleId = 'default';
      } else if (this.allMidi.size) {
        map = this.allMidi;
        scaleId = 'all';
      } else if (this.byScale.size) {
        scaleId = this.byScale.keys().next().value;
        map = this.byScale.get(scaleId);
      }
    }

    if (!map || !map.size) {
      this.activeScaleId = null;
      this.byMidi = new Map();
      this.ready = false;
      return false;
    }

    this.activeScaleId = scaleId;
    this.byMidi = map;
    this.ready = this.byMidi.size > 0;
    return this.ready;
  }

  resolve(midi) {
    if (!this.byMidi.size && this.allMidi.size) {
      this.byMidi = this.allMidi;
      this.ready = true;
    }
    if (!this.byMidi.size) return null;
    const m = Math.round(midi);
    if (this.byMidi.has(m)) {
      return { buffer: this.byMidi.get(m), rate: 1, sourceMidi: m };
    }
    let best = null;
    let bestDist = Infinity;
    for (const k of this.byMidi.keys()) {
      const d = Math.abs(k - m);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    // Allow up to an octave of pitch-shift so transposed roots still hit samples
    if (best == null || bestDist > 12) return null;
    return {
      buffer: this.byMidi.get(best),
      rate: Math.pow(2, (m - best) / 12),
      sourceMidi: best
    };
  }

  static velocityCurve(v) {
    v = Math.max(0, Math.min(1, v));
    const soft = Math.pow(v, 1.65);
    const hard = Math.pow(v, 0.72);
    return soft * (1 - v) + hard * v;
  }

  static zoneWeights(radial = 0.4, angleRad = 0) {
    const r = Math.max(0, Math.min(1.25, radial));
    const center = Math.exp(-r * r * 3.2);
    const mid = Math.exp(-Math.pow(r - 0.45, 2) * 8);
    const edge = Math.max(0, (r - 0.25) / 0.9);
    const sum = center + mid + edge + 1e-6;
    return {
      body: center / sum,
      fundamental: center / sum,
      partials: mid / sum,
      brightness: edge / sum,
      noise: 0
    };
  }

  play(midi, dest, when, opts = {}) {
    const vel = NoteSampleBank.velocityCurve(opts.vel ?? 0.75);
    const radial = opts.radial ?? 0.35;
    const angleRad = opts.angleRad ?? 0;
    const z = NoteSampleBank.zoneWeights(radial, angleRad);

    const hit = this.resolve(midi);
    if (!hit) return null;

    const ctx = this.ctx;
    const key = hit.sourceMidi;
    const rr = (this._rr.get(key) || 0) + 1;
    this._rr.set(key, rr);

    const detuneA = 1 + ((rr % 3) - 1) * 0.0018;
    const detuneB = 1 + ((rr % 5) - 2) * 0.0024;
    const startSkew = (rr % 4) * 0.0007;

    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(dest);

    const nodes = [];

    const a = this._layer(hit, when + startSkew, {
      rate: hit.rate * detuneA,
      filterType: 'lowpass',
      filterFreq: 420 + z.fundamental * 900 + vel * 400,
      filterQ: 0.7,
      peak: 1.05 * z.body * (0.4 + 0.6 * vel),
      attack: 0.004 + (1 - vel) * 0.012
    });
    a.gain.connect(bus);
    nodes.push(a.source, a.gain, a.filter);

    const b = this._layer(hit, when + startSkew + 0.0012, {
      rate: hit.rate * detuneB * (1 + z.partials * 0.002),
      filterType: 'bandpass',
      filterFreq: 900 + z.partials * 2200 + vel * 800,
      filterQ: 0.9 + z.brightness * 0.6,
      peak: 0.8 * z.partials * (0.3 + 0.7 * vel),
      attack: 0.003
    });
    b.gain.connect(bus);
    nodes.push(b.source, b.gain, b.filter);

    const c = this._layer(hit, when + startSkew + 0.002, {
      rate: hit.rate * (1 + ((rr % 7) - 3) * 0.0015),
      filterType: 'highpass',
      filterFreq: 1800 + z.brightness * 3200,
      filterQ: 0.55,
      peak: 0.55 * z.brightness * (0.25 + 0.75 * vel),
      attack: 0.002
    });
    c.gain.connect(bus);
    nodes.push(c.source, c.gain, c.filter);

    const dur = hit.buffer.duration / Math.max(0.5, hit.rate);
    const stop = (t = ctx.currentTime, tc = 0.06) => {
      try {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0, t, tc);
      } catch (_) {}
    };

    a.source.onended = () => {
      try { bus.disconnect(); } catch (_) {}
    };

    return { nodes, bus, stop, duration: dur };
  }

  _layer(hit, when, p) {
    const src = this.ctx.createBufferSource();
    src.buffer = hit.buffer;
    src.playbackRate.value = p.rate;
    const filter = this.ctx.createBiquadFilter();
    filter.type = p.filterType;
    filter.frequency.value = p.filterFreq;
    filter.Q.value = p.filterQ;
    const gain = this.ctx.createGain();
    const peak = Math.max(0.0001, p.peak);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + p.attack);
    const dur = hit.buffer.duration / Math.max(0.5, p.rate);
    gain.gain.setValueAtTime(peak, when + Math.max(p.attack + 0.02, dur * 0.55));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    src.start(when);
    src.stop(when + dur + 0.05);
    return { source: src, filter, gain };
  }
}
