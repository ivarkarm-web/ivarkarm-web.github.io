/**
 * looper.js — seven-layer phrase looper v3 (ES module split).
 *
 * Main entry point: owns DOM mounting, event wiring, and the render loop.
 * Recording, mixing, persistence, and timing logic live in sub-modules
 * under js/looper/. All share the state object from ./state.mjs.
 *
 * Record: arm/stop layer (pre-FX instrument bus)
 * Recording uses optional count-in, metronome and tempo controls:
 *   FREE  — independent lengths
 *   LOOP  — secondary tracks snap to exact multiples of layer-1 duration
 *   BEAT  — start/stop quantized to beat grid derived from layer 1
 *   SERIAL — tracks play one after another (song sections)
 */

import { state } from './looper/state.mjs';
import * as Recorder from './looper/recorder.mjs';
import * as Mixer from './looper/mixer.mjs';
import * as Persistence from './looper/persistence.mjs';
import * as Timing from './looper/timing.mjs';
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js';

const LONG_MS = 480;
const DEFAULT_LEVEL = 0.92;
const SYNC_MODES = [
  { id: 'free', label: 'FREE', title: 'Free — each layer independent' },
  { id: 'loop', label: 'LOOP', title: 'Loop sync — multiples of master length' },
  { id: 'beat', label: 'BEAT', title: 'Beat sync — quantize to master grid' },
  { id: 'serial', label: 'SERIAL', title: 'Serial — sections play in sequence' },
];

const CLICK_TYPES = [
  { id: 'woodblock', label: 'Woodblock', wave: 'triangle', frequency: 1450, duration: 0.045 },
  { id: 'soft-wood', label: 'Soft Wood', wave: 'sine', frequency: 950, duration: 0.055 },
  { id: 'rim-click', label: 'Rim Click', wave: 'square', frequency: 2100, duration: 0.022 },
  { id: 'handpan-tap', label: 'Handpan Tap', wave: 'sine', frequency: 520, duration: 0.11 },
  { id: 'bell', label: 'Bell', wave: 'sine', frequency: 1760, duration: 0.16 },
  { id: 'shaker', label: 'Shaker', wave: 'sawtooth', frequency: 4200, duration: 0.018 },
  { id: 'tick', label: 'Soft Tick', wave: 'square', frequency: 1200, duration: 0.012 },
  { id: 'clave', label: 'Clave', wave: 'triangle', frequency: 2500, duration: 0.03 },
  { id: 'low-pulse', label: 'Low Pulse', wave: 'sine', frequency: 180, duration: 0.08 },
  { id: 'digital', label: 'Digital Click', wave: 'square', frequency: 3000, duration: 0.018 },
];

