/** Phase 1 guard: hide manual note-count controls; only the randomizer may choose 8–13 notes. */
(function () {
  if (window.__pionierPhase1NoteGuardV3) return;
  window.__pionierPhase1NoteGuardV3 = true;

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

  function wireRandomize() {
    var btn = document.getElementById('randomizeSetup');
    if (!btn || btn.dataset.phase1Random === '3') return;
    // Re-bind if an older phase1 handler was attached
    if (btn.dataset.phase1Random && btn.dataset.phase1Random !== '3') {
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      btn = clone;
    }
    btn.dataset.phase1Random = '3';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (btn.dataset.rolling === '1') return;
      btn.dataset.rolling = '1';
      btn.classList.add('is-rolling');

      (async function () {
        try {
          var c = window.PionierCore;
          try { if (c && c.ensureAudio) c.ensureAudio(); } catch (_) {}
          // Full randomize: instrument + scale + note count (8–13).
          if (c && typeof c.randomizeSetup === 'function') {
            await c.randomizeSetup();
          } else {
            var steps = 1 + Math.floor(Math.random() * 5);
            for (var i = 0; i < steps; i++) {
              var nextBtn = document.getElementById('voiceNext');
              if (nextBtn) nextBtn.click();
            }
            var handpan = c && c.handpan;
            var scales = window.HANDPAN_SCALES || [];
            if (handpan && scales.length > 1) {
              var next = Math.floor(Math.random() * scales.length);
              if (next === handpan.scaleIndex) next = (next + 1) % scales.length;
              handpan.setScaleIndex(next);
              if (c.refreshPitch) c.refreshPitch();
              if (c.draw) c.draw();
              var label = document.getElementById('scaleLabel');
              var scale = scales[next];
              if (label && scale) label.textContent = (scale.short || scale.label || 'Scale') + ' \u25BE';
            }
            if (handpan) {
              handpan.noteCount = 8 + Math.floor(Math.random() * 6);
              if (typeof handpan.rebuildNotes === 'function') handpan.rebuildNotes();
              if (c.refreshPitch) c.refreshPitch();
            }
          }
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
})();
