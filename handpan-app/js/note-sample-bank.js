/**
 * note-sample-bank.js
 *
 * Dry one-shot handpan hits mapped by MIDI (Haganenote recordings).
 * Exposes multi-zone harmonic blend + non-linear velocity layering
 * without Flutter / React Native — pure Web Audio graph only.
 */
export class NoteSampleBank {
  constructor(ctx, baseUrl = './sounds/notes/') {
    this.ctx = ctx;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.byMidi = new Map();
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
    await Promise.all(
      (this.manifest.samples || []).map(async (s) => {
        try {
          const r = await fetch(this.baseUrl + s.file);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(ab.slice(0));
          this.byMidi.set(s.midi, buf);
        } catch (e) {
          console.warn('Sample failed', s.file, e);
        }
      })
    );
    this.ready = this.byMidi.size > 0;
    return this;
  }

  resolve(midi) {
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
    if (best == null || bestDist > 4) return null;
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

  /** Zone weights from pad radial position (0 = center, 1 = edge). */
  static zoneWeights(radial, angleRad = 0) {
    const r = Math.max(0, Math.min(1.2, radial));
    const center = Math.max(0, 1 - r * 1.35);
    const mid = Math.max(0, 1 - Math.abs(r - 0.45) * 2.2);
    const edge = Math.max(0, (r - 0.35) * 1.6);
    const s = center + mid + edge + 0.0001;
    return {
      fundamental: center / s,
      partials: mid / s,
      brightness: edge / s,
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

    const layer = (filterType, freq, q, gainPeak, rateMul, attack) => {
      const source = ctx.createBufferSource();
      source.buffer = hit.buffer;
      source.playbackRate.value = hit.rate * rateMul;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(gainPeak, when + attack);
      gain.gain.setValueAtTime(gainPeak, when + attack);
      source.connect(filter);
      filter.connect(gain);
      return { source, filter, gain };
    };

    // Layer A — body / fundamental (LP)
    const a = layer(
      'lowpass',
      420 + z.fundamental * 1800,
      0.7,
      (0.55 + 0.45 * vel) * (0.55 + 0.45 * z.fundamental),
      detuneA,
      0.004
    );
    a.gain.connect(bus);
    nodes.push(a.source, a.gain, a.filter);

    // Layer B — mid partials
    const b = layer(
      'bandpass',
      900 + z.partials * 2200,
      1.1,
      (0.28 + 0.35 * vel) * (0.35 + 0.65 * z.partials),
      detuneB,
      0.003
    );
    b.gain.connect(bus);
    nodes.push(b.source, b.gain, b.filter);

    // Layer C — brightness (HP)
    const c = layer(
      'highpass',
      1800 + z.brightness * 3200,
      0.85,
      (0.12 + 0.28 * vel) * (0.2 + 0.8 * z.brightness),
      1 + ((rr % 7) - 3) * 0.0015,
      0.002
    );
    c.gain.connect(bus);
    nodes.push(c.source, c.gain, c.filter);

    const dur = hit.buffer.duration / Math.max(0.5, hit.rate);
    const startAt = when + startSkew;
    nodes.forEach((n) => {
      if (n.start) {
        try { n.start(startAt); n.stop(startAt + dur + 0.05); } catch (_) {}
      }
    });

    return {
      stop: (tt, tc = 0.06) => {
        try {
          bus.gain.cancelScheduledValues(tt);
          bus.gain.setTargetAtTime(0, tt, tc);
        } catch (_) {}
      }
    };
  }
}
