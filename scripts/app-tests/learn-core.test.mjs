import test from 'node:test';
import assert from 'node:assert/strict';
import { TimingScorer, timingGrade } from '../../handpan-app/js/learn-core.js';
import { LESSONS } from '../../handpan-app/js/lessons.js';

test('learn curriculum has sixteen original lessons across four levels', () => {
  assert.equal(LESSONS.length, 16);
  assert.deepEqual([...new Set(LESSONS.map((lesson) => lesson.level))], [1, 2, 3, 4]);
  assert.equal(LESSONS.filter((lesson) => lesson.level === 1).length, 4);
  assert.equal(LESSONS.filter((lesson) => lesson.level === 2).length, 4);
  assert.equal(LESSONS.filter((lesson) => lesson.level === 3).length, 4);
  assert.equal(LESSONS.filter((lesson) => lesson.level === 4).length, 4);
});

test('timing grades reward increasingly precise hits', () => {
  assert.equal(timingGrade(0).label, 'PERFECT');
  assert.equal(timingGrade(0.1).label, 'GREAT');
  assert.equal(timingGrade(0.25).label, 'GOOD');
  assert.equal(timingGrade(0.4).label, 'LATE');
  assert.equal(timingGrade(0.6), null);
});

test('timing scorer handles hits, misses, combos and chords without immediate failure', () => {
  const scorer = new TimingScorer([
    { at: 0, targets: [0, 2] },
    { at: 1, targets: [1] }
  ], 0.48);
  const first = scorer.scoreNote(0, 0.02);
  assert.equal(first.correct, true);
  assert.equal(first.complete, false);
  const second = scorer.scoreNote(2, -0.03);
  assert.equal(second.correct, true);
  assert.equal(second.complete, true);
  const miss = scorer.scoreNote(5, 0.5);
  assert.equal(miss.correct, false);
  assert.equal(scorer.misses, 1);
  assert.equal(scorer.combo, 0);
  const final = scorer.scoreNote(1, 1.04);
  assert.equal(final.correct, true);
  assert.equal(scorer.allComplete(), true);
  assert.equal(scorer.bestCombo, 2);
});
