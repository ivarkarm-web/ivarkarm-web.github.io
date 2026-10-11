/** Shared 9–13 note-count controls for every Pionier instrument. */
import { MIN_NOTES, MAX_NOTES } from './pad-layout.js';

export function mountNotePlus() {
  const wrap = document.getElementById('notePlusWrap');
  const plus = document.getElementById('notePlus');
  const count = document.getElementById('notePlusCount');
  const core = window.PionierCore;
  if (!wrap || !plus || !core || typeof core.addNote !== 'function' || typeof core.removeNote !== 'function') {
    if (wrap) wrap.hidden = true;
    return;
  }

  let minus = document.getElementById('noteMinus');
  if (!minus) {
    minus = document.createElement('button');
    minus.type = 'button';
    minus.id = 'noteMinus';
    minus.className = 'note-plus note-minus';
    minus.innerHTML = '<span class="note-minus-icon" aria-hidden="true"></span>';
    minus.setAttribute('aria-label', 'Remove the last note');
    minus.title = 'Remove the last note';
    plus.insertAdjacentElement('afterend', minus);
  }

  function sync() {
    const n = typeof core.noteCount === 'function' ? core.noteCount() : (core.handpan?.noteCount ?? MIN_NOTES);
    const atMin = n <= MIN_NOTES;
    const atMax = n >= MAX_NOTES;
    if (count) count.textContent = n + '/' + MAX_NOTES;
    plus.disabled = atMax;
    plus.title = atMax ? 'Maximum of ' + MAX_NOTES + ' notes reached' : 'Add a note (' + n + ' of ' + MAX_NOTES + ')';
    plus.setAttribute('aria-label', plus.title);
    minus.disabled = atMin;
    minus.title = atMin ? 'Minimum of ' + MIN_NOTES + ' notes' : 'Remove the last note (' + n + ' total)';
    minus.setAttribute('aria-label', minus.title);
    wrap.classList.toggle('is-full', atMax);
    wrap.classList.toggle('is-minimum', atMin);
  }

  plus.addEventListener('click', (e) => {
    e.stopPropagation();
    if (plus.disabled) return;
    if (core.addNote()) {
      plus.classList.remove('is-pulse');
      void plus.offsetWidth;
      plus.classList.add('is-pulse');
    }
    sync();
  });
  minus.addEventListener('click', (e) => {
    e.stopPropagation();
    if (minus.disabled) return;
    core.removeNote();
    sync();
  });

  const voiceName = document.getElementById('instrumentDropdownToggle');
  if (voiceName && typeof MutationObserver === 'function') {
    new MutationObserver(sync).observe(voiceName, { childList: true, characterData: true, subtree: true });
  }
  sync();
}
