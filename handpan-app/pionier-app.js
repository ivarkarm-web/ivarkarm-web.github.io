/**
 * Pionier app shell: load the vendored local core and optional UI modules.
 * No CDN fetch, source rewriting, Blob module, or runtime string patches.
 */
const BASE = new URL('.', import.meta.url).href;

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
  // The core and its imports are served from this same deployed repository.
  await import(new URL('./pionier-core.js?v=1', BASE).href);

  const pan = () => document.getElementById('pan');
  killCanvasGhosts(pan());
  requestAnimationFrame(() => killCanvasGhosts(pan()));

  const { HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js', BASE).href);
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

await boot();
