/** Phase 1 guard: note count is scale-driven only; block mutators + randomize pad count. */
(function () {
  if (window.__pionierPhase1NoteGuard) return;
  window.__pionierPhase1NoteGuard = true;

  function hardenCore() {
    var c = window.PionierCore;
    if (!c) return;
    c.addNote = function () { return false; };
    c.removeNote = function () { return false; };
    c.setNoteCount = function () { return false; };
    if (c.handpan) {
      c.handpan.addNote = function () { return false; };
      c.handpan.setNoteCount = function () {
        try {
          if (typeof c.handpan.rebuildNotes === 'function') c.handpan.rebuildNotes();
        } catch (e) {}
      };
    }
  }

  function hideNoteCountUI() {
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

  function scaleNoteCount(scale) {
    if (!scale) return 0;
    if (Array.isArray(scale.intervals)) return scale.intervals.length;
    if (Array.isArray(scale.cents)) return scale.cents.length;
    return 0;
  }

  function wireRandomize() {
    var btn = document.getElementById('randomizeSetup');
    if (!btn || btn.dataset.phase1Random === '1') return;
    btn.dataset.phase1Random = '1';

    // Capture-phase handler: run our randomize and stop the old one that setNoteCount(8-13).
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (btn.dataset.rolling === '1') return;
      btn.dataset.rolling = '1';
      btn.classList.add('is-rolling');

      (async function () {
        try {
          try { window.PionierCore && window.PionierCore.ensureAudio && window.PionierCore.ensureAudio(); } catch (_) {}
          var c = window.PionierCore;
          var handpan = c && c.handpan;
          var scales = window.HANDPAN_SCALES || [];
          if (handpan && scales.length > 1) {
            var currentCount = scaleNoteCount(scales[handpan.scaleIndex]) || handpan.noteCount || 0;
            // Prefer scales with the same pad count so randomize does not grow/shrink pads.
            var same = [];
            for (var i = 0; i < scales.length; i++) {
              if (i === handpan.scaleIndex) continue;
              if (scaleNoteCount(scales[i]) === currentCount) same.push(i);
            }
            var pool = same.length ? same : scales.map(function (_, i) { return i; }).filter(function (i) { return i !== handpan.scaleIndex; });
            if (!pool.length) pool = [handpan.scaleIndex];
            var next = pool[Math.floor(Math.random() * pool.length)];
            handpan.setScaleIndex(next);
            if (c.refreshPitch) c.refreshPitch();
            if (c.draw) c.draw();
            var label = document.getElementById('scaleLabel');
            var scale = scales[next];
            if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' \u25BE';
          }
          // Intentionally do NOT call setNoteCount / addNote.
        } catch (err) {
          console.warn('[phase1-randomize]', err);
        } finally {
          delete btn.dataset.rolling;
          btn.classList.remove('is-rolling');
        }
      })();
    }, true);
  }

  function tick() {
    hardenCore();
    hideNoteCountUI();
    wireRandomize();
  }

  tick();
  setInterval(tick, 800);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  }
})();
