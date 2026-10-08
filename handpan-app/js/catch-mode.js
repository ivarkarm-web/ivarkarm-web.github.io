/**
 * catch-mode.js — Catch: signature Pionier musical interaction
 */
export class CatchMode {
  constructor(opts = {}) {
    this.getInstrument = opts.getInstrument || (() => null);
    this.onStatus = opts.onStatus || (() => {});
    this.onPhase = opts.onPhase || (() => {});
    this.phase = 'idle';
    this.waves = [];
    this.sequence = [];
    this.seqIndex = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.startedAt = 0;
    this.reducedMotion = false;
    this._timers = [];
  }

  _clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
  }

  _later(ms, fn) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  }

  reset() {
    this._clearTimers();
    this.phase = 'idle';
    this.waves = [];
    this.sequence = [];
    this.seqIndex = 0;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.onPhase('idle');
    this.onStatus('');
  }

  startOnboarding() {
    this.reset();
    this._setPhase('darken');
    this.onStatus('Settle in…');
    // Auto-advance into interactive onboarding after a brief settle
    const delay = this.reducedMotion ? 600 : 1400;
    this._later(delay, () => {
      if (this.phase !== 'darken') return;
      this._setPhase('focus-knobs');
      this.onStatus('Try a knob');
    });
  }

  advanceFromUI() {
    const order = ['darken', 'focus-knobs', 'focus-fx', 'focus-scale', 'ready'];
    const i = order.indexOf(this.phase);
    if (i < 0 || i >= order.length - 1) return;
    const next = order[i + 1];
    this._setPhase(next);
    if (next === 'focus-knobs') this.onStatus('Try a knob');
    else if (next === 'focus-fx') this.onStatus('Open FX');
    else if (next === 'focus-scale') this.onStatus('Change scale');
    else if (next === 'ready') {
      this.onStatus('CATCH');
      this._later(600, () => {
        if (this.phase === 'ready') this.startCatchSequence();
      });
    }
  }

  startCatchSequence() {
    this._clearTimers();
    const inst = this.getInstrument();
    if (!inst || !inst.getNotes) {
      this.onStatus('No instrument');
      return;
    }
    const notes = inst.getNotes();
    if (!notes.length) {
      this.onStatus('No notes');
      return;
    }
    const ascending = notes.map((n) => n.index);
    const descending = notes.slice().reverse().map((n) => n.index).slice(1);
    this.sequence = [...ascending, ...descending];
    this.seqIndex = 0;
    this.waves = [];
    this.hits = 0;
    this.misses = 0;
    this.score = 0;
    this._setPhase('catch-intro');
    this.onStatus('CATCH');
    this.startedAt = performance.now();
    this._spawnNextWave();
    this._setPhase('ascending');
  }

  _spawnNextWave() {
    if (this.seqIndex >= this.sequence.length) {
      this._setPhase('complete');
      this.onStatus(`Caught ${this.hits} · ${this.score} pts`);
      return;
    }
    const targetIndex = this.sequence[this.seqIndex];
    const travelMs = this.reducedMotion ? 1800 : 2200;
    this.waves.push({
      id: `${this.seqIndex}-${targetIndex}-${Date.now()}`,
      targetIndex,
      born: performance.now(),
      travelMs,
      progress: 0,
      caught: false,
      missed: false
    });
  }

  onStrike(zoneIndex, when = performance.now()) {
    if (!['ascending', 'descending', 'catch-intro'].includes(this.phase)) return null;
    const active = this.waves.find(
      (w) => !w.caught && !w.missed && w.targetIndex === zoneIndex
    );
    if (!active) {
      this.misses += 1;
      return { result: 'miss' };
    }
    const progress = (when - active.born) / active.travelMs;
    const delta = Math.abs(progress - 0.92);
    let grade = 'LATE';
    let pts = 30;
    if (delta < 0.08) {
      grade = 'PERFECT';
      pts = 100;
    } else if (delta < 0.16) {
      grade = 'GREAT';
      pts = 80;
    } else if (delta < 0.28) {
      grade = 'GOOD';
      pts = 60;
    }
    active.caught = true;
    this.hits += 1;
    this.score += pts;
    this.seqIndex += 1;
    if (this.seqIndex === Math.ceil(this.sequence.length / 2)) {
      this._setPhase('descending');
    }
    this._spawnNextWave();
    this.onStatus(grade);
    return { result: 'hit', grade, points: pts };
  }

  tick(now = performance.now()) {
    for (const w of this.waves) {
      if (w.caught || w.missed) continue;
      w.progress = (now - w.born) / w.travelMs;
      if (w.progress > 1.12) {
        w.missed = true;
        this.misses += 1;
        this.seqIndex += 1;
        this._spawnNextWave();
      }
    }
    if (this.waves.length > 12) {
      this.waves = this.waves.filter(
        (w) => (!w.caught && !w.missed) || now - w.born < 3000
      );
    }
  }

  getActiveWaves() {
    return this.waves.filter((w) => !w.caught && !w.missed);
  }

  _setPhase(p) {
    this.phase = p;
    this.onPhase(p);
  }

  get isActive() {
    return this.phase !== 'idle' && this.phase !== 'complete';
  }
}