export function mountLooper({ root } = {}) {
  const rail = root || document.getElementById('looperRail');
  if (!rail || rail.dataset.mounted === '1') return null;
  rail.dataset.mounted = '1';

  state.rail = rail;

  // --- Build required controls ---
  let btn = document.getElementById('looperBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'looperBtn';
    rail.appendChild(btn);
  }
  btn.className = 'looper-btn looper-record';
  btn.setAttribute('aria-label', 'Record loop');
  btn.title = 'Record loop';
  if (!btn.querySelector('.looper-btn-core')) {
    btn.innerHTML =
      '<span class="looper-btn-ring" aria-hidden="true"></span>' +
      '<span class="looper-btn-core" aria-hidden="true"></span>';
  }
  state.btn = btn;

  let layersEl = document.getElementById('looperLayers');
  if (!layersEl) {
    layersEl = document.createElement('div');
    layersEl.id = 'looperLayers';
    layersEl.className = 'looper-layers';
    layersEl.setAttribute('role', 'group');
    layersEl.setAttribute('aria-label', 'Loop layers');
    rail.appendChild(layersEl);
  }
  state.layersEl = layersEl;

  let clearBtn = document.getElementById('looperClearBtn');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'looperClearBtn';
    clearBtn.className = 'looper-clear-btn';
    clearBtn.setAttribute('aria-label', 'Clear all loops');
    clearBtn.title = 'Clear all loops';
    document.body.appendChild(clearBtn);
  }
  if (clearBtn.parentElement !== rail) rail.insertBefore(clearBtn, rail.firstChild);
  clearBtn.className = 'looper-clear-btn';
  clearBtn.innerHTML =
    '<span class="looper-clear-ring" aria-hidden="true"></span>' +
    '<span class="looper-clear-core" aria-hidden="true">' +
    '<span class="looper-clear-x"></span>' +
    '</span>';
  clearBtn.hidden = false;
  clearBtn.disabled = false;
  state.clearBtn = clearBtn;

  const oldPulse = document.getElementById('looperPulseBtn');
  if (oldPulse) oldPulse.remove();

  let syncBtn = document.getElementById('looperSyncBtn');
  if (!syncBtn) {
    syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.id = 'looperSyncBtn';
  }
  syncBtn.className = 'looper-sync-dial';
  syncBtn.hidden = true;
  syncBtn.setAttribute('aria-hidden', 'true');
  syncBtn.innerHTML = '<span class="looper-sync-label">FREE</span>';
  if (syncBtn.parentElement !== cluster) cluster.insertBefore(syncBtn, btn);
  state.syncBtn = syncBtn;

  function ensureTimingButton(id, className, aria, html) {
    let control = document.getElementById(id);
    if (!control) {
      control = document.createElement('button');
      control.type = 'button';
      control.id = id;
    }
    control.className = 'looper-timing-btn ' + className;
    control.hidden = false;
    control.removeAttribute('hidden');
    control.style.removeProperty('display');
    control.setAttribute('aria-label', aria);
    control.title = aria;
    control.innerHTML = html;
    return control;
  }

  const countInBtn = ensureTimingButton(
    'looperCountInBtn',
    'looper-count-in-btn',
    'Toggle count-in',
    '<svg class="looper-icon looper-countin-icon" viewBox="0 0 18 16" aria-hidden="true"><path d="M2 12V8M6.7 12V4M11.3 12V6M16 12V2.5" /><path d="M1 14.2H17" /></svg><span class="looper-timing-main">1·2·3·4</span>'
  );
  const metronomeBtn = ensureTimingButton(
    'looperMetronomeBtn',
    'looper-metronome-btn',
    'Toggle metronome',
    '<svg class="looper-icon looper-metronome-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 15.5 7.2 2.5h3.6L13 15.5Z"/><path d="M9 4.3 12.1 7.1M9 4.3 8 10.4"/><circle cx="8" cy="10.4" r="1.15" /></svg><span class="looper-timing-led" aria-hidden="true"></span>'
  );
  const bpmBtn = ensureTimingButton(
    'looperBpmBtn',
    'looper-bpm-btn',
    'Tempo settings',
    '<svg class="looper-icon looper-tempo-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.1 12.8a7 7 0 1 1 11.8 0"/><path d="M9 9 12.3 5.8"/><circle cx="9" cy="9" r="1.1"/><path d="M4.7 12.8h8.6"/></svg><span class="looper-bpm-value">90</span><span class="looper-bpm-unit">BPM</span>'
  );
  state.countInBtn = countInBtn;
  state.metronomeBtn = metronomeBtn;
  state.bpmBtn = bpmBtn;

  const exportBtn = ensureTimingButton(
    'looperExportBtn',
    'looper-export-btn',
    'Export loop as WAV',
    '<span class="looper-timing-main">WAV</span>'
  );
  exportBtn.disabled = true;
  rail.appendChild(exportBtn);
  exportBtn.addEventListener('click', () => Persistence.exportWav());
  state.exportBtn = exportBtn;

  const saveBtn = ensureTimingButton(
    'looperSaveBtn',
    'looper-save-btn',
    'Save composition to My Library',
    '<span class="looper-timing-main">Save</span>'
  );
  saveBtn.disabled = true;
  rail.appendChild(saveBtn);
  saveBtn.addEventListener('click', () => {
    const snap = Persistence.createLibrarySnapshot();
    window.PionierLibrary?.save?.(snap);
  });
  state.saveBtn = saveBtn;

  // --- Utility group ---
  let utilityGroup = document.getElementById('looperUtilityControls');
  if (!utilityGroup) {
    utilityGroup = document.createElement('div');
    utilityGroup.id = 'looperUtilityControls';
    utilityGroup.className = 'looper-utility-controls';
  }
  if (utilityGroup.parentElement !== rail) {
    rail.insertBefore(utilityGroup, cluster.parentElement === rail ? cluster : null);
  }
  [countInBtn, metronomeBtn, bpmBtn].forEach((control) => utilityGroup.appendChild(control));
  state.utilityGroup = utilityGroup;

  syncBtn.setAttribute('aria-label', 'Sync mode: Free');
  syncBtn.title = SYNC_MODES[0].title;

  // --- Wire event listeners ---
  const legacyPlay = document.getElementById('looperPlayBtn');
  if (legacyPlay) {
    legacyPlay.hidden = true;
    legacyPlay.style.display = 'none';
  }

  const cluster = document.getElementById('looperRecordCluster');
  if (!cluster) {
    // Should not happen; rail always has the cluster.
  }

  // Pointer handling on the canvas is done in pionier-core-base.js;
  // here we only wire the transport controls.
  btn.addEventListener('click', async () => {
    if (state.recording) {
      await Recorder.finishRecord();
    } else {
      await Recorder.startRecord();
    }
  });

  clearBtn.addEventListener('click', () => {
    Recorder.clearAll();
    state.layers = [];
    renderCircles();
  });

  syncBtn.addEventListener('click', () => {
    Timing.cycleSyncMode();
  });

  countInBtn.addEventListener('click', () => {
    state.countInEnabled = !state.countInEnabled;
    countInBtn.classList.toggle('is-active', state.countInEnabled);
  });

  metronomeBtn.addEventListener('click', () => {
    Timing.setMetronome(!state.metronomeOn);
    metronomeBtn.classList.toggle('is-active', state.metronomeOn);
  });

  bpmBtn.addEventListener('click', () => {
    Timing.showTimingMenu('bpm', bpmBtn);
  });

  exportBtn.addEventListener('click', () => {
    Persistence.exportWav();
  });

  saveBtn.addEventListener('click', () => {
    const snap = Persistence.createLibrarySnapshot();
    window.PionierLibrary?.save?.(snap);
  });

  // --- Expose API ---
  window.PionierLooper = {
    get layers() {
      return state.layers;
    },
    get recording() {
      return state.recording;
    },
    get bpm() {
      return state.bpm;
    },
    get syncMode() {
      return Timing.syncMode();
    },
    get countInEnabled() {
      return state.countInEnabled;
    },
    get metronomeOn() {
      return state.metronomeOn;
    },
    addLayer: (buffer) => {
      const layer = {
        index: state.layers.length,
        buffer,
        level: DEFAULT_LEVEL,
        muted: false,
        solo: false,
        paused: false,
        startedAt: getAudioContext().currentTime,
      };
      state.layers.push(layer);
      renderCircles();
      return layer.index;
    },
    setLayerLevel: (index, level) => {
      const layer = state.layers[index];
      if (layer) {
        layer.level = level;
        Mixer.applyLayerGain(layer);
      }
    },
    toggleLayer: (index) => Mixer.toggleLayer(index),
    deleteLayer: (index) => {
      Mixer.deleteLayer(index);
      renderCircles();
    },
  };

  renderCircles();
  return state;
}

function renderCircles() {
  const layersEl = state.layersEl;
  if (!layersEl) return;
  layersEl.innerHTML = '';
  state.layers.forEach((layer, i) => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className =
      'looper-circle' +
      (i === 0 ? ' is-master' : '') +
      (layer.paused ? ' is-paused' : '') +
      (layer.muted ? ' is-muted' : '') +
      (layer.solo ? ' is-solo' : '');
    c.setAttribute('aria-label', i === 0 ? 'Layer 1, master' : 'Layer ' + (i + 1));
    c.innerHTML = '<span class="looper-circle-core">' + (i + 1) + '</span>';
    c.addEventListener('click', () => {
      Mixer.toggleLayer(i);
      renderCircles();
    });
    layersEl.appendChild(c);
  });
}
