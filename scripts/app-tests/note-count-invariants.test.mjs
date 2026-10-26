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


test('E Amara routes through the owner-recording sample bank', () => {
  const handpan = new HandpanInstrument();
  const eamara = HANDPAN_SCALES.findIndex((scale) => scale.id === 'eamara');
  assert.notEqual(eamara, -1, 'E Amara scale must be present');
  handpan.setScaleIndex(eamara);
  assert.equal(handpan._isRecordedScale(), true);
});
