/**
 * scale-selector.js — dropdown scale picker UI
 */
import { HANDPAN_SCALES } from './instruments/handpan.js';

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
    const s = HANDPAN_SCALES[handpan.scaleIndex];
    const short = s?.label || handpan.scaleLabel || 'Scale';
    toggle.textContent = short + ' ▾';
    toggle.title = handpan.scaleLabel || short;
  }

  function render() {
    const handpan = getHandpan();
    menu.replaceChildren();
    let lastTuning = null;
    HANDPAN_SCALES.forEach((scale, index) => {
      const tuning = scale.tuning || '12-TET';
      if (tuning !== lastTuning) {
        lastTuning = tuning;
        const head = document.createElement('div');
        head.className = 'scale-menu-group';
        head.textContent = tuning;
        menu.appendChild(head);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scale-menu-item' + (index === handpan.scaleIndex ? ' is-active' : '');
      button.setAttribute('role', 'menuitem');
      const name = document.createElement('span');
      name.textContent = scale.label;
      button.appendChild(name);
      if (tuning !== '12-TET') {
        const sub = document.createElement('span');
        sub.className = 'scale-item-tuning';
        sub.textContent = tuning;
        button.appendChild(sub);
      }
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        handpan.setScaleIndex(index);
        onScaleChange?.();
        render();
        updateLabel();
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(button);
    });
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const instMenu = document.getElementById('instrumentMenu');
    if (instMenu) instMenu.hidden = true;
    render();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      requestAnimationFrame(() => {
        menu.querySelector('.scale-menu-item.is-active')?.scrollIntoView({ block: 'nearest' });
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (e.target.closest('#scaleMenu') || e.target.closest('#scaleLabel')) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });

  // Close scale menu when instrument menu opens
  document.getElementById('instrumentDropdownToggle')?.addEventListener('click', () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });

  updateLabel();
  return { render, updateLabel };
}
