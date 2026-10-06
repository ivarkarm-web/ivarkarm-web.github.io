export const SAMPLE_MANIFEST_PATH = './sounds/manifest.json';

export class SampleBank {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.buffers = new Map();
    this.manifest = null;
    this.loading = null;
  }

  async loadManifest(manifest = SAMPLE_MANIFEST_PATH) {
    if (this.manifest) return this.manifest;
    if (this.loading) return this.loading;
    this.loading = fetch(manifest)
      .then((response) => {
        if (!response.ok) throw new Error(`Sample manifest HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        this.manifest = json;
        return json;
      })
      .catch(() => {
        this.manifest = { version: 1, status: 'fallback-synth', samples: {} };
        return this.manifest;
      });
    return this.loading;
  }

  has(key) { return this.buffers.has(key); }

  async load(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const manifest = await this.loadManifest();
    const entry = manifest.samples?.[key];
    if (!entry?.url) return null;
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`Sample HTTP ${response.status}`);
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(key, buffer);
    return buffer;
  }

  play(key, when, velocity = 0.8, detune = 0) {
    const buffer = this.buffers.get(key);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.detune.value = detune;
    gain.gain.setValueAtTime(Math.max(0.001, Math.min(1, velocity)), when);
    source.connect(gain);
    gain.connect(this.output);
    source.start(when);
    return { source, gain };
  }
}
