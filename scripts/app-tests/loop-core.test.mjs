import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BPM, DEFAULT_BARS, beatDuration, loopDuration, countInDuration,
  quantizeTime, normalizeLayer, phaseAt, eventsBetween
} from '../../handpan-app/js/loop-core.js';

test('default loop is four bars at 80 BPM with a one-bar count-in', () => {
  assert.equal(DEFAULT_BPM, 80);
  assert.equal(DEFAULT_BARS, 4);
  assert.equal(loopDuration(), 12);
  assert.equal(countInDuration(), 3);
  assert.equal(beatDuration(), 0.75);
});

test('quantiser snaps to sixteenth notes', () => {
  assert.equal(quantizeTime(0.17), 0.1875);
  assert.equal(quantizeTime(0.2), 0.1875);
  assert.equal(quantizeTime(0.39), 0.375);
});

test('layer normalisation clamps, quantises and sorts events', () => {
  const layer = normalizeLayer([
    { t: 1.02, n: 3, v: 2 },
    { t: -0.1, n: 1, v: 0.5 },
    { t: 4, n: 2, v: 0.7 }
  ], 3, 80);
  assert.deepEqual(layer.map((e) => [e.t, e.n, e.v]), [
    [0, 1, 0.5],
    [0.9375, 3, 1],
    [2.999, 2, 0.7]
  ]);
});

test('phase wraps and event scheduler handles loop boundaries in playback order', () => {
  assert.ok(Math.abs(phaseAt(12.2, 12) - 0.2) < 1e-9);
  const events = [{ t: 0.1, n: 1 }, { t: 2, n: 2 }, { t: 11.8, n: 3 }];
  assert.deepEqual(eventsBetween(events, 11.5, 0.2, 12).map((e) => e.n), [3, 1]);
  assert.deepEqual(eventsBetween(events, 1, 0.5, 12).map((e) => e.n), [2, 3, 1]);
});
