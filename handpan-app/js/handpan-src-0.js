export default `import { getAudioContext, getAudioMaster, resumeAudio, suspendAudio, closeAudio } from './audio-core.js';
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
    var m = String(name).trim().match(/^([A-G])([#b♯♭]?)(\\d+)$/i);
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
  // Matches a natural handpan "circle of notes" feel (Oval-style ergonomics).
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
      intervals:`;
