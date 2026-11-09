/** Scale picker — native <select> (decision: native menus), behavior preserved. */
import { HANDPAN_SCALES, SCALE_FAMILIES } from './instruments/handpan-scales.js';

export function mountScaleSelector({ getHandpan, onScaleChange }) {
  const menu = document.getElementById('scaleMenu');
  const toggle = document.getElementById('scaleLabel');
  if (!menu || !toggle) {
    return { render() {}, updateLabel() {} };
  }

  let select = menu.querySelector('select[data-scale-native]');
  if (!select) {
    select = document.createElement('select');
    select.dataset.scaleNative = '1';
    select.className = 'pionier-native-select scale-native-select';
    select.setAttribute('aria-label', 'Choose scale');
    select.style.width = '100%';
    select.style.minHeight = '44px';
    menu.appendChild(select);
  }
  menu.hidden = true;

  function updateLabel() {
    const handpan = getHandpan();
    if (!handpan) return;
    const s = HANDPAN_SCALES[handpan.scaleIndex];
    let short = s?.short || s?.label || handpan.scaleLabel || 'Scale';
    const full = s?.label || handpan.scaleLabel || short;
    const root = handpan.rootLabel || '';
    if (root && short.startsWith(root + ' ')) short = short.slice(root.length).trim();
    toggle.textContent = short + ' ▾';
    toggle.title = full;
    const rootLabel = document.getElementById('rootLabel');
    if (rootLabel && root) rootLabel.textContent = root;
    if (select && Number.isFinite(handpan.scaleIndex)) select.value = String(handpan.scaleIndex);
  }

  function render() {
    const handpan = getHandpan();
    if (!handpan) return;
    select.replaceChildren();
    for (const family of SCALE_FAMILIES) {
      const members = HANDPAN_SCALES.filter((s) => s.family === family);
      if (!members.length) continue;
      const group = document.createElement('optgroup');
      group.label = family;
      members.forEach((scale) => {
        const globalIndex = HANDPAN_SCALES.indexOf(scale);
        const opt = document.createElement('option');
        opt.value = String(globalIndex);
        opt.textContent = scale.label + (scale.mood ? ' — ' + scale.mood : '');
        if (globalIndex === handpan.scaleIndex) opt.selected = true;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
  }

  function applyIndex(idx) {
    const handpan = getHandpan();
    if (!handpan) return;
    handpan.setScaleIndex(idx);
    onScaleChange?.();
    updateLabel();
  }

  select.addEventListener('change', () => applyIndex(+select.value));

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    render();
    // On mobile, programmatic open isn't possible; focusing + showing the select works.
    menu.hidden = false;
    menu.style.position = 'absolute';
    menu.style.zIndex = '60';
    select.focus();
    try { select.showPicker?.(); } catch (_) {}
  });

  select.addEventListener('blur', () => {
    setTimeout(() => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }, 150);
  });
  select.addEventListener('change', () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });

  function stepScale(delta) {
    const handpan = getHandpan();
    if (!handpan || !HANDPAN_SCALES.length) return;
    handpan.setScaleIndex(handpan.scaleIndex + delta);
    onScaleChange?.();
    render();
    updateLabel();
  }
  document.getElementById('scalePrev')?.addEventListener('click', () => stepScale(-1));
  document.getElementById('scaleNext')?.addEventListener('click', () => stepScale(1));

  render();
  updateLabel();
  return { render, updateLabel };
}
