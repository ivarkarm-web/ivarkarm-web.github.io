/** Searchable scale picker. Overlay ownership remains in overlay-controller.js. */
import { HANDPAN_SCALES } from './instruments/handpan.js?v=10';

export function mountScaleSelector({ getHandpan, onScaleChange }) {
  const menu = document.getElementById('scaleMenu'); const toggle = document.getElementById('scaleLabel');
  if (!menu || !toggle) return { render() {}, updateLabel() {} };
  function updateLabel() { const handpan = getHandpan(); if (!handpan) return; const s = HANDPAN_SCALES[handpan.scaleIndex]; const short = s?.short || s?.label || handpan.scaleLabel || 'Scale'; const full = s?.label || handpan.scaleLabel || short; toggle.textContent = short + ' ▾'; toggle.title = full; }
  function render() {
    const handpan = getHandpan(); if (!handpan) return; const queryBeforeRender = menu.querySelector('.picker-search')?.value || ''; menu.replaceChildren();
    const search = document.createElement('input'); search.type = 'search'; search.className = 'picker-search scale-menu-search'; search.placeholder = 'Search scales…'; search.setAttribute('aria-label', 'Search scales'); search.setAttribute('role', 'searchbox'); search.autocomplete = 'off'; search.spellcheck = false; search.value = queryBeforeRender; menu.appendChild(search);
    const results = document.createElement('div'); results.className = 'picker-results scale-menu-results'; menu.appendChild(results);
    let lastTuning = null; let section = null;
    HANDPAN_SCALES.forEach((scale, index) => {
      const tuning = scale.tuning || '12-TET';
      if (tuning !== lastTuning) { lastTuning = tuning; section = document.createElement('section'); section.className = 'picker-group scale-picker-group'; const head = document.createElement('div'); head.className = 'scale-menu-group'; head.textContent = tuning; section.appendChild(head); results.appendChild(section); }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'scale-menu-item' + (index === handpan.scaleIndex ? ' is-active' : ''); button.setAttribute('role', 'menuitem'); button.dataset.searchText = [scale.label, scale.short, tuning, scale.root, scale.id].filter(Boolean).join(' ').toLowerCase();
      const name = document.createElement('span'); name.textContent = scale.label; button.appendChild(name); if (tuning !== '12-TET') { const sub = document.createElement('span'); sub.className = 'scale-item-tuning'; sub.textContent = tuning; button.appendChild(sub); }
      button.addEventListener('click', (e) => { e.stopPropagation(); handpan.setScaleIndex(index); onScaleChange?.(); render(); updateLabel(); if (window.PionierOverlay) window.PionierOverlay.closePickers(); else { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } toggle.focus?.(); }); section.appendChild(button);
    });
    const empty = document.createElement('div'); empty.className = 'picker-empty'; empty.textContent = 'No scales found'; empty.hidden = true; results.appendChild(empty);
    const filter = () => { const q = search.value.trim().toLowerCase(); let total = 0; results.querySelectorAll('.picker-group').forEach((group) => { let count = 0; group.querySelectorAll('.scale-menu-item').forEach((button) => { const show = !q || button.dataset.searchText.includes(q); button.hidden = !show; if (show) count++; }); group.hidden = count === 0; total += count; }); empty.hidden = total !== 0; };
    search.addEventListener('input', filter); search.addEventListener('keydown', (e) => { if (['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) e.stopPropagation(); }); filter();
  }
  const mo = new MutationObserver(() => { if (!menu.hidden) render(); }); mo.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('pionier:picker-open', (e) => { if (e.detail?.id === 'scaleMenu') render(); }); updateLabel(); return { render, updateLabel };
}