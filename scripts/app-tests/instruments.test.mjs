import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTRUMENT_META,
  instrumentIds,
  INSTRUMENT_FAMILIES,
  instrumentsByFamily,
  instrumentsInFamily,
  randomInstrumentId,
  randomInstrumentInFamily
} from '../../handpan-app/js/instruments/instrument-meta.js';
import { VOICES, VOICE_MAP } from '../../handpan-app/js/sound/voices.js';

test('instruments: metadata exists for handpan plus every library voice', () => {
  const voiceIds = VOICES.map((v) => v.id);
  const metaIds = instrumentIds();
  assert.equal(metaIds.length, voiceIds.length, `meta count ${metaIds.length} vs voices ${voiceIds.length}`);
  for (const id of voiceIds) {
    assert.ok(INSTRUMENT_META[id], `missing metadata for ${id}`);
    assert.ok(VOICE_MAP.get(id), `voice ${id} not in VOICE_MAP`);
  }
});

test('instruments: every instrument is assigned to a valid family', () => {
  for (const id of instrumentIds()) {
    const m = INSTRUMENT_META[id];
    assert.ok(INSTRUMENT_FAMILIES.includes(m.family), `invalid family ${m.family} for ${id}`);
  }
});

test('instruments: family breakdown covers all six families with at least one instrument', () => {
  const byFam = instrumentsByFamily();
  assert.equal(byFam.size, INSTRUMENT_FAMILIES.length);
  for (const fam of INSTRUMENT_FAMILIES) {
    const list = instrumentsInFamily(fam);
    assert.ok(list.length > 0, `family ${fam} is empty`);
    assert.ok(list.every((m) => m.family === fam), `family ${fam} contains other families`);
  }
  const total = [...byFam.values()].reduce((a, b) => a + b.length, 0);
  assert.equal(total, instrumentIds().length);
});

test('instruments: required metadata fields are present and well-typed', () => {
  for (const id of instrumentIds()) {
    const m = INSTRUMENT_META[id];
    assert.equal(typeof m.id, 'string', `${id}: id`);
    assert.ok(m.id.length > 0, `${id}: id non-empty`);
    assert.equal(typeof m.name, 'string', `${id}: name`);
    assert.ok(m.name.length > 0, `${id}: name non-empty`);
    assert.equal(typeof m.description, 'string', `${id}: description`);
    assert.equal(Array.isArray(m.tags), true, `${id}: tags`);
    assert.equal(typeof m.isTonal, 'boolean', `${id}: isTonal`);
    assert.equal(typeof m.isPercussive, 'boolean', `${id}: isPercussive`);
    assert.equal(typeof m.isSustained, 'boolean', `${id}: isSustained`);
    assert.equal(typeof m.supportsPitchBend, 'boolean', `${id}: supportsPitchBend`);
    assert.equal(typeof m.supportsExpression, 'boolean', `${id}: supportsExpression`);
    assert.equal(typeof m.supportsPolyphony, 'boolean', `${id}: supportsPolyphony`);
    assert.equal(typeof m.supportsScaleMapping, 'boolean', `${id}: supportsScaleMapping`);
    assert.equal(typeof m.supportsNoteRelease, 'boolean', `${id}: supportsNoteRelease`);
    assert.equal(Array.isArray(m.compatibleScales), true, `${id}: compatibleScales`);
    assert.ok(m.compatibleScales.length > 0, `${id}: compatibleScales empty`);
  }
});

test('instruments: capabilities are not over-advertised', () => {
  // A voice that fades on release (isSustained) is the only kind that advertises
  // genuine sustained note release. One-shot voices do not.
  for (const id of instrumentIds()) {
    const m = INSTRUMENT_META[id];
    assert.ok(m.supportsNoteRelease === m.isSustained, `${id}: supportsNoteRelease must match isSustained`);
    assert.ok(!m.supportsNoteRelease || m.isSustained, `${id}: release advertised without sustain`);
  }
});

test('instruments: handpan is in HANDPAN & TUNED PERCUSSION and supports pitch bend', () => {
  const hp = INSTRUMENT_META.handpan;
  assert.equal(hp.family, 'HANDPAN & TUNED PERCUSSION');
  assert.equal(hp.isSustained, true);
  assert.equal(hp.supportsPitchBend, true);
  assert.equal(hp.supportsScaleMapping, true);
});

test('instruments: wind family contains the breath-based instruments', () => {
  const wind = instrumentsInFamily('WIND').map((m) => m.id);
  for (const id of ['shakuhachi', 'dizi', 'xun', 'bone_flute', 'native_flute', 'breath']) {
    assert.ok(wind.includes(id), `${id} should be in WIND family`);
  }
});

test('instruments: strings family contains the plucked string instruments', () => {
  const strings = instrumentsInFamily('STRINGS').map((m) => m.id);
  for (const id of ['koto', 'harp', 'guqin', 'valiha', 'krar', 'guzheng']) {
    assert.ok(strings.includes(id), `${id} should be in STRINGS family`);
  }
});

test('instruments: randomInstrumentId returns only registered instruments', () => {
  const registered = new Set(instrumentIds());
  for (let i = 0; i < 100; i++) {
    const id = randomInstrumentId();
    assert.ok(registered.has(id), `randomInstrumentId returned unregistered ${id}`);
  }
});

test('instruments: randomInstrumentId within a family stays in that family', () => {
  for (let i = 0; i < 50; i++) {
    const id = randomInstrumentInFamily('WIND');
    const m = INSTRUMENT_META[id];
    assert.equal(m.family, 'WIND', `${id} is not WIND`);
  }
});

test('instruments: randomInstrumentId respects excludeIds', () => {
  const id = randomInstrumentId({ excludeIds: instrumentIds() });
  assert.equal(id, null, 'randomInstrumentId should return null when all ids excluded');
});
