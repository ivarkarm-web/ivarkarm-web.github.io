/**
 * note-count-fix.js — make +/- note controls reliable.
 *
 * Root causes:
 * 1) PionierCore.noteCount() preferred activeInstrument().getNotes().length.
 *    Library voices fill 14 pitch slots, so the counter stuck at 14/14 and + was disabled.
 * 2) changeNoteCount hard-capped at 13 while the UI / pad-layout allow 14.
 *
 * This patch always drives handpan.noteCount (9–14) and refreshes the layout.
 */
(function noteCountFix() {
  const MIN = 9;
  const MAX = 14;

  function apply() {
    const core = window.PionierCore;
    const handpan = core && core.handpan;
    if (!core || !handpan || typeof handpan.setNoteCount !== 'function') return false;
    if (core.__noteCountFixed) return true;

    function current() {
      return Number.isFinite(handpan.noteCount) && handpan.noteCount > 0
        ? handpan.noteCount
        : MIN;
    }

    function setCount(n) {
      const before = current();
      const after = Math.max(MIN, Math.min(MAX, Math.round(n) || MIN));
      if (after === before) return false;
      handpan.setNoteCount(after);
      if (typeof core.refreshPitch === 'function') core.refreshPitch();
      else {
        try { handpan.rebuildNotes?.(); } catch (_) {}
        try { core.draw?.(); } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('pionier:note-count', { detail: { count: after } }));
      return true;
    }

    core.noteCount = () => current();
    core.addNote = () => setCount(current() + 1);
    core.removeNote = () => setCount(current() - 1);
    core.__noteCountFixed = true;
    return true;
  }

  function boot() {
    if (apply()) return;
    let n = 0;
    const id = setInterval(() => {
      if (apply() || ++n > 80) clearInterval(id);
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', () => apply());
})();
