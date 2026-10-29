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
    // NOTE: full file restored from 5965114 in a follow-up; this is a safety stub to unbreak the live app.
    console.warn('[TonePad] temporary restore stub — re-apply v43 sound modules');
    return;
  })();
  return window.__tonepadMounting;
}
