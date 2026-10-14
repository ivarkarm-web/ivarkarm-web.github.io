/**
 * sound/scheduler.js — Look-Ahead clock with asymmetric / polyrhythmic steps
 *
 * Supports per-subscriber custom step durations (seconds) so arps can float
 * on dotted, triplet, or free-form phrasing instead of rigid 16ths.
 */

const DEFAULT_LOOKAHEAD_MS = 25;
const DEFAULT_SCHEDULE_AHEAD = 0.15;
const DEFAULT_BPM = 72;

export class LookAheadScheduler {
  constructor(ctx, opts = {}) {
    this.ctx = ctx;
    this.bpm = opts.bpm ?? DEFAULT_BPM;
    this.lookaheadMs = opts.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    this.scheduleAhead = opts.scheduleAhead ?? DEFAULT_SCHEDULE_AHEAD;

    this._running = false;
    this._timerId = null;
    this._nextNoteTime = 0;
    this._currentStep = 0;
    this._stepsPerBar = 16;
    this._subscribers = new Set();
  }

  /** Default 16th at current BPM (fallback when a voice has no custom rhythm). */
  get secondsPerStep() {
    return 60 / this.bpm / 4;
  }

  beatSec(beats) {
    return (60 / this.bpm) * beats;
  }

  get isRunning() {
    return this._running;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(160, Number(bpm) || DEFAULT_BPM));
  }

  onTick(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  start(fromTime = null) {
    if (this._running) return;
    this._running = true;
    this._nextNoteTime = fromTime != null ? fromTime : this.ctx.currentTime + 0.04;
    this._currentStep = 0;
    this._timerId = setInterval(() => this._scheduler(), this.lookaheadMs);
  }

  stop() {
    this._running = false;
    if (this._timerId != null) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  resetSteps() {
    this._currentStep = 0;
  }

  _scheduler() {
    if (!this._running || !this.ctx) return;
    const horizon = this.ctx.currentTime + this.scheduleAhead;
    while (this._nextNoteTime < horizon) {
      const step = this._currentStep;
      const bar = Math.floor(step / this._stepsPerBar);
      const beat = step % this._stepsPerBar;
      const ev = {
        time: this._nextNoteTime,
        step,
        bar,
        beat,
        bpm: this.bpm,
        beatSec: (b) => (60 / this.bpm) * b
      };
      for (const fn of this._subscribers) {
        try { fn(ev); } catch (e) { console.warn('[scheduler] tick', e); }
      }
      // Base grid advances at 16th resolution; arps decide when to actually fire
      this._nextNoteTime += this.secondsPerStep;
      this._currentStep += 1;
    }
  }
}

const _byCtx = new WeakMap();

export function getSharedScheduler(ctx, opts) {
  let s = _byCtx.get(ctx);
  if (!s) {
    s = new LookAheadScheduler(ctx, opts);
    _byCtx.set(ctx, s);
  }
  return s;
}
