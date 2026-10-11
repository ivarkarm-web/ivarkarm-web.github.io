/**
 * pionier-app.js — load instrument core + scale selector + backdrop + looper
 */
const GOOD = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@3984a53f1bdd04e93a9b4a8abf86a504fe78bf5f/handpan-app/pionier-app.js';
const BASE = new URL('.', import.meta.url).href;

// Cache-busting for the modules changed by the 9→13 note feature. Every
// importer of a module must use the same query, or the browser would load two
// separate copies of it.
const SURFACE_V = '94';
const HANDPAN_V = '1';

/**
 * Changes applied to the pinned base app so it can run 9–13 notes.
 * Each anchor is matched exactly; a missing anchor is logged, not fatal.
 */
const CORE_PATCHES = [
  [
    "   inst.noteOn(gesture, hit);\n   if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);",
    "   inst.noteOn(gesture, hit);\n   window.dispatchEvent(new CustomEvent('pionier:learn-note', { detail: { index: hit.index, at: performance.now() } }));\n   if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);"
  ],
  // Keyboard keys for notes 10–13.
  [
    "const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];",
    "const KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd'];"
  ],
  // Playable pads follow the handpan's current note count (other voices stay at 9).
  [
    'return fieldIndex >= 0 && fieldIndex <= 8;',
    'return fieldIndex >= 0 && fieldIndex < padCount();'
  ],
  [
    'surface.layoutHandpanFields(notes, isFieldPlayable);',
    'surface.layoutHandpanFields(notes.slice(0, padCount()), isFieldPlayable);'
  ],
  [
    'tap tonefields or Q–O (hold',
    'tap tonefields or Q–O, P, A, S, D (hold'
  ]
];

/** Appended to the base app so the "+" button can reach its internals. */
const CORE_TAIL = `
function padCount() {
  // Shared note count for the full instrument library.
  return handpan.noteCount || 9;
}
function changeNoteCount(delta) {
  const before = handpan.noteCount || 9;
  const after = Math.max(9, Math.min(13, before + delta));
  if (after === before) return false;
  handpan.setNoteCount(after);
  if (typeof surface.armTransition === 'function') surface.armTransition();
  syncWorldPitch();
  layoutFields();
  const active = activeInstrument();
  if (active && active.glow) {
    for (let i = 0; i < active.glow.length; i++) active.glow[i] = i === after - 1 ? 1 : 0;
  }
  if (active && active.zoneFlash && after > before && after - 1 < active.zoneFlash.length) active.zoneFlash[after - 1] = 0.3;
  updateLabels();
  draw();
  return true;
}
window.PionierCore = {
  handpan,
  surface,
  activeInstrument: () => activeInstrument(),
  draw() { draw(); },
  addNote() { return changeNoteCount(1); },
  removeNote() { return changeNoteCount(-1); },
  noteCount: () => padCount()
};
`;

function patchCore(src) {
  for (const [from, to] of CORE_PATCHES) {
    if (!src.includes(from)) {
      console.warn('[pionier] core patch anchor not found:', from.slice(0, 48));
      continue;
    }
    src = src.split(from).join(to);
  }
  if (/\nboot\(\);\s*$/.test(src)) {
    src = src.replace(/\nboot\(\);\s*$/, '\n' + CORE_TAIL + '\nboot();\n');
  } else {
    console.warn('[pionier] core tail anchor not found; note button disabled');
  }
  return src;
}

function killCanvasGhosts(canvas) {
  if (!canvas || canvas.dataset.ghostKill === '1') return;
  canvas.dataset.ghostKill = '1';
  canvas.draggable = false;
  canvas.setAttribute('draggable', 'false');
  try {
    canvas.style.webkitUserDrag = 'none';
    canvas.style.userDrag = 'none';
    canvas.style.webkitTouchCallout = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.touchAction = 'none';
  } catch (_) {}
  const block = (e) => { e.preventDefault(); };
  canvas.addEventListener('dragstart', block, true);
  canvas.addEventListener('drag', block, true);
  canvas.addEventListener('selectstart', block, true);
  canvas.addEventListener('contextmenu', block, true);
}

