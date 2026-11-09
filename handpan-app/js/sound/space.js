/**
 * sound/space.js — one shared "room" for every voice.
 *
 * Voices don't carry their own effects. Each sends a little into this common
 * reverb and ping-pong delay, which is what makes a handpan, a koto and a
 * grain cloud sound like they are in the same place.
 */
import { reverbIR } from './dsp.js';

export function createSpace(ctx) {
  const output = ctx.createGain();

  // --- reverb: generated stereo IR, darkened, with pre-delay ---
  const reverbIn = ctx.createGain();
  const pre = ctx.createDelay(0.2);
  pre.delayTime.value = 0.022;
  const conv = ctx.createConvolver();
  const [L, R] = reverbIR(ctx.sampleRate, 3.6, 11, 0.8);
  const irBuf = ctx.createBuffer(2, L.length, ctx.sampleRate);
  irBuf.copyToChannel(L, 0);
  irBuf.copyToChannel(R, 1);
  conv.buffer = irBuf;
  const revTone = ctx.createBiquadFilter();
  revTone.type = 'lowpass';
  revTone.frequency.value = 6500;
  const revOut = ctx.createGain();
  revOut.gain.value = 0.9;
  reverbIn.connect(pre); pre.connect(conv); conv.connect(revTone); revTone.connect(revOut); revOut.connect(output);

  // --- ping-pong delay with darkening feedback ---
  const delayIn = ctx.createGain();
  const dL = ctx.createDelay(2), dR = ctx.createDelay(2);
  dL.delayTime.value = 0.375; dR.delayTime.value = 0.5;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2800;
  const merger = ctx.createChannelMerger(2);
  const delOut = ctx.createGain(); delOut.gain.value = 0.7;
  delayIn.connect(dL);
  dL.connect(tone); tone.connect(dR); dR.connect(fb); fb.connect(dL);
  dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
  merger.connect(delOut); delOut.connect(output);
  // delay tails also bloom into the reverb
  const delToRev = ctx.createGain(); delToRev.gain.value = 0.25;
  delOut.connect(delToRev); delToRev.connect(reverbIn);

  return {
    reverbIn, delayIn, output,
    /** { reverb 0..1.5, delay 0..1.5, feedback 0..0.8, time seconds, tone Hz } */
    set(o = {}) {
      if (o.reverb != null) revOut.gain.value = o.reverb;
      if (o.delay != null) delOut.gain.value = o.delay;
      if (o.feedback != null) fb.gain.value = Math.min(0.8, o.feedback);
      if (o.time != null) { dL.delayTime.value = o.time * 0.75; dR.delayTime.value = o.time; }
      if (o.tone != null) tone.frequency.value = o.tone;
    }
  };
}
