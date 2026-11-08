/**
 * looper/state.mjs — Shared mutable state for the seven-layer looper.
 *
 * All modules import this state and mutate it directly. This keeps the
 * module boundary clean: looper.js owns the state, sub-modules own
 * behaviour.
 */

export const state = {
  // DOM references
  rail: null,
  btn: null,
  layersEl: null,
  clearBtn: null,
  syncBtn: null,
  cluster: null,
  utilityGroup: null,
  countInBtn: null,
  metronomeBtn: null,
  bpmBtn: null,
  exportBtn: null,
  saveBtn: null,

  // Recording state
  layers: [],
  recording: false,
  recordStartGeneration: 0,
  recChunks: null,
  processor: null,
  silent: null,
  tapSource: null,
  tapPromise: null,
  recorderFlushResolve: null,

  // Press / gesture state
  pressTimer: null,
  longFired: false,
  pendingTap: null,

  // Track panel / sheet state
  trackPanelEl: null,
  trackPanelKeyHandler: null,
  trackPanelProgressTimer: null,
  openSheetIndex: -1,
  sheetEl: null,
  sheetPointerHandler: null,
  sheetKeyHandler: null,

  // Sync / timing state
  syncModeIndex: 1,
  pendingLoopStop: false,
  pendingLoopStopTimer: null,
  progressRaf: 0,
  countInEnabled: false,
  countInBars: 1,
  countInPending: false,
  countInCurrent: 0,
  countInTimer: null,
  metronomeOn: false,
  metronomeTimer: null,
  bpm: 90,
  beatsPerBar: 4,
  clickType: 'woodblock',
  lastTapTimes: [],
  timingMenu: null,
  timingMenuType: null,
  timingPressTimer: null,
  timingLongFired: false,
  bpmPointer: null,
};
