/**
 * Gain-staging contract (Phase 1).
 *
 * Every source is designed to land at a documented nominal peak (dBFS) when
 * its bus fader is at 0 dB. Bus trims then place those sources in a shared
 * loudness window so a handpan note, a loop layer, a pad and rain can sit
 * together without one vanishing. The master limiter absorbs the worst-case
 * stack: 13 live notes + 7 loop layers + ambience + backing.
 *
 * dBFS here means 20·log10(|peak| / 1.0) at the destination before the limiter.
 */

export const DBFS_FULL_SCALE = 1;

export const NOMINAL_PEAK_DBFS = {
  instrumentVoice: -12,
  loopLayer: -12,
  backing: -21,
  ambienceBed: -24,
  metronome: -18,
  fxReturn: -18
};

/** Fixed trims applied after each bus fader (fader 0 dB = unity). */
export const BUS_TRIM_DB = {
  instrument: 0,
  loop: 0,
  backing: 18,
  ambience: 20,
  nature: 20,
  fxReturn: -6
};

export const BUS_NAMES = ['instrument', 'loop', 'backing', 'ambience', 'fxReturn'];

export const MASTER_GAIN = 0.95;
export const LIMITER_THRESHOLD = 1.15;
export const LIMITER_CEILING = 0.97;

export const LOOKAHEAD_S = 0.1;
export const SCHEDULER_TICK_MS = 25;

export const STRESS = {
  liveNotes: 13,
  loopLayers: 7,
  extraBeds: 2
};

export function dbToGain(db) {
  if (!Number.isFinite(db)) return 1;
  return Math.pow(10, db / 20);
}

export function gainToDb(gain) {
  const g = Math.max(1e-12, Math.abs(Number(gain) || 0));
  return 20 * Math.log10(g);
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function limiterShape(x, threshold = LIMITER_THRESHOLD) {
  const drive = Math.max(0.2, threshold);
  const y = Math.tanh(x * drive);
  const ceiling = LIMITER_CEILING;
  return Math.max(-ceiling, Math.min(ceiling, y));
}

/** Worst-case linear mix before the limiter, faders at 0 dB. */
export function stressMixPeak() {
  const voice = dbToGain(NOMINAL_PEAK_DBFS.instrumentVoice);
  const backing = dbToGain(NOMINAL_PEAK_DBFS.backing) * dbToGain(BUS_TRIM_DB.backing);
  const ambience = dbToGain(NOMINAL_PEAK_DBFS.ambienceBed) * dbToGain(BUS_TRIM_DB.ambience);
  const live = STRESS.liveNotes * voice * dbToGain(BUS_TRIM_DB.instrument);
  const loops = STRESS.loopLayers * voice * dbToGain(BUS_TRIM_DB.loop);
  return live + loops + backing + ambience;
}

export function stressLimitedPeak() {
  return Math.abs(limiterShape(stressMixPeak() * MASTER_GAIN));
}
