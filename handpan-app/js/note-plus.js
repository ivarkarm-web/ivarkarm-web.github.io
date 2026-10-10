/**
 * note-plus.js — the little "+" above the music player.
 * Each press adds the next note of the current scale (9 → 13 notes).
 */
import { MIN_NOTES, MAX_NOTES } from './pad-layout.js';

export function mountNotePlus() {
  const wrap = document.getElementById('notePlusWrap');
  const btn = document.getElementById('notePlus');
  const count = document.getElementById('notePlusCount');
  const core = window.PionierCore;
  const handpan = core && core.handpan;
  if (!wrap || !btn) return;

  // Stale cached engine without note growth: hide rather than show a dead button.
  if (!core || !handpan || typeof handpan.addNote !== 'function' || typeof core.addNote !== 'function') {
    wrap.hidden = true;
    return;
  }

  function sync() {
    const n = handpan.noteCount ?? MIN_NOTES;
    const onHandpan = core.activeInstrument() === handpan;
    const atMax = n >= MAX_NOTES;
    if (count) count.textContent = n + '/' + MAX_NOTES;
    btn.disabled = atMax || !onHandpan;
    if (atMax) {
      btn.title = 'Maximum of ' + MAX_NOTES + ' notes reached';
    } else if (!onHandpan) {
      btn.title = 'Switch to Handpan to add notes';
    } else {
      btn.title = 'Add the next scale note (' + n + ' of ' + MAX_NOTES + ')';
    }
    btn.setAttribute('aria-label', btn.title);
    wrap.classList.toggle('is-full', atMax);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    if (core.addNote()) {
      btn.classList.remove('is-pulse');
      void btn.offsetWidth;
      btn.classList.add('is-pulse');
    }
    sync();
  });

  // The voice name changes whenever the instrument does.
  const voiceName = document.getElementById('instrumentDropdownToggle');
  if (voiceName && typeof MutationObserver === 'function') {
    new MutationObserver(sync).observe(voiceName, { childList: true, characterData: true, subtree: true });
  }

  sync();
}
