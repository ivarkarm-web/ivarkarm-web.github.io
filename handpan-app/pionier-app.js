/**
 * pionier-app.js — load instrument core + wire scale selector + anti-ghost touch
 */
const GOOD = 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@3984a53f1bdd04e93a9b4a8abf86a504fe78bf5f/handpan-app/pionier-app.js';
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

  canvas.addEventListener('dragstart', (e) => {
    try {
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'none';
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
      }
    } catch (_) {}
    e.preventDefault();
  }, true);
}

async function boot() {
  const res = await fetch(GOOD);
  if (!res.ok) throw new Error('failed to load base app ' + res.status);
  let src = await res.text();

  src = src.replace(
    /from\s+(['"])(\.?\/?[^'"]+)\1/g,
    (m, q, path) => {
      const abs = new URL(path, BASE).href;
      return `from ${q}${abs}${q}`;
    }
  );

  const blob = new Blob([src], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);

  const pan = () => document.getElementById('pan');
  killCanvasGhosts(pan());
  requestAnimationFrame(() => killCanvasGhosts(pan()));

  const { HANDPAN_SCALES } = await import(new URL('./js/instruments/handpan.js', BASE).href);
  const scaleLabel = document.getElementById('scaleLabel');
  const scaleMenu = document.getElementById('scaleMenu');
  if (!scaleLabel || !scaleMenu || !HANDPAN_SCALES) return;

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
    if (open) {
      requestAnimationFrame(() => {
        scaleMenu.querySelector('.scale-menu-item.is-active')?.scrollIntoView({ block: 'nearest' });
      });
    }
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

boot().catch((err) => console.error('Pionier boot failed', err));
