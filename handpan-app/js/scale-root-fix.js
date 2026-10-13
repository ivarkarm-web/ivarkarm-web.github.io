/**
 * scale-root-fix.js
 * On main, HandpanInstrument.setScaleIndex only changed intervals — not the root.
 * This wraps setScaleIndex so the root follows the scale name (e.g. B2, F3, C4).
 */
(function scaleRootFix() {
  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  function midiFromLabel(label) {
    if (!label) return null;
    const clean = String(label).replace(/\s*▾\s*$/, '').split('·')[0].trim();
    const m = clean.match(/^([A-G])([♯#b♭]?)(\d)\b/i);
    if (!m) return null;
    let name = m[1].toUpperCase() + (m[2] || '');
    name = name.replace('#', '♯').replace('b', '♭');
    const flats = { 'D♭': 'C♯', 'E♭': 'D♯', 'G♭': 'F♯', 'A♭': 'G♯', 'B♭': 'A♯', Db: 'C♯', Eb: 'D♯', Gb: 'F♯', Ab: 'G♯', Bb: 'A♯' };
    if (flats[name]) name = flats[name];
    const pc = NOTE_NAMES.indexOf(name);
    if (pc < 0) return null;
    const oct = parseInt(m[3], 10);
    return (oct + 1) * 12 + pc; // MIDI: C4=60, D3=50
  }

  function applyRootFromMidi(handpan, midi) {
    let bestPc = 0, bestOct = 0, bestDist = 999;
    for (let o = -1; o <= 1; o++) {
      for (let p = 0; p < 12; p++) {
        const mm = 48 + p + o * 12;
        const d = Math.abs(mm - midi);
        if (d < bestDist) { bestDist = d; bestPc = p; bestOct = o; }
      }
    }
    handpan.rootIndex = bestPc;
    handpan.octaveOffset = bestOct;
    if (typeof handpan.rebuildNotes === 'function') handpan.rebuildNotes();
  }

  function syncLabels(handpan) {
    const rootEl = document.getElementById('rootLabel');
    const octEl = document.getElementById('octLabel');
    if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
    if (octEl) {
      const o = handpan.octaveOffset ?? 0;
      octEl.textContent = o === 0 ? '0' : o > 0 ? '+' + o : String(o);
    }
    try { window.PionierCore?.draw?.(); } catch (_) {}
    try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  }

  function patch() {
    const core = window.PionierCore;
    const handpan = core?.handpan;
    if (!handpan || typeof handpan.setScaleIndex !== 'function') return false;
    if (handpan.__rootFromScaleFixed) return true;

    const original = handpan.setScaleIndex.bind(handpan);
    handpan.setScaleIndex = function (i) {
      original(i);
      try {
        const label = this.scaleLabel || '';
        const midi = midiFromLabel(label);
        if (midi != null) applyRootFromMidi(this, midi);
      } catch (err) {
        console.warn('[scale-root-fix]', err);
      }
      syncLabels(this);
    };

    handpan.__rootFromScaleFixed = true;
    console.info('[scale-root-fix] setScaleIndex now maps root from scale name');
    return true;
  }

  function boot() {
    if (patch()) return;
    setTimeout(boot, 150);
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
