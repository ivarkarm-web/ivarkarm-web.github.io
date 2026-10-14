/**
 * sound/scheduler.js — Look-Ahead Web Audio musical clock
 *
 * Drift-free scheduling against audioContext.currentTime.
 * Uses a short setInterval tick + look-ahead window to schedule
 * note callbacks slightly ahead of the audio thread.
 */

const DEFAULT_LOOKAHEAD_MS = 25;
const DEFAULT_SCHEDULE_AHEAD = 0.08;
const DEFAULT_BPM = 90;

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

  get secondsPerStep() {
    return 60 / this.bpm / 4;
  }

  get isRunning() {
    return this._running;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(200, bpm));
  }

  onTick(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  start(fromTime = null) {
    if (this._running) return;
    this._running = true;
    this._nextNoteTime = fromTime != null ? fromTime : this.ctx.currentTime + 0.05;
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
      const ev = { time: this._nextNoteTime, step, bar, beat };
      for (const fn of this._subscribers) {
        try { fn(ev); } catch (e) { console.warn('[scheduler] tick error', e); }
      }
      this._advance();
    }
  }

  _advance() {
    this._nextNoteTime += this.secondsPerStep;
    this._currentStep += 1;
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
