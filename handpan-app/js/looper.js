/**
 * looper.js — four-layer phrase looper v3
 * Community upload import removed (repository-loop-save deleted).
 * NOTE: Full Phase C looper (loop-core quantize) still pending push of full file body.
 * This stub keeps the module graph loading so the instrument boots.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const MAX_LAYERS = 4;

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  if (!rail || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  const btn = document.getElementById('looperBtn');
  const clearBtn = document.getElementById('looperClearBtn');
  if (btn) {
    btn.title = 'Looper update in progress — record temporarily unavailable';
    btn.setAttribute('aria-label', btn.title);
    btn.disabled = true;
  }
  if (clearBtn) clearBtn.disabled = true;

  const api = {
    clearAll() {},
    layers: [],
    openTrackPanel() {},
    closeTrackPanel() {},
    setBpm() {},
    setMetronome() {},
    getTimingState: () => ({ bpm: 90, metronomeOn: false, countInEnabled: false, countInBars: 1, beatsPerBar: 4, clickType: 'woodblock' }),
    getState: () => ({ maxLayers: MAX_LAYERS, layerCount: 0, recording: false, pendingLoopStop: false })
  };
  window.PionierLooper = api;
  return api;
}
