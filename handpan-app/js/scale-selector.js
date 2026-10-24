/** Searchable scale picker. Overlay ownership remains in overlay-controller.js. */
import { HANDPAN_SCALES } from './instruments/handpan.js?v=12';

export function mountScaleSelector({ getHandpan, onScaleChange }) {
  const menu = document.getElementById('scaleMenu'); const toggle = document.getElementById('scaleLabel');
  if (!menu || !toggle) return { render() {}, updateLabel() {} };
  function updateLabel() { const handpan = getHandpan(); if (!handpan) return; const s = HANDPAN_SCALES[handpan.scaleIndex]; let short = s?.short || s?.label || handpan.scaleLabel || 'Scale'; const full = s?.label || handpan.scaleLabel || short; const root = handpan.rootLabel || ''; if (root && short.startsWith(root + ' ')) short = short.slice(root.length).trim(); toggle.textContent = short + ' \u25be'; toggle.title = full; const rootLabel = document.getElementById('rootLabel'); if (rootLabel && root) rootLabel.textContent = root; }
  function render() {
    const handpan = getHandpan(); if (!handpan) return; menu.replaceChildren();
    const results = document.createElement('div'); results.className = 'picker-results scale-menu-results'; menu.appendChild(results);
    let lastTuning = null; let section = null;
    HANDPAN_SCALES.forEach((scale, index) => {
      const tuning = scale.tuning || '12-TET';
      if (tuning !== lastTuning) { lastTuning = tuning; section = document.createElement('section'); section.className = 'picker-group scale-picker-group'; const head = document.createElement('div'); head.className = 'scale-menu-group'; head.textContent = tuning; section.appendChild(head); results.appendChild(section); }
      const row = document.createElement('div');
      row.className = 'scale-menu-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', scale.label || scale.short || 'Scale');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scale-menu-item pionier-menu-option' + (index === handpan.scaleIndex ? ' is-active' : '');
      button.setAttribute('role', 'menuitem');
      button.dataset.searchText = [scale.label, scale.short, tuning, scale.root, scale.id].filter(Boolean).join(' ').toLowerCase();
      const name = document.createElement('span');
      name.textContent = scale.label;
      button.appendChild(name);
      if (tuning !== '12-TET') {
        const sub = document.createElement('span');
        sub.className = 'scale-item-tuning';
        sub.textContent = tuning;
        button.appendChild(sub);
      }
      button.addEventListener('click', (e) => { e.stopPropagation(); handpan.setScaleIndex(index); onScaleChange?.(); render(); updateLabel(); if (window.PionierOverlay) window.PionierOverlay.closePickers(); else { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } toggle.focus?.(); });
      row.appendChild(button);
      try { window.PionierFavorites?.decorateScaleItem?.(button, scale, index); } catch (_) {}
      section.appendChild(row);
    });

  }
  const mo = new MutationObserver(() => { if (!menu.hidden) render(); }); mo.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('pionier:picker-open', (e) => { if (e.detail?.id === 'scaleMenu') render(); }); updateLabel(); return { render, updateLabel };
}
