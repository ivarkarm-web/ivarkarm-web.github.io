/**
 * looper/recorder.mjs — AudioWorklet-based recording logic.
 *
 * Imports shared state from ./state.mjs. Audio functions are imported
 * from audio-core.js.
 */

import { getAudioContext, getAudioMaster, resumeAudio } from '../audio-core.js';
import { state } from './state.mjs';

const LONG_MS = 480;

export function getRecordBus() {
  try {
    const bus = window.PionierCore?.getInstrumentBus?.();
    if (bus) return bus;
  } catch (_) {}
  return getAudioMaster();
}

export async function ensureTap() {
  const ctx = getAudioContext();
  const bus = getRecordBus();
  if (!ctx || !bus || !ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
    console.error('[looper] AudioWorklet recording is unavailable in this browser/context.');
    return null;
  }
  if (state.processor && state.tapSource && state.tapSource !== bus) {
    try {
      state.tapSource.disconnect(state.processor);
    } catch (_) {}
    try {
      bus.connect(state.processor);
    } catch (_) {}
    state.tapSource = bus;
    return ctx;
  }
  if (state.processor) return ctx;
  if (!state.tapPromise) {
    state.tapPromise = (async () => {
      let node = null;
      let mute = null;
      let source = null;
      try {
        await ctx.audioWorklet.addModule('../../js/looper-recorder-worklet.js');
        if (getAudioContext() !== ctx) {
          throw new Error('Audio context changed while preparing recorder');
        }
        node = new AudioWorkletNode(ctx, 'pionier-looper-recorder', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'discrete',
        });
        node.port.onmessage = (event) => {
          const data = event.data;
          if (data?.type === 'flushed') {
            if (state.recorderFlushResolve) state.recorderFlushResolve();
            state.recorderFlushResolve = null;
            return;
          }
          if (!state.recChunks || !data || !data.left) return;
          state.recChunks.push({
            L: new Float32Array(data.left),
            R: new Float32Array(data.right || data.left),
          });
        };
        mute = ctx.createGain();
        mute.gain.value = 0;
        try {
          bus.connect(node);
          source = bus;
        } catch (err) {
          const master = getAudioMaster();
          master.connect(node);
          source = master;
        }
        state.processor = node;
        state.tapSource = source;
        return ctx;
      } catch (err) {
        console.error('[looper] AudioWorklet init failed', err);
        state.tapPromise = null;
        return null;
      }
    })();
  }
  return state.tapPromise;
}

export function reportRecorderError() {
  console.error('[looper] Audio context failed to resume, cannot start recording');
}

export function handleContextStateChange() {
  const ctx = getAudioContext();
  if (ctx.state === 'interrupted' && state.recording) {
    if (state.pendingLoopStopTimer) {
      clearTimeout(state.pendingLoopStopTimer);
    }
    state.pendingLoopStop = false;
    void finishRecord();
  }
}

export async function beginRecording(generation = state.recordStartGeneration) {
  const ctx = await ensureTap();
  if (!ctx || generation !== state.recordStartGeneration) return;
  if (ctx.state !== 'running') {
    reportRecorderError();
    return;
  }
  if (state.recording || state.recChunks !== null) return;
  state.recording = true;
  state.recChunks = [];
  const master = getAudioMaster();
  if (master) {
    master.connect(state.processor);
  }
  try {
    await resumeAudio();
  } catch (_) {}
}

export async function startRecord() {
  if (state.layers.length >= 7 || state.recording || state.pendingLoopStop) return;
  // Guard against concurrent initialization from rapid button presses
  if (state.tapPromise) {
    console.warn('[looper] Recorder initialization already in progress, ignoring duplicate start');
    return;
  }
  const generation = ++state.recordStartGeneration;
  await beginRecording(generation);
}

export function reportRecorderError2() {
  console.error('[looper] Audio context failed to resume, cannot start recording');
}

export async function finishRecord() {
  if (!state.recording && !state.pendingLoopStop) return;
  if (state.recording && state.processor?.port && state.recChunks) {
    await new Promise((resolve) => {
      state.recorderFlushResolve = resolve;
      state.processor.port.postMessage({ type: 'flush' });
      setTimeout(() => {
        if (state.recorderFlushResolve === resolve) state.recorderFlushResolve = null;
        resolve();
      }, 500);
    });
  }
  state.recording = false;
  state.recChunks = null;
  state.processor = null;
  state.silent = null;
  state.tapSource = null;
  state.tapPromise = null;
}

export function clearAll() {
  state.recordStartGeneration += 1;
  try {
    if (state.processor?.port) state.processor.port.onmessage = null;
  } catch (_) {}
  try {
    state.processor?.disconnect();
  } catch (_) {}
  try {
    state.silent?.disconnect();
  } catch (_) {}
  try {
    state.tapSource?.disconnect(state.processor);
  } catch (_) {}
  state.processor = null;
  state.silent = null;
  state.tapSource = null;
  state.tapPromise = null;
}

export function requestStopRecord() {
  // Called when AudioContext is interrupted
  if (state.pendingLoopStopTimer) {
    clearTimeout(state.pendingLoopStopTimer);
  }
  state.pendingLoopStop = true;
  void finishRecord();
}

export function registerContextListener() {
  const ctx = getAudioContext();
  if (ctx) {
    ctx.addEventListener('statechange', handleContextStateChange);
  }
}

export function unregisterContextListener() {
  const ctx = getAudioContext();
  if (ctx) {
    ctx.removeEventListener('statechange', handleContextStateChange);
  }
}
