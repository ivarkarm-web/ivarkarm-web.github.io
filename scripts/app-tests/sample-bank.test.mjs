import test from 'node:test';
import assert from 'node:assert/strict';
import { SampleBank } from '../../handpan-app/js/sample-bank.js';

test('sample bank gracefully falls back when the production manifest has no samples', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: 1, status: 'fallback-synth', samples: {} }) });
  const context = {};
  const bank = new SampleBank(context, {});
  const manifest = await bank.loadManifest('fixture://manifest');
  assert.equal(manifest.status, 'fallback-synth');
  assert.equal(await bank.load('steel:D3', 0.8), null);
  globalThis.fetch = originalFetch;
});
