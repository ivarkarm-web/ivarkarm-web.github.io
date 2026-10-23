/** Phase 1 guard: disable public note-count mutators; hide leftover UI. */
(function () {
  if (window.__pionierPhase1NoteGuard) return;
  window.__pionierPhase1NoteGuard = true;
  function apply() {
    var c = window.PionierCore;
    if (c) {
      c.addNote = function () { return false; };
      c.removeNote = function () { return false; };
      c.setNoteCount = function () { return false; };
      if (c.handpan) {
        c.handpan.addNote = function () { return false; };
        c.handpan.setNoteCount = function () {
          try { c.handpan.rebuildNotes(); } catch (e) {}
        };
      }
    }
    ['notePlusWrap', 'notePlus', 'noteMinus', 'noteCountPrev', 'noteCountNext', 'noteCountLabel', 'looperNotesMenuBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.style.display = 'none';
    });
  }
  apply();
  setInterval(apply, 1000);
})();
