/** Native scale selector; the browser owns its option popup. */
import { HANDPAN_SCALES } from './instruments/handpan.js?v=10';

export function mountScaleSelector({ getHandpan, onScaleChange }) {
  const select = document.getElementById('scaleMenu');
  if (!select) return { render() {}, updateLabel() {} };

  function updateLabel() {
    const handpan = getHandpan();
    if (!handpan) return;
    const scale = HANDPAN_SCALES[handpan.scaleIndex];
    select.value = String(handpan.scaleIndex);
    select.title = scale?.label || handpan.scaleLabel || scale?.short || 'Scale';
  }

  function render() {
    const handpan = getHandpan();
    if (!handpan) return;
    const selected = String(handpan.scaleIndex);
    select.replaceChildren();
    let lastTuning = null;
    let group = null;
    HANDPAN_SCALES.forEach((scale, index) => {
      const tuning = scale.tuning || '12-TET';
      if (tuning !== lastTuning) {
        lastTuning = tuning;
        group = document.createElement('optgroup');
        group.label = tuning;
        select.appendChild(group);
      }
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = scale.label || scale.short || scale.id || ('Scale ' + (index + 1));
      group.appendChild(option);
    });
    select.value = selected;
  }

  select.addEventListener('change', () => {
    const handpan = getHandpan();
    const index = Number(select.value);
    if (!handpan || !Number.isInteger(index) || !HANDPAN_SCALES[index]) return;
    handpan.setScaleIndex(index);
    onScaleChange?.();
    updateLabel();
  });

  render();
  updateLabel();
  return { render, updateLabel };
}
