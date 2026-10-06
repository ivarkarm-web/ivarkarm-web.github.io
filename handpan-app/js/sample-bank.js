export const SAMPLE_MANIFEST_PATH = './sounds/manifest.json';

function velocityBucket(velocity) {
  if (velocity < 0.45) return 'v1';
  if (velocity < 0.75) return 'v2';
  return 'v3';
}

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
      .then((json) => { this.manifest = json; return json; })
      .catch(() => {
        this.manifest = { version: 1, status: 'fallback-synth', samples: {} };
        return this.manifest;
      });
    return this.loading;
  }

  getEntry(key, velocity) {
    const entry = this.manifest?.samples?.[key];
    if (!entry) return null;
    if (entry.url) return { url: entry.url, cacheKey: key };
    const bucket = velocityBucket(velocity);
    const variant = entry.variants?.[bucket] || entry.variants?.v2 || entry.variants?.v1;
    return variant?.url ? { url: variant.url, cacheKey: key + ':' + bucket } : null;
  }

  has(key, velocity = 0.8) {
    const entry = this.getEntry(key, velocity);
    return !!entry && this.buffers.has(entry.cacheKey);
  }

  async load(key, velocity = 0.8) {
    await this.loadManifest();
    const entry = this.getEntry(key, velocity);
    if (!entry) return null;
    if (this.buffers.has(entry.cacheKey)) return this.buffers.get(entry.cacheKey);
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`Sample HTTP ${response.status}`);
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(entry.cacheKey, buffer);
    return buffer;
  }

  play(key, when, velocity = 0.8, detune = 0) {
    const entry = this.getEntry(key, velocity);
    const buffer = entry ? this.buffers.get(entry.cacheKey) : null;
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
