let context = null;
let master = null;
let compressor = null;

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

  master = context.createGain();
  master.gain.value = 1.15;
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
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => {
        if (document.hidden) suspendAudio();
      }, 2500);
    } else {
      clearTimeout(suspendTimer);
      resumeAudio();
    }
  });
  window.addEventListener('pageshow', () => {
    clearTimeout(suspendTimer);
    resumeAudio();
  });
  window.addEventListener('focus', () => {
    clearTimeout(suspendTimer);
    resumeAudio();
  });
}

export const HandpanAudio = {
  getAudioContext,
  getAudioMaster,
  createBus,
  resumeAudio,
  suspendAudio,
  closeAudio,
  audioState
};

if (typeof window !== 'undefined') window.HandpanAudio = HandpanAudio;
