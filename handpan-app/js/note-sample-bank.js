/**
 * note-sample-bank.js
 * Dry one-shot handpan hits mapped by MIDI pitch.
 * Source: Haganenote recordings (parsed from haganenote/virtual-handpan sample URL list).
 * SparkFun Digital_Handpan has no audio assets (Teensy hardware only).
 */
export class NoteSampleBank {
  /**
   * @param {AudioContext} ctx
   * @param {string} baseUrl e.g. './sounds/notes/'
   */
  constructor(ctx, baseUrl = './sounds/notes/') {
    this.ctx = ctx;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.byMidi = new Map(); // midi -> AudioBuffer
    this.manifest = null;
    this.ready = false;
    this.loadPromise = null;
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
    const samples = this.manifest.samples || [];
    await Promise.all(
      samples.map(async (s) => {
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

  /** Nearest available buffer + playbackRate to hit target MIDI */
  resolve(midi) {
    if (!this.byMidi.size) return null;
    if (this.byMidi.has(midi)) {
      return { buffer: this.byMidi.get(midi), rate: 1, sourceMidi: midi };
    }
    let best = null;
    let bestDist = Infinity;
    for (const m of this.byMidi.keys()) {
      const d = Math.abs(m - midi);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    if (best == null || bestDist > 4) return null; // don't stretch more than ~4 semitones
    return {
      buffer: this.byMidi.get(best),
      rate: Math.pow(2, (midi - best) / 12),
      sourceMidi: best
    };
  }

  /**
   * Play one-shot into a destination node.
   * @returns {{ source: AudioBufferSourceNode, gain: GainNode } | null}
   */
  play(midi, dest, when, vel = 0.8) {
    const hit = this.resolve(Math.round(midi));
    if (!hit) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = hit.buffer;
    src.playbackRate.value = hit.rate;
    const g = this.ctx.createGain();
    const peak = 0.85 * Math.max(0.2, Math.min(1, vel));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.008);
    // natural decay follows sample; gentle safety fade at end
    const dur = hit.buffer.duration / hit.rate;
    g.gain.setValueAtTime(peak, when + Math.max(0.05, dur - 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(g);
    g.connect(dest);
    src.start(when);
    src.stop(when + dur + 0.05);
    return { source: src, gain: g };
  }
}

/** Pitch name helpers used by the fetch script / manifest */
export const HAGANE_REMOTE = {
  base: 'https://www.haganenote.com/vst/',
  // filename on server → local safe name + midi
  files: [
    ['C3.mp3', 'C3.mp3', 48],
    ['Cdiesis3.mp3', 'Cs3.mp3', 49],
    ['D3.mp3', 'D3.mp3', 50],
    ['Eb3.mp3', 'Eb3.mp3', 51],
    ['E3.mp3', 'E3.mp3', 52],
    ['F3.mp3', 'F3.mp3', 53],
    ['Fdiesis3.mp3', 'Fs3.mp3', 54],
    ['G3.mp3', 'G3.mp3', 55],
    ['Gdiesis3.mp3', 'Gs3.mp3', 56],
    ['A3.mp3', 'A3.mp3', 57],
    ['Bb3.mp3', 'Bb3.mp3', 58],
    ['B3.mp3', 'B3.mp3', 59],
    ['C4.mp3', 'C4.mp3', 60],
    ['Cdiesis4.mp3', 'Cs4.mp3', 61],
    ['D4.mp3', 'D4.mp3', 62],
    ['Ddiesis4.mp3', 'Ds4.mp3', 63],
    ['E4.mp3', 'E4.mp3', 64],
    ['F4.mp3', 'F4.mp3', 65],
    ['Fdiesis4.mp3', 'Fs4.mp3', 66],
    ['G4.mp3', 'G4.mp3', 67],
    ['Gdiesis4.mp3', 'Gs4.mp3', 68],
    ['A4.mp3', 'A4.mp3', 69],
    ['Bb4.mp3', 'Bb4.mp3', 70],
    ['B4.mp3', 'B4.mp3', 71],
    ['C5.mp3', 'C5.mp3', 72],
    ['Db5.mp3', 'Db5.mp3', 73],
    ['D5.mp3', 'D5.mp3', 74],
    ['Eb5.mp3', 'Eb5.mp3', 75],
    ['E5.mp3', 'E5.mp3', 76],
    ['F5.mp3', 'F5.mp3', 77],
    ['Fdiesis5.mp3', 'Fs5.mp3', 78]
    // G5.mp3 returns 404 on origin
  ]
};
