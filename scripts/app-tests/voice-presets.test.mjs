import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_PRESETS, resolveVoiceIndex, migrateVoiceSelection } from '../../handpan-app/js/voice-presets.js';

test('production voice set is five plain named presets', () => {
  assert.equal(VOICE_PRESETS.length, 5);
  assert.deepEqual(VOICE_PRESETS.map((voice) => voice.name), ['Steel', 'Warm', 'Bell', 'Soft', 'Deep']);
  assert.ok(VOICE_PRESETS.every((voice) => voice.partials.length >= 3));
});

test('legacy numeric and named selections migrate safely', () => {
  assert.equal(VOICE_PRESETS[resolveVoiceIndex(0)].name, 'Steel');
  assert.equal(VOICE_PRESETS[resolveVoiceIndex(7)].name, 'Deep');
  assert.equal(VOICE_PRESETS[resolveVoiceIndex('Glass Bloom')].name, 'Steel');
  assert.equal(VOICE_PRESETS[resolveVoiceIndex('Drift Arp')].name, 'Warm');
  assert.equal(migrateVoiceSelection('Deep Resonator'), 'deep');
});
