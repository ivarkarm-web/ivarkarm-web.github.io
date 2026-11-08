/**
 * Looper recording race condition regression tests
 * Tests for multiple consecutive layer recordings and state consistency
 *
 * These tests verify the source code fixes in the looper module graph by
 * inspecting the implementation patterns in the sub-modules under
 * handpan-app/js/looper/.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const read = (rel) => readFileSync(join(__dirname, '../../handpan-app/js/looper', rel), 'utf-8');

test('verify concurrent recording guard in beginRecording()', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes('state.recording || state.recChunks !== null'),
    'beginRecording() must guard against concurrent recording attempts'
  );
  assert.ok(
    src.includes(
      "console.warn('[looper] Recorder initialization already in progress, ignoring duplicate start')"
    ),
    'Guard should log a warning when blocking duplicate start'
  );
});

test('verify chunk capture order in finishRecord()', () => {
  const src = read('recorder.mjs');
  // Verify that recChunks is captured before being cleared
  assert.ok(
    src.includes('state.recChunks') && src.includes('recChunks = null'),
    'finishRecord() must capture chunks before clearing recChunks'
  );
});

test('verify AudioWorklet initialization failure cleanup', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes('state.tapPromise = null;'),
    'ensureTap() must clear tapPromise on failure'
  );
  assert.ok(src.includes('catch (err) {'), 'ensureTap() must catch initialization errors');
});

test('verify recorder initialization guard is released after initialization settles', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes('if (state.tapPromise) {'),
    'startRecord() must guard against an in-flight initialization'
  );
  assert.ok(
    src.includes(
      "console.warn('[looper] Recorder initialization already in progress, ignoring duplicate start')"
    ),
    'Guard should log a warning when blocking a duplicate start during initialization'
  );
});

test('verify generation counter prevents stale operations', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes('++state.recordStartGeneration'),
    'startRecord() must increment generation counter'
  );
  assert.ok(
    src.includes('generation !== state.recordStartGeneration'),
    'Operations must check generation counter'
  );
});

test('verify AudioWorklet cleanup in clearAll()', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes('++state.recordStartGeneration'),
    'clearAll() must increment generation to invalidate pending starts'
  );
  assert.ok(src.includes('state.processor?.port'), 'clearAll() must clear processor port handler');
  assert.ok(src.includes('state.processor?.disconnect()'), 'clearAll() must disconnect processor');
  assert.ok(src.includes('state.silent?.disconnect()'), 'clearAll() must disconnect silent node');
  assert.ok(src.includes('state.tapPromise = null'), 'clearAll() must clear tapPromise');
});

test('verify flush timeout increased to 500ms', () => {
  const src = read('recorder.mjs');
  assert.ok(src.includes('500'), 'Flush timeout must be 500ms to handle delayed chunk delivery');
  assert.ok(!src.includes('}, 120);'), 'Old 120ms timeout must be removed');
});

test('verify AudioContext state verification before recording', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes("ctx.state !== 'running')"),
    'beginRecording() must verify AudioContext is running'
  );
  assert.ok(
    src.includes("console.error('[looper] Audio context failed to resume"),
    'Should log error when context is not running'
  );
  assert.ok(
    src.includes('reportRecorderError()'),
    'Should call reportRecorderError() on context failure'
  );
});

test('verify interruption handler stops recording on context interrupted', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes("ctx.state === 'interrupted'"),
    'Handler must check for interrupted state during recording'
  );
  assert.ok(src.includes('state.pendingLoopStopTimer'), 'Handler must clear pendingLoopStopTimer');
  assert.ok(src.includes('state.pendingLoopStop = false'), 'Handler must clear pendingLoopStop');
  assert.ok(src.includes('finishRecord()'), 'Handler must save partial take via finishRecord()');
});

test('verify interruption listener is added on mount and removed on clear', () => {
  const src = read('recorder.mjs');
  assert.ok(
    src.includes("addEventListener('statechange'"),
    'Mount must register context statechange listener'
  );
});
