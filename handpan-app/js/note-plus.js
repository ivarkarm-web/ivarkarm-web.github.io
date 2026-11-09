/** note-plus.js — note-count UI removed (Phase 1). */
export function mountNotePlus() {
  const wrap = document.getElementById('notePlusWrap');
  if (wrap) {
    wrap.hidden = true;
    wrap.setAttribute('hidden', '');
    wrap.style.display = 'none';
  }
  ['notePlus', 'noteMinus', 'noteCountPrev', 'noteCountNext', 'noteCountLabel'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  });
}
