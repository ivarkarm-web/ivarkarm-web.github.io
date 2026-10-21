/**
 * pionier-core -- instrument surface + audio graph
 * Local vendored core (no remote fetch / string-patch boot).
 * Looper v2: exposes getInstrumentBus for pre-FX recording
 */
import { getAudioContext, getAudioMaster, resumeAudio, audioState } from './js/audio-core.js?v=2';
import { InstrumentRegistry } from './js/instrument.js';
import { GestureTracker, gestureFromPointer } from './js/gesture.js';
import { HandpanInstrument, HANDPAN_SCALES } from './js/instruments/handpan.js?v=11';
import { createLibraryInstruments } from './js/instruments/library-family.js?v=3';
import { FxChain } from './js/fx.js';
import { CatchMode } from './js/catch-mode.js?v=4';
import { isDebugEnabled, mountDebugPanel } from './js/debug.js';
import { createSurface } from './js/pionier-surface.js?v=146';
import { MIN_NOTES, MAX_NOTES } from './js/pad-layout.js';

const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f'];
const PITCH_BEND_PIXELS = 90;
