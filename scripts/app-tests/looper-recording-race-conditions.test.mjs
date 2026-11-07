/**
 * Looper recording race condition regression tests
 * Tests for multiple consecutive layer recordings and state consistency
 * 
 * These tests verify the source code fixes in looper.js by inspecting the
 * implementation patterns rather than trying to mock the complex looper module
 * which has many dependencies (audio-core, gesture, DOM, etc.).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('verify concurrent recording guard in beginRecording()', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify the guard: if (recording || recChunks !== null) return;
  assert.ok(
    looperSource.includes('if (recording || recChunks !== null) {'),
    'beginRecording() must guard against concurrent recording attempts'
  );
  assert.ok(
    looperSource.includes('console.warn(\'[looper] Recording already in progress, ignoring duplicate start\')'),
    'Guard should log a warning when blocking duplicate start'
  );
});

test('verify chunk capture order in finishRecord()', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify that chunks is captured BEFORE recChunks is cleared
  // The fix: capture chunks → clear state → process chunks
  const chunkCapturePattern = /const chunks = recChunks;[\s\S]*?recChunks = null;/s;
  assert.ok(
    chunkCapturePattern.test(looperSource),
    'finishRecord() must capture chunks before clearing recChunks'
  );
  
  // Verify the comment explaining the fix
  assert.ok(
    looperSource.includes('Capture chunks BEFORE clearing recording state to prevent race conditions'),
    'Should have explanatory comment about the fix'
  );
});

test('verify AudioWorklet initialization failure cleanup', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify that recChunks is cleared on init failure
  const catchBlockPattern = /\.catch\(\(err\) => {[\s\S]*?recChunks = null;[\s\S]*?throw err;[\s\S]*?}\);/;
  assert.ok(
    catchBlockPattern.test(looperSource),
    'ensureTap() catch block must clear recChunks on failure'
  );
  
  assert.ok(
    looperSource.includes('// Ensure recChunks is cleared on initialization failure'),
    'Should have explanatory comment about the cleanup'
  );
});

test('verify recorder initialization guard is released after initialization settles', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');

  // The guard still protects genuinely concurrent presses while addModule() runs.
  assert.ok(
    looperSource.includes('if (tapPromise) {'),
    'startRecord() must guard against an in-flight initialization'
  );
  assert.ok(
    looperSource.includes('console.warn(\'[looper] Recorder initialization already in progress, ignoring duplicate start\')'),
    'Guard should log a warning when blocking a duplicate start during initialization'
  );
  // But the guard must be released when initialization settles, otherwise every
  // later take is rejected even though the recorder is ready for reuse.
  assert.match(
    looperSource,
    /const initializing = tapPromise;[\s\S]*?finally \{[\s\S]*?if \(tapPromise === initializing\) tapPromise = null;/,
    'ensureTap() must clear tapPromise after the in-flight initialization settles'
  );
});

test('verify generation counter prevents stale operations', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify the generation counter pattern
  assert.ok(
    looperSource.includes('const generation = ++recordStartGeneration;'),
    'startRecord() must increment generation counter'
  );
  assert.ok(
    looperSource.includes('if (generation !== recordStartGeneration) return;'),
    'Operations must check generation counter'
  );
  assert.ok(
    looperSource.includes('if (!ctx || generation !== recordStartGeneration) return;'),
    'beginRecording() must check generation counter'
  );
});

test('verify AudioWorklet cleanup in clearAll()', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify cleanup of AudioWorklet resources
  assert.ok(
    looperSource.includes('recordStartGeneration += 1;'),
    'clearAll() must increment generation to invalidate pending starts'
  );
  assert.ok(
    looperSource.includes('try { if (processor?.port) processor.port.onmessage = null; } catch (_) {}'),
    'clearAll() must clear processor port handler'
  );
  assert.ok(
    looperSource.includes('try { processor?.disconnect(); } catch (_) {}'),
    'clearAll() must disconnect processor'
  );
  assert.ok(
    looperSource.includes('try { silent?.disconnect(); } catch (_) {}'),
    'clearAll() must disconnect silent node'
  );
  assert.ok(
    looperSource.includes('tapPromise = null;'),
    'clearAll() must clear tapPromise'
  );
  
  assert.ok(
    looperSource.includes('// Disconnect and cleanup AudioWorklet recorder to prevent CPU waste'),
    'Should have explanatory comment about cleanup'
  );
});

test('verify flush timeout increased to 500ms', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify the timeout is 500ms, not 120ms
  assert.ok(
    looperSource.includes('setTimeout(() => { if (recorderFlushResolve === resolve) recorderFlushResolve = null; resolve(); }, 500);'),
    'Flush timeout must be 500ms to handle delayed chunk delivery'
  );
  
  // Verify old 120ms timeout is not present
  assert.ok(
    !looperSource.includes('setTimeout(() => { if (recorderFlushResolve === resolve) recorderFlushResolve = null; resolve(); }, 120);'),
    'Old 120ms timeout must be removed'
  );
  
  assert.ok(
    looperSource.includes('// Increased timeout from 120ms to 500ms to ensure all audio chunks are flushed'),
    'Should have explanatory comment about the timeout increase'
  );
});

test('verify AudioContext state verification before recording', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');
  
  // Verify AudioContext state check
  assert.ok(
    looperSource.includes('if (getAudioContext()?.state !== \'running\') {'),
    'beginRecording() must verify AudioContext is running'
  );
  assert.ok(
    looperSource.includes('console.error(\'[looper] Audio context failed to resume, cannot start recording\')'),
    'Should log error when context is not running'
  );
  assert.ok(
    looperSource.includes('reportRecorderError()'),
    'Should call reportRecorderError() on context failure'
  );
});

test('verify interruption handler stops recording on context interrupted', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');

  assert.ok(
    looperSource.includes('function handleContextStateChange() {'),
    'handleContextStateChange() must exist'
  );
  assert.ok(
    looperSource.includes("ctx.state === 'interrupted' && recording"),
    'Handler must check for interrupted state during recording'
  );
  assert.ok(
    looperSource.includes('if (pendingLoopStopTimer) {'),
    'Handler must clear pendingLoopStopTimer'
  );
  assert.ok(
    looperSource.includes('pendingLoopStop = false;'),
    'Handler must clear pendingLoopStop'
  );
  assert.ok(
    looperSource.includes('void finishRecord();'),
    'Handler must save partial take via finishRecord()'
  );
});

test('verify interruption listener is added on mount and removed on clear', () => {
  const looperSource = readFileSync(join(__dirname, '../../handpan-app/js/looper.js'), 'utf-8');

  assert.ok(
    looperSource.includes("ctx.addEventListener('statechange', handleContextStateChange)"),
    'Mount must register context statechange listener'
  );
  assert.ok(
    looperSource.includes("stopCtx.removeEventListener('statechange', handleContextStateChange)"),
    'clearAll() must remove context statechange listener'
  );
});
