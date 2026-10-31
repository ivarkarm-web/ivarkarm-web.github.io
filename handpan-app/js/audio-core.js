let context = null;
let master = null;
let compressor = null;
const MASTER_DEFAULT = 0.85;
let resumeAfterVisibility = false;

function audioConstructor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
}

export function getAudioContext() {
  if (context && context.state !== 'closed') return context;
  const AC = audioConstructor();
  if (!AC) return null;
  try {
    if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback';
  } catch {}
  try { context = new AC({ latencyHint: 'interactive' }); }
  catch { context = new AC(); }

  try {
    context.addEventListener('statechange', () => {
      if (context?.state === 'interrupted') resumeAfterVisibility = true;
      else if (context?.state === 'suspended' && resumeAfterVisibility && typeof document !== 'undefined' && !document.hidden) {
        resumeExistingAudio();
        resumeAfterVisibility = false;
      }
    });
  } catch (_) {}

  master = context.createGain();
  // Leave headroom for concurrent instruments and loop layers before the
  // shared compressor; individual source buses retain their own level controls.
  master.gain.value = MASTER_DEFAULT;
  compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 20;
  compressor.ratio.value = 2.0;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.22;
  master.connect(compressor);
  compressor.connect(context.destination);
  return context;
}

export function getAudioMaster() {
  getAudioContext();
  return master;
}

export function getMasterGain() { return master?.gain?.value ?? MASTER_DEFAULT; }

export function setMasterGain(value) {
  getAudioContext();
  if (!master) return MASTER_DEFAULT;
  const gain = Math.max(0, Math.min(1, Number(value) || 0));
  master.gain.setTargetAtTime(gain, context.currentTime, 0.025);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pionier-master-gain', { detail: { gain } }));
  return gain;
}

export function createBus(name, initialGain = 1) {
  const ctx = getAudioContext();
  if (!ctx || !master) return null;
  const bus = ctx.createGain();
  bus.gain.value = initialGain;
  bus.name = name;
  bus.connect(master);
  return bus;
}

export function resumeAudio() {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'closed' || ctx.state === 'running') return Promise.resolve(ctx);
  return ctx.resume().catch(() => ctx);
}

function resumeExistingAudio() {
  if (!context || context.state === 'closed' || context.state === 'running') return Promise.resolve(context);
  return context.resume().catch(() => context);
}

export function suspendAudio() {
  if (!context || context.state === 'closed' || context.state === 'suspended') return Promise.resolve();
  return context.suspend().catch(() => undefined);
}

export function closeAudio() {
  if (!context || context.state === 'closed') return Promise.resolve();
  const closing = context.close().catch(() => undefined);
  context = null;
  master = null;
  compressor = null;
  resumeAfterVisibility = false;
  return closing;
}

export function audioState() {
  return context?.state || 'uninitialized';
}

if (typeof document !== 'undefined') {
  // iOS Safari often fires visibilitychange during system gestures / Control
  // Center. Suspending mid-session causes the next strike to be silent until
  // another explicit unlock. Prefer resume-on-show; only suspend when the
  // page is truly backgrounded for a while.
  let suspendTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeAfterVisibility = resumeAfterVisibility || (!!context && context.state === 'running');
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => {
        if (document.hidden) suspendAudio();
      }, 2500);
    } else {
      clearTimeout(suspendTimer);
      if (resumeAfterVisibility) resumeExistingAudio();
      resumeAfterVisibility = false;
    }
  });
  window.addEventListener('pageshow', () => {
    clearTimeout(suspendTimer);
    if (resumeAfterVisibility) resumeExistingAudio();
    resumeAfterVisibility = false;
  });
  window.addEventListener('focus', () => {
    clearTimeout(suspendTimer);
    if (resumeAfterVisibility) resumeExistingAudio();
    resumeAfterVisibility = false;
  });
}

export function audioHealth() {
  return {
    state: audioState(),
    available: !!audioConstructor(),
    hasContext: !!(context && context.state !== 'closed'),
    sampleRate: context?.sampleRate ?? null
  };
}

export const HandpanAudio = {
  getAudioContext,
  getAudioMaster,
  getMasterGain,
  setMasterGain,
  createBus,
  resumeAudio,
  suspendAudio,
  closeAudio,
  audioState,
  audioHealth
};

if (typeof window !== 'undefined') window.HandpanAudio = HandpanAudio;
