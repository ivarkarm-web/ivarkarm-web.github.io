import test from 'node:test';
import assert from 'node:assert/strict';
import { HandpanInstrument, HANDPAN_SCALES } from '../../handpan-app/js/instruments/handpan.js';
import {
  HANDPAN_SCALES as HS2,
  scaleToCents,
  scaleIds,
  scaleCount,
  nonExperimentalScales,
  findScaleById,
  randomScaleIndex,
  SCALE_FAMILIES
} from '../../handpan-app/js/instruments/handpan-scales.js';
import { extendScaleCents } from '../../handpan-app/js/instruments/handpan.js';

test('scales: source of truth is consistent between handpan.js and handpan-scales.js', () => {
  assert.equal(HANDPAN_SCALES.length, HS2.length);
  assert.equal(HANDPAN_SCALES[0].id, HS2[0].id);
});

test('scales: every scale has a unique id and unique label', () => {
  const ids = HANDPAN_SCALES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate scale ids');
  const labels = HANDPAN_SCALES.map((s) => s.label);
  assert.equal(new Set(labels).size, labels.length, 'duplicate scale labels');
});

test('scales: count is approximately 36 (curated library)', () => {
  assert.equal(scaleCount(), HANDPAN_SCALES.length);
  assert.ok(scaleCount() >= 30 && scaleCount() <= 45, `expected ~36 scales, got ${scaleCount()}`);
});

test('scales: every scale is assigned to a valid family', () => {
  for (const s of HANDPAN_SCALES) {
    assert.ok(SCALE_FAMILIES.includes(s.family), `invalid family ${s.family} for ${s.id}`);
  }
});

test('scales: every scale has valid root, rootMidi and rootPc', () => {
  for (const s of HANDPAN_SCALES) {
    assert.ok(Number.isFinite(s.rootMidi) && s.rootMidi >= 0 && s.rootMidi <= 127, `bad rootMidi ${s.id}`);
    assert.ok(Number.isFinite(s.rootPc) && s.rootPc >= 0 && s.rootPc <= 11, `bad rootPc ${s.id}`);
    assert.equal(s.rootMidi % 12, s.rootPc, `rootMidi/rootPc mismatch ${s.id}`);
    assert.ok(Number.isFinite(s.noteCount) && s.noteCount >= 1, `bad noteCount ${s.id}`);
  }
});

test('scales: intervals start at root (0), are ascending and finite', () => {
  for (const s of HANDPAN_SCALES) {
    assert.equal(s.intervals[0], 0, `${s.id}: intervals[0] is not root`);
    for (let i = 1; i < s.intervals.length; i++) {
      assert.ok(s.intervals[i] > s.intervals[i - 1], `${s.id}: intervals not ascending`);
      assert.ok(Number.isFinite(s.intervals[i]) && s.intervals[i] >= 0, `${s.id}: non-finite interval`);
    }
  }
});

test('scales: cents conversion preserves interval count and ordering', () => {
  for (const s of HANDPAN_SCALES) {
    const cents = scaleToCents(s);
    assert.equal(cents.length, s.intervals.length, `${s.id}: cents length`);
    assert.ok(cents.every((c) => Number.isFinite(c)), `${s.id}: non-finite cents`);
    assert.equal(cents[0], 0, `${s.id}: cents root`);
  }
});

test('scales: octave expansion (extendScaleCents) produces finite frequencies for every scale', () => {
  const handpan = new HandpanInstrument();
  for (let index = 0; index < HANDPAN_SCALES.length; index++) {
    handpan.setScaleIndex(index);
    const notes = handpan.getNotes();
    assert.ok(notes.length >= 1, `${HANDPAN_SCALES[index].id}: no notes`);
    assert.ok(notes.every((n) => Number.isFinite(n.freq) && n.freq > 0), `${HANDPAN_SCALES[index].id}: bad freq`);
  }
});

test('scales: randomScaleIndex returns a valid, non-experimental index by default', () => {
  const experimentalIds = new Set(HANDPAN_SCALES.filter((s) => s.isExperimental).map((s) => s.id));
  for (let i = 0; i < 200; i++) {
    const idx = randomScaleIndex({ excludeExperimental: true });
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < HANDPAN_SCALES.length, 'randomScaleIndex out of range');
    assert.ok(!experimentalIds.has(HANDPAN_SCALES[idx].id), 'experimental scale returned by default');
  }
});

test('scales: randomScaleIndex can include experimental when requested', () => {
  const hasExperimental = HANDPAN_SCALES.some((s) => s.isExperimental);
  if (!hasExperimental) return; // nothing to assert if none are experimental
  let sawExperimental = false;
  for (let i = 0; i < 200; i++) {
    const idx = randomScaleIndex({ excludeExperimental: false });
    if (HANDPAN_SCALES[idx].isExperimental) { sawExperimental = true; break; }
  }
  assert.ok(sawExperimental, 'randomScaleIndex never returned an experimental scale');
});

test('scales: nonExperimentalScales excludes every experimental preset', () => {
  const nonExp = nonExperimentalScales();
  assert.ok(nonExp.every((s) => !s.isExperimental), 'non-experimental list contains an experimental scale');
  assert.ok(nonExp.length < HANDPAN_SCALES.length, 'no scales were excluded as experimental');
  assert.ok(nonExp.length > 0, 'non-experimental list is empty');
});

test('scales: findScaleById resolves known ids and null for unknown', () => {
  assert.ok(findScaleById('dkurd'), 'dkurd not found');
  assert.equal(findScaleById('does-not-exist'), null, 'unknown id should be null');
});
