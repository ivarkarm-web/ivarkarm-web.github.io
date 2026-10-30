import test from 'node:test';
import assert from 'node:assert/strict';
import { HandpanInstrument, HANDPAN_SCALES } from '../../handpan-app/js/instruments/handpan.js';

test('handpan starts with eight notes and preserves randomized count across tuning changes', () => {
  const handpan = new HandpanInstrument();
  assert.equal(handpan.noteCount, 8);
  handpan.rebuildNotes();
  assert.equal(handpan.getNotes().length, 8);

  handpan.setNoteCount(11);
  assert.equal(handpan.noteCount, 11);
  assert.equal(handpan.getNotes().length, 11);

  handpan.setScaleIndex((handpan.scaleIndex + 1));
  assert.equal(handpan.noteCount, 11);
  assert.equal(handpan.getNotes().length, 11);

  handpan.setRootIndex((handpan.rootIndex + 1) % 12);
  assert.equal(handpan.noteCount, 11);
  assert.equal(handpan.getNotes().length, 11);
});

test('randomizer note count setter clamps to the 8–13 range', () => {
  const handpan = new HandpanInstrument();
  handpan.setNoteCount(7);
  assert.equal(handpan.noteCount, 8);
  handpan.setNoteCount(99);
  assert.equal(handpan.noteCount, 13);
});


test('every handpan scale, including E Amara, produces procedural note frequencies', () => {
  const handpan = new HandpanInstrument();
  assert.equal(handpan.engineKind, 'procedural');
  for (let index = 0; index < HANDPAN_SCALES.length; index++) {
    handpan.setScaleIndex(index);
    const notes = handpan.getNotes();
    assert.equal(notes.length, handpan.noteCount, HANDPAN_SCALES[index].id);
    assert.ok(notes.every((note) => Number.isFinite(note.freq) && note.freq > 0), HANDPAN_SCALES[index].id);
  }
  assert.ok(HANDPAN_SCALES.some((scale) => scale.id === 'eamara'), 'E Amara scale must remain available');
});
