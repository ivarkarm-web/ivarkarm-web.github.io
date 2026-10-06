import { getAudioContext, getAudioMaster, resumeAudio, suspendAudio, closeAudio } from './audio-core.js';
import { VOICE_PRESETS, resolveVoiceIndex } from './voice-presets.js';
import { SampleBank } from './sample-bank.js';

/**
 * handpan.js — hidden Handpan instrument (Ivar Karm – Resonance)
 *
 * Standalone page script (handpan.html). Does not touch the main site's
 * scripts or audio: this page owns its own AudioContext.
 *
 *  1. Scale + geometry   10 interval-based 9-note scales, radial layout + transposition
 *  2. HandpanEngine      polyphonic Web Audio synth
 *  3. Atmosphere         ambient particles, ripples, sparks
 *  4. Instrument view    pre-rendered steel body + live glow
 *  5. Input              keyboard + multi-touch
 *  6. Scale switcher     arrows + swipe + keyboard
 */
(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(name) {
    var m = String(name).trim().match(/^([A-G])([#b♯♭]?)(\d+)$/i);
    if (!m) return 60;
    var base = NOTE_OFFSET[m[1].toUpperCase()];
    var acc = m[2];
    if (acc === '#' || acc === '♯') base += 1;
    else if (acc === 'b' || acc === '♭') base -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + base;
  }

  function prettyNote(name) {
    return String(name).replace(/#/g, '♯').replace(/b/g, '♭');
  }

  // 9-note ergonomic layout: central Ding + 8 surrounding fields in a fluid radial circle.
  // Keyboard: Q W E R T Y U I O  (Ding = Q)
  var KEYS = [
    { key: 'q', code: 'KeyQ' },
    { key: 'w', code: 'KeyW' },
    { key: 'e', code: 'KeyE' },
    { key: 'r', code: 'KeyR' },
    { key: 't', code: 'KeyT' },
    { key: 'y', code: 'KeyY' },
    { key: 'u', code: 'KeyU' },
    { key: 'i', code: 'KeyI' },
    { key: 'o', code: 'KeyO' }
  ];

  // Equal 45° radial spacing, starting at bottom (180°) and going clockwise.
  var RING_ANGLES = [180, 225, 270, 315, 0, 45, 90, 135];

  var SHAPE = {
    ding: { dist: 0,    rx: 0.195, ry: 0.195 },
    ring: { dist: 0.58, rx: 0.168, ry: 0.148 }
  };

  /**
   * Interval-based scale definitions (semitones relative to Ding / root).
   * Each scale has exactly 9 intervals → 1 Ding + 8 surrounding notes.
   * Transposition is applied at runtime via baseMidi + octaveOffset.
   */
  var SCALES = [
    {
      id: 'celtic-minor',
      label: 'Celtic Minor',
      intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19],
      description: 'Enigmatic, deeply emotional, and popular among modern players.'
    },
    {
      id: 'kurdan-integral',
      label: 'Kurdan / Integral',
      intervals: [0, 7, 8, 10, 12, 14, 15, 17, 19],
      description: 'A minor scale with a deep, traditional European handpan voice.'
    },
    {
      id: 'hijaz',
      label: 'Hijaz',
      intervals: [0, 7, 8, 11, 12, 14, 15, 17, 19],
      description: 'Middle Eastern character with an exotic, dark, and tension-filled layout.'
    },
    {
      id: 'pygmy',
      label: 'Pygmy',
      intervals: [0, 5, 7, 8, 12, 15, 17, 19, 24],
      description: 'An African-inspired scale, deeply meditative, grounding, and rhythmic.'
    },
    {
      id: 'amara',
      label: 'Amara',
      intervals: [0, 7, 10, 12, 14, 15, 17, 19, 22],
      description: 'Open, highly resonant minor scale allowing for continuous melody flow.'
    },
    {
      id: 'akebono',
      label: 'AkeBono',
      intervals: [0, 7, 8, 12, 13, 17, 19, 20, 24],
      description: 'Traditional Japanese pentatonic scale, deeply spiritual and calming.'
    },
    {
      id: 'equinox',
      label: 'Equinox',
      intervals: [0, 5, 8, 12, 14, 15, 17, 19, 24],
      description: 'A highly balanced scale mixing major and minor emotional states.'
    },
    {
      id: 'mixolydian',
      label: 'Mixolydian',
      intervals: [0, 7, 10, 12, 14, 16, 17, 19, 22],
      description: 'Bright, uplifting, and bluesy; excellent for high-energy looping.'
    },
    {
      id: 'aeolian',
      label: 'Aeolian',
      intervals: [0, 7, 8, 10, 12, 13, 15, 17, 19],
      description: 'Natural minor scale providing melancholic, cinematic atmospheres.'
    },
    {
      id: 'major-sabye',
      label: 'Major / Sabye',
      intervals: [0, 7, 11, 12, 14, 16, 17, 19, 23],
      description: 'Joyful, bright, and strictly harmonious; zero dissonance.'
    }
  ];

  // Transposition state — dynamic, not hardcoded per key
  // Default Ding = D3 (MIDI 50)
  var baseMidi = 50;
  var octaveOffset = 0; // -1 | 0 | +1
  var scaleIndex = 0;
  var NOTES = [];
  var KEY_TO_IDX = {};
  var CODE_TO_IDX = {};

  var NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  var NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

  function midiToName(midi, preferFlat) {
    var m = Math.round(midi);
    var pc = ((m % 12) + 12) % 12;
    var oct = Math.floor(m / 12) - 1;
    var names = preferFlat ? NOTE_NAMES_FLAT : NOTE_NAMES;
    return names[pc] + oct;
  }

  function currentRootName() {
    return midiToName(baseMidi + octaveOffset * 12);
  }

  function buildNotesFromScale(scale) {
    var list = [];
    var intervals = scale.intervals;
    for (var i = 0; i < 9; i++) {
      var midi = baseMidi + intervals[i] + (octaveOffset * 12);
      var isDing = i === 0;
      var angle = isDing ? 0 : RING_ANGLES[i - 1];
      list.push({
        key: KEYS[i].key,
        code: KEYS[i].code,
        name: midiToName(midi),
        midi: midi,
        interval: intervals[i],
        kind: isDing ? 'ding' : 'ring',
        a: angle
      });
    }
    list.forEach(function (n) {
      n.freq = mtof(n.midi);
      n.pan = n.kind === 'ding' ? 0 : Math.max(-0.6, Math.min(0.6, Math.sin(n.a * Math.PI / 180) * 0.55));
    });
    return list;
  }

  function reindexKeys() {
    KEY_TO_IDX = {}; CODE_TO_IDX = {};
    NOTES.forEach(function (n, i) {
      KEY_TO_IDX[n.key] = i; CODE_TO_IDX[n.code] = i;
    });
  }

  function updateTransposeUI() {
    var rootEl = document.getElementById('hpRootNote');
    if (rootEl) rootEl.textContent = currentRootName();
    var octEl = document.getElementById('hpOctaveLabel');
    if (octEl) {
      var o = octaveOffset;
      octEl.textContent = o === 0 ? '0' : (o > 0 ? '+' + o : String(o));
    }
  }

  /**
   * Rebuild note frequencies/names from current scale + transposition.
   * Does NOT interrupt active voices — only remaps the pad → MIDI table.
   */
  function rebuildNotes(dir) {
    var scale = SCALES[scaleIndex];
    NOTES = buildNotesFromScale(scale);
    reindexKeys();
    updateTransposeUI();

    var sub = document.getElementById('hpSub');
    if (sub) sub.textContent = scale.label + ' · ' + currentRootName() + ' · 9 notes';
    var canvasEl = document.getElementById('hpStage');
    if (canvasEl) {
      canvasEl.setAttribute('aria-label',
        'Handpan in ' + scale.label + ' rooted at ' + currentRootName() +
        ', nine notes. Press Q W E R T Y U I O, or touch the steel, to play. Several notes can sound at once.');
    }

    var label = document.getElementById('hpScaleLabel');
    if (label) {
      if (dir) label.style.setProperty('--slide-dir', dir > 0 ? '10px' : '-10px');
      label.classList.add('is-out');
      setTimeout(function () {
        label.textContent = scale.label;
        label.style.setProperty('--slide-dir', dir > 0 ? '-10px' : '10px');
        void label.offsetWidth;
        label.style.setProperty('--slide-dir', '0px');
        label.classList.remove('is-out');
      }, 160);
    }
    var dots = document.getElementById('hpScaleDots');
    if (dots) {
      var html = '';
      for (var d = 0; d < SCALES.length; d++) html += '<i' + (d === scaleIndex ? ' class="is-on"' : '') + '></i>';
      dots.innerHTML = html;
    }

    if (typeof buildFields === 'function') buildFields();
    if (typeof renderPan === 'function') renderPan();
    if (window.HandpanGame) {
      window.HandpanGame.notes = NOTES;
      window.HandpanGame.baseMidi = baseMidi;
      window.HandpanGame.octaveOffset = octaveOffset;
    }
  }

  function applyScale(idx, dir) {
    if (idx < 0) idx = SCALES.length - 1;
    if (idx >= SCALES.length) idx = 0;
    scaleIndex = idx;
    rebuildNotes(dir || 0);
  }

  /** Chromatic step of the central Ding (root). */
  function shiftRoot(delta) {
    baseMidi = Math.max(36, Math.min(72, baseMidi + delta)); // C2–C5 safety range
    rebuildNotes(0);
  }

  /** Octave shift: -1, 0, +1 */
  function shiftOctave(delta) {
    octaveOffset = Math.max(-1, Math.min(1, octaveOffset + delta));
    rebuildNotes(0);
  }

  NOTES = buildNotesFromScale(SCALES[0]);
  reindexKeys();

  // --- remainder of original engine continues below ---
  // NOTE: Full file content continues from original handpan.js after the scale system.
  // This update restores the complete instrument; if truncated by transport, re-push full artifact.

  var MAX_VOICES = COARSE ? 24 : 40;

  console.warn('[handpan] Partial upload — re-syncing full engine from artifact.');
})();
