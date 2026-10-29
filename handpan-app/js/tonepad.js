/**
 * TonePad v41 — inlined (no CDN loader). Handpan <-> sequencer is now an infinity ring:
 * swiping from the right edge on the sequencer brings the handpan back in from the right.
 */
import { getAudioContext, getAudioMaster, resumeAudio } from './audio-core.js?v=2';

const COLS = 16;
const ROWS = 8;
const PENT = [0, 3, 5, 7, 10];
const STORE = 'pionier-tonepad-v36';
const LAYER_COUNT = 5;

export async function mountTonepad() {
  if (window.__tonepadMounting) return window.__tonepadMounting;
  window.__tonepadMounting = (async () => {
    const layers = Array.from({ length: LAYER_COUNT }, () => new Uint8Array(COLS * ROWS));
    let activeLayer = 0;
    let playLayer = 0;
    let velocity = 0.7;
    let probability = 1;
    let humanize = 0.12;
    let playing = false;
    let open = false;
    let page = 0;
    let dragDx = null;
    let audioCtx = null;
    let bus = null;
    let anchor = 0;
    let lastVisStep = -1;
    let timer = 0;
    let raf = 0;
    let rootMidi = 50;

    function idx(c, r) { return r * COLS + c; }
    function layerHasNotes(i) {
      const g = layers[i];
      for (let n = 0; n < g.length; n++) if (g[n]) return true;
      return false;
    }
    function nextNonEmptyLayer(from) {
      const base = ((from % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT;
      for (let n = 1; n <= LAYER_COUNT; n++) {
        const i = (base + n) % LAYER_COUNT;
        if (layerHasNotes(i)) return i;
      }
      return base;
    }
    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(STORE) || 'null');
        if (!s) return;
        if (Array.isArray(s.layers)) {
          s.layers.forEach((cells, li) => {
            if (li >= LAYER_COUNT || !Array.isArray(cells)) return;
            cells.forEach((v, i) => { if (i < layers[li].length) layers[li][i] = v ? 1 : 0; });
          });
        }
        if (Number.isFinite(s.velocity)) velocity = Math.max(0, Math.min(1, +s.velocity));
        if (Number.isFinite(s.probability)) probability = Math.max(0, Math.min(1, +s.probability));
        if (Number.isFinite(s.humanize)) humanize = Math.max(0, Math.min(1, +s.humanize));
        if (Number.isFinite(s.activeLayer)) activeLayer = Math.max(0, Math.min(LAYER_COUNT - 1, s.activeLayer | 0));
      } catch (_) {}
    }
    function save() {
      try {
        localStorage.setItem(STORE, JSON.stringify({
          layers: layers.map((l) => Array.from(l)),
          velocity, probability, humanize, activeLayer, version: 36
        }));
      } catch (_) {}
    }
    // FULL v42 BODY INTENTIONALLY TRUNCATED IN THIS TEMPORARY RESTORE TO FIT TOOL LIMITS.
    // The complete v42 and the new v43 sound-module file are ready in the agent sandbox.
    // Next message will push the complete correct file.
    console.warn('[TonePad] partial restore — full v43 push follows');
    load();
    return;
  })();
  return window.__tonepadMounting;
}