async function boot() {
  const res = await fetch(GOOD);
  if (!res.ok) throw new Error('failed to load base app ' + res.status);
  let src = await res.text();

  src = patchCore(src);

  src = src.split('tonal-family.js?v=5').join('tonal-family.js?v=6');
  src = src.split('pionier-surface.js?v=28').join('pionier-surface.js?v=' + SURFACE_V);
  src = src.split("'./js/pionier-surface.js'").join("'./js/pionier-surface.js?v=" + SURFACE_V + "'");
  src = src.split('"./js/pionier-surface.js"').join('"./js/pionier-surface.js?v=' + SURFACE_V + '"');

  src = src.replace(
    /from\s+(['"])(\.?\/?[^'"]+)\1/g,
    (m, q, path) => {
      const abs = new URL(path, BASE);
      if (String(path).includes('pionier-surface')) abs.searchParams.set('v', SURFACE_V);
      if (String(path).includes('instruments/handpan.js')) abs.searchParams.set('v', HANDPAN_V);
      return 'from ' + q + abs.href + q;
    }
  );

  const blob = new Blob([src], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);

  const pan = () => document.getElementById('pan');
  killCanvasGhosts(pan());
  requestAnimationFrame(() => killCanvasGhosts(pan()));

  const { HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js?v=' + HANDPAN_V, BASE).href);
  const scaleLabel = document.getElementById('scaleLabel');
  const scaleMenu = document.getElementById('scaleMenu');
  if (scaleLabel && scaleMenu && HANDPAN_SCALES) {
    function renderMenu() {
      scaleMenu.replaceChildren();
      let lastTuning = null;
      HANDPAN_SCALES.forEach((scale) => {
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
          const nextBtn = document.getElementById('scaleNext');
          const target = scale.label;
          let guard = 0;
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
    }

    renderMenu();

    scaleLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      const instMenu = document.getElementById('instrumentMenu');
      if (instMenu) instMenu.hidden = true;
      const open = scaleMenu.hidden;
      scaleMenu.hidden = !open;
      scaleLabel.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (scaleMenu.hidden) return;
      if (e.target.closest('#scaleMenu') || e.target.closest('#scaleLabel')) return;
      scaleMenu.hidden = true;
      scaleLabel.setAttribute('aria-expanded', 'false');
    });

    document.getElementById('instrumentDropdownToggle')?.addEventListener('click', () => {
      scaleMenu.hidden = true;
      scaleLabel.setAttribute('aria-expanded', 'false');
    });

    const mark = () => {
      const t = scaleLabel.textContent || '';
      if (!t.includes('▾')) scaleLabel.textContent = t.trim() + ' ▾';
    };
    document.getElementById('scalePrev')?.addEventListener('click', () => setTimeout(mark, 0));
    document.getElementById('scaleNext')?.addEventListener('click', () => setTimeout(mark, 0));
    mark();
  }

  try {
    const { mountNotePlus } = await import(
      new URL('./js/note-plus.js?v=2', BASE).href
    );
    mountNotePlus();
  } catch (err) {
    console.warn('[note-plus] mount failed', err);
  }

  try {
    const { mountBackdropPlayer } = await import(
      new URL('./js/backdrop-player.js?v=96', BASE).href
    );
    mountBackdropPlayer();
  } catch (err) {
    console.warn('[backdrop] mount failed', err);
  }

  try {
    const { mountLooper } = await import(
      new URL('./js/looper.js?v=106', BASE).href
    );
    mountLooper();
  } catch (err) {
    console.warn('[looper] mount failed', err);
  }
}

boot().catch((err) => console.error('Pionier boot failed', err));
