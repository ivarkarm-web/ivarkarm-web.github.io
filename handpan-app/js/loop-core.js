export const MAX_LAYERS = 7;
export const DEFAULT_BPM = 80;
export const DEFAULT_BARS = 4;
export const BEATS_PER_BAR = 4;
export const COUNT_IN_BARS = 1;
export const MIN_BPM = 40;
export const MAX_BPM = 180;
export const MIN_BARS = 1;
export const MAX_BARS = 8;
export const GRID_DIVISION = 16;

export function clampBpm(value) {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Number.isFinite(+value) ? +value : DEFAULT_BPM));
}

export function clampBars(value) {
  return Math.max(MIN_BARS, Math.min(MAX_BARS, Number.isFinite(+value) ? Math.round(+value) : DEFAULT_BARS));
}

export function beatDuration(bpm) {
  return 60 / clampBpm(bpm);
}

export function loopDuration(bpm = DEFAULT_BPM, bars = DEFAULT_BARS) {
  return beatDuration(bpm) * BEATS_PER_BAR * clampBars(bars);
}

export function countInDuration(bpm = DEFAULT_BPM) {
  return beatDuration(bpm) * BEATS_PER_BAR * COUNT_IN_BARS;
}

export function quantizeTime(seconds, bpm = DEFAULT_BPM, division = GRID_DIVISION) {
  const step = beatDuration(bpm) / (division / 4);
  return Math.max(0, Math.round(Math.max(0, seconds) / step) * step);
}

export function quantizeEvent(event, duration, bpm = DEFAULT_BPM) {
  const safeDuration = Math.max(0.001, duration);
  return {
    t: Math.min(quantizeTime(event.t, bpm), Math.max(0, safeDuration - 0.001)),
    n: Number(event.n),
    v: Math.max(0, Math.min(1, Number.isFinite(+event.v) ? +event.v : 0.8))
  };
}

export function normalizeLayer(events, duration, bpm = DEFAULT_BPM) {
  return events
    .map((event) => quantizeEvent(event, duration, bpm))
    .sort((a, b) => a.t - b.t || a.n - b.n);
}

export function phaseAt(elapsed, duration) {
  if (!(duration > 0)) return 0;
  return ((elapsed % duration) + duration) % duration;
}

export function eventsBetween(events, last, current, duration) {
  if (!events.length || !(duration > 0) || last === current) return [];
  const wrapped = current < last;
  return events
    .filter((event) => wrapped
      ? event.t >= last || event.t < current
      : event.t >= last && event.t < current)
    .sort((a, b) => {
      const aOffset = a.t >= last ? a.t - last : duration - last + a.t;
      const bOffset = b.t >= last ? b.t - last : duration - last + b.t;
      return aOffset - bOffset;
    });
}
