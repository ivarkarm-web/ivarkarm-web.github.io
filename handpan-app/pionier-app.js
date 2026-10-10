/**
 * pionier-app.js — load last good instrument surface, then wire scale selector
 */
const GOOD = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@3984a53f1bdd04e93a9b4a8abf86a504fe78bf5f/handpan-app/pionier-app.js';

async function boot() {
  const res = await fetch(GOOD);
  if (!res.ok) throw new Error('failed to load base app ' + res.status);
  const src = await res.text();
  const blob = new Blob([src], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);

  // Wire scale selector after base app has initialized globals via module side-effects.
  // Base module does not export; we re-import scale selector and mount against DOM.
  const { mountScaleSelector } = await import('./js/scale-selector.js');
  const { HandpanInstrument, HANDPAN_SCALES } = await import('./js/instruments/handpan.js');

  // Find the handpan instance used by the base app is not exported.
  // Instead, drive scale changes through the existing prev/next buttons + rebuild.
  // Mount dropdown so it calls the same scale index setters via DOM events.
  const scaleLabel = document.getElementById('scaleLabel');
  const scaleMenu = document.getElementById('scaleMenu');
  if (!scaleLabel || !scaleMenu) return;

  // Create a thin adapter: on select, click through scalePrev/Next to reach target index is fragile.
  // Prefer dispatching scale changes by simulating the stepper after setting via exposed path.
  // The base app keeps handpan private. So we rebuild the menu to fire scalePrev/scaleNext N times — not ideal.
  // Better: re-bind scaleLabel click to open menu, and on item click set location hash then reload — bad UX.

  // Practical approach: the base file already has scalePrev/scaleNext wired.
  // We mount the selector to update the label display and use programmatic clicks on scaleNext/Prev.
  let currentIndex = 0;
  try {
    const short = (scaleLabel.textContent || '').replace(/\s*▾\s*$/, '').trim();
    // leave currentIndex 0; user can step
  } catch (_) {}

  function openMenu() {
    scaleMenu.hidden = !scaleMenu.hidden;
    scaleLabel.setAttribute('aria-expanded', scaleMenu.hidden ? 'false' : 'true');
  }

  // Build menu from HANDPAN_SCALES
  scaleMenu.replaceChildren();
  let lastTuning = null;
  HANDPAN_SCALES.forEach((scale, index) => {
    const tuning = scale.tuning || '12-TET';
    if (tuning !== lastTuning) {
      lastTuning = tuning;
      const head = document.createElement('div');
      head.className = 'scale-menu-group';
      head.textContent = tuning;
      scaleMenu.appendChild(head);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scale-menu-item';
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
      // Step from current to target using existing wired buttons
      const prevBtn = document.getElementById('scalePrev');
      const nextBtn = document.getElementById('scaleNext');
      // We don't know current index precisely; step next until label matches, max 60
      let guard = 0;
      const target = scale.label;
      while (guard++ < HANDPAN_SCALES.length + 2) {
        const cur = (scaleLabel.textContent || '').replace(/\s*▾\s*$/, '').split('·')[0].trim();
        if (cur === target || (scaleLabel.textContent || '').includes(target)) break;
        nextBtn?.click();
      }
      scaleLabel.textContent = scale.label + ' ▾';
      scaleMenu.hidden = true;
      scaleLabel.setAttribute('aria-expanded', 'false');
    });
    scaleMenu.appendChild(button);
  });

  scaleLabel.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('instrumentMenu') && (document.getElementById('instrumentMenu').hidden = true);
    openMenu();
  });
  document.addEventListener('click', (e) => {
    if (scaleMenu.hidden) return;
    if (e.target.closest('#scaleMenu') || e.target.closest('#scaleLabel')) return;
    scaleMenu.hidden = true;
    scaleLabel.setAttribute('aria-expanded', 'false');
  });
}

boot().catch((err) => console.error('Pionier boot failed', err));
