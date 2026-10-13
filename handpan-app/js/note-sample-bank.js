/**
 * note-sample-bank.js
 *
 * Universal owner sample bank (owner-notes-9 + library-v1).
 * Loads each unique audio file once, then maps the full pitch set onto every
 * scale id so setActiveScale never drops the bank to synth fallback.
 */
export class NoteSampleBank {
  constructor(ctx, baseUrl = './sounds/notes/') {
    this.ctx = ctx;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.byMidi = new Map();
    this.byScale = new Map();
    this.allMidi = new Map();
    this.activeScaleId = null;
    this.manifest = null;
    this.ready = false;
    this.loadPromise = null;
    this._rr = new Map();
    this._fileCache = new Map();
  }

  async load() {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  async _decodeFile(file, encoding) {
    if (this._fileCache.has(file)) return this._fileCache.get(file);
    const r = await fetch(this.baseUrl + file);
    if (!r.ok) return null;
    let ab;
    if (encoding === 'base64' || /\.b64$/i.test(file)) {
      const text = (await r.text()).replace(/\s+/g, '');
      const bin = atob(text);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      ab = bytes.buffer;
    } else {
      ab = await r.arrayBuffer();
    }
    const buf = await this.ctx.decodeAudioData(ab.slice(0));
    this._fileCache.set(file, buf);
    return buf;
  }

  async _load() {
    const res = await fetch(this.baseUrl + 'manifest.json');
    if (!res.ok) throw new Error('Sample manifest missing: ' + res.status);
    this.manifest = await res.json();

    const byMidiFile = new Map();
    const add = (s) => {
      if (s.midi == null || !s.file) return;
      const pri = /owner-notes-9/i.test(s.file) ? 2 : 1;
      const prev = byMidiFile.get(s.midi);
      if (!prev || pri > prev.priority) {
        byMidiFile.set(s.midi, { file: s.file, encoding: s.encoding, priority: pri });
      }
    };
    for (const s of this.manifest.samples || []) add(s);
    for (const scale of this.manifest.scales || []) {
      for (const s of scale.samples || []) add(s);
    }

    await Promise.all(
      [...byMidiFile.entries()].map(async ([midi, info]) => {
        try {
          const buf = await this._decodeFile(info.file, info.encoding);
          if (!buf) return;
          this.allMidi.set(midi, buf);
        } catch (e) {
          console.warn('Sample failed', info.file, e);
        }
      })
    );

    const scaleIds = (this.manifest.scales || []).map((s) => s.id).filter(Boolean);
    if (!scaleIds.length) scaleIds.push('default');
    for (const s of this.manifest.samples || []) {
      if (s.scaleId && !scaleIds.includes(s.scaleId)) scaleIds.push(s.scaleId);
    }

    for (const id of scaleIds) {
      this.byScale.set(id, new Map(this.allMidi));
    }
    if (!this.byScale.has('default')) {
      this.byScale.set('default', new Map(this.allMidi));
    }

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

    console.info(
      '[samples] unique notes',
      this.allMidi.size,
      'scales',
      [...this.byScale.keys()].length,
      'active',
      this.activeScaleId,
      'files',
      this._fileCache.size
    );
    return this;
  }

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
      if (this.allMidi.size) {
        map = this.allMidi;
        scaleId = scaleId || 'all';
      } else if (this.byScale.has('default') && this.byScale.get('default').size) {
        map = this.byScale.get('default');
        scaleId = 'default';
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

    const target = Number(midi);
    if (!Number.isFinite(target)) return null;
    const rounded = Math.round(target);

    if (this.byMidi.has(rounded) && Math.abs(target - rounded) < 0.01) {
      return { buffer: this.byMidi.get(rounded), rate: 1, sourceMidi: rounded };
    }

    let best = null;
    let bestDist = Infinity;
    for (const k of this.byMidi.keys()) {
      const d = Math.abs(k - target);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    if (best == null || bestDist > 12) return null;
    return {
      buffer: this.byMidi.get(best),
      rate: Math.pow(2, (target - best) / 12),
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
