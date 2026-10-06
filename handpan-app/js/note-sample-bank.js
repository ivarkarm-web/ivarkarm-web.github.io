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
    // Blend of power curves: soft hits stay soft, hard hits open up
    const soft = Math.pow(v, 1.65);
    const hard = Math.pow(v, 0.72);
    return soft * (1 - v) + hard * v;
  }

  /**
   * Multi-zone vector mapping → harmonic / brightness / noise weights.
   * @param {number} radial 0 = dead center of pad, 1 = outer edge of pad ellipse
   * @param {number} angleRad optional strike angle relative to pad
   */
  static zoneWeights(radial, angleRad = 0) {
    const r = Math.max(0, Math.min(1.25, radial));
    // Acoustic handpan: center → more fundamental body; edge → brighter partials + more strike noise
    const center = Math.max(0, 1 - r * 1.15);
    const mid = 1 - Math.abs(r - 0.55) * 1.6;
    const edge = Math.max(0, (r - 0.35) / 0.65);
    const tangential = 0.5 + 0.5 * Math.sin(angleRad * 2); // slight asymmetry
    return {
      fundamental: 0.55 + 0.45 * center,
      partials: 0.35 + 0.55 * Math.max(0, mid) + 0.25 * edge,
      brightness: 0.25 + 0.75 * edge,
      noise: 0.08 + 0.55 * edge * edge,
      body: 0.7 + 0.3 * center,
      tangential
    };
  }

  /**
   * Play layered one-shot with zone + velocity interpolation.
   * Uses multiple parallel BufferSources / filters as virtual multi-samples
   * so rapid hits never fire an identical mono path (anti machine-gun).
   *
   * @returns {{ nodes: AudioNode[], stop: Function } | null}
   */
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

    // Micro-variations per strike (anti machine-gun)
    const detuneA = 1 + ((rr % 3) - 1) * 0.0018;
    const detuneB = 1 + ((rr % 5) - 2) * 0.0024;
    const startSkew = (rr % 4) * 0.0007;

    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(dest);

    const nodes = [];

    // Layer A — body / fundamental (LP)
    const a = this._layer(hit, when + startSkew, {
      rate: hit.rate * detuneA,
      filterType: 'lowpass',
      filterFreq: 420 + z.fundamental * 900 + vel * 400,
      filterQ: 0.7,
      peak: 0.55 * z.body * (0.35 + 0.65 * vel),
      attack: 0.004 + (1 - vel) * 0.012
    });
    a.gain.connect(bus);
    nodes.push(a.source, a.gain, a.filter);

    // Layer B — partials / mid (BP)
    const b = this._layer(hit, when + startSkew + 0.0012, {
      rate: hit.rate * detuneB * (1 + z.partials * 0.002),
      filterType: 'bandpass',
      filterFreq: 900 + z.partials * 2200 + vel * 800,
      filterQ: 0.9 + z.brightness * 0.6,
      peak: 0.42 * z.partials * (0.25 + 0.75 * vel),
      attack: 0.003
    });
    b.gain.connect(bus);
    nodes.push(b.source, b.gain, b.filter);

    // Layer C — edge brightness (HP) + more on edge strikes
    const c = this._layer(hit, when + startSkew + 0.002, {
      rate: hit.rate * (1 + ((rr % 7) - 3) * 0.0015),
      filterType: 'highpass',
      filterFreq: 1800 + z.brightness * 3200,
      filterQ: 0.55,
      peak: 0.28 * z.brightness * (0.2 + 0.8 * vel),
      attack: 0.002
    });
    c.gain.connect(bus);
    nodes.push(c.source, c.gain, c.filter);

    // Transient noise shaped by edge zone
    if (z.noise > 0.05) {
      const nlen = Math.floor(ctx.sampleRate * 0.06);
      const nb = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nlen * 0.25));
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 2500 + z.brightness * 3500;
      nf.Q.value = 1.1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, when);
      ng.gain.linearRampToValueAtTime(z.noise * vel * 0.55, when + 0.0015);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.045 + radial * 0.03);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(bus);
      ns.start(when);
      ns.stop(when + 0.08);
      nodes.push(ns, nf, ng);
    }

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
  files: [] // see scripts/fetch-handpan-samples.mjs
};
