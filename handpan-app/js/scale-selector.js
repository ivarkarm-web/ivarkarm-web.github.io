/**
 * scale-selector.js — scale list UI only. Open/close owned by overlay-controller.
 */
import { HANDPAN_SCALES } from './instruments/handpan.js?v=10';

/**
 * @param {object} opts
 * @param {() => import('./instruments/handpan.js').HandpanInstrument} opts.getHandpan
 * @param {() => void} opts.onScaleChange
 */
export function mountScaleSelector({ getHandpan, onScaleChange }) {
  const menu = document.getElementById('scaleMenu');
  const toggle = document.getElementById('scaleLabel');
  if (!menu || !toggle) return { render() {}, updateLabel() {} };

  function updateLabel() {
    const handpan = getHandpan();
    if (!handpan) return;
    const s = HANDPAN_SCALES[handpan.scaleIndex];
    const short = s?.short || s?.label || handpan.scaleLabel || 'Scale';
    const full = s?.label || handpan.scaleLabel || short;
    toggle.textContent = short;
    toggle.title = full;
  }

  function render() {
    const handpan = getHandpan();
    if (!handpan) return;
    menu.replaceChildren();
    menu.classList.add('scale-browser');

    // Search row
    const searchRow = document.createElement('div');
    searchRow.className = 'scale-browser-search';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search';
    input.setAttribute('aria-label', 'Search scales');
    input.autocomplete = 'off';
    const filterBtn = document.createElement('button');
    filterBtn.type = 'button';
    filterBtn.className = 'scale-browser-filter';
    filterBtn.setAttribute('aria-label', 'Filter');
    filterBtn.textContent = '☰';
    searchRow.appendChild(input);
    searchRow.appendChild(filterBtn);
    menu.appendChild(searchRow);

    const grid = document.createElement('div');
    grid.className = 'scale-browser-grid';
    menu.appendChild(grid);

    function paint(filter = '') {
      grid.replaceChildren();
      const q = filter.trim().toLowerCase();
      HANDPAN_SCALES.forEach((scale, index) => {
        const label = scale.label || scale.short || '';
        if (q && !label.toLowerCase().includes(q)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'scale-menu-item' + (index === handpan.scaleIndex ? ' is-active' : '');
        button.setAttribute('role', 'menuitem');
        button.textContent = label;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          handpan.setScaleIndex(index);
          onScaleChange?.();
          render();
          updateLabel();
          if (window.PionierOverlay) window.PionierOverlay.closePickers();
          else {
            menu.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
          }
          toggle.focus?.();
        });
        grid.appendChild(button);
      });
    }

    paint();
    input.addEventListener('input', () => paint(input.value));
    // Keep focus in search when opening
    requestAnimationFrame(() => input.focus?.());
  }

  const mo = new MutationObserver(() => {
    if (!menu.hidden) render();
  });
  mo.observe(menu, { attributes: true, attributeFilter: ['hidden'] });

  document.addEventListener('pionier:picker-open', (e) => {
    if (e.detail?.id === 'scaleMenu') render();
  });

  updateLabel();
  return { render, updateLabel };
}
