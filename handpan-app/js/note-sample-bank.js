/**
 * note-sample-bank.js
 *
 * Dry one-shot handpan hits mapped by MIDI (Haganenote recordings).
 * Exposes multi-zone harmonic blend + non-linear velocity layering
 * without Flutter / React Native — pure Web Audio graph only.
 *
 * Native path (optional): same bank interface can be driven from
 * CoreAudio (iOS) / AAudio (Android) via a thin JNI/Swift bridge;
 * see native/audio-bridge.md
 */
export class NoteSampleBank {
  constructor(ctx, baseUrl = './sounds/notes/') {
    this.ctx = ctx;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.byMidi = new Map();
    this.manifest = null;
    this.ready = false;
    this.loadPromise = null;
    /** Round-robin / anti machine-gun state per MIDI */
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

  /**
   * Non-linear velocity curve (perceptual loudness-ish).
   * v in 0..1 → shaped 0..1
   */
  static velocityCurve(v) {
    v = Math.max(0, Math.min(1, v));
    const soft = Math.pow(v, 1.65);
    const hard = Math.pow(v, 0.72);
    return soft * (1 - v) + hard * v;
  }

  /**
   * Multi-zone vector mapping → harmonic / brightness weights.
   * radial: 0 at pad center → 1 near rim.
   */
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

    // Layer A — body / fundamental (LP) — boosted
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

    // Layer B — partials / mid (BP) — boosted
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

    // Layer C — edge brightness (HP) — boosted
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

export const HAGANE_REMOTE = {
  base: 'https://www.haganenote.com/vst/',
  files: []
};
