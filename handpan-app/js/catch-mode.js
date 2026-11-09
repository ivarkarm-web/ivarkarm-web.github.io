/**
 * catch-mode.js — Catch: signature Pionier musical interaction
 * Works on Handpan, Kitchen, and Bird — sequence built from active instrument getNotes().
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
    // Ascending then descending (skip top note on the way down to avoid double)
    // Kitchen/Bird: 5 zones at [0,1,3,5,7]; Handpan: full 9-note scale
    const ascending = notes.map((n) => n.index);
    const descending = notes.slice().reverse().map((n) => n.index).slice(1);
    this.sequence = [...ascending, ...descending];
    this.seqIndex = 0;
    this.waves = [];
    this.hits = 0;
    this.misses = 0;
    this.score = 0;
    this._setPhase('catch-intro');
    const instName = inst.name || inst.id || '';
    this.onStatus(instName ? `CATCH · ${instName}` : 'CATCH');
    this.startedAt = performance.now();
    this._spawnNextWave();
    this._setPhase('ascending');
  }

  _targetLabel(targetIndex) {
    const inst = this.getInstrument();
    const notes = inst?.getNotes?.() || [];
    const n = notes.find((x) => x.index === targetIndex);
    return n?.name || null;
  }

  _spawnNextWave() {
    if (this.seqIndex >= this.sequence.length) {
      this._finish();
      return;
    }
    const targetIndex = this.sequence[this.seqIndex];
    // Slightly slower first waves so the approach cue is readable
    const base = this.reducedMotion ? 1800 : 2200;
    const travelMs = this.seqIndex < 2 ? base + 280 : base;
    const label = this._targetLabel(targetIndex);
    this.waves.push({
      id: `${this.seqIndex}-${targetIndex}-${Date.now()}`,
      targetIndex,
      label,
      born: performance.now(),
      travelMs,
      progress: 0,
      caught: false,
      missed: false
    });
    // Soft target cue for Kitchen/Bird (and Handpan note names when available)
    if (label && this.phase !== 'catch-intro') {
      this.onStatus(label);
    }
  }

  _finish() {
    this._setPhase('complete');
    const total = this.hits + this.misses;
    const line =
      total > 0
        ? `Caught ${this.hits}/${total} · ${this.score} pts`
        : `Caught ${this.hits} · ${this.score} pts`;
    this.onStatus(line);
    // Hold result, then clear so the surface returns to free play
    this._later(3200, () => {
      if (this.phase === 'complete') this.reset();
    });
  }

  onStrike(zoneIndex, when = performance.now()) {
    if (!['ascending', 'descending', 'catch-intro'].includes(this.phase)) return null;
    const active = this.waves.find(
      (w) => !w.caught && !w.missed && w.targetIndex === zoneIndex
    );
    if (!active) {
      this.misses += 1;
      this.onStatus('MISS');
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
    // Midpoint of sequence = start of descent
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
        this.onStatus('MISS');
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
