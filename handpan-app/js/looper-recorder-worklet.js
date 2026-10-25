/* AudioWorklet recorder: copies the instrument bus into bounded stereo chunks. */
class PionierLooperRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.left = new Float32Array(this.chunkSize);
    this.right = new Float32Array(this.chunkSize);
    this.offset = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (!input || !input.length || !input[0]) return true;
    const left = input[0];
    const right = input.length > 1 ? input[1] : left;
    let sourceOffset = 0;
    while (sourceOffset < left.length) {
      const count = Math.min(this.chunkSize - this.offset, left.length - sourceOffset);
      this.left.set(left.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.right.set(right.subarray(sourceOffset, sourceOffset + count), this.offset);
      this.offset += count;
      sourceOffset += count;
      if (this.offset === this.chunkSize) {
        const l = this.left, r = this.right;
        this.port.postMessage({ left: l, right: r }, [l.buffer, r.buffer]);
        this.left = new Float32Array(this.chunkSize);
        this.right = new Float32Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pionier-looper-recorder', PionierLooperRecorder);
