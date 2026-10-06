export const TIMING_GRADES = [
  { max: 0.08, label: 'PERFECT', points: 100 },
  { max: 0.18, label: 'GREAT', points: 80 },
  { max: 0.32, label: 'GOOD', points: 60 },
  { max: 0.48, label: 'LATE', points: 30 }
];

export function timingGrade(delta, window = 0.48) {
  const abs = Math.abs(delta);
  const grade = TIMING_GRADES.find((item) => abs <= item.max);
  return grade || (abs <= window ? { label: 'LATE', points: 30 } : null);
}

export class TimingScorer {
  constructor(steps, window = 0.48) {
    this.steps = steps;
    this.window = window;
    this.stepHits = steps.map(() => new Set());
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.score = 0;
    this.lastFeedback = '';
  }

  scoreNote(note, elapsed) {
    let best = null;
    for (let stepIndex = 0; stepIndex < this.steps.length; stepIndex++) {
      const step = this.steps[stepIndex];
      const targetIndex = step.targets.indexOf(note);
      if (targetIndex < 0 || this.stepHits[stepIndex].has(targetIndex)) continue;
      const delta = elapsed - step.at;
      if (Math.abs(delta) > this.window) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { stepIndex, targetIndex, delta };
    }

    if (!best) {
      this.misses += 1;
      this.combo = 0;
      this.lastFeedback = 'MISS';
      return { correct: false, complete: false, feedback: 'MISS', delta: null, stepIndex: null };
    }

    const grade = timingGrade(best.delta, this.window);
    this.stepHits[best.stepIndex].add(best.targetIndex);
    this.hits += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += grade.points;
    this.lastFeedback = grade.label;
    const complete = this.stepHits[best.stepIndex].size === this.steps[best.stepIndex].targets.length;
    return { correct: true, complete, feedback: grade.label, delta: best.delta, stepIndex: best.stepIndex, targetIndex: best.targetIndex };
  }

  stepComplete(index) {
    return this.stepHits[index].size === this.steps[index].targets.length;
  }

  allComplete() {
    return this.steps.every((_, index) => this.stepComplete(index));
  }

  accuracy() {
    const total = this.hits + this.misses;
    return total ? this.hits / total : 0;
  }
}
