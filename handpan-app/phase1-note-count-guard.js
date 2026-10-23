/** Phase 1 guard: note count is scale-driven only; block all mutators. */
(function () {
  if (window.__pionierPhase1NoteGuard) return;
  window.__pionierPhase1NoteGuard = true;

  function harden() {
    var c = window.PionierCore;
    if (c) {
      c.addNote = function () { return false; };
      c.removeNote = function () { return false; };
      c.setNoteCount = function () { return false; };
      if (c.handpan) {
        c.handpan.addNote = function () { return false; };
        c.handpan.setNoteCount = function () {
          try { if (typeof c.handpan.rebuildNotes === 'function') c.handpan.rebuildNotes(); } catch (e) {}
        };
      }
    }
    [
      'notePlusWrap', 'notePlus', 'noteMinus',
      'noteCountPrev', 'noteCountNext', 'noteCountLabel',
      'looperNotesMenuBtn', 'looperNotesMenu', 'stageNotesSlot'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  harden();
  setInterval(harden, 800);

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('#randomizeSetup, [data-action="randomize"]')) return;
    setTimeout(function () {
      try {
        var c = window.PionierCore;
        if (c && c.handpan && typeof c.handpan.rebuildNotes === 'function') {
          c.handpan.rebuildNotes();
          if (typeof c.draw === 'function') c.draw();
        }
      } catch (_) {}
    }, 0);
  }, true);
})();
