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
    toggle.textContent = short + ' ▾';
    toggle.title = full;
  }

  function render() {
    const handpan = getHandpan();
    if (!handpan) return;
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
        if (window.PionierOverlay) window.PionierOverlay.closePickers();
        else {
          menu.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
        toggle.focus?.();
      });
      menu.appendChild(button);
    });
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
